/**
 * Windows 11 Native 3-Zone Desktop Explorer View Component
 * 
 * Features:
 * - Windows 11 Chrome: Tabs bar, Navigation row (Back/Forward/Up/Refresh/Breadcrumbs/Search), Fluent Command Ribbon.
 * - Zone 1 (Tree Sidebar): Quick Access / Pinned Folders, Project Categories, Mounted Windows Drives.
 * - Zone 2 (Center Canvas):
 *     1. Large Icons Grid View
 *     2. Details Table View
 *     3. Dual-Pane External RAID Bridge (1-click Ingest via /api/fs/transfer)
 *     4. 4K Media Scrubber & Waveform Player hooked to /api/fs/raw
 * - Zone 3 (Right Details Inspector): File specifications + CreativeOS Action Deck.
 * - Modals: openNewProjectModal, openBulkReclaimModal, openLiveSyncModal, openProjectInspector.
 */

import { api, formatBytes } from "../api.js";
import { getCategoryIconSvg, getFileIconSvg, icons } from "../icons.js";
import { showToast } from "../components/toast.js";
import { toggleTheme } from "../theme.js";
import { openNewProjectModal } from "../components/newProjectModal.js";
import { openBulkReclaimModal, openReclaimModal } from "../components/reclaimModal.js";
import { openLiveSyncModal, openProjectInspector, openConfirmModal } from "../components/modal.js";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function renderDesktopExplorer(container, initialPath = "") {
  // State Initialization
  let tabs = [
    {
      id: 1,
      title: initialPath ? initialPath.split(/[\\/]/).filter(Boolean).pop() || "Explorer" : "01_Projects",
      path: initialPath || "",
      history: [initialPath || ""],
      historyIndex: 0,
    }
  ];
  let activeTabId = 1;
  let viewMode = localStorage.getItem("cos_win11_view_mode") || "grid"; // "grid" | "details" | "split" | "media"
  let sortField = localStorage.getItem("cos_win11_sort_field") || "name";
  let sortDir = localStorage.getItem("cos_win11_sort_dir") || "asc";
  let showZone3 = localStorage.getItem("cos_win11_show_inspector") !== "false";
  let selectedItem = null;
  let currentEntries = [];
  let currentParentPath = null;
  let projectsList = [];
  let storageData = null;
  let configData = null;
  let categoriesData = {};

  // Dual Pane Ingest State (View 3)
  let dualLeftPath = localStorage.getItem("cos_dual_left_path") || "Downloads";
  let dualRightPath = localStorage.getItem("cos_dual_right_path") || "01_Projects";
  let dualLeftEntries = [];
  let dualRightEntries = [];
  let dualLeftSelected = [];
  let dualMoveMode = false;
  let dualOverwrite = false;

  // Media Player State (View 4)
  let activeMediaFile = null;

  // Load Initial Data in Parallel
  try {
    const [projs, storage, conf, cats] = await Promise.all([
      api.getProjectsSWR((fresh) => { projectsList = fresh; updateSidebarBadges(); }),
      api.getStorageSWR((fresh) => { storageData = fresh; }),
      api.getConfigSWR((fresh) => { configData = fresh; }),
      api.getCategoriesSWR((fresh) => { categoriesData = fresh.categories || {}; }),
    ]);
    projectsList = projs || [];
    storageData = storage || null;
    configData = conf || null;
    categoriesData = cats?.categories || {};
  } catch (e) {
    console.warn("[Explorer SWR]", e);
  }

  function getActiveTab() {
    return tabs.find(t => t.id === activeTabId) || tabs[0];
  }

  function updateActiveTabPath(newPath, recordHistory = true) {
    const tab = getActiveTab();
    if (!tab) return;

    tab.path = newPath;
    tab.title = newPath ? newPath.split(/[\\/]/).filter(Boolean).pop() || "Folder" : "01_Projects";

    if (recordHistory) {
      if (tab.historyIndex < tab.history.length - 1) {
        tab.history = tab.history.slice(0, tab.historyIndex + 1);
      }
      tab.history.push(newPath);
      tab.historyIndex = tab.history.length - 1;
    }

    renderTabsBar();
    loadCurrentDirectory();
  }

  // Render Skeleton Shell
  container.innerHTML = `
    <div class="win11-explorer-root" id="win11-explorer-root">
      <!-- Windows 11 Chrome: Tab Bar -->
      <div class="win11-chrome-tabs-bar" id="win11-tabs-bar">
        <!-- Rendered by renderTabsBar() -->
      </div>

      <!-- Navigation & Address Row -->
      <div class="win11-nav-row">
        <div class="win11-nav-buttons">
          <button class="win11-nav-btn" id="win11-nav-back" title="Back (Alt+Left)" disabled>${icons.arrowLeft}</button>
          <button class="win11-nav-btn" id="win11-nav-forward" title="Forward (Alt+Right)" disabled>${icons.arrowRight}</button>
          <button class="win11-nav-btn" id="win11-nav-up" title="Up to Parent Directory (Alt+Up)" disabled>${icons.arrowUp}</button>
          <button class="win11-nav-btn" id="win11-nav-refresh" title="Refresh (F5)">${icons.refresh}</button>
        </div>

        <!-- Interactive Breadcrumbs Bar -->
        <div class="win11-address-bar" id="win11-address-bar">
          <div class="win11-address-icon">${icons.folder}</div>
          <div class="win11-breadcrumbs-list" id="win11-breadcrumbs-list"></div>
          <input type="text" class="win11-address-input font-mono" id="win11-address-input" style="display: none;" />
          <button class="win11-address-action-btn" id="win11-copy-address-btn" title="Copy Path">${icons.copy}</button>
        </div>

        <!-- Search Box -->
        <div class="win11-search-box">
          <span class="win11-search-icon">${icons.search}</span>
          <input type="text" id="win11-search-input" class="win11-search-input" placeholder="Search directory..." />
        </div>
      </div>

      <!-- Command Ribbon -->
      <div class="win11-command-ribbon">
        <div class="win11-ribbon-group">
          <button class="win11-ribbon-btn primary" id="win11-btn-new-project">
            ${icons.plus}
            <span>New Project</span>
          </button>
        </div>

        <div class="win11-ribbon-divider"></div>

        <!-- View Engine Selector -->
        <div class="win11-ribbon-group">
          <button class="win11-ribbon-btn ${viewMode === 'grid' ? 'active' : ''}" id="win11-btn-view-grid" title="Large Icons Grid">
            ${icons.grid}
            <span>Grid</span>
          </button>
          <button class="win11-ribbon-btn ${viewMode === 'details' ? 'active' : ''}" id="win11-btn-view-details" title="Details Table View">
            ${icons.table}
            <span>Details</span>
          </button>
          <button class="win11-ribbon-btn ${viewMode === 'split' ? 'active' : ''}" id="win11-btn-view-split" title="Dual-Pane External RAID Bridge">
            ${icons.split}
            <span>RAID Ingest</span>
          </button>
          <button class="win11-ribbon-btn ${viewMode === 'media' ? 'active' : ''}" id="win11-btn-view-media" title="4K Media Scrubber & Waveform Player">
            ${icons.media}
            <span>Media Player</span>
          </button>
        </div>

        <div class="win11-ribbon-divider"></div>

        <!-- Quick Studio Automations -->
        <div class="win11-ribbon-group">
          <button class="win11-ribbon-btn" id="win11-btn-clean-downloads" title="Sort loose downloads into organized subfolders">
            ${icons.broom}
            <span>Clean Downloads</span>
          </button>
          <button class="win11-ribbon-btn" id="win11-btn-sort-inbox" title="Sort exports into monthly folders">
            ${icons.inbox}
            <span>Sort Inbox</span>
          </button>
          <button class="win11-ribbon-btn" id="win11-btn-sync-vault" title="Obsidian Brain Live SSE Sync">
            ${icons.sync}
            <span>Sync Vault</span>
          </button>
          <button class="win11-ribbon-btn" id="win11-btn-bulk-reclaim" title="Reclaim dependency & build caches">
            ${icons.zap}
            <span>Bulk Reclaim</span>
          </button>
        </div>

        <div class="win11-ribbon-divider"></div>

        <div class="win11-ribbon-group win11-ribbon-right">
          <button class="win11-ribbon-btn" id="win11-btn-theme-toggle" title="Toggle Light / Dark Theme">
            ${icons.eye}
            <span>Theme</span>
          </button>
          <button class="win11-ribbon-btn ${showZone3 ? 'active' : ''}" id="win11-btn-toggle-inspector" title="Toggle Right Details Inspector">
            ${icons.sidebar || icons.info}
            <span>Details</span>
          </button>
        </div>
      </div>

      <!-- Main 3-Zone Workspace Body -->
      <div class="win11-workspace-layout ${showZone3 ? 'with-inspector' : ''}" id="win11-workspace-layout">
        <!-- Zone 1: Tree Sidebar -->
        <aside class="win11-zone1-sidebar" id="win11-sidebar">
          <div class="win11-sidebar-scroll">
            <!-- Quick Access / Pinned Folders -->
            <div class="win11-sidebar-section">
              <div class="win11-section-header">
                <span>QUICK ACCESS</span>
              </div>
              <ul class="win11-nav-tree">
                <li class="win11-tree-item" data-path="" title="CreativeOS Projects Workspace">
                  <span class="win11-tree-icon" style="color: var(--color-primary);">${icons.folder}</span>
                  <span class="win11-tree-label">Projects Root</span>
                </li>
                <li class="win11-tree-item" data-path="00_Notes" title="Obsidian Brain Vault">
                  <span class="win11-tree-icon" style="color: var(--color-success);">${icons.notes}</span>
                  <span class="win11-tree-label">00_Notes (Vault)</span>
                </li>
                <li class="win11-tree-item" data-path="02_Exports" title="Render Exports Inbox">
                  <span class="win11-tree-icon" style="color: var(--color-accent-cyan);">${icons.exportFolder}</span>
                  <span class="win11-tree-label">02_Exports</span>
                </li>
                <li class="win11-tree-item" data-path="Downloads" title="User Downloads Folder">
                  <span class="win11-tree-icon" style="color: #3b82f6;">${icons.download}</span>
                  <span class="win11-tree-label">Downloads</span>
                </li>
                <li class="win11-tree-item" data-path="Desktop" title="User Desktop">
                  <span class="win11-tree-icon" style="color: #6366f1;">${icons.desktop}</span>
                  <span class="win11-tree-label">Desktop</span>
                </li>
              </ul>
            </div>

            <!-- Project Categories -->
            <div class="win11-sidebar-section">
              <div class="win11-section-header">
                <span>CATEGORIES</span>
              </div>
              <ul class="win11-nav-tree" id="win11-categories-tree">
                <li class="win11-tree-item" data-path="Video">
                  <span class="win11-tree-icon">${icons.video}</span>
                  <span class="win11-tree-label">Video</span>
                  <span class="win11-tree-badge" id="badge-cat-Video">0</span>
                </li>
                <li class="win11-tree-item" data-path="Code">
                  <span class="win11-tree-icon">${icons.code}</span>
                  <span class="win11-tree-label">Code</span>
                  <span class="win11-tree-badge" id="badge-cat-Code">0</span>
                </li>
                <li class="win11-tree-item" data-path="Audio">
                  <span class="win11-tree-icon">${icons.audio}</span>
                  <span class="win11-tree-label">Audio &amp; Music</span>
                  <span class="win11-tree-badge" id="badge-cat-Audio">0</span>
                </li>
                <li class="win11-tree-item" data-path="AI">
                  <span class="win11-tree-icon">${icons.ai}</span>
                  <span class="win11-tree-label">AI &amp; ML</span>
                  <span class="win11-tree-badge" id="badge-cat-AI">0</span>
                </li>
                <li class="win11-tree-item" data-path="Design">
                  <span class="win11-tree-icon">${icons.design}</span>
                  <span class="win11-tree-label">Design &amp; 3D</span>
                  <span class="win11-tree-badge" id="badge-cat-Design">0</span>
                </li>
                <li class="win11-tree-item" data-path="Photo">
                  <span class="win11-tree-icon">${icons.photo}</span>
                  <span class="win11-tree-label">Photo</span>
                  <span class="win11-tree-badge" id="badge-cat-Photo">0</span>
                </li>
                <li class="win11-tree-item" data-path="Clients">
                  <span class="win11-tree-icon">${icons.client}</span>
                  <span class="win11-tree-label">Clients</span>
                  <span class="win11-tree-badge" id="badge-cat-Clients">0</span>
                </li>
              </ul>
            </div>

            <!-- Mounted Windows Drives & Cold Storage -->
            <div class="win11-sidebar-section">
              <div class="win11-section-header">
                <span>THIS PC &amp; DRIVES</span>
              </div>
              <ul class="win11-nav-tree">
                <li class="win11-tree-item" data-path="01_Projects" title="CreativeOS Projects Root">
                  <span class="win11-tree-icon" style="color: var(--color-primary);">${icons.drive}</span>
                  <span class="win11-tree-label">Projects Root (C:)</span>
                </li>
                <li class="win11-tree-item" data-path="D:\\" title="Work Drive (D:)">
                  <span class="win11-tree-icon">${icons.drive}</span>
                  <span class="win11-tree-label">Storage (D:)</span>
                </li>
                <li class="win11-tree-item" data-path="E:\\" title="External Media Drive (E:)">
                  <span class="win11-tree-icon">${icons.drive}</span>
                  <span class="win11-tree-label">Media RAID (E:)</span>
                </li>
              </ul>
            </div>
          </div>
        </aside>

        <!-- Zone 2: Center Canvas (Dynamic View Engines) -->
        <main class="win11-zone2-canvas" id="win11-canvas">
          <div class="win11-canvas-loading">
            <div class="spinner"></div>
            <p>Loading files...</p>
          </div>
        </main>

        <!-- Zone 3: Right Details Inspector & Action Deck -->
        <aside class="win11-zone3-inspector" id="win11-inspector" style="${showZone3 ? '' : 'display: none;'}">
          <!-- Rendered by renderInspector() -->
        </aside>
      </div>

      <!-- Windows 11 Status Bar -->
      <footer class="win11-status-bar" id="win11-status-bar">
        <div class="win11-status-left">
          <span id="win11-status-count">0 items</span>
          <span class="win11-status-sep">|</span>
          <span id="win11-status-selection">No item selected</span>
        </div>
        <div class="win11-status-right">
          <span class="font-mono" id="win11-status-storage-summary">CreativeOS Studio Engine</span>
        </div>
      </footer>
    </div>
  `;

  // DOM Elements References
  const tabsBarEl = document.getElementById("win11-tabs-bar");
  const breadcrumbsListEl = document.getElementById("win11-breadcrumbs-list");
  const addressInputEl = document.getElementById("win11-address-input");
  const addressBarEl = document.getElementById("win11-address-bar");
  const canvasEl = document.getElementById("win11-canvas");
  const inspectorEl = document.getElementById("win11-inspector");
  const searchInputEl = document.getElementById("win11-search-input");
  const navBackBtn = document.getElementById("win11-nav-back");
  const navForwardBtn = document.getElementById("win11-nav-forward");
  const navUpBtn = document.getElementById("win11-nav-up");
  const navRefreshBtn = document.getElementById("win11-nav-refresh");
  const copyAddressBtn = document.getElementById("win11-copy-address-btn");
  const statusCountEl = document.getElementById("win11-status-count");
  const statusSelectionEl = document.getElementById("win11-status-selection");
  const workspaceLayoutEl = document.getElementById("win11-workspace-layout");

  // ──────────────────────────────────────────────────────────────────────────
  // Tab Bar Management
  // ──────────────────────────────────────────────────────────────────────────
  function renderTabsBar() {
    if (!tabsBarEl) return;

    tabsBarEl.innerHTML = `
      <div class="win11-tabs-list">
        ${tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return `
            <div class="win11-tab-item ${isActive ? 'active' : ''}" data-tab-id="${tab.id}">
              <span class="win11-tab-icon">${icons.folder}</span>
              <span class="win11-tab-title font-mono" title="${tab.title}">${escapeHtml(tab.title)}</span>
              ${tabs.length > 1 ? `
                <button class="win11-tab-close-btn" data-close-tab="${tab.id}" title="Close tab">
                  ${icons.x}
                </button>
              ` : ''}
            </div>
          `;
        }).join("")}
        <button class="win11-tab-add-btn" id="win11-tab-add-btn" title="New Tab (Ctrl+T)">
          ${icons.plus}
        </button>
      </div>
    `;

    tabsBarEl.querySelectorAll(".win11-tab-item").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".win11-tab-close-btn")) return;
        const id = Number(item.getAttribute("data-tab-id"));
        if (id !== activeTabId) {
          activeTabId = id;
          renderTabsBar();
          loadCurrentDirectory();
        }
      });
    });

    tabsBarEl.querySelectorAll(".win11-tab-close-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = Number(btn.getAttribute("data-close-tab"));
        tabs = tabs.filter(t => t.id !== id);
        if (activeTabId === id) {
          activeTabId = tabs[tabs.length - 1].id;
        }
        renderTabsBar();
        loadCurrentDirectory();
      });
    });

    document.getElementById("win11-tab-add-btn")?.addEventListener("click", () => {
      const newId = Date.now();
      tabs.push({
        id: newId,
        title: "01_Projects",
        path: "",
        history: [""],
        historyIndex: 0,
      });
      activeTabId = newId;
      renderTabsBar();
      loadCurrentDirectory();
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Breadcrumbs & Address Bar
  // ──────────────────────────────────────────────────────────────────────────
  function renderBreadcrumbs(fullPath, relDisplay) {
    if (!breadcrumbsListEl) return;

    const currentP = getActiveTab().path;
    const norm = (fullPath || currentP || "01_Projects").replace(/\\/g, "/");
    const segments = norm.split("/").filter(Boolean);

    let accum = "";
    const crumbs = segments.map((seg, idx) => {
      if (idx === 0 && seg.endsWith(":")) {
        accum = seg;
      } else {
        accum = accum ? `${accum}/${seg}` : seg;
      }
      const isLast = idx === segments.length - 1;
      const targetP = accum === "01_Projects" ? "" : accum;

      return `
        <button class="win11-breadcrumb-btn ${isLast ? 'active' : ''}" data-path="${targetP}" title="${accum}">
          ${seg}
        </button>
        ${!isLast ? '<span class="win11-breadcrumb-sep">&rsaquo;</span>' : ''}
      `;
    });

    breadcrumbsListEl.innerHTML = crumbs.join("");

    breadcrumbsListEl.querySelectorAll(".win11-breadcrumb-btn:not(.active)").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-path");
        updateActiveTabPath(p);
      });
    });
  }

  function updateSidebarBadges() {
    if (!projectsList) return;
    const catCounts = {
      Video: 0, Code: 0, Audio: 0, AI: 0, Design: 0, Photo: 0, Clients: 0
    };

    projectsList.forEach(p => {
      const cat = p.type || "Video";
      if (p.client && p.client !== "None") {
        catCounts.Clients = (catCounts.Clients || 0) + 1;
      }
      if (catCounts[cat] !== undefined) {
        catCounts[cat]++;
      }
    });

    Object.entries(catCounts).forEach(([cat, count]) => {
      const el = document.getElementById(`badge-cat-${cat}`);
      if (el) el.textContent = String(count);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Main Directory Loader
  // ──────────────────────────────────────────────────────────────────────────
  async function loadCurrentDirectory() {
    const tab = getActiveTab();
    const targetPath = tab.path;

    // Update navigation button states
    if (navBackBtn) navBackBtn.disabled = tab.historyIndex <= 0;
    if (navForwardBtn) navForwardBtn.disabled = tab.historyIndex >= tab.history.length - 1;

    // Highlight active sidebar item
    document.querySelectorAll(".win11-tree-item").forEach(item => {
      const p = item.getAttribute("data-path");
      if (p === targetPath || (p === "" && !targetPath)) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    if (viewMode === "split") {
      renderDualPaneView();
      return;
    }

    if (viewMode === "media") {
      renderMediaScrubberView();
      return;
    }

    if (canvasEl) {
      canvasEl.innerHTML = `
        <div class="win11-canvas-loading">
          <div class="spinner"></div>
          <p>Scanning directory contents...</p>
        </div>
      `;
    }

    try {
      const res = await api.listFiles(targetPath);
      currentEntries = res.entries || [];
      currentParentPath = res.parent_path || null;

      if (navUpBtn) navUpBtn.disabled = !currentParentPath;

      renderBreadcrumbs(res.current_path, res.relative_display);
      renderCanvasEntries();

      if (statusCountEl) {
        statusCountEl.textContent = `${currentEntries.length} item${currentEntries.length === 1 ? '' : 's'}`;
      }

      // Automatically select first item if none selected
      if (currentEntries.length > 0) {
        selectCanvasItem(currentEntries[0]);
      } else {
        selectCanvasItem(null);
      }
    } catch (err) {
      if (canvasEl) {
        canvasEl.innerHTML = `
          <div class="win11-empty-canvas">
            <div class="win11-empty-icon" style="color: var(--color-danger);">${icons.warning}</div>
            <h3>Unable to Access Directory</h3>
            <p>${escapeHtml(err.message)}</p>
            <button class="btn btn-secondary" id="win11-btn-reset-root">Return to Projects Root</button>
          </div>
        `;
        document.getElementById("win11-btn-reset-root")?.addEventListener("click", () => {
          updateActiveTabPath("");
        });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Zone 2 Canvas Renderers: View 1 (Grid) & View 2 (Details)
  // ──────────────────────────────────────────────────────────────────────────
  function sortEntries(entries) {
    return [...entries].sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;

      let comp = 0;
      if (sortField === "name") {
        comp = (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
      } else if (sortField === "type") {
        const typeA = a.is_dir ? "Folder" : (a.type || a.extension || "");
        const typeB = b.is_dir ? "Folder" : (b.type || b.extension || "");
        comp = typeA.localeCompare(typeB, undefined, { numeric: true, sensitivity: "base" });
      } else if (sortField === "size") {
        comp = (a.size || 0) - (b.size || 0);
      } else if (sortField === "modified") {
        const dA = a.modified ? new Date(a.modified).getTime() : 0;
        const dB = b.modified ? new Date(b.modified).getTime() : 0;
        comp = dA - dB;
      }
      return sortDir === "desc" ? -comp : comp;
    });
  }

  function renderCanvasEntries() {
    if (!canvasEl) return;

    const query = (searchInputEl?.value || "").toLowerCase().trim();
    let filtered = currentEntries.filter(e => {
      if (!query) return true;
      return e.name.toLowerCase().includes(query) || (e.type && e.type.toLowerCase().includes(query));
    });

    filtered = sortEntries(filtered);

    if (filtered.length === 0) {
      canvasEl.innerHTML = `
        <div class="win11-empty-canvas">
          <div class="win11-empty-icon">${icons.folder}</div>
          <h3>${query ? 'No matching items found' : 'This folder is empty'}</h3>
          <p>${query ? `No files matching "${query}" in this directory` : 'Create a new project or drop assets into this folder'}</p>
        </div>
      `;
      return;
    }

    if (viewMode === "grid") {
      canvasEl.innerHTML = `
        <div class="win11-grid-view">
          ${filtered.map(entry => {
            const isDir = entry.is_dir;
            const iconSvg = getFileIconSvg(entry.extension, isDir);
            const isSel = selectedItem && selectedItem.path === entry.path;
            const sizeStr = isDir ? "Folder" : formatBytes(entry.size);
            const modDate = entry.modified ? entry.modified.substring(0, 10) : "";

            return `
              <div class="win11-file-tile ${isDir ? 'is-folder' : 'is-file'} ${isSel ? 'is-selected' : ''}" data-path="${entry.path}" data-isdir="${isDir}" tabindex="0" role="button">
                <div class="win11-tile-preview">
                  ${iconSvg}
                </div>
                <div class="win11-tile-details">
                  <span class="win11-tile-name font-mono" title="${entry.name}">${escapeHtml(entry.name)}</span>
                  <div class="win11-tile-meta font-mono">
                    <span>${sizeStr}</span>
                    <span>&bull;</span>
                    <span>${modDate}</span>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    } else {
      // Details Table View
      canvasEl.innerHTML = `
        <div class="win11-table-wrapper">
          <table class="win11-details-table">
            <thead>
              <tr>
                <th class="col-sortable ${sortField === 'name' ? 'sorted' : ''}" data-sort="name">
                  <span>Name</span>
                  ${sortField === 'name' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th class="col-sortable ${sortField === 'modified' ? 'sorted' : ''}" data-sort="modified">
                  <span>Date modified</span>
                  ${sortField === 'modified' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th class="col-sortable ${sortField === 'type' ? 'sorted' : ''}" data-sort="type">
                  <span>Type</span>
                  ${sortField === 'type' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th class="col-sortable ${sortField === 'size' ? 'sorted' : ''}" data-sort="size">
                  <span>Size</span>
                  ${sortField === 'size' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(entry => {
                const isDir = entry.is_dir;
                const iconSvg = getFileIconSvg(entry.extension, isDir);
                const isSel = selectedItem && selectedItem.path === entry.path;
                const sizeStr = isDir ? "" : formatBytes(entry.size);
                const modDate = entry.modified ? entry.modified.substring(0, 19).replace("T", " ") : "—";
                const typeStr = isDir ? "File folder" : (entry.type ? `${entry.type.toUpperCase()} file` : "File");

                return `
                  <tr class="win11-table-row ${isDir ? 'is-folder' : 'is-file'} ${isSel ? 'is-selected' : ''}" data-path="${entry.path}" data-isdir="${isDir}">
                    <td class="col-name">
                      <div class="win11-name-cell">
                        <span class="win11-cell-icon">${iconSvg}</span>
                        <span class="win11-cell-text font-mono" title="${entry.name}">${escapeHtml(entry.name)}</span>
                      </div>
                    </td>
                    <td class="col-date font-mono">${modDate}</td>
                    <td class="col-type font-mono">${typeStr}</td>
                    <td class="col-size font-mono">${sizeStr}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;

      // Header sorting handlers
      canvasEl.querySelectorAll("th.col-sortable").forEach(th => {
        th.addEventListener("click", () => {
          const field = th.getAttribute("data-sort");
          if (sortField === field) {
            sortDir = sortDir === "asc" ? "desc" : "asc";
          } else {
            sortField = field;
            sortDir = (field === "size" || field === "modified") ? "desc" : "asc";
          }
          localStorage.setItem("cos_win11_sort_field", sortField);
          localStorage.setItem("cos_win11_sort_dir", sortDir);
          renderCanvasEntries();
        });
      });
    }

    // Attach Selection & Navigation handlers to tiles / rows
    canvasEl.querySelectorAll(".win11-file-tile, .win11-table-row").forEach(el => {
      const p = el.getAttribute("data-path");
      const isDir = el.getAttribute("data-isdir") === "true";
      const entry = currentEntries.find(e => e.path === p);

      el.addEventListener("click", () => {
        if (entry) selectCanvasItem(entry);
      });

      el.addEventListener("dblclick", () => {
        if (isDir) {
          updateActiveTabPath(p);
        } else {
          api.openPath(p).catch(err => showToast(`Cannot open: ${err.message}`, "error"));
        }
      });
    });
  }

  function selectCanvasItem(entry) {
    selectedItem = entry;

    canvasEl.querySelectorAll(".win11-file-tile, .win11-table-row").forEach(el => {
      if (entry && el.getAttribute("data-path") === entry.path) {
        el.classList.add("is-selected");
      } else {
        el.classList.remove("is-selected");
      }
    });

    if (statusSelectionEl) {
      if (entry) {
        statusSelectionEl.textContent = `Selected: ${entry.name} (${entry.is_dir ? 'Folder' : formatBytes(entry.size)})`;
      } else {
        statusSelectionEl.textContent = "No item selected";
      }
    }

    if (showZone3) {
      renderInspector(entry);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // View 3: Dual-Pane External RAID Bridge (Side-by-side Ingest)
  // ──────────────────────────────────────────────────────────────────────────
  async function renderDualPaneView() {
    if (!canvasEl) return;

    canvasEl.innerHTML = `
      <div class="win11-dual-pane-container">
        <!-- Dual Pane Header & Ingest Action Strip -->
        <div class="win11-dual-top-bar">
          <div class="win11-dual-status">
            <span class="win11-dual-tag font-mono">DUAL-PANE RAID INGEST BRIDGE</span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Transfer footage, stems, and project assets with 1-click Ingest</span>
          </div>

          <div class="win11-dual-actions">
            <label class="win11-dual-switch">
              <input type="checkbox" id="dual-mode-move" ${dualMoveMode ? 'checked' : ''} />
              <span>Move instead of Copy</span>
            </label>
            <label class="win11-dual-switch">
              <input type="checkbox" id="dual-mode-overwrite" ${dualOverwrite ? 'checked' : ''} />
              <span>Overwrite existing</span>
            </label>
            <button class="btn btn-primary" id="dual-execute-ingest-btn" disabled>
              ${icons.download}
              <span>Ingest to Destination</span>
            </button>
          </div>
        </div>

        <!-- Left & Right Side-by-Side Panes -->
        <div class="win11-dual-panes-split">
          <!-- Left Pane (Source Drive / Ingest Folder) -->
          <div class="win11-dual-pane" id="win11-dual-left-pane">
            <div class="win11-pane-header">
              <div class="win11-pane-title">
                <span style="color: var(--color-warning);">${icons.drive}</span>
                <span class="font-bold">Source Drive (RAID / Card)</span>
              </div>
              <div class="win11-pane-path-bar">
                <input type="text" class="win11-pane-input font-mono" id="dual-left-path-inp" value="${dualLeftPath}" placeholder="E:\\ or Downloads" />
                <button class="win11-nav-btn" id="dual-left-refresh-btn" title="Refresh">${icons.refresh}</button>
              </div>
            </div>
            <div class="win11-pane-body" id="dual-left-body">
              <div class="spinner"></div>
            </div>
          </div>

          <!-- Ingest Direction Arrow Divider -->
          <div class="win11-dual-divider">
            <div class="win11-divider-pill" title="Ingest direction: Source &rarr; Destination">
              &rarr;
            </div>
          </div>

          <!-- Right Pane (Destination Project Workspace) -->
          <div class="win11-dual-pane" id="win11-dual-right-pane">
            <div class="win11-pane-header">
              <div class="win11-pane-title">
                <span style="color: var(--color-success);">${icons.folder}</span>
                <span class="font-bold">Destination Workspace Project</span>
              </div>
              <div class="win11-pane-path-bar">
                <input type="text" class="win11-pane-input font-mono" id="dual-right-path-inp" value="${dualRightPath}" placeholder="01_Projects\\Video\\...\\01_RAW" />
                <button class="win11-nav-btn" id="dual-right-refresh-btn" title="Refresh">${icons.refresh}</button>
              </div>
            </div>
            <div class="win11-pane-body" id="dual-right-body">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach Dual Pane Handlers
    const leftInp = document.getElementById("dual-left-path-inp");
    const rightInp = document.getElementById("dual-right-path-inp");
    const leftRefresh = document.getElementById("dual-left-refresh-btn");
    const rightRefresh = document.getElementById("dual-right-refresh-btn");
    const ingestBtn = document.getElementById("dual-execute-ingest-btn");
    const moveCheck = document.getElementById("dual-mode-move");
    const overCheck = document.getElementById("dual-mode-overwrite");

    moveCheck?.addEventListener("change", () => { dualMoveMode = moveCheck.checked; });
    overCheck?.addEventListener("change", () => { dualOverwrite = overCheck.checked; });

    leftInp?.addEventListener("change", () => {
      dualLeftPath = leftInp.value.trim();
      localStorage.setItem("cos_dual_left_path", dualLeftPath);
      loadDualLeft();
    });

    rightInp?.addEventListener("change", () => {
      dualRightPath = rightInp.value.trim();
      localStorage.setItem("cos_dual_right_path", dualRightPath);
      loadDualRight();
    });

    leftRefresh?.addEventListener("click", loadDualLeft);
    rightRefresh?.addEventListener("click", loadDualRight);

    async function loadDualLeft() {
      const body = document.getElementById("dual-left-body");
      if (!body) return;
      body.innerHTML = `<div class="spinner"></div>`;
      try {
        const res = await api.listFiles(dualLeftPath);
        dualLeftEntries = res.entries || [];
        dualLeftSelected = [];
        updateIngestBtn();

        body.innerHTML = `
          <div class="win11-pane-table-wrapper">
            <table class="win11-details-table">
              <thead>
                <tr>
                  <th style="width: 32px;"><input type="checkbox" id="dual-left-select-all" /></th>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                ${dualLeftEntries.map(e => `
                  <tr class="win11-dual-row" data-path="${e.path}">
                    <td><input type="checkbox" class="dual-left-item-cb" data-path="${e.path}" /></td>
                    <td>
                      <div class="win11-name-cell">
                        <span class="win11-cell-icon">${getFileIconSvg(e.extension, e.is_dir)}</span>
                        <span class="win11-cell-text font-mono">${escapeHtml(e.name)}</span>
                      </div>
                    </td>
                    <td class="font-mono">${e.is_dir ? '—' : formatBytes(e.size)}</td>
                    <td class="font-mono">${e.is_dir ? 'Folder' : (e.type || 'File')}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;

        const selectAll = document.getElementById("dual-left-select-all");
        selectAll?.addEventListener("change", () => {
          body.querySelectorAll(".dual-left-item-cb").forEach(cb => {
            cb.checked = selectAll.checked;
          });
          dualLeftSelected = selectAll.checked ? dualLeftEntries.map(e => e.path) : [];
          updateIngestBtn();
        });

        body.querySelectorAll(".dual-left-item-cb").forEach(cb => {
          cb.addEventListener("change", () => {
            const p = cb.getAttribute("data-path");
            if (cb.checked) {
              dualLeftSelected.push(p);
            } else {
              dualLeftSelected = dualLeftSelected.filter(item => item !== p);
            }
            updateIngestBtn();
          });
        });
      } catch (e) {
        body.innerHTML = `<div class="win11-empty-canvas"><p style="color: var(--color-danger);">${escapeHtml(e.message)}</p></div>`;
      }
    }

    async function loadDualRight() {
      const body = document.getElementById("dual-right-body");
      if (!body) return;
      body.innerHTML = `<div class="spinner"></div>`;
      try {
        const res = await api.listFiles(dualRightPath);
        dualRightEntries = res.entries || [];

        body.innerHTML = `
          <div class="win11-pane-table-wrapper">
            <table class="win11-details-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Date Modified</th>
                </tr>
              </thead>
              <tbody>
                ${dualRightEntries.map(e => `
                  <tr>
                    <td>
                      <div class="win11-name-cell">
                        <span class="win11-cell-icon">${getFileIconSvg(e.extension, e.is_dir)}</span>
                        <span class="win11-cell-text font-mono">${escapeHtml(e.name)}</span>
                      </div>
                    </td>
                    <td class="font-mono">${e.is_dir ? '—' : formatBytes(e.size)}</td>
                    <td class="font-mono">${e.modified ? e.modified.substring(0, 10) : '—'}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      } catch (e) {
        body.innerHTML = `<div class="win11-empty-canvas"><p style="color: var(--color-danger);">${escapeHtml(e.message)}</p></div>`;
      }
    }

    function updateIngestBtn() {
      if (!ingestBtn) return;
      const count = dualLeftSelected.length;
      ingestBtn.disabled = count === 0;
      ingestBtn.innerHTML = `
        ${icons.download}
        <span>Ingest ${count} Selected Item${count === 1 ? '' : 's'}</span>
      `;
    }

    ingestBtn?.addEventListener("click", async () => {
      if (dualLeftSelected.length === 0) return;
      if (!dualRightPath || !dualRightPath.trim()) {
        showToast("Please enter or select a destination project folder in the right pane.", "warning");
        return;
      }
      ingestBtn.disabled = true;
      ingestBtn.innerHTML = `<span class="spinner" style="width: 12px; height: 12px; border-width: 2px; margin: 0;"></span> Ingesting...`;

      let transferredCount = 0;
      for (const src of dualLeftSelected) {
        try {
          await api.transfer({
            source: src,
            destination: dualRightPath || "",
            move: dualMoveMode,
            overwrite: dualOverwrite,
          });
          transferredCount++;
        } catch (err) {
          showToast(`Ingest failed for ${src}: ${err.message}`, "error");
        }
      }

      showToast(`Successfully ingested ${transferredCount} item(s)!`, "success");
      loadDualLeft();
      loadDualRight();
    });

    loadDualLeft();
    loadDualRight();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // View 4: 4K Media Scrubber & Waveform Player
  // ──────────────────────────────────────────────────────────────────────────
  async function renderMediaScrubberView() {
    if (!canvasEl) return;

    const tab = getActiveTab();
    let mediaFiles = [];
    try {
      const res = await api.listFiles(tab.path);
      mediaFiles = (res.entries || []).filter(e => {
        const ext = (e.extension || "").toLowerCase();
        return [".mp4", ".mov", ".mkv", ".webm", ".m4v", ".mp3", ".wav", ".aac", ".flac", ".ogg", ".jpg", ".png", ".webp"].includes(ext);
      });
    } catch {}

    if (!activeMediaFile && mediaFiles.length > 0) {
      activeMediaFile = mediaFiles[0];
    }

    const isVideo = activeMediaFile && [".mp4", ".mov", ".mkv", ".webm", ".m4v"].includes(activeMediaFile.extension.toLowerCase());
    const isAudio = activeMediaFile && [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"].includes(activeMediaFile.extension.toLowerCase());
    const rawUrl = activeMediaFile ? api.getRawFileUrl(activeMediaFile.path) : "";

    canvasEl.innerHTML = `
      <div class="win11-media-scrubber-container">
        <div class="win11-scrubber-main">
          <!-- Main Player Display -->
          <div class="win11-player-viewport">
            ${activeMediaFile ? (
              isVideo ? `
                <video id="win11-video-player" class="win11-video-screen" src="${rawUrl}" playsinline preload="auto"></video>
              ` : (
                isAudio ? `
                  <div class="win11-audio-hero">
                    <div class="win11-audio-waves">
                      ${Array.from({ length: 32 }).map(() => `<span class="wave-bar" style="height: ${Math.floor(Math.random() * 80 + 20)}%;"></span>`).join("")}
                    </div>
                    <audio id="win11-video-player" src="${rawUrl}"></audio>
                    <span class="font-mono" style="font-size: 1.1rem; font-weight: 700; margin-top: 1rem;">${activeMediaFile.name}</span>
                  </div>
                ` : `
                  <img src="${rawUrl}" class="win11-image-screen" alt="${escapeHtml(activeMediaFile.name)}" />
                `
              )
            ) : `
              <div class="win11-empty-canvas">
                <div class="win11-empty-icon">${icons.video}</div>
                <h3>No Media Files in Current Folder</h3>
                <p>Navigate to a folder with video or audio assets to launch the scrubber.</p>
              </div>
            `}
          </div>

          <!-- Precision Transport Controls -->
          ${activeMediaFile && (isVideo || isAudio) ? `
            <div class="win11-transport-deck">
              <div class="win11-scrub-timeline">
                <input type="range" id="win11-timeline-slider" min="0" max="100" value="0" step="0.05" class="win11-timeline-range" />
              </div>

              <div class="win11-transport-controls">
                <div class="win11-transport-left">
                  <button class="win11-transport-btn" id="win11-btn-play-pause" title="Play / Pause (Space)">${icons.play}</button>
                  <span class="win11-timecode font-mono" id="win11-timecode-display">00:00:00 / 00:00:00</span>
                </div>

                <div class="win11-transport-right">
                  <button class="win11-transport-btn" id="win11-btn-loop" title="Toggle Loop">${icons.sync}</button>
                  <button class="win11-transport-btn" id="win11-btn-fullscreen" title="Fullscreen">${icons.maximize || icons.eye}</button>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Playlist / Media Queue Sidebar -->
        <aside class="win11-media-playlist">
          <div class="win11-playlist-header">
            <span class="font-bold">MEDIA ASSETS</span>
            <span class="badge font-mono">${mediaFiles.length} files</span>
          </div>
          <div class="win11-playlist-list">
            ${mediaFiles.map(m => `
              <div class="win11-playlist-item ${activeMediaFile && activeMediaFile.path === m.path ? 'active' : ''}" data-path="${m.path}">
                <span class="win11-playlist-icon">${getFileIconSvg(m.extension, false)}</span>
                <div class="win11-playlist-info">
                  <span class="win11-playlist-name font-mono" title="${m.name}">${escapeHtml(m.name)}</span>
                  <span class="win11-playlist-size font-mono">${formatBytes(m.size)}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </aside>
      </div>
    `;

    // Wire Player Events
    const player = document.getElementById("win11-video-player");
    const playPauseBtn = document.getElementById("win11-btn-play-pause");
    const slider = document.getElementById("win11-timeline-slider");
    const timecode = document.getElementById("win11-timecode-display");
    const loopBtn = document.getElementById("win11-btn-loop");
    const fullBtn = document.getElementById("win11-btn-fullscreen");

    function formatTime(secs) {
      if (isNaN(secs)) return "00:00:00";
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    if (player) {
      player.addEventListener("timeupdate", () => {
        if (slider && player.duration) {
          slider.value = (player.currentTime / player.duration) * 100;
        }
        if (timecode) {
          timecode.textContent = `${formatTime(player.currentTime)} / ${formatTime(player.duration)}`;
        }
      });

      playPauseBtn?.addEventListener("click", () => {
        if (player.paused) {
          player.play();
          if (playPauseBtn) playPauseBtn.innerHTML = icons.pause;
        } else {
          player.pause();
          if (playPauseBtn) playPauseBtn.innerHTML = icons.play;
        }
      });

      slider?.addEventListener("input", () => {
        if (player.duration) {
          player.currentTime = (slider.value / 100) * player.duration;
        }
      });

      loopBtn?.addEventListener("click", () => {
        player.loop = !player.loop;
        loopBtn.classList.toggle("active", player.loop);
        showToast(player.loop ? "Loop enabled" : "Loop disabled", "info", 1000);
      });

      fullBtn?.addEventListener("click", () => {
        if (player.requestFullscreen) player.requestFullscreen();
      });
    }

    canvasEl.querySelectorAll(".win11-playlist-item").forEach(item => {
      item.addEventListener("click", () => {
        const p = item.getAttribute("data-path");
        const found = mediaFiles.find(m => m.path === p);
        if (found) {
          activeMediaFile = found;
          renderMediaScrubberView();
        }
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Zone 3: Right Details Inspector & CreativeOS Action Deck
  // ──────────────────────────────────────────────────────────────────────────
  function renderInspector(item) {
    if (!inspectorEl) return;

    if (!item) {
      inspectorEl.innerHTML = `
        <div class="win11-inspector-empty">
          <div class="win11-empty-icon">${icons.info}</div>
          <p>Select a file or project to inspect specifications and studio actions</p>
        </div>
      `;
      return;
    }

    const isDir = item.is_dir;
    const rawUrl = api.getRawFileUrl(item.path);
    const ext = (item.extension || "").toLowerCase();
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext);

    // Check if this directory corresponds to a known project
    const matchedProject = projectsList.find(p => p.path === item.path || p.name === item.name || p.slug === item.name);

    inspectorEl.innerHTML = `
      <div class="win11-inspector-header">
        <div class="win11-inspector-title font-bold">Details &amp; Specifications</div>
        <button class="win11-nav-btn" id="win11-inspector-close-btn" title="Close Details">${icons.x}</button>
      </div>

      <div class="win11-inspector-scroll">
        <!-- Preview Hero -->
        <div class="win11-inspector-hero">
          ${isImage ? `
            <img src="${rawUrl}" class="win11-hero-image" alt="${escapeHtml(item.name)}" />
          ` : `
            <div class="win11-hero-icon">${getFileIconSvg(item.extension, isDir)}</div>
          `}
          <div class="win11-hero-title font-mono" title="${item.name}">${escapeHtml(item.name)}</div>
          <span class="win11-hero-badge font-mono">${isDir ? (matchedProject ? `${matchedProject.type} Project` : 'Folder') : formatBytes(item.size)}</span>
        </div>

        <!-- Specifications Table -->
        <div class="win11-inspector-section">
          <div class="win11-section-label">SPECIFICATIONS</div>
          <div class="win11-spec-grid">
            <div class="win11-spec-row font-mono">
              <span class="spec-k">Type</span>
              <span class="spec-v">${isDir ? (matchedProject ? `${matchedProject.type} Project` : 'Directory') : (ext.toUpperCase() || 'File')}</span>
            </div>
            <div class="win11-spec-row font-mono">
              <span class="spec-k">Size</span>
              <span class="spec-v">${isDir ? (matchedProject ? formatBytes(matchedProject.total_size) : '—') : formatBytes(item.size)}</span>
            </div>
            <div class="win11-spec-row font-mono">
              <span class="spec-k">Modified</span>
              <span class="spec-v">${item.modified ? item.modified.substring(0, 19).replace('T', ' ') : '—'}</span>
            </div>
            <div class="win11-spec-row font-mono">
              <span class="spec-k">Location</span>
              <span class="spec-v text-ellipsis" title="${item.path}">${escapeHtml(item.path)}</span>
            </div>
          </div>
        </div>

        <!-- CreativeOS Action Deck -->
        <div class="win11-inspector-section">
          <div class="win11-section-label">CREATIVEOS ACTION DECK</div>
          <div class="win11-action-deck">
            <button class="win11-deck-btn" id="deck-btn-open-os">
              ${icons.externalLink}
              <span>Open in OS</span>
            </button>
            <button class="win11-deck-btn" id="deck-btn-export-folder">
              ${icons.exportFolder}
              <span>Export Folder</span>
            </button>
            <button class="win11-deck-btn" id="deck-btn-shuttle">
              ${icons.travel}
              <span>Shuttle Travel</span>
            </button>
            <button class="win11-deck-btn" id="deck-btn-reclaim">
              ${icons.zap}
              <span>Reclaim Cache</span>
            </button>
            <button class="win11-deck-btn" id="deck-btn-sync">
              ${icons.sync}
              <span>Live Sync</span>
            </button>
            <button class="win11-deck-btn warning" id="deck-btn-archive">
              ${icons.archive}
              <span>Archive</span>
            </button>
            ${matchedProject ? `
              <button class="win11-deck-btn primary" id="deck-btn-inspect-modal">
                ${icons.edit}
                <span>Project Inspector</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    document.getElementById("win11-inspector-close-btn")?.addEventListener("click", () => {
      showZone3 = false;
      localStorage.setItem("cos_win11_show_inspector", "false");
      inspectorEl.style.display = "none";
      workspaceLayoutEl?.classList.remove("with-inspector");
      document.getElementById("win11-btn-toggle-inspector")?.classList.remove("active");
    });

    // Wire Action Deck Handlers
    document.getElementById("deck-btn-open-os")?.addEventListener("click", async () => {
      try {
        await api.openPath(item.path);
        showToast(`Opened ${item.name} natively in Windows`, "info", 1500);
      } catch (e) {
        showToast(`Failed: ${e.message}`, "error");
      }
    });

    document.getElementById("deck-btn-export-folder")?.addEventListener("click", async () => {
      try {
        const res = await api.createExportFolder(matchedProject?.slug || item.name);
        showToast(`Export folder ready at ${res.export_path}`, "success");
      } catch (e) {
        showToast(`Failed: ${e.message}`, "error");
      }
    });

    document.getElementById("deck-btn-shuttle")?.addEventListener("click", () => {
      openConfirmModal({
        title: "Export to Shuttle Drive",
        message: `Sync '${item.name}' to your connected external Shuttle Drive?`,
        confirmText: "Launch Travel",
        variant: "info",
        onConfirm: async () => {
          const res = await api.travelProject(matchedProject?.slug || item.name);
          showToast(`Exported to Shuttle: ${res.dest_path}`, "success");
        }
      });
    });

    document.getElementById("deck-btn-reclaim")?.addEventListener("click", () => {
      if (matchedProject) {
        openReclaimModal(matchedProject, () => loadCurrentDirectory());
      } else {
        openBulkReclaimModal(storageData || { projects: projectsList }, () => loadCurrentDirectory());
      }
    });

    document.getElementById("deck-btn-sync")?.addEventListener("click", () => {
      openLiveSyncModal(() => loadCurrentDirectory());
    });

    document.getElementById("deck-btn-archive")?.addEventListener("click", () => {
      openConfirmModal({
        title: "Move to Cold Archive",
        message: `Move '${item.name}' out of the active studio tree into Cold Storage?`,
        confirmText: "Archive",
        variant: "danger",
        onConfirm: async () => {
          const res = await api.archiveProject(matchedProject?.slug || item.name);
          showToast(`Archived to ${res.archive_path}`, "success");
          loadCurrentDirectory();
        }
      });
    });

    document.getElementById("deck-btn-inspect-modal")?.addEventListener("click", () => {
      if (matchedProject) {
        openProjectInspector(matchedProject, categoriesData, () => loadCurrentDirectory());
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Top Chrome & Ribbon Event Handlers
  // ──────────────────────────────────────────────────────────────────────────
  navBackBtn?.addEventListener("click", () => {
    const tab = getActiveTab();
    if (tab.historyIndex > 0) {
      tab.historyIndex--;
      tab.path = tab.history[tab.historyIndex];
      tab.title = tab.path ? tab.path.split(/[\\/]/).filter(Boolean).pop() || "Folder" : "01_Projects";
      renderTabsBar();
      loadCurrentDirectory();
    }
  });

  navForwardBtn?.addEventListener("click", () => {
    const tab = getActiveTab();
    if (tab.historyIndex < tab.history.length - 1) {
      tab.historyIndex++;
      tab.path = tab.history[tab.historyIndex];
      tab.title = tab.path ? tab.path.split(/[\\/]/).filter(Boolean).pop() || "Folder" : "01_Projects";
      renderTabsBar();
      loadCurrentDirectory();
    }
  });

  navUpBtn?.addEventListener("click", () => {
    if (currentParentPath) {
      updateActiveTabPath(currentParentPath);
    }
  });

  navRefreshBtn?.addEventListener("click", () => {
    loadCurrentDirectory();
    showToast("Refreshed", "info", 800);
  });

  copyAddressBtn?.addEventListener("click", async () => {
    const p = getActiveTab().path || "01_Projects";
    try {
      await navigator.clipboard.writeText(p);
      showToast("Copied path to clipboard", "info", 1500);
    } catch {}
  });

  // Ribbon Actions
  document.getElementById("win11-btn-new-project")?.addEventListener("click", () => {
    openNewProjectModal(() => loadCurrentDirectory());
  });

  document.getElementById("win11-btn-view-grid")?.addEventListener("click", () => {
    viewMode = "grid";
    localStorage.setItem("cos_win11_view_mode", "grid");
    updateViewButtons();
    loadCurrentDirectory();
  });

  document.getElementById("win11-btn-view-details")?.addEventListener("click", () => {
    viewMode = "details";
    localStorage.setItem("cos_win11_view_mode", "details");
    updateViewButtons();
    loadCurrentDirectory();
  });

  document.getElementById("win11-btn-view-split")?.addEventListener("click", () => {
    viewMode = "split";
    localStorage.setItem("cos_win11_view_mode", "split");
    updateViewButtons();
    loadCurrentDirectory();
  });

  document.getElementById("win11-btn-view-media")?.addEventListener("click", () => {
    viewMode = "media";
    localStorage.setItem("cos_win11_view_mode", "media");
    updateViewButtons();
    loadCurrentDirectory();
  });

  function updateViewButtons() {
    document.querySelectorAll("#win11-btn-view-grid, #win11-btn-view-details, #win11-btn-view-split, #win11-btn-view-media").forEach(btn => {
      btn.classList.remove("active");
    });
    document.getElementById(`win11-btn-view-${viewMode}`)?.classList.add("active");
  }

  document.getElementById("win11-btn-clean-downloads")?.addEventListener("click", async () => {
    try {
      showToast("Cleaning loose downloads into subfolders...", "info", 1500);
      const res = await api.cleanDownloads();
      showToast(`Cleaned Downloads: ${res.moved_count} files organized!`, "success");
      loadCurrentDirectory();
    } catch (e) {
      showToast(`Failed: ${e.message}`, "error");
    }
  });

  document.getElementById("win11-btn-sort-inbox")?.addEventListener("click", async () => {
    try {
      showToast("Sorting unfiled renders into monthly folders...", "info", 1500);
      const res = await api.sortExportsInbox();
      showToast(`Sorted ${res.moved_count} renders into 02_Exports/!`, "success");
      loadCurrentDirectory();
    } catch (e) {
      showToast(`Failed: ${e.message}`, "error");
    }
  });

  document.getElementById("win11-btn-sync-vault")?.addEventListener("click", () => {
    openLiveSyncModal(() => loadCurrentDirectory());
  });

  document.getElementById("win11-btn-bulk-reclaim")?.addEventListener("click", () => {
    openBulkReclaimModal(storageData || { projects: projectsList }, () => loadCurrentDirectory());
  });

  document.getElementById("win11-btn-theme-toggle")?.addEventListener("click", () => {
    const t = toggleTheme();
    showToast(`Switched to ${t} theme`, "info", 1000);
  });

  document.getElementById("win11-btn-toggle-inspector")?.addEventListener("click", () => {
    showZone3 = !showZone3;
    localStorage.setItem("cos_win11_show_inspector", showZone3 ? "true" : "false");
    document.getElementById("win11-btn-toggle-inspector")?.classList.toggle("active", showZone3);
    if (inspectorEl) inspectorEl.style.display = showZone3 ? "block" : "none";
    workspaceLayoutEl?.classList.toggle("with-inspector", showZone3);
    if (showZone3) {
      renderInspector(selectedItem);
    }
  });

  // Sidebar Tree Item Click Handlers
  document.querySelectorAll(".win11-tree-item").forEach(item => {
    item.addEventListener("click", () => {
      const p = item.getAttribute("data-path");
      updateActiveTabPath(p);
    });
  });

  // Live Filter Input
  searchInputEl?.addEventListener("input", () => {
    renderCanvasEntries();
  });

  // Kickoff
  renderTabsBar();
  loadCurrentDirectory();
}
