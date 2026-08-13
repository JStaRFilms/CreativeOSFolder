/**
 * Explorer View — Lightweight Studio File & Workspace Browser
 */

import { api, formatBytes } from "../api.js";
import { getFileIconSvg, icons } from "../icons.js";
import { showToast } from "../components/toast.js";

export async function renderExplorer(container, initialPath = "") {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-eyebrow">
          <span class="studio-status-indicator" style="background-color: var(--text-primary);"></span>
          <span>WORKSPACE FILE EXPLORER</span>
        </div>
        <h1 class="page-title">Workspace Explorer</h1>
        <p class="page-description">Browse project files, inspect directory trees, and launch assets natively in your default OS apps</p>
      </div>

      <div class="header-action-group">
        <button id="explorer-open-os-btn" class="btn btn-secondary" title="Open current folder in OS file manager">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open in OS
        </button>
        <button id="explorer-refresh-btn" class="btn btn-secondary" title="Refresh directory">
          ${icons.refresh}
          Refresh
        </button>
      </div>
    </div>

    <!-- Quick Root Jumps & Breadcrumb Bar -->
    <div class="explorer-nav-panel">
      <div class="explorer-quick-roots">
        <button class="quick-root-btn" data-target="" title="CreativeOS Projects Root">
          ${icons.folder}
          <span>Projects Root</span>
        </button>
      </div>

      <!-- Interactive Breadcrumb -->
      <div class="explorer-breadcrumbs" id="explorer-breadcrumbs">
        <span class="breadcrumb-item font-mono">Loading path...</span>
      </div>
    </div>

    <!-- Explorer Toolbar -->
    <div class="studio-toolbar" style="margin-top: 1rem;">
      <div class="search-box">
        <span class="search-icon">${icons.search}</span>
        <input type="text" id="explorer-search-input" class="search-input" placeholder="Filter files and folders in this folder..." />
      </div>

      <div class="toolbar-controls">
        <button id="explorer-parent-btn" class="btn btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;" disabled>
          ${icons.arrowUp}
          Up One Level
        </button>

        <div class="view-mode-toggle">
          <button class="view-toggle-btn active" id="explorer-view-grid-btn" title="Grid View" aria-label="Grid View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          <button class="view-toggle-btn" id="explorer-view-list-btn" title="Detailed List" aria-label="Detailed List">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Explorer Content Area -->
    <div id="explorer-content-area" class="explorer-content-container">
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Reading directory contents...</p>
      </div>
    </div>
  `;

  let currentPath = initialPath;
  let currentParentPath = null;
  let currentEntries = [];
  let viewMode = localStorage.getItem("cos_explorer_view_mode") || "grid";

  // Elements
  const breadcrumbsEl = document.getElementById("explorer-breadcrumbs");
  const contentAreaEl = document.getElementById("explorer-content-area");
  const searchInput = document.getElementById("explorer-search-input");
  const parentBtn = document.getElementById("explorer-parent-btn");
  const refreshBtn = document.getElementById("explorer-refresh-btn");
  const openOsBtn = document.getElementById("explorer-open-os-btn");
  const gridBtn = document.getElementById("explorer-view-grid-btn");
  const listBtn = document.getElementById("explorer-view-list-btn");

  async function loadDirectory(targetPath = "") {
    if (contentAreaEl) {
      contentAreaEl.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Scanning directory...</p>
        </div>
      `;
    }

    try {
      const data = await api.listFiles(targetPath);
      currentPath = data.current_path || "";
      currentParentPath = data.parent_path || null;
      currentEntries = data.entries || [];

      // Update Parent Button
      if (parentBtn) {
        parentBtn.disabled = !currentParentPath;
      }

      // Render Breadcrumbs
      renderBreadcrumbs(data.current_path, data.relative_display);

      // Render Entries
      renderEntries();

    } catch (err) {
      if (contentAreaEl) {
        contentAreaEl.innerHTML = `
          <div class="empty-state" style="border-color: var(--color-danger);">
            <h3 style="color: var(--color-danger); margin-bottom: 0.35rem; font-size: 1.05rem;">Cannot Access Directory</h3>
            <p style="font-size: 0.85rem; margin-bottom: 1rem;">${err.message}</p>
            <button class="btn btn-secondary" id="explorer-error-home-btn">Back to Projects Root</button>
          </div>
        `;
        document.getElementById("explorer-error-home-btn")?.addEventListener("click", () => {
          loadDirectory("");
        });
      }
      showToast(`Error: ${err.message}`, "error");
    }
  }

  function renderBreadcrumbs(fullPath, relDisplay) {
    if (!breadcrumbsEl) return;

    const normalized = (fullPath || "").replace(/\\/g, "/");
    const parts = normalized.split("/").filter(Boolean);

    let accum = "";
    const items = parts.map((part, index) => {
      if (index === 0 && part.endsWith(":")) {
        accum = part;
      } else {
        accum = accum ? `${accum}/${part}` : part;
      }
      const isLast = index === parts.length - 1;
      const stepPath = accum;

      return `
        <button class="breadcrumb-step ${isLast ? 'active' : ''}" data-path="${stepPath}" title="${stepPath}">
          ${part}
        </button>
        ${!isLast ? '<span class="breadcrumb-separator">&rsaquo;</span>' : ''}
      `;
    });

    breadcrumbsEl.innerHTML = `
      <div class="breadcrumb-trail font-mono">
        ${items.join("")}
      </div>
    `;

    breadcrumbsEl.querySelectorAll(".breadcrumb-step:not(.active)").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-path");
        if (p) loadDirectory(p);
      });
    });
  }

  function renderEntries() {
    if (!contentAreaEl) return;

    const query = (searchInput?.value || "").toLowerCase().trim();
    const filtered = currentEntries.filter(entry => {
      if (!query) return true;
      return entry.name.toLowerCase().includes(query) || (entry.type && entry.type.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      contentAreaEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--text-muted);">${icons.folder}</div>
          <h3 style="margin-bottom: 0.35rem; color: var(--text-primary); font-size: 1.05rem;">${query ? 'No Matching Items' : 'Directory is Empty'}</h3>
          <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">${query ? `No items matching "${query}" in this folder` : 'This workspace folder has no tracked files'}</p>
          ${currentParentPath ? `
            <button class="btn btn-secondary" id="explorer-empty-back-btn" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 0.45rem;">
              ${icons.arrowLeft}
              <span>Go Back One Level</span>
            </button>
          ` : ''}
        </div>
      `;

      if (currentParentPath) {
        document.getElementById("explorer-empty-back-btn")?.addEventListener("click", () => {
          loadDirectory(currentParentPath);
        });
      }
      return;
    }

    if (viewMode === "grid") {
      contentAreaEl.innerHTML = `
        <div class="explorer-grid">
          ${filtered.map(entry => {
            const iconSvg = getFileIconSvg(entry.extension, entry.is_dir);
            const sizeStr = entry.is_dir ? "Folder" : formatBytes(entry.size);
            const modDate = entry.modified ? entry.modified.substring(0, 10) : "";

            return `
              <div class="explorer-card ${entry.is_dir ? 'is-folder' : 'is-file'}" data-path="${entry.path}" data-isdir="${entry.is_dir}" tabindex="0" role="button">
                <div class="explorer-card-icon">
                  ${iconSvg}
                </div>
                <div class="explorer-card-info">
                  <span class="explorer-card-name font-mono" title="${entry.name}">${entry.name}</span>
                  <div class="explorer-card-meta font-mono">
                    <span>${sizeStr}</span>
                    <span>${modDate}</span>
                  </div>
                </div>
                <div class="explorer-card-actions">
                  <button class="icon-button item-open-btn" title="${entry.is_dir ? 'Open Folder' : 'Open Natively'}">
                    ${entry.is_dir ? icons.chevronRight : icons.externalLink}
                  </button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    } else {
      contentAreaEl.innerHTML = `
        <div class="table-container">
          <table class="studio-table explorer-table">
            <thead>
              <tr>
                <th style="width: 50%;">Name</th>
                <th style="width: 15%;">Type</th>
                <th style="width: 15%;">Size</th>
                <th style="width: 20%;">Modified</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(entry => {
                const iconSvg = getFileIconSvg(entry.extension, entry.is_dir);
                const sizeStr = entry.is_dir ? "—" : formatBytes(entry.size);
                const modDate = entry.modified ? entry.modified.substring(0, 19).replace('T', ' ') : "—";
                const typeLabel = entry.is_dir ? "Folder" : (entry.type ? entry.type.toUpperCase() : "File");

                return `
                  <tr class="explorer-row ${entry.is_dir ? 'is-folder-row' : ''}" data-path="${entry.path}" data-isdir="${entry.is_dir}">
                    <td>
                      <div class="table-name-lockup">
                        <span class="table-icon-tag">${iconSvg}</span>
                        <span class="table-title font-mono" title="${entry.name}">${entry.name}</span>
                      </div>
                    </td>
                    <td class="font-mono" style="color: var(--text-muted); font-size: 0.8rem;">${typeLabel}</td>
                    <td class="font-mono font-bold" style="font-size: 0.8rem;">${sizeStr}</td>
                    <td class="font-mono" style="color: var(--text-muted); font-size: 0.8rem;">${modDate}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // Attach Item Click Handlers
    const items = contentAreaEl.querySelectorAll(".explorer-card, .explorer-row");
    items.forEach(el => {
      const itemPath = el.getAttribute("data-path");
      const isDir = el.getAttribute("data-isdir") === "true";

      const triggerAction = async () => {
        if (isDir) {
          loadDirectory(itemPath);
        } else {
          try {
            showToast(`Opening ${itemPath.split(/[\\/]/).pop()}...`, "info", 1500);
            await api.openPath(itemPath);
          } catch (e) {
            showToast(`Failed to open: ${e.message}`, "error");
          }
        }
      };

      el.addEventListener("dblclick", (e) => {
        e.preventDefault();
        triggerAction();
      });

      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          triggerAction();
        }
      });

      el.querySelector(".item-open-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        triggerAction();
      });
    });
  }

  // Toolbar Handlers
  searchInput?.addEventListener("input", renderEntries);

  parentBtn?.addEventListener("click", () => {
    if (currentParentPath) {
      loadDirectory(currentParentPath);
    }
  });

  refreshBtn?.addEventListener("click", () => {
    loadDirectory(currentPath);
    showToast("Directory refreshed", "info", 1200);
  });

  openOsBtn?.addEventListener("click", async () => {
    if (!currentPath) return;
    try {
      showToast("Opening in OS file manager...", "info", 1500);
      await api.openPath(currentPath);
    } catch (err) {
      showToast(`Error: ${err.message}`, "error");
    }
  });

  if (viewMode === "list") {
    listBtn?.classList.add("active");
    gridBtn?.classList.remove("active");
  } else {
    gridBtn?.classList.add("active");
    listBtn?.classList.remove("active");
  }

  gridBtn?.addEventListener("click", () => {
    viewMode = "grid";
    localStorage.setItem("cos_explorer_view_mode", "grid");
    gridBtn.classList.add("active");
    listBtn?.classList.remove("active");
    renderEntries();
  });

  listBtn?.addEventListener("click", () => {
    viewMode = "list";
    localStorage.setItem("cos_explorer_view_mode", "list");
    listBtn.classList.add("active");
    gridBtn?.classList.remove("active");
    renderEntries();
  });

  // Quick Roots Jumps
  container.querySelectorAll(".quick-root-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      loadDirectory(target);
    });
  });

  // Initial Load
  await loadDirectory(initialPath);
}
