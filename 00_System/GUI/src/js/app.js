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
