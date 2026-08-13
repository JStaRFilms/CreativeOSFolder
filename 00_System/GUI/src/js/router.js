/**
 * Client-side View Router
 */

import { renderDashboard } from "./views/dashboardView.js";
import { renderStorage } from "./views/storageView.js";
import { renderNewProject } from "./views/newProjectView.js";
import { renderSettings } from "./views/settingsView.js";

const routes = {
  "#dashboard": renderDashboard,
  "#storage": renderStorage,
  "#new": renderNewProject,
  "#settings": renderSettings,
};

export function initRouter(containerId = "app-main") {
  const container = document.getElementById(containerId);
  if (!container) return;

  function handleRoute() {
    let hash = window.location.hash || "#dashboard";
    if (!routes[hash]) {
      hash = "#dashboard";
    }

    // Update active nav link
    document.querySelectorAll(".nav-item").forEach((el) => {
      const linkHash = el.getAttribute("href");
      if (linkHash === hash) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });

    // Render corresponding view
    const renderFn = routes[hash];
    if (renderFn) {
      renderFn(container);
    }
  }

  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}
