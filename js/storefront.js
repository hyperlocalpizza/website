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
  const GEOAPIFY_API = "https://api.geoapify.com/v1/geocode/autocomplete";

  let menuItems = [];
  let categories = [];
  let slots = [];
  let cart = loadCart();
  let addressSearchTimer = null;
  let addressSearchController = null;
  let addressSearchId = 0;
  let addressSuggestions = [];
  let activeAddressSuggestion = -1;
  let selectedAddressKey = "";

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
    slotSelect: document.getElementById("slot-select"),
    slotHint: document.getElementById("slot-hint"),
    addressField: document.getElementById("address-field"),
    customerAddress: document.getElementById("customer-address"),
    customerAddressApt: document.getElementById("customer-address-apt"),
    customerAddressCity: document.getElementById("customer-address-city"),
    customerAddressState: document.getElementById("customer-address-state"),
    customerAddressZip: document.getElementById("customer-address-zip"),
    customerAddressCountry: document.getElementById("customer-address-country"),
    addressSuggestions: document.getElementById("address-suggestions"),
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

  function setAddressHint(message, isError = false) {
    els.addressHint.textContent = message;
    els.addressHint.classList.toggle("is-error", isError);
  }

  function closeAddressSuggestions() {
    els.addressSuggestions.hidden = true;
    els.customerAddress.setAttribute("aria-expanded", "false");
    els.customerAddress.removeAttribute("aria-activedescendant");
    activeAddressSuggestion = -1;
  }

  function addressFields() {
    return {
      street: els.customerAddress.value.trim(),
      apt: els.customerAddressApt.value.trim(),
      city: els.customerAddressCity.value.trim(),
      state: els.customerAddressState.value.trim(),
      zip: els.customerAddressZip.value.trim(),
      country: els.customerAddressCountry.value.trim()
    };
  }

  function addressKey(address) {
    return [address.street, address.city, address.state, address.zip, address.country]
      .map((part) => part.trim().toLowerCase())
      .join("|");
  }

  function validateAddress() {
    const address = addressFields();
    const isComplete = address.street && address.city;
    if (!isComplete) {
      setAddressHint("");
      return false;
    }
    setAddressHint(t(selectedAddressKey === addressKey(address)
      ? "checkout.address.selected"
      : "checkout.address.ready"));
    return true;
  }

  function formatSuggestion(feature) {
    const address = feature.properties || {};
    if (address.formatted) return address.formatted;
    const line = [address.housenumber, address.street || address.name].filter(Boolean).join(" ");
    const locality = [address.city, address.state, address.postcode].filter(Boolean).join(", ");
    return [line, locality].filter(Boolean).join(", ");
  }

  function renderAddressSuggestions(features) {
    const seenAddresses = new Set();
    addressSuggestions = features.filter((feature) => {
      const key = formatSuggestion(feature).toLowerCase();
      if (seenAddresses.has(key)) return false;
      seenAddresses.add(key);
      return true;
    });
    activeAddressSuggestion = -1;

    if (!addressSuggestions.length) {
      closeAddressSuggestions();
      setAddressHint(t("checkout.address.noResults"));
      return;
    }

    els.addressSuggestions.innerHTML = addressSuggestions.map((feature, index) =>
      `<li id="address-suggestion-${index}" role="option" aria-selected="false" data-index="${index}">${escapeHtml(formatSuggestion(feature))}</li>`
    ).join("");
    els.addressSuggestions.hidden = false;
    els.customerAddress.setAttribute("aria-expanded", "true");
  }

  function scheduleAddressSearch() {
    clearTimeout(addressSearchTimer);
    addressSearchId += 1;
    if (addressSearchController) addressSearchController.abort();
    closeAddressSuggestions();
    addressSuggestions = [];

    const address = addressFields();
    if (address.street.length < 3) {
      setAddressHint("");
      return;
    }
    if (!window.VIPizza.config?.GEOAPIFY_API_KEY) {
      setAddressHint(t("checkout.address.apiKeyMissing"));
      return;
    }

    addressSearchTimer = setTimeout(searchAddresses, 250);
  }

  async function searchAddresses() {
    const requestId = ++addressSearchId;
    const address = addressFields();
    const query = [address.street, address.city, address.state, address.zip, address.country]
      .filter(Boolean)
      .join(", ");
    const controller = new AbortController();
    let timedOut = false;
    addressSearchController = controller;
    setAddressHint(t("checkout.address.searching"));
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);

    try {
      const url = new URL(GEOAPIFY_API);
      url.search = new URLSearchParams({
        text: query,
        limit: "20",
        lang: "en",
        format: "json",
        apiKey: window.VIPizza.config.GEOAPIFY_API_KEY
      });
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Geoapify returned HTTP ${response.status}`);
      const result = await response.json();
      if (requestId !== addressSearchId) return;
      const features = Array.isArray(result?.results)
        ? result.results.map((properties) => ({ properties }))
        : Array.isArray(result?.features)
          ? result.features
          : [];
      renderAddressSuggestions(features);
    } catch (error) {
      if (requestId !== addressSearchId || (error.name === "AbortError" && !timedOut)) return;
      console.error("Address autocomplete failed:", error);
      closeAddressSuggestions();
      setAddressHint(t("checkout.address.searchError"), true);
    } finally {
      clearTimeout(timeoutId);
      if (requestId === addressSearchId) addressSearchController = null;
    }
  }

  function selectAddressSuggestion(index) {
    const suggestion = addressSuggestions[index];
    if (!suggestion) return;
    const address = suggestion.properties;
    const street = address.street || address.name || "";
    els.customerAddress.value = address.address_line1 ||
      [address.housenumber, street].filter(Boolean).join(" ");
    els.customerAddressCity.value = address.city || "";
    els.customerAddressState.value = address.state || address.state_code || "";
    els.customerAddressZip.value = address.postcode || "";
    els.customerAddressCountry.value = address.country || "";
    closeAddressSuggestions();
    selectedAddressKey = addressKey(addressFields());
    validateAddress();
    els.customerAddress.focus();
  }

  function moveAddressSuggestion(offset) {
    if (els.addressSuggestions.hidden || !addressSuggestions.length) return;
    activeAddressSuggestion = (activeAddressSuggestion + offset + addressSuggestions.length) % addressSuggestions.length;
    [...els.addressSuggestions.children].forEach((option, index) => {
      const active = index === activeAddressSuggestion;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-selected", String(active));
    });
    const activeOption = els.addressSuggestions.children[activeAddressSuggestion];
    els.customerAddress.setAttribute("aria-activedescendant", activeOption.id);
    activeOption.scrollIntoView({ block: "nearest" });
  }

  function updateDeliveryFields() {
    const isDelivery = els.checkoutForm.delivery_type.value === "delivery";
    els.addressField.hidden = !isDelivery;
    if (!isDelivery) {
      clearTimeout(addressSearchTimer);
      addressSearchId += 1;
      if (addressSearchController) addressSearchController.abort();
      closeAddressSuggestions();
    }
  }

  async function handleCheckout(event) {
    event.preventDefault();
    els.checkoutError.hidden = true;

    const name = els.checkoutForm.customer_name.value.trim();
    const phone = els.checkoutForm.phone.value.trim();
    const deliveryType = els.checkoutForm.delivery_type.value;
    const addressFieldsValue = addressFields();
    const notes = els.checkoutForm.notes.value.trim();
    const slotId = els.slotSelect.value;
    const items = cartItems();

    if (!name || !phone || items.length === 0) {
      showCheckoutError(t("checkout.err.incomplete"));
      return;
    }
    if (deliveryType === "delivery" && (
      !addressFieldsValue.street ||
      !addressFieldsValue.city
    )) {
      showCheckoutError(t("checkout.err.address"));
      return;
    }
    if (deliveryType === "delivery" && !validateAddress()) {
      showCheckoutError(t("checkout.err.address"));
      return;
    }
    if (!slotId) {
      showCheckoutError(t("checkout.err.slot"));
      return;
    }

    const submitBtn = document.getElementById("submit-order");
    submitBtn.disabled = true;
    submitBtn.textContent = t("checkout.submitting");

    try {
      const address = deliveryType === "delivery"
        ? [
            addressFieldsValue.street,
            addressFieldsValue.apt,
            [addressFieldsValue.city, addressFieldsValue.state, addressFieldsValue.zip, addressFieldsValue.country]
              .filter(Boolean)
              .join(", ")
          ].filter(Boolean).join(", ")
        : null;

      const { data: order, error: orderError } = await getClient().rpc("submit_order", {
        p_customer_name: name,
        p_phone: phone,
        p_delivery_type: deliveryType,
        p_address: address,
        p_notes: notes || null,
        p_slot_id: slotId,
        p_items: items.map((item) => ({
          menu_item_id: item.id,
          quantity: item.quantity
        }))
      });
      if (orderError) throw orderError;
      if (order?.error === "slot_full") {
        showCheckoutError(t("checkout.err.slotFull"));
        await loadSlots();
        return;
      }
      if (order?.error) {
        throw new Error(`Order submission failed: ${order.error}`);
      }
      if (typeof order?.tracking_id !== "string") {
        throw new Error("Order submission returned no tracking ID");
      }

      // Success: clear cart and show confirmation.
      cart = {};
      saveCart();
      renderCart();
      closeCheckout();
      showConfirmation(order.tracking_id);
    } catch (err) {
      console.error("Checkout failed:", err);
      const needsMigration = ["PGRST202", "42883"].includes(err.code);
      showCheckoutError(t(needsMigration ? "checkout.err.setup" : "checkout.err.generic"));
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
    [
      els.customerAddress,
      els.customerAddressCity,
      els.customerAddressState,
      els.customerAddressZip,
      els.customerAddressCountry
    ].forEach((input) => {
      input.addEventListener("input", () => {
        selectedAddressKey = "";
        if (input === els.customerAddress && !input.value.trim()) {
          els.customerAddressCity.value = "";
          els.customerAddressState.value = "";
          els.customerAddressZip.value = "";
          els.customerAddressCountry.value = "";
        }
        validateAddress();
        scheduleAddressSearch();
      });
    });
    els.customerAddress.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveAddressSuggestion(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveAddressSuggestion(-1);
      } else if (event.key === "Enter" && !els.addressSuggestions.hidden) {
        event.preventDefault();
        selectAddressSuggestion(activeAddressSuggestion >= 0 ? activeAddressSuggestion : 0);
      } else if (event.key === "Escape") {
        closeAddressSuggestions();
      }
    });
    els.addressSuggestions.addEventListener("mousedown", (event) => event.preventDefault());
    els.addressSuggestions.addEventListener("click", (event) => {
      const option = event.target.closest("[data-index]");
      if (option) selectAddressSuggestion(Number(option.dataset.index));
    });
    els.customerAddress.addEventListener("blur", () => {
      setTimeout(closeAddressSuggestions, 150);
    });
    els.checkoutForm.querySelectorAll('input[name="delivery_type"]').forEach((input) =>
      input.addEventListener("change", updateDeliveryFields)
    );
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
    updateDeliveryFields();
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