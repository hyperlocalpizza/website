/**
 * VIPizza — Admin / Kitchen dashboard logic.
 * Handles Supabase Auth (email/password), a realtime order feed, and
 * single-click order status updates.
 */
(function () {
  "use strict";

  const getClient = window.VIPizza.getClient;
  const {
    formatPrice,
    escapeHtml,
    formatTime,
    formatDateTime,
    STATUS_LABELS,
    STATUS_FLOW,
    nextStatus,
    playChime,
    toast
  } = window.VIPizza.utils;
  const i18n = window.VIPizza.i18n;
  const t = (key, vars) => i18n.t(key, vars);

  // ---------------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------------
  const els = {
    loginView: document.getElementById("login-view"),
    dashboardView: document.getElementById("dashboard-view"),
    loginForm: document.getElementById("login-form"),
    loginEmail: document.getElementById("login-email"),
    loginPassword: document.getElementById("login-password"),
    loginError: document.getElementById("login-error"),
    loginBtn: document.getElementById("login-btn"),
    logoutBtn: document.getElementById("logout-btn"),
    userEmail: document.getElementById("user-email"),
    connectionStatus: document.getElementById("connection-status"),
    ordersFeed: document.getElementById("orders-feed"),
    statActive: document.getElementById("stat-active"),
    statToday: document.getElementById("stat-today"),
    slotsFeed: document.getElementById("slots-feed"),
    slotAddBtn: document.getElementById("slot-add-btn"),
    inventoryFeed: document.getElementById("inventory-feed"),
    inventoryAddBtn: document.getElementById("inventory-add-btn"),
    menuFeed: document.getElementById("menu-feed"),
    menuAddBtn: document.getElementById("menu-add-btn"),
    editorModal: document.getElementById("editor-modal"),
    editorTitle: document.getElementById("editor-title"),
    editorForm: document.getElementById("editor-form"),
    editorFields: document.getElementById("editor-fields"),
    editorError: document.getElementById("editor-error"),
    editorSubmit: document.getElementById("editor-submit")
  };

  let orders = [];
  let slots = [];
  let inventory = [];
  let menuItems = [];
  let categories = [];
  let channel = null;
  let editorContext = null; // { kind, id }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  function showLogin() {
    els.loginView.hidden = false;
    els.dashboardView.hidden = true;
  }

  function showDashboard() {
    els.loginView.hidden = true;
    els.dashboardView.hidden = false;
  }

  function setConnection(status, ok) {
    els.connectionStatus.textContent = status;
    els.connectionStatus.classList.toggle("is-online", ok === true);
    els.connectionStatus.classList.toggle("is-offline", ok === false);
  }

  async function handleLogin(event) {
    event.preventDefault();
    els.loginError.hidden = true;
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;

    if (!email || !password) {
      showLoginError(t("admin.login.err.empty"));
      return;
    }

    els.loginBtn.disabled = true;
    els.loginBtn.textContent = t("admin.login.signing");

    try {
      const { error } = await getClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      await onAuthenticated();
    } catch (err) {
      console.error("Login failed:", err);
      showLoginError(t("admin.login.err.invalid"));
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = t("admin.login.btn");
    }
  }

  function showLoginError(message) {
    els.loginError.textContent = message;
    els.loginError.hidden = false;
  }

  async function handleLogout() {
    await getClient().auth.signOut();
    teardownRealtime();
    orders = [];
    showLogin();
  }

  async function onAuthenticated() {
    const { data: { user } } = await getClient().auth.getUser();
    if (user) {
      els.userEmail.textContent = user.email || "";
      showDashboard();
      await Promise.all([loadOrders(), loadSlots(), loadInventory(), loadMenu()]);
      setupRealtime();
    }
  }

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------
  function switchTab(tabName) {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.tab === tabName);
    });
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.toggle("is-active", view.id === `view-${tabName}`);
    });
  }

  // ---------------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------------
  function renderOrders() {
    if (!orders.length) {
      els.ordersFeed.innerHTML = `<p class="empty-state">${t("admin.orders.empty")}</p>`;
      els.statActive.textContent = "0";
      els.statToday.textContent = "0";
      return;
    }

    const active = orders.filter((o) => !["completed", "cancelled"].includes(o.status));
    const today = orders.filter((o) => {
      const d = new Date(o.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    });

    els.statActive.textContent = active.length;
    els.statToday.textContent = today.length;

    els.ordersFeed.innerHTML = orders
      .map((order) => {
        const items = order.order_items || [];
        const itemsHtml = items.length
          ? items
              .map(
                (item) => `
              <li class="order-item-line">
                <span class="order-item-qty">${item.quantity}×</span>
                <span class="order-item-name">${escapeHtml(item.item_name)}</span>
                <span class="order-item-price">${formatPrice(item.unit_price * item.quantity)}</span>
              </li>
            `
              )
              .join("")
          : `<li class="order-item-line">—</li>`;

        const next = nextStatus(order.status);
        const isTerminal = ["completed", "cancelled"].includes(order.status);
        const slotLabel = order.slot_id && slots.length
          ? slots.find((s) => s.id === order.slot_id)?.start_time
          : null;
        const deliveryLabel = order.delivery_type === "delivery" ? t("admin.orders.delivery") : t("admin.orders.pickup");

        return `
        <article class="order-card ${isTerminal ? "order-card--muted" : ""}" data-id="${order.id}">
          <div class="order-card-head">
            <div class="order-card-id">
              <span class="order-tracking">#${escapeHtml(order.tracking_id)}</span>
              <span class="order-time">${formatTime(order.created_at)}</span>
            </div>
            <span class="order-status status--${order.status}">${STATUS_LABELS[order.status] || order.status}</span>
          </div>

          <div class="order-customer">
            <span class="order-customer-name">${escapeHtml(order.customer_name)}</span>
            <span class="order-customer-meta">
              ${order.delivery_type === "delivery" ? "🚚" : "🛍️"} ${deliveryLabel}
              ${slotLabel ? ` · 🕐 ${slotLabel}` : ""}
              ${order.address ? ` · ${escapeHtml(order.address)}` : ""}
            </span>
            <span class="order-customer-phone">📞 ${escapeHtml(order.phone)}</span>
          </div>

          <ul class="order-items">${itemsHtml}</ul>

          ${order.notes ? `<p class="order-notes">📝 ${escapeHtml(order.notes)}</p>` : ""}

          <div class="order-card-foot">
            <span class="order-total">${t("admin.orders.total")} <strong>${formatPrice(order.total_amount)}</strong></span>
            <div class="order-actions">
              ${next ? `<button class="btn btn-primary btn-sm" data-action="advance" data-next="${next}">${t("admin.orders.advance", { next: STATUS_LABELS[next] })}</button>` : ""}
              ${!isTerminal ? `<button class="btn btn-danger btn-sm" data-action="cancel">${t("admin.orders.cancel")}</button>` : ""}
            </div>
          </div>
        </article>
      `;
      })
      .join("");
  }

  async function loadOrders() {
    try {
      const { data, error } = await getClient()
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      orders = data || [];
      renderOrders();
    } catch (err) {
      console.error("Failed to load orders:", err);
      toast(t("admin.orders.loadError"), "error");
    }
  }

  async function updateOrderStatus(orderId, status) {
    try {
      const { error } = await getClient()
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if (error) throw error;
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        order.status = status;
        renderOrders();
      }
    } catch (err) {
      console.error("Failed to update order:", err);
      toast("Impossibile aggiornare lo stato.", "error");
    }
  }

  // ---------------------------------------------------------------------------
  // Slots
  // ---------------------------------------------------------------------------
  function renderSlots() {
    if (!slots.length) {
      els.slotsFeed.innerHTML = `<p class="empty-state">${t("admin.slots.empty")}</p>`;
      return;
    }
    els.slotsFeed.innerHTML = slots
      .map((slot) => {
        const remaining = slot.max_pizzas - slot.reserved_pizzas;
        const pct = slot.max_pizzas > 0 ? Math.round((slot.reserved_pizzas / slot.max_pizzas) * 100) : 0;
        return `
        <article class="slot-card" data-id="${slot.id}">
          <div class="slot-card-head">
            <span class="slot-time">🕐 ${escapeHtml(slot.start_time)}</span>
            <span class="slot-badge ${slot.is_active ? "is-on" : "is-off"}">${slot.is_active ? t("admin.slots.active") : t("admin.slots.inactive")}</span>
          </div>
          <div class="slot-meter">
            <div class="slot-meter-fill" style="width:${pct}%"></div>
          </div>
          <p class="slot-capacity">${t("admin.slots.capacity", { reserved: slot.reserved_pizzas, max: slot.max_pizzas, remaining })}</p>
          <div class="slot-actions">
            <button class="btn btn-outline btn-sm" data-action="toggle">${slot.is_active ? t("admin.slots.toggleOn") : t("admin.slots.toggleOff")}</button>
            <button class="btn btn-outline btn-sm" data-action="edit">${t("admin.slots.edit")}</button>
            <button class="btn btn-danger btn-sm" data-action="delete">${t("admin.slots.delete")}</button>
          </div>
        </article>
      `;
      })
      .join("");
  }

  async function loadSlots() {
    try {
      const { data, error } = await getClient()
        .from("slots")
        .select("*")
        .order("start_time");
      if (error) throw error;
      slots = (data || []).map((s) => ({ ...s, start_time: s.start_time.slice(0, 5) }));
      renderSlots();
    } catch (err) {
      console.error("Failed to load slots:", err);
      toast(t("admin.slots.loadError"), "error");
    }
  }

  async function toggleSlot(id) {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    try {
      const { error } = await getClient()
        .from("slots")
        .update({ is_active: !slot.is_active })
        .eq("id", id);
      if (error) throw error;
      slot.is_active = !slot.is_active;
      renderSlots();
    } catch (err) {
      console.error("Failed to toggle slot:", err);
      toast(t("admin.slots.loadError"), "error");
    }
  }

  async function deleteSlot(id) {
    if (!confirm(t("admin.slots.deleteConfirm"))) return;
    try {
      const { error } = await getClient().from("slots").delete().eq("id", id);
      if (error) throw error;
      slots = slots.filter((s) => s.id !== id);
      renderSlots();
      toast(t("admin.slots.deleted"), "success");
    } catch (err) {
      console.error("Failed to delete slot:", err);
      toast(t("admin.slots.loadError"), "error");
    }
  }

  // ---------------------------------------------------------------------------
  // Inventory
  // ---------------------------------------------------------------------------
  function renderInventory() {
    if (!inventory.length) {
      els.inventoryFeed.innerHTML = `<p class="empty-state">${t("admin.inv.empty")}</p>`;
      return;
    }
    els.inventoryFeed.innerHTML = inventory
      .map((item) => {
        const low = item.quantity <= item.low_threshold;
        return `
        <article class="inventory-card ${low ? "is-low" : ""}" data-id="${item.id}">
          <div class="inventory-card-head">
            <span class="inventory-name">${escapeHtml(item.name)}</span>
            <span class="inventory-badge ${low ? "is-low" : "is-ok"}">${low ? t("admin.inv.low") : t("admin.inv.ok")}</span>
          </div>
          <p class="inventory-qty"><strong>${item.quantity}</strong> ${escapeHtml(item.unit)}</p>
          <p class="inventory-threshold">${t("admin.inv.threshold", { value: item.low_threshold, unit: escapeHtml(item.unit) })}</p>
          <div class="inventory-actions">
            <button class="btn btn-outline btn-sm" data-action="edit">${t("admin.inv.edit")}</button>
            <button class="btn btn-danger btn-sm" data-action="delete">${t("admin.inv.delete")}</button>
          </div>
        </article>
      `;
      })
      .join("");
  }

  async function loadInventory() {
    try {
      const { data, error } = await getClient()
        .from("inventory")
        .select("*")
        .order("name");
      if (error) throw error;
      inventory = data || [];
      renderInventory();
    } catch (err) {
      console.error("Failed to load inventory:", err);
      toast(t("admin.inv.loadError"), "error");
    }
  }

  async function deleteInventory(id) {
    if (!confirm(t("admin.inv.deleteConfirm"))) return;
    try {
      const { error } = await getClient().from("inventory").delete().eq("id", id);
      if (error) throw error;
      inventory = inventory.filter((i) => i.id !== id);
      renderInventory();
      toast(t("admin.inv.deleted"), "success");
    } catch (err) {
      console.error("Failed to delete inventory:", err);
      toast(t("admin.inv.loadError"), "error");
    }
  }

  // ---------------------------------------------------------------------------
  // Menu
  // ---------------------------------------------------------------------------
  function renderMenu() {
    if (!menuItems.length) {
      els.menuFeed.innerHTML = `<p class="empty-state">${t("admin.menu.empty")}</p>`;
      return;
    }
    els.menuFeed.innerHTML = menuItems
      .map((item) => {
        const cat = categories.find((c) => c.id === item.category_id);
        return `
        <article class="menu-card" data-id="${item.id}">
          <div class="menu-card-head">
            <span class="menu-item-name">${escapeHtml(item.name)}</span>
            <span class="menu-item-price">${formatPrice(item.price)}</span>
          </div>
          <p class="menu-item-desc">${escapeHtml(item.description || "")}</p>
          <p class="menu-item-meta">
            ${cat ? `<span class="menu-item-cat">${escapeHtml(cat.name)}</span>` : ""}
            <span class="menu-item-avail ${item.is_available ? "is-on" : "is-off"}">${item.is_available ? t("admin.menu.available") : t("admin.menu.unavailable")}</span>
          </p>
          <div class="menu-actions">
            <button class="btn btn-outline btn-sm" data-action="toggle">${item.is_available ? t("admin.menu.hide") : t("admin.menu.show")}</button>
            <button class="btn btn-outline btn-sm" data-action="edit">${t("admin.menu.edit")}</button>
            <button class="btn btn-danger btn-sm" data-action="delete">${t("admin.menu.delete")}</button>
          </div>
        </article>
      `;
      })
      .join("");
  }

  async function loadMenu() {
    try {
      const [{ data: cats, error: catError }, { data: items, error: itemError }] =
        await Promise.all([
          getClient().from("categories").select("*").order("sort_order"),
          getClient().from("menu_items").select("*").order("name")
        ]);
      if (catError) throw catError;
      if (itemError) throw itemError;
      categories = cats || [];
      menuItems = items || [];
      renderMenu();
    } catch (err) {
      console.error("Failed to load menu:", err);
      toast(t("admin.menu.loadError"), "error");
    }
  }

  async function toggleMenuItem(id) {
    const item = menuItems.find((i) => i.id === id);
    if (!item) return;
    try {
      const { error } = await getClient()
        .from("menu_items")
        .update({ is_available: !item.is_available })
        .eq("id", id);
      if (error) throw error;
      item.is_available = !item.is_available;
      renderMenu();
    } catch (err) {
      console.error("Failed to toggle menu item:", err);
      toast(t("admin.menu.loadError"), "error");
    }
  }

  async function deleteMenuItem(id) {
    if (!confirm(t("admin.menu.deleteConfirm"))) return;
    try {
      const { error } = await getClient().from("menu_items").delete().eq("id", id);
      if (error) throw error;
      menuItems = menuItems.filter((i) => i.id !== id);
      renderMenu();
      toast(t("admin.menu.deleted"), "success");
    } catch (err) {
      console.error("Failed to delete menu item:", err);
      toast(t("admin.menu.loadError"), "error");
    }
  }

  // ---------------------------------------------------------------------------
  // Editor modal (add / edit for slots, inventory, menu)
  // ---------------------------------------------------------------------------
  function openEditor(kind, id) {
    editorContext = { kind, id };
    els.editorError.hidden = true;
    els.editorFields.innerHTML = "";

    if (kind === "slot") {
      const slot = id ? slots.find((s) => s.id === id) : null;
      els.editorTitle.textContent = slot ? t("admin.editor.slot.edit") : t("admin.editor.slot.new");
      els.editorFields.innerHTML = `
        <label class="field"><span>${t("admin.editor.slot.time")}</span><input type="time" id="f-start" value="${slot ? slot.start_time : "18:00"}" required /></label>
        <label class="field"><span>${t("admin.editor.slot.capacity")}</span><input type="number" id="f-max" min="1" value="${slot ? slot.max_pizzas : 10}" required /></label>
        <label class="field"><span>${t("admin.editor.slot.reserved")}</span><input type="number" id="f-reserved" min="0" value="${slot ? slot.reserved_pizzas : 0}" required /></label>
        <label class="field"><span>${t("admin.editor.slot.active")}</span><select id="f-active"><option value="true" ${!slot || slot.is_active ? "selected" : ""}>${t("admin.editor.slot.yes")}</option><option value="false" ${slot && !slot.is_active ? "selected" : ""}>${t("admin.editor.slot.no")}</option></select></label>
      `;
    } else if (kind === "inventory") {
      const item = id ? inventory.find((i) => i.id === id) : null;
      els.editorTitle.textContent = item ? t("admin.editor.inv.edit") : t("admin.editor.inv.new");
      els.editorFields.innerHTML = `
        <label class="field"><span>${t("admin.editor.inv.name")}</span><input type="text" id="f-name" value="${item ? escapeHtml(item.name) : ""}" required /></label>
        <label class="field"><span>${t("admin.editor.inv.unit")}</span><select id="f-unit">
          <option value="pz" ${!item || item.unit === "pz" ? "selected" : ""}>pz</option>
          <option value="kg" ${item && item.unit === "kg" ? "selected" : ""}>kg</option>
          <option value="g" ${item && item.unit === "g" ? "selected" : ""}>g</option>
          <option value="l" ${item && item.unit === "l" ? "selected" : ""}>l</option>
          <option value="ml" ${item && item.unit === "ml" ? "selected" : ""}>ml</option>
        </select></label>
        <label class="field"><span>${t("admin.editor.inv.qty")}</span><input type="number" id="f-qty" min="0" step="0.01" value="${item ? item.quantity : 0}" required /></label>
        <label class="field"><span>${t("admin.editor.inv.threshold")}</span><input type="number" id="f-threshold" min="0" step="0.01" value="${item ? item.low_threshold : 0}" required /></label>
      `;
    } else if (kind === "menu") {
      const item = id ? menuItems.find((i) => i.id === id) : null;
      els.editorTitle.textContent = item ? t("admin.editor.menu.edit") : t("admin.editor.menu.new");
      const catOptions = categories
        .map((c) => `<option value="${c.id}" ${item && item.category_id === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
        .join("");
      els.editorFields.innerHTML = `
        <label class="field"><span>${t("admin.editor.menu.name")}</span><input type="text" id="f-name" value="${item ? escapeHtml(item.name) : ""}" required /></label>
        <label class="field"><span>${t("admin.editor.menu.category")}</span><select id="f-category"><option value="">—</option>${catOptions}</select></label>
        <label class="field"><span>${t("admin.editor.menu.desc")}</span><textarea id="f-desc" rows="2">${item ? escapeHtml(item.description || "") : ""}</textarea></label>
        <label class="field"><span>${t("admin.editor.menu.price")}</span><input type="number" id="f-price" min="0" step="0.01" value="${item ? item.price : ""}" required /></label>
        <label class="field"><span>${t("admin.editor.menu.available")}</span><select id="f-available"><option value="true" ${!item || item.is_available ? "selected" : ""}>${t("admin.editor.slot.yes")}</option><option value="false" ${item && !item.is_available ? "selected" : ""}>${t("admin.editor.slot.no")}</option></select></label>
      `;
    }

    els.editorModal.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeEditor() {
    els.editorModal.hidden = true;
    document.body.classList.remove("no-scroll");
    editorContext = null;
  }

  function showEditorError(message) {
    els.editorError.textContent = message;
    els.editorError.hidden = false;
  }

  async function handleEditorSubmit(event) {
    event.preventDefault();
    els.editorError.hidden = true;
    if (!editorContext) return;
    const { kind, id } = editorContext;

    try {
      if (kind === "slot") {
        const payload = {
          start_time: els.editorFields.querySelector("#f-start").value,
          max_pizzas: Number(els.editorFields.querySelector("#f-max").value),
          reserved_pizzas: Number(els.editorFields.querySelector("#f-reserved").value),
          is_active: els.editorFields.querySelector("#f-active").value === "true"
        };
        if (id) {
          const { error } = await getClient().from("slots").update(payload).eq("id", id);
          if (error) throw error;
        } else {
          const { error } = await getClient().from("slots").insert(payload);
          if (error) throw error;
        }
        await loadSlots();
      } else if (kind === "inventory") {
        const payload = {
          name: els.editorFields.querySelector("#f-name").value.trim(),
          unit: els.editorFields.querySelector("#f-unit").value,
          quantity: Number(els.editorFields.querySelector("#f-qty").value),
          low_threshold: Number(els.editorFields.querySelector("#f-threshold").value)
        };
        if (id) {
          const { error } = await getClient().from("inventory").update(payload).eq("id", id);
          if (error) throw error;
        } else {
          const { error } = await getClient().from("inventory").insert(payload);
          if (error) throw error;
        }
        await loadInventory();
      } else if (kind === "menu") {
        const payload = {
          name: els.editorFields.querySelector("#f-name").value.trim(),
          category_id: els.editorFields.querySelector("#f-category").value || null,
          description: els.editorFields.querySelector("#f-desc").value.trim() || null,
          price: Number(els.editorFields.querySelector("#f-price").value),
          is_available: els.editorFields.querySelector("#f-available").value === "true"
        };
        if (id) {
          const { error } = await getClient().from("menu_items").update(payload).eq("id", id);
          if (error) throw error;
        } else {
          const { error } = await getClient().from("menu_items").insert(payload);
          if (error) throw error;
        }
        await loadMenu();
      }
      closeEditor();
      toast(t("admin.editor.saved"), "success");
    } catch (err) {
      console.error("Editor save failed:", err);
      showEditorError(t("admin.editor.error"));
    }
  }

  // ---------------------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------------------
  function setupRealtime() {
    teardownRealtime();

    channel = getClient()
      .channel("kitchen-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          fetchOrderWithItems(payload.new.id).then((full) => {
            if (!full) return;
            orders = [full, ...orders];
            renderOrders();
            playChime();
            toast(t("admin.orders.newOrder", { tracking: full.tracking_id }), "success");
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new;
          const idx = orders.findIndex((o) => o.id === updated.id);
          if (idx !== -1) {
            orders[idx] = { ...orders[idx], ...updated };
            renderOrders();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "slots" },
        () => loadSlots()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        () => loadInventory()
      )
      .subscribe((status) => {
        setConnection(
          status === "SUBSCRIBED" ? t("admin.connected") : t("admin.reconnecting"),
          status === "SUBSCRIBED"
        );
      });
  }

  function teardownRealtime() {
    if (channel) {
      getClient().removeChannel(channel);
      channel = null;
    }
  }

  async function fetchOrderWithItems(orderId) {
    const { data, error } = await getClient()
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();
    if (error) {
      console.error("Failed to fetch new order:", error);
      return null;
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------
  function wireEvents() {
    els.loginForm.addEventListener("submit", handleLogin);
    els.logoutBtn.addEventListener("click", handleLogout);

    // Tabs
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    // Orders feed actions
    els.ordersFeed.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const card = btn.closest(".order-card");
      if (!card) return;
      const orderId = card.dataset.id;
      const action = btn.dataset.action;
      if (action === "advance") updateOrderStatus(orderId, btn.dataset.next);
      else if (action === "cancel" && confirm(t("admin.orders.cancelConfirm"))) updateOrderStatus(orderId, "cancelled");
    });

    // Slots feed actions
    els.slotsFeed.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const card = btn.closest(".slot-card");
      if (!card) return;
      const id = card.dataset.id;
      const action = btn.dataset.action;
      if (action === "toggle") toggleSlot(id);
      else if (action === "edit") openEditor("slot", id);
      else if (action === "delete") deleteSlot(id);
    });
    els.slotAddBtn.addEventListener("click", () => openEditor("slot", null));

    // Inventory feed actions
    els.inventoryFeed.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const card = btn.closest(".inventory-card");
      if (!card) return;
      const id = card.dataset.id;
      const action = btn.dataset.action;
      if (action === "edit") openEditor("inventory", id);
      else if (action === "delete") deleteInventory(id);
    });
    els.inventoryAddBtn.addEventListener("click", () => openEditor("inventory", null));

    // Menu feed actions
    els.menuFeed.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const card = btn.closest(".menu-card");
      if (!card) return;
      const id = card.dataset.id;
      const action = btn.dataset.action;
      if (action === "toggle") toggleMenuItem(id);
      else if (action === "edit") openEditor("menu", id);
      else if (action === "delete") deleteMenuItem(id);
    });
    els.menuAddBtn.addEventListener("click", () => openEditor("menu", null));

    // Editor modal
    els.editorForm.addEventListener("submit", handleEditorSubmit);
    document.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", closeEditor);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeEditor();
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  async function init() {
    wireEvents();

    const { data: { session } } = await getClient().auth.getSession();
    if (session) {
      await onAuthenticated();
    } else {
      showLogin();
    }

    getClient().auth.onAuthStateChange((_event, session) => {
      if (session) {
        onAuthenticated();
      } else {
        teardownRealtime();
        orders = [];
        showLogin();
      }
    });

    // Re-render dynamic content when the language changes.
    document.addEventListener("vipizza:langchange", () => {
      renderOrders();
      renderSlots();
      renderInventory();
      renderMenu();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
