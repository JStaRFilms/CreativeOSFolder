/**
 * Client-side View Router
 */

import { renderDashboard } from "./views/dashboardView.js";
import { renderExplorer } from "./views/explorerView.js";
import { renderStorage } from "./views/storageView.js";
import { renderNewProject } from "./views/newProjectView.js";
import { renderSettings } from "./views/settingsView.js";

const routes = {
  "#dashboard": renderDashboard,
  "#explorer": renderExplorer,
  "#storage": renderStorage,
  "#new": renderNewProject,
  "#settings": renderSettings,
};

export function initRouter(containerId = "app-main") {
  const container = document.getElementById(containerId);
  if (!container) return;

  function handleRoute() {
    const rawHash = window.location.hash || "#dashboard";
    const [baseHash, queryString] = rawHash.split("?");

    let routeKey = baseHash;
    if (!routes[routeKey]) {
      routeKey = "#dashboard";
    }

    // Parse query params if any
    const params = new URLSearchParams(queryString || "");
    const initialPath = params.get("path") || "";

    // Update active nav link
    document.querySelectorAll(".nav-item").forEach((el) => {
      const linkHash = el.getAttribute("href");
      if (linkHash === routeKey) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });

    // Render corresponding view
    const renderFn = routes[routeKey];
    if (renderFn) {
      if (routeKey === "#explorer") {
        renderFn(container, initialPath);
      } else {
        renderFn(container);
      }
    }
  }

  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}
