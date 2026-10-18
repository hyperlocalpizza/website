/**
 * VIPizza — Storefront logic.
 * Handles menu rendering, client-side cart (localStorage), and order submission.
 */
(function () {
  "use strict";

  const { formatPrice, escapeHtml, toast } = window.VIPizza.utils;
  const i18n = window.VIPizza.i18n;
  const t = (key, vars) => i18n.t(key, vars);
  const getClient = window.VIPizza.getClient;
  const SITE_CONTENT_CACHE_KEY = "vipizza_site_content";

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const CART_KEY = "vipizza_cart";
  // Update this regex for the actual delivery area you serve.
  const SERVICE_AREA = /Bloomfield Hills|Bloomfield Hills, Michigan|Bloomfield Hills MI|Bloomfield Hills, MI/i;

  let menuItems = [];
  let categories = [];
  let slots = [];
  let cart = loadCart();

  // ---------------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------------
  const els = {
    menuCategories: document.getElementById("menu-categories"),
    menuStatus: document.getElementById("menu-status"),
    cartToggle: document.getElementById("cart-toggle"),
    cartCount: document.getElementById("cart-count"),
    cartOverlay: document.getElementById("cart-overlay"),
    cartDrawer: document.getElementById("cart-drawer"),
    cartClose: document.getElementById("cart-close"),
    cartItems: document.getElementById("cart-items"),
    cartTotal: document.getElementById("cart-total"),
    checkoutBtn: document.getElementById("checkout-btn"),
    checkoutModal: document.getElementById("checkout-modal"),
    checkoutForm: document.getElementById("checkout-form"),
    checkoutError: document.getElementById("checkout-error"),
    slotField: document.getElementById("slot-field"),
    slotSelect: document.getElementById("slot-select"),
    slotHint: document.getElementById("slot-hint"),
    addressField: document.getElementById("address-field"),
    customerAddress: document.getElementById("customer-address"),
    addressHint: document.getElementById("address-hint"),
    confirmationModal: document.getElementById("confirmation-modal"),
    confirmationTracking: document.getElementById("confirmation-tracking"),
    confirmationClose: document.getElementById("confirmation-close"),
    year: document.getElementById("year")
  };

  // ---------------------------------------------------------------------------
  // Cart (localStorage)
  // ---------------------------------------------------------------------------
  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function cartItems() {
    return menuItems
      .filter((item) => cart[item.id])
      .map((item) => ({ ...item, quantity: cart[item.id] }));
  }

  function cartCount() {
    return cartItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  function cartTotal() {
    return cartItems().reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function updateQuantity(id, delta) {
    const current = cart[id] || 0;
    const next = current + delta;
    if (next <= 0) delete cart[id];
    else cart[id] = next;
    saveCart();
    renderCart();
    const menuControl = [...document.querySelectorAll(".menu-card .qty-control")]
      .find((control) => control.dataset.id === id);
    if (menuControl) {
      menuControl.querySelector(".qty-value").textContent = cart[id] || 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Menu rendering
  // ---------------------------------------------------------------------------
  function renderMenu() {
    els.menuCategories.innerHTML = "";

    if (!categories.length) {
      els.menuCategories.innerHTML = `<p class="empty-state">${t("menu.noCategories")}</p>`;
      return;
    }

    categories.forEach((category) => {
      const items = menuItems.filter((item) => item.category_id === category.id);
      if (!items.length) return;

      const section = document.createElement("section");
      section.className = "menu-category";
      section.innerHTML = `
        <h3 class="menu-category-title">${escapeHtml(category.name)}</h3>
        <div class="menu-grid">
          ${items
            .map(
              (item) => `
            <article class="menu-card">
              ${item.image_url ? `<img class="menu-card-photo" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy" />` : ""}
              <div class="menu-card-body">
                <div class="menu-card-head">
                  <h4 class="menu-card-name">${escapeHtml(item.name)}</h4>
                  <span class="menu-card-price">${formatPrice(item.price)}</span>
                </div>
                <p class="menu-card-desc">${escapeHtml(item.description || t("menu.defaultDesc"))}</p>
              </div>
              <div class="menu-card-actions">
                <div class="qty-control" data-id="${item.id}">
                  <button type="button" class="qty-btn qty-minus" aria-label="${t("menu.remove")} ${escapeHtml(item.name)}">−</button>
                  <span class="qty-value">${cart[item.id] || 0}</span>
                  <button type="button" class="qty-btn qty-plus" aria-label="${t("menu.add")} ${escapeHtml(item.name)}">+</button>
                </div>
              </div>
            </article>
          `
            )
            .join("")}
        </div>
      `;
      els.menuCategories.appendChild(section);
    });
  }

  // ---------------------------------------------------------------------------
  // Cart rendering
  // ---------------------------------------------------------------------------
  function renderCart() {
    const items = cartItems();
    const count = cartCount();

    // Header badge
    els.cartCount.textContent = count;
    els.cartCount.hidden = count === 0;

    // Drawer list
    if (!items.length) {
      els.cartItems.innerHTML = `<p class="cart-empty">${t("cart.empty")}</p>`;
    } else {
      els.cartItems.innerHTML = items
        .map(
          (item) => `
        <div class="cart-item" data-id="${item.id}">
          <div class="cart-item-info">
            <span class="cart-item-name">${escapeHtml(item.name)}</span>
            <span class="cart-item-price">${formatPrice(item.price)}</span>
          </div>
          <div class="qty-control qty-control--sm" data-id="${item.id}">
            <button type="button" class="qty-btn qty-minus" aria-label="${t("menu.remove")} ${escapeHtml(item.name)}">−</button>
            <span class="qty-value">${item.quantity}</span>
            <button type="button" class="qty-btn qty-plus" aria-label="${t("menu.add")} ${escapeHtml(item.name)}">+</button>
          </div>
          <span class="cart-item-subtotal">${formatPrice(item.price * item.quantity)}</span>
        </div>
      `
        )
        .join("");
    }

    els.cartTotal.textContent = formatPrice(cartTotal());
    els.checkoutBtn.disabled = count === 0;

    // Slot availability depends on the cart size.
    if (slots.length) renderSlots();
  }

  // ---------------------------------------------------------------------------
  // Slot rendering
  // ---------------------------------------------------------------------------
  function renderSlots() {
    const count = cartCount();
    const current = els.slotSelect.value;
    els.slotSelect.innerHTML = `<option value="">${t("checkout.slot.ph")}</option>`;

    slots.forEach((slot) => {
      const remaining = slot.max_pizzas - slot.reserved_pizzas;
      const disabled = count === 0 || remaining < count;
      const opt = document.createElement("option");
      opt.value = slot.id;
      opt.disabled = disabled;
      opt.textContent = `${slot.start_time} — ${disabled ? t("checkout.slot.full") : `${remaining} ${t("checkout.slot.spots")}`}`;
      els.slotSelect.appendChild(opt);
    });

    // Keep the selection if still valid.
    if (current && [...els.slotSelect.options].some((o) => o.value === current && !o.disabled)) {
      els.slotSelect.value = current;
    } else {
      els.slotSelect.value = "";
    }
    updateSlotHint();
  }

  function updateSlotHint() {
    const count = cartCount();
    if (count === 0) {
      els.slotHint.textContent = t("checkout.slot.hintEmpty");
      return;
    }
    if (!els.slotSelect.value) {
      els.slotHint.textContent = "";
      return;
    }
    const pizzaWord = count === 1 ? t("checkout.slot.pizza") : t("checkout.slot.pizzas");
    els.slotHint.textContent = t("checkout.slot.hintSelected", { count, pizza: pizzaWord });
  }

  // ---------------------------------------------------------------------------
  // Cart drawer open/close
  // ---------------------------------------------------------------------------
  function openCart() {
    els.cartDrawer.classList.add("is-open");
    els.cartDrawer.setAttribute("aria-hidden", "false");
    els.cartOverlay.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeCart() {
    els.cartDrawer.classList.remove("is-open");
    els.cartDrawer.setAttribute("aria-hidden", "true");
    els.cartOverlay.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  // ---------------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------------
  function openCheckout() {
    els.checkoutError.hidden = true;
    els.checkoutModal.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeCheckout() {
    els.checkoutModal.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function showConfirmation(trackingId) {
    els.confirmationTracking.textContent = trackingId;
    els.confirmationModal.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeConfirmation() {
    els.confirmationModal.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function validateAddress() {
    const value = els.customerAddress.value.trim();
    if (!value) {
      els.addressHint.textContent = "";
      return true;
    }
    const ok = SERVICE_AREA.test(value);
    els.addressHint.textContent = ok ? t("checkout.address.ok") : t("checkout.address.bad");
    els.addressHint.classList.toggle("is-error", !ok);
    return ok;
  }

  async function handleCheckout(event) {
    event.preventDefault();
    els.checkoutError.hidden = true;

    const name = els.checkoutForm.customer_name.value.trim();
    const phone = els.checkoutForm.phone.value.trim();
    const deliveryType = els.checkoutForm.delivery_type.value;
    const address = els.customerAddress.value.trim();
    const notes = els.checkoutForm.notes.value.trim();
    const slotId = els.slotSelect.value;
    const items = cartItems();

    if (!name || !phone || items.length === 0) {
      showCheckoutError(t("checkout.err.incomplete"));
      return;
    }
    if (deliveryType === "delivery" && !address) {
      showCheckoutError(t("checkout.err.address"));
      return;
    }
    if (deliveryType === "delivery" && !validateAddress()) {
      showCheckoutError(t("checkout.err.area"));
      return;
    }
    if (deliveryType === "pickup" && !slotId) {
      showCheckoutError(t("checkout.err.slot"));
      return;
    }

    const submitBtn = document.getElementById("submit-order");
    submitBtn.disabled = true;
    submitBtn.textContent = t("checkout.submitting");

    try {
      const total = cartTotal();

      // Reserve slot capacity first (pickup only).
      if (deliveryType === "pickup") {
        const { data: reserved, error: reserveError } = await getClient().rpc(
          "check_and_reserve_slot",
          { p_slot_id: slotId, p_requested_quantity: cartCount() }
        );
        if (reserveError) throw reserveError;
        if (reserved !== true) {
          showCheckoutError(t("checkout.err.slotFull"));
          await loadSlots();
          return;
        }
      }

      const { data: order, error: orderError } = await getClient()
        .from("orders")
        .insert({
          customer_name: name,
          phone,
          delivery_type: deliveryType,
          address: deliveryType === "delivery" ? address : null,
          notes: notes || null,
          slot_id: deliveryType === "pickup" ? slotId : null,
          total_amount: total
        })
        .select("id, tracking_id")
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((item) => ({
        order_id: order.id,
        menu_item_id: item.id,
        item_name: item.name,
        unit_price: item.price,
        quantity: item.quantity
      }));

      const { error: itemsError } = await getClient().from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // Success: clear cart and show confirmation.
      cart = {};
      saveCart();
      renderCart();
      closeCheckout();
      showConfirmation(order.tracking_id);
    } catch (err) {
      console.error("Checkout failed:", err);
      showCheckoutError(t("checkout.err.generic"));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t("checkout.submit");
    }
  }

  function showCheckoutError(message) {
    els.checkoutError.textContent = message;
    els.checkoutError.hidden = false;
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  async function loadSlots() {
    try {
      const { data, error } = await getClient()
        .from("slots")
        .select("id, start_time, max_pizzas, reserved_pizzas")
        .eq("is_active", true)
        .order("start_time");
      if (error) throw error;
      slots = (data || []).map((slot) => ({
        ...slot,
        start_time: slot.start_time.slice(0, 5)
      }));
      renderSlots();
    } catch (err) {
      console.error("Failed to load slots:", err);
      slots = [];
    }
  }

  async function loadMenu() {
    els.menuStatus.textContent = t("menu.loading");
    try {
      const [{ data: cats, error: catError }, { data: items, error: itemError }] =
        await Promise.all([
          getClient()
            .from("categories")
            .select("id, name, slug, sort_order")
            .eq("is_active", true)
            .order("sort_order"),
          getClient()
            .from("menu_items")
            .select("id, category_id, name, description, price, image_url")
            .eq("is_available", true)
            .order("name")
        ]);

      if (catError) throw catError;
      if (itemError) throw itemError;

      categories = cats || [];
      menuItems = items || [];
      els.menuStatus.textContent = "";
      renderMenu();
      renderCart();
    } catch (err) {
      console.error("Failed to load menu:", err);
      els.menuStatus.textContent = t("menu.error");
      els.menuCategories.innerHTML = `<p class="empty-state">${t("menu.empty")}</p>`;
    }
  }

  async function loadSiteContent() {
    try {
      const cached = JSON.parse(localStorage.getItem(SITE_CONTENT_CACHE_KEY) || "[]");
      if (Array.isArray(cached)) i18n.setContentOverrides(cached);
    } catch {
      // Ignore unavailable or malformed local cache and use bundled translations.
    }

    try {
      const client = getClient();
      if (!client) return;
      const { data, error } = await client
        .from("site_content")
        .select("content_key, language, content");
      if (error) throw error;
      const entries = (data || []).map(({ content_key, language, content }) => ({
        key: content_key,
        language,
        content
      }));
      i18n.setContentOverrides(entries);
      try {
        localStorage.setItem(SITE_CONTENT_CACHE_KEY, JSON.stringify(entries));
      } catch {
        // Continue without caching if browser storage is unavailable.
      }
    } catch (error) {
      console.warn("Using cached or bundled site content:", error);
    }
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------
  function wireEvents() {
    els.cartToggle.addEventListener("click", openCart);
    els.cartClose.addEventListener("click", closeCart);
    els.cartOverlay.addEventListener("click", closeCart);

    els.checkoutBtn.addEventListener("click", openCheckout);
    els.checkoutForm.addEventListener("submit", handleCheckout);
    els.customerAddress.addEventListener("input", validateAddress);
    els.slotSelect.addEventListener("change", updateSlotHint);
    els.confirmationClose.addEventListener("click", closeConfirmation);

    // Delegate quantity buttons (menu + cart).
    document.addEventListener("click", (event) => {
      const btn = event.target.closest(".qty-btn");
      if (!btn) return;
      const control = btn.closest(".qty-control");
      if (!control) return;
      const id = control.dataset.id;
      const delta = btn.classList.contains("qty-plus") ? 1 : -1;
      updateQuantity(id, delta);
    });

    // Close modals via backdrop.
    document.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        if (el.closest("#checkout-modal")) closeCheckout();
      });
    });

    // Close on Escape.
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeCart();
        closeCheckout();
      }
    });

    if (els.year) els.year.textContent = new Date().getFullYear();
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init() {
    wireEvents();
    renderCart();
    loadSiteContent();
    loadMenu();
    loadSlots();

    // Re-render dynamic content when the language changes.
    document.addEventListener("vipizza:langchange", () => {
      renderMenu();
      renderCart();
      renderSlots();
      updateSlotHint();
      validateAddress();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();