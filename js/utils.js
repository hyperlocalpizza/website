/**
 * VIPizza — shared utilities.
 * Plain helpers used by both the storefront and the admin dashboard.
 */
(function () {
  "use strict";

  const VIPizza = (window.VIPizza = window.VIPizza || {});

  /** Format a number as US dollar currency. */
  function formatPrice(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(Number(value) || 0);
  }

  /** Escape a string for safe insertion into HTML. */
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Format an ISO timestamp into a readable local time (HH:MM). */
  function formatTime(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }

  /** Format an ISO timestamp into a readable date + time. */
  function formatDateTime(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  /** Human-readable labels for order statuses. */
  const STATUS_LABELS = {
    pending: "In attesa",
    preparing: "In preparazione",
    in_oven: "In forno",
    out_for_delivery: "In consegna",
    completed: "Completato",
    cancelled: "Annullato"
  };

  /** Ordered list of statuses for the kitchen workflow. */
  const STATUS_FLOW = [
    "pending",
    "preparing",
    "in_oven",
    "out_for_delivery",
    "completed"
  ];

  /** Return the next status in the workflow, or null if none. */
  function nextStatus(current) {
    const index = STATUS_FLOW.indexOf(current);
    if (index === -1 || index === STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[index + 1];
  }

  /** Play a short notification chime using the Web Audio API. */
  function playChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const playTone = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration + 0.05);
      };
      playTone(880, 0, 0.15);
      playTone(1174.66, 0.18, 0.2);
    } catch (err) {
      // Audio is not critical; ignore failures.
    }
  }

  /** Show a toast notification. */
  function toast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.classList.add("toast--show"), 10);
    setTimeout(() => {
      el.classList.remove("toast--show");
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  VIPizza.utils = {
    formatPrice,
    escapeHtml,
    formatTime,
    formatDateTime,
    STATUS_LABELS,
    STATUS_FLOW,
    nextStatus,
    playChime,
    toast
  };
})();