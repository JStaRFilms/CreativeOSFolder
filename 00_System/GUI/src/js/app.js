/**
 * CreativeOS GUI App Entry Point
 */

import "../css/main.css";
import "../css/cards.css";
import "../css/tables.css";
import "../css/forms.css";

import { initTheme, toggleTheme } from "./theme.js";
import { initRouter } from "./router.js";
import { showToast } from "./components/toast.js";
import { closeActiveModal } from "./components/modal.js";

// Initialize Theme
initTheme();

// Attach Theme Toggle Button
const themeBtn = document.getElementById("theme-toggle-btn");
themeBtn?.addEventListener("click", () => {
  const newTheme = toggleTheme();
  showToast(`Switched to ${newTheme} mode`, "info", 1500);
});

// Initialize SPA Router
initRouter("app-main");

// Global Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
  // Close modal on Escape
  if (e.key === "Escape") {
    closeActiveModal();
  }

  // Focus Search on "/" key if not in an input/textarea
  if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
    const searchInput = document.getElementById("project-search-input") || document.getElementById("storage-search-input");
    if (searchInput) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  }
});

// Register PWA Service Worker
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((reg) => {
        console.log("[PWA] Service Worker registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });
  });
}

// PWA Install Prompt Handler
let deferredPrompt;
const installBtn = document.getElementById("install-pwa-btn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) {
    installBtn.style.display = "inline-flex";
  }
});

installBtn?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`[PWA] Install prompt outcome: ${outcome}`);
  deferredPrompt = null;
  installBtn.style.display = "none";
});

window.addEventListener("appinstalled", () => {
  showToast("CreativeOS App installed successfully!", "success");
  if (installBtn) {
    installBtn.style.display = "none";
  }
});

// Self-Contained Desktop App Heartbeat & Server Lifecycle
function initManagedHeartbeat() {
  let consecutiveFailures = 0;

  // --- Offline Banner ---
  const showOfflineBanner = () => {
    let banner = document.getElementById("server-offline-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "server-offline-banner";
      Object.assign(banner.style, {
        position: "fixed", bottom: "24px", right: "24px", zIndex: "9999",
        display: "flex", alignItems: "center", gap: "10px",
        background: "rgba(24,24,27,0.96)", color: "#fafafa",
        border: "1px solid rgba(245,158,11,0.5)",
        padding: "10px 16px", borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)", fontSize: "13px", fontFamily: "system-ui, sans-serif",
      });
      const dot = document.createElement("span");
      Object.assign(dot.style, {
        width: "8px", height: "8px", borderRadius: "50%",
        background: "#f59e0b", display: "inline-block", flexShrink: "0",
      });
      const label = document.createElement("span");
      label.textContent = "Server offline — restart it with ";
      const code = document.createElement("code");
      code.textContent = "cos gui";
      Object.assign(code.style, {
        background: "rgba(255,255,255,0.1)", padding: "2px 6px",
        borderRadius: "4px", fontSize: "12px",
      });
      label.appendChild(code);
      banner.appendChild(dot);
      banner.appendChild(label);
      document.body.appendChild(banner);
    }
  };

  const removeOfflineBanner = () => {
    const el = document.getElementById("server-offline-banner");
    if (el) el.remove();
  };

  // --- Heartbeat Ping ---
  const sendPing = async () => {
    try {
      const res = await fetch("/api/system/heartbeat", { method: "POST" });
      if (res.ok) {
        if (consecutiveFailures > 0) {
          removeOfflineBanner();
          consecutiveFailures = 0;
        }
      } else {
        consecutiveFailures++;
      }
    } catch (e) {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        showOfflineBanner();
      }
    }
  };

  // Send initial ping and maintain interval
  sendPing();
  setInterval(sendPing, 3000);

  // Send heartbeat immediately on window focus or becoming visible
  window.addEventListener("focus", sendPing);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      sendPing();
    }
  });

  // --- Window Close / Unload Detection ---
  // Only send leave beacon when the actual window is closing/unloading
  const sendLeave = () => {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/system/leave");
      }
    } catch (_) {}
  };

  window.addEventListener("pagehide", sendLeave);
  window.addEventListener("beforeunload", sendLeave);
}

initManagedHeartbeat();

