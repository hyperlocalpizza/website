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
  const CONTENT_GROUPS = [
    {
      title: "admin.content.groupHero",
      fields: [
        ["hero.eyebrow", "admin.content.heroEyebrow"],
        ["hero.title", "admin.content.heroTitle"],
        ["hero.sub", "admin.content.heroSub"],
        ["hero.cta", "admin.content.heroCta"]
      ]
    },
    {
      title: "admin.content.groupMenu",
      fields: [["menu.eyebrow", "admin.content.menuEyebrow"], ["menu.title", "admin.content.menuTitle"]]
    },
    {
      title: "admin.content.groupInfo",
      fields: [
        ["info.eyebrow", "admin.content.infoEyebrow"],
        ["info.title", "admin.content.infoTitle"],
        ["info.choose.title", "admin.content.chooseTitle"],
        ["info.choose.desc", "admin.content.chooseDesc"],
        ["info.order.title", "admin.content.orderTitle"],
        ["info.order.desc", "admin.content.orderDesc"],
        ["info.enjoy.title", "admin.content.enjoyTitle"],
        ["info.enjoy.desc", "admin.content.enjoyDesc"]
      ]
    },
    {
      title: "admin.content.groupFooter",
      fields: [["footer.tagline", "admin.content.footerTagline"]]
    }
  ];
  const CONTENT_LANGUAGES = ["en", "it", "es"];

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
    inventoryTotal: document.getElementById("inventory-total"),
    inventoryAddBtn: document.getElementById("inventory-add-btn"),
    menuFeed: document.getElementById("menu-feed"),
    menuAddBtn: document.getElementById("menu-add-btn"),
    siteContentForm: document.getElementById("site-content-form"),
    siteContentFields: document.getElementById("site-content-fields"),
    siteContentStatus: document.getElementById("site-content-status"),
    siteContentSave: document.getElementById("site-content-save"),
    analyticsPeriod: document.getElementById("analytics-period"),
    analyticsRefresh: document.getElementById("analytics-refresh"),
    analyticsStatus: document.getElementById("analytics-status"),
    analyticsChart: document.getElementById("weekly-sales-chart"),
    analyticsTableBody: document.getElementById("analytics-table-body"),
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
  let contentLanguage = "en";
  let siteContentDrafts = { en: {}, it: {}, es: {} };
  let weeklyAnalytics = [];

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
      await Promise.all([loadOrders(), loadSlots(), loadInventory(), loadMenu(), loadSiteContent(), loadWeeklyAnalytics()]);
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
    if (tabName === "analytics") renderWeeklyAnalyticsChart();
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

  function utcWeekStart(date) {
    const week = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
    return week;
  }

  function formatAnalyticsWeek(date) {
    return date.toLocaleDateString(i18n.getLang(), { month: "short", day: "numeric", timeZone: "UTC" });
  }

  function renderWeeklyAnalyticsTable() {
    els.analyticsTableBody.innerHTML = weeklyAnalytics.map((week) => `
      <tr>
        <th scope="row">${escapeHtml(formatAnalyticsWeek(week.start))}</th>
        <td>${formatPrice(week.cost)}</td>
        <td>${formatPrice(week.gain)}</td>
        <td>${week.pizzas}</td>
      </tr>
    `).join("");
  }

  function renderWeeklyAnalyticsChart() {
    const canvas = els.analyticsChart;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !weeklyAnalytics.length) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const width = bounds.width;
    const height = 340;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    const context = canvas.getContext("2d");
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const costColor = "#e0a458";
    const gainColor = "#8fca7a";
    const pizzasColor = "#75b8d1";
    const mutedColor = "#b9aaa0";
    const gridColor = "#514941";
    const plot = { left: 72, right: width - 62, top: 22, bottom: height - 48 };
    const plotWidth = Math.max(1, plot.right - plot.left);
    const plotHeight = plot.bottom - plot.top;
    const maxMoneyValue = Math.max(1, ...weeklyAnalytics.map((week) => week.cost + week.gain));
    const maxMoney = Math.ceil(maxMoneyValue / 5) * 5 || 5;
    const maxPizzasValue = Math.max(1, ...weeklyAnalytics.map((week) => week.pizzas));
    const maxPizzas = Math.ceil(maxPizzasValue / 5) * 5 || 5;
    const labelFont = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    context.font = labelFont;
    context.lineWidth = 1;
    for (let tick = 0; tick <= 4; tick += 1) {
      const y = plot.bottom - (plotHeight * tick) / 4;
      context.strokeStyle = gridColor;
      context.beginPath();
      context.moveTo(plot.left, y);
      context.lineTo(plot.right, y);
      context.stroke();
      context.fillStyle = mutedColor;
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillText(formatPrice((maxMoney * tick) / 4), plot.left - 9, y);
      context.textAlign = "left";
      context.fillText(String(Math.round((maxPizzas * tick) / 4)), plot.right + 9, y);
    }

    const band = plotWidth / weeklyAnalytics.length;
    const barWidth = Math.max(3, Math.min(11, band * 0.18));
    weeklyAnalytics.forEach((week, index) => {
      const center = plot.left + band * (index + 0.5);
      const costHeight = (week.cost / maxMoney) * plotHeight;
      const gainHeight = (week.gain / maxMoney) * plotHeight;
      const pizzasHeight = (week.pizzas / maxPizzas) * plotHeight;
      const gap = Math.max(2, barWidth * 0.25);
      const firstX = center - (3 * barWidth + 2 * gap) / 2;

      context.fillStyle = costColor;
      context.fillRect(firstX, plot.bottom - costHeight, barWidth, costHeight);
      context.fillStyle = gainColor;
      context.fillRect(firstX + barWidth + gap, plot.bottom - gainHeight, barWidth, gainHeight);
      context.fillStyle = pizzasColor;
      context.fillRect(firstX + 2 * (barWidth + gap), plot.bottom - pizzasHeight, barWidth, pizzasHeight);

      if (index % 2 === 0 || index === weeklyAnalytics.length - 1) {
        context.fillStyle = mutedColor;
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(formatAnalyticsWeek(week.start), center, plot.bottom + 10);
      }
    });
  }

  async function loadWeeklyAnalytics() {
    const currentWeek = utcWeekStart(new Date());
    const firstWeek = new Date(currentWeek);
    firstWeek.setUTCDate(firstWeek.getUTCDate() - 11 * 7);
    const weeks = Array.from({ length: 12 }, (_, index) => {
      const start = new Date(firstWeek);
      start.setUTCDate(start.getUTCDate() + index * 7);
      return { start, cost: 0, gain: 0, pizzas: 0 };
    });
    const weekLookup = new Map(weeks.map((week) => [week.start.toISOString().slice(0, 10), week]));

    els.analyticsRefresh.disabled = true;
    els.analyticsStatus.hidden = true;
    try {
      const { data, error } = await getClient()
        .from("orders")
        .select("created_at, status, order_items(quantity, ingredient_cost, gain, menu_items(ingredient_cost, gain))")
        .gte("created_at", firstWeek.toISOString())
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (error) throw error;

      (data || []).forEach((order) => {
        const key = utcWeekStart(new Date(order.created_at)).toISOString().slice(0, 10);
        const week = weekLookup.get(key);
        if (!week) return;
        (order.order_items || []).forEach((line) => {
          const quantity = Number(line.quantity) || 0;
          const currentMenu = Array.isArray(line.menu_items) ? line.menu_items[0] : line.menu_items;
          const unitCost = Number(line.ingredient_cost ?? currentMenu?.ingredient_cost ?? 0);
          const unitGain = Number(line.gain ?? currentMenu?.gain ?? 0);
          week.pizzas += quantity;
          week.cost += unitCost * quantity;
          week.gain += unitGain * quantity;
        });
      });

      weeklyAnalytics = weeks.map((week) => ({
        ...week,
        cost: Math.round((week.cost + Number.EPSILON) * 100) / 100,
        gain: Math.round((week.gain + Number.EPSILON) * 100) / 100
      }));
      els.analyticsPeriod.textContent = t("admin.analytics.period", {
        start: formatAnalyticsWeek(firstWeek),
        end: formatAnalyticsWeek(currentWeek)
      });
      renderWeeklyAnalyticsTable();
      renderWeeklyAnalyticsChart();
    } catch (error) {
      console.error("Failed to load weekly analytics:", error);
      els.analyticsStatus.textContent = t("admin.analytics.loadError");
      els.analyticsStatus.hidden = false;
    } finally {
      els.analyticsRefresh.disabled = false;
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
    const totalValue = inventory.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0),
      0
    );
    els.inventoryTotal.textContent = formatPrice(totalValue);
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
          <p class="inventory-cost">${t("admin.inv.unitCost", { price: formatPrice(item.unit_cost), unit: escapeHtml(item.unit) })}</p>
          <p class="inventory-value">${t("admin.inv.itemValue", { value: formatPrice(Number(item.quantity) * Number(item.unit_cost || 0)) })}</p>
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
      if (menuItems.length) {
        syncMenuPricingFromInventory();
        renderMenu();
      }
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
      toast(err.code === "23503" ? t("admin.inv.inUseError") : t("admin.inv.loadError"), "error");
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
        const ingredients = (item.ingredients || [])
          .map((line) => `${escapeHtml(line.inventory?.name || "")} · ${line.quantity} ${escapeHtml(line.inventory?.unit || "")}`)
          .join(", ");
        return `
        <article class="menu-card" data-id="${item.id}">
          ${item.image_url ? `<img class="admin-menu-photo" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy" />` : ""}
          <div class="menu-card-head">
            <span class="menu-item-name">${escapeHtml(item.name)}</span>
            <span class="menu-item-price">${formatPrice(item.price)}</span>
          </div>
          <p class="menu-item-cost">${t("admin.menu.costBreakdown", { cost: formatPrice(item.ingredient_cost), gain: formatPrice(item.gain) })}</p>
          <p class="menu-item-desc">${escapeHtml(item.description || "")}</p>
          ${ingredients ? `<p class="menu-item-ingredients">${ingredients}</p>` : ""}
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
      const [{ data: cats, error: catError }, { data: items, error: itemError }, { data: recipes, error: recipeError }] =
        await Promise.all([
          getClient().from("categories").select("*").order("sort_order"),
          getClient().from("menu_items").select("*").order("name"),
           getClient().from("menu_item_ingredients").select("menu_item_id, inventory_id, quantity, inventory(name, unit, unit_cost)")
        ]);
      if (catError) throw catError;
      if (itemError) throw itemError;
      if (recipeError) throw recipeError;
      categories = cats || [];
      menuItems = (items || []).map((item) => ({
        ...item,
        ingredients: (recipes || []).filter((line) => line.menu_item_id === item.id)
      }));
      syncMenuPricingFromInventory();
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
    const item = menuItems.find((entry) => entry.id === id);
    try {
      const { error } = await getClient().from("menu_items").delete().eq("id", id);
      if (error) throw error;
      menuItems = menuItems.filter((i) => i.id !== id);
      renderMenu();
      if (item && item.image_url) await deleteMenuPhoto(item.image_url);
      toast(t("admin.menu.deleted"), "success");
    } catch (err) {
      console.error("Failed to delete menu item:", err);
      toast(t("admin.menu.loadError"), "error");
    }
  }

  function menuPhotoObjectPath(imageUrl) {
    try {
      const marker = "/storage/v1/object/public/menu-photos/";
      const pathname = new URL(imageUrl).pathname;
      const markerIndex = pathname.indexOf(marker);
      return markerIndex === -1 ? null : decodeURIComponent(pathname.slice(markerIndex + marker.length));
    } catch {
      return null;
    }
  }

  async function deleteMenuPhoto(imageUrl) {
    const objectPath = menuPhotoObjectPath(imageUrl);
    if (!objectPath) return;
    try {
      const { error } = await getClient().storage.from("menu-photos").remove([objectPath]);
      if (error) console.warn("Unable to remove old menu photo:", error);
    } catch (error) {
      console.warn("Unable to remove old menu photo:", error);
    }
  }

  function renderSiteContentFields() {
    els.siteContentFields.textContent = "";
    CONTENT_GROUPS.forEach((group) => {
      const section = document.createElement("section");
      section.className = "site-content-group";
      const heading = document.createElement("h2");
      heading.textContent = t(group.title);
      section.appendChild(heading);

      group.fields.forEach(([key, labelKey]) => {
        const label = document.createElement("label");
        label.className = "field site-content-field";
        const caption = document.createElement("span");
        caption.textContent = t(labelKey);
        const textarea = document.createElement("textarea");
        textarea.rows = key === "hero.title" ? 2 : 3;
        textarea.maxLength = 500;
        textarea.dataset.contentKey = key;
        textarea.value = siteContentDrafts[contentLanguage][key] || "";
        textarea.placeholder = i18n.getBaseText(key, contentLanguage).replace(/<br\s*\/?\s*>/gi, "\n");
        label.append(caption, textarea);
        section.appendChild(label);
      });

      els.siteContentFields.appendChild(section);
    });
  }

  function captureSiteContentDrafts() {
    els.siteContentFields.querySelectorAll("[data-content-key]").forEach((field) => {
      siteContentDrafts[contentLanguage][field.dataset.contentKey] = field.value;
    });
  }

  function renderSiteContent() {
    document.querySelectorAll("[data-content-language]").forEach((button) => {
      const active = button.dataset.contentLanguage === contentLanguage;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderSiteContentFields();
  }

  async function loadSiteContent() {
    try {
      const { data, error } = await getClient()
        .from("site_content")
        .select("content_key, language, content");
      if (error) throw error;
      siteContentDrafts = { en: {}, it: {}, es: {} };
      (data || []).forEach((entry) => {
        siteContentDrafts[entry.language][entry.content_key] = entry.content;
      });
      renderSiteContent();
    } catch (error) {
      console.error("Failed to load site content:", error);
      toast(t("admin.content.loadError"), "error");
    }
  }

  async function saveSiteContent(event) {
    event.preventDefault();
    captureSiteContentDrafts();
    const entries = CONTENT_LANGUAGES.flatMap((language) =>
      CONTENT_GROUPS.flatMap((group) =>
        group.fields.map(([key]) => {
          const content = (siteContentDrafts[language][key] || "").trim();
          return { content_key: key, language, content };
        })
      )
    );

    els.siteContentSave.disabled = true;
    els.siteContentStatus.hidden = true;
    try {
      const { error } = await getClient().rpc("save_site_content", { p_entries: entries });
      if (error) throw error;
      i18n.setContentOverrides(entries.filter(({ content }) => content).map(({ content_key, language, content }) => ({
        key: content_key,
        language,
        content
      })));
      els.siteContentStatus.textContent = t("admin.content.saved");
      els.siteContentStatus.classList.remove("is-error");
      els.siteContentStatus.hidden = false;
      toast(t("admin.content.saved"), "success");
    } catch (error) {
      console.error("Failed to save site content:", error);
      const detail = error?.message || t("admin.content.unknownError");
      const code = error?.code ? ` (${error.code})` : "";
      els.siteContentStatus.textContent = `${t("admin.content.saveError")}${code} ${detail}`;
      els.siteContentStatus.classList.add("is-error");
      els.siteContentStatus.hidden = false;
    } finally {
      els.siteContentSave.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Editor modal (add / edit for slots, inventory, menu)
  // ---------------------------------------------------------------------------
  function addIngredientRow(container, ingredient = {}) {
    const row = document.createElement("div");
    row.className = "ingredient-row";

    const select = document.createElement("select");
    select.className = "ingredient-select";
    select.setAttribute("aria-label", t("admin.editor.menu.ingredient"));
    const blankOption = document.createElement("option");
    blankOption.value = "";
    blankOption.textContent = t("admin.editor.menu.chooseIngredient");
    select.appendChild(blankOption);
    inventory.forEach((stockItem) => {
      const option = document.createElement("option");
      option.value = stockItem.id;
      option.textContent = `${stockItem.name} (${stockItem.unit})`;
      option.selected = stockItem.id === ingredient.inventory_id;
      select.appendChild(option);
    });

    const quantity = document.createElement("input");
    quantity.className = "ingredient-quantity";
    quantity.type = "number";
    quantity.min = "0.001";
    quantity.step = "0.001";
    quantity.value = ingredient.quantity ?? "";
    quantity.setAttribute("aria-label", t("admin.editor.menu.ingredientQuantity"));

    const unit = document.createElement("span");
    unit.className = "ingredient-unit";
    unit.textContent = inventory.find((stockItem) => stockItem.id === select.value)?.unit || "";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn ingredient-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", t("admin.editor.menu.removeIngredient"));

    row.append(select, quantity, unit, remove);
    container.appendChild(row);
  }

  function recipeCostFromRows() {
    let cost = 0;
    els.editorFields.querySelectorAll(".ingredient-row").forEach((row) => {
      const stockItem = inventory.find((entry) => entry.id === row.querySelector(".ingredient-select").value);
      const quantity = Number(row.querySelector(".ingredient-quantity").value);
      if (stockItem && Number.isFinite(quantity) && quantity > 0) {
        cost += quantity * Number(stockItem.unit_cost || 0);
      }
    });
    return Math.round((cost + Number.EPSILON) * 100) / 100;
  }

  function refreshMenuPricePreview() {
    const costOutput = els.editorFields.querySelector("#f-ingredient-cost");
    const gainInput = els.editorFields.querySelector("#f-gain");
    const priceOutput = els.editorFields.querySelector("#f-final-price");
    if (!costOutput || !gainInput || !priceOutput) return;
    const cost = recipeCostFromRows();
    const gain = Math.max(0, Number(gainInput.value) || 0);
    costOutput.textContent = formatPrice(cost);
    priceOutput.textContent = formatPrice(Math.round((cost + gain + Number.EPSILON) * 100) / 100);
  }

  function syncMenuPricingFromInventory() {
    menuItems.forEach((item) => {
      const cost = (item.ingredients || []).reduce(
        (sum, line) => {
          const stock = inventory.find((entry) => entry.id === line.inventory_id);
          return sum + Number(line.quantity || 0) * Number(stock?.unit_cost ?? line.inventory?.unit_cost ?? 0);
        },
        0
      );
      item.ingredient_cost = Math.round((cost + Number.EPSILON) * 100) / 100;
      item.gain = Number(item.gain || 0);
      item.price = Math.round((item.ingredient_cost + item.gain + Number.EPSILON) * 100) / 100;
    });
  }

  async function openEditor(kind, id) {
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
        <label class="field"><span>${t("admin.editor.inv.qty")}</span><input type="number" id="f-qty" min="0" step="0.001" value="${item ? item.quantity : 0}" required /></label>
        <label class="field"><span>${t("admin.editor.inv.unitCost")}</span><input type="number" id="f-unit-cost" min="0" step="0.01" value="${item ? item.unit_cost ?? 0 : 0}" required /><small id="f-unit-cost-hint" class="field-hint">${t("admin.editor.inv.unitCostHint", { unit: item ? item.unit : "pz" })}</small></label>
        <label class="field"><span>${t("admin.editor.inv.threshold")}</span><input type="number" id="f-threshold" min="0" step="0.001" value="${item ? item.low_threshold : 0}" required /></label>
      `;
    } else if (kind === "menu") {
      const item = id ? menuItems.find((i) => i.id === id) : null;
      els.editorTitle.textContent = item ? t("admin.editor.menu.edit") : t("admin.editor.menu.new");
      let recipe = [];
      if (item) {
        const { data, error } = await getClient()
          .from("menu_item_ingredients")
          .select("inventory_id, quantity")
          .eq("menu_item_id", item.id);
        if (error) {
          console.error("Failed to load menu recipe:", error);
          toast(t("admin.menu.loadError"), "error");
          return;
        }
        recipe = data || [];
      }
      const catOptions = categories
        .map((c) => `<option value="${c.id}" ${item && item.category_id === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
        .join("");
      els.editorFields.innerHTML = `
        <label class="field"><span>${t("admin.editor.menu.name")}</span><input type="text" id="f-name" value="${item ? escapeHtml(item.name) : ""}" required /></label>
        <label class="field"><span>${t("admin.editor.menu.category")}</span><select id="f-category"><option value="">—</option>${catOptions}</select></label>
        <label class="field"><span>${t("admin.editor.menu.desc")}</span><textarea id="f-desc" rows="2">${item ? escapeHtml(item.description || "") : ""}</textarea></label>
        <div class="menu-price-breakdown">
          <p><span>${t("admin.editor.menu.ingredientCost")}</span><strong id="f-ingredient-cost">${formatPrice(item?.ingredient_cost || 0)}</strong></p>
          <label class="field"><span>${t("admin.editor.menu.gain")}</span><input type="number" id="f-gain" min="0" step="0.01" value="${item ? item.gain ?? 0 : 0}" required /></label>
          <p class="menu-final-price"><span>${t("admin.editor.menu.finalPrice")}</span><strong id="f-final-price">${formatPrice(item?.price || 0)}</strong></p>
        </div>
        <section class="recipe-field">
          <div class="recipe-head"><strong>${t("admin.editor.menu.ingredients")}</strong><button type="button" id="ingredient-add" class="btn btn-outline btn-sm">${t("admin.editor.menu.addIngredient")}</button></div>
          <div id="ingredient-rows" class="ingredient-rows"></div>
        </section>
        <div class="field photo-field">
          <span>${t("admin.editor.menu.photo")}</span>
          <input type="file" id="f-photo" accept="image/jpeg,.jpg,.jpeg" />
          <small class="field-hint">${t("admin.editor.menu.photoHint")}</small>
          <img id="f-photo-preview" class="photo-preview" src="${item && item.image_url ? escapeHtml(item.image_url) : ""}" alt="${escapeHtml(item ? item.name : "")}" ${item && item.image_url ? "" : "hidden"} />
        </div>
        <label class="field"><span>${t("admin.editor.menu.available")}</span><select id="f-available"><option value="true" ${!item || item.is_available ? "selected" : ""}>${t("admin.editor.slot.yes")}</option><option value="false" ${item && !item.is_available ? "selected" : ""}>${t("admin.editor.slot.no")}</option></select></label>
      `;
      const rows = els.editorFields.querySelector("#ingredient-rows");
      (recipe.length ? recipe : [{}]).forEach((line) => addIngredientRow(rows, line));
      refreshMenuPricePreview();
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
          unit_cost: Number(els.editorFields.querySelector("#f-unit-cost").value),
          low_threshold: Number(els.editorFields.querySelector("#f-threshold").value)
        };
        if (!Number.isFinite(payload.unit_cost) || payload.unit_cost < 0) {
          throw new Error("invalid_inventory_cost");
        }
        if (id) {
          const { error } = await getClient().from("inventory").update(payload).eq("id", id);
          if (error) throw error;
        } else {
          const { error } = await getClient().from("inventory").insert(payload);
          if (error) throw error;
        }
        await loadInventory();
      } else if (kind === "menu") {
        const photoInput = els.editorFields.querySelector("#f-photo");
        const photoFile = photoInput.files[0];
        if (photoFile && (photoFile.type !== "image/jpeg" || photoFile.size > 5 * 1024 * 1024)) {
          throw new Error("invalid_photo");
        }

        const ingredients = [];
        const usedIngredients = new Set();
        els.editorFields.querySelectorAll(".ingredient-row").forEach((row) => {
          const inventoryId = row.querySelector(".ingredient-select").value;
          const quantityValue = row.querySelector(".ingredient-quantity").value;
          if (!inventoryId && !quantityValue) return;
          const quantity = Number(quantityValue);
          if (!inventoryId || !Number.isFinite(quantity) || quantity <= 0 || usedIngredients.has(inventoryId)) {
            throw new Error("invalid_ingredients");
          }
          usedIngredients.add(inventoryId);
          ingredients.push({ inventory_id: inventoryId, quantity });
        });

        const name = els.editorFields.querySelector("#f-name").value.trim();
        const gain = Number(els.editorFields.querySelector("#f-gain").value);
        if (!name || !Number.isFinite(gain) || gain < 0) throw new Error("invalid_menu_item");

        const item = id ? menuItems.find((entry) => entry.id === id) : null;
        let photoPath = null;
        let imageUrl = item?.image_url || null;
        if (photoFile) {
          photoPath = `${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await getClient()
            .storage.from("menu-photos")
            .upload(photoPath, photoFile, { contentType: "image/jpeg", upsert: false });
          if (uploadError) throw uploadError;
          imageUrl = getClient().storage.from("menu-photos").getPublicUrl(photoPath).data.publicUrl;
        }

        const { error } = await getClient().rpc("save_menu_item", {
          p_item_id: id || null,
          p_name: name,
          p_category_id: els.editorFields.querySelector("#f-category").value || null,
          p_description: els.editorFields.querySelector("#f-desc").value.trim() || null,
          p_gain: gain,
          p_is_available: els.editorFields.querySelector("#f-available").value === "true",
          p_image_url: imageUrl,
          p_ingredients: ingredients
        });
        if (error) {
          if (photoPath) await getClient().storage.from("menu-photos").remove([photoPath]);
          throw error;
        }
        if (photoFile && item?.image_url) await deleteMenuPhoto(item.image_url);
        await loadMenu();
      }
      closeEditor();
      toast(t("admin.editor.saved"), "success");
    } catch (err) {
      console.error("Editor save failed:", err);
      const message = err.message === "invalid_photo"
        ? t("admin.editor.menu.photoError")
        : err.message === "invalid_ingredients"
          ? t("admin.editor.menu.ingredientError")
          : t("admin.editor.error");
      showEditorError(message);
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
            loadWeeklyAnalytics();
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
          loadWeeklyAnalytics();
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
    els.analyticsRefresh.addEventListener("click", loadWeeklyAnalytics);
    window.addEventListener("resize", renderWeeklyAnalyticsChart);

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
    els.siteContentForm.addEventListener("submit", saveSiteContent);
    document.querySelectorAll("[data-content-language]").forEach((button) => {
      button.addEventListener("click", () => {
        captureSiteContentDrafts();
        contentLanguage = button.dataset.contentLanguage;
        renderSiteContent();
      });
    });
    els.editorFields.addEventListener("click", (event) => {
      if (event.target.closest("#ingredient-add")) {
        addIngredientRow(els.editorFields.querySelector("#ingredient-rows"));
        refreshMenuPricePreview();
      } else if (event.target.closest(".ingredient-remove")) {
        event.target.closest(".ingredient-row").remove();
        refreshMenuPricePreview();
      }
    });
    els.editorFields.addEventListener("input", (event) => {
      if (event.target.matches(".ingredient-quantity, #f-gain")) refreshMenuPricePreview();
    });
    els.editorFields.addEventListener("change", (event) => {
      if (event.target.matches(".ingredient-select")) {
        const row = event.target.closest(".ingredient-row");
        row.querySelector(".ingredient-unit").textContent =
          inventory.find((stockItem) => stockItem.id === event.target.value)?.unit || "";
        refreshMenuPricePreview();
      } else if (event.target.matches("#f-unit")) {
        const hint = els.editorFields.querySelector("#f-unit-cost-hint");
        hint.textContent = t("admin.editor.inv.unitCostHint", { unit: event.target.value });
      } else if (event.target.matches("#f-photo")) {
        const preview = els.editorFields.querySelector("#f-photo-preview");
        const file = event.target.files[0];
        if (file && file.type === "image/jpeg" && file.size <= 5 * 1024 * 1024) {
          preview.src = URL.createObjectURL(file);
          preview.hidden = false;
        }
      }
    });
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
      renderSiteContent();
      renderWeeklyAnalyticsTable();
      renderWeeklyAnalyticsChart();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
