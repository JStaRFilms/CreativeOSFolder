/**
 * Storage Overview View — Visual Analytics & Inventory
 */

import { api, formatBytes, cacheStore } from "../api.js";
import { renderStorageTable } from "../components/storageTable.js";
import { openProjectInspector } from "../components/modal.js";
import { showToast } from "../components/toast.js";

export async function renderStorage(container, options = {}) {
  const targetProject = options.project ? decodeURIComponent(options.project).trim() : "";
  const cachedStorage = cacheStore.get("storage");
  const cachedCats = cacheStore.get("categories");
  const hasCache = Boolean(cachedStorage && cachedStorage.projects);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-eyebrow">
          <span class="studio-status-indicator" style="background-color: var(--color-accent-cyan);"></span>
          <span>STORAGE AUDIT &amp; ANALYTICS</span>
        </div>
        <h1 class="page-title">Storage Inventory</h1>
        <p class="page-description">Safely inspect disk consumption, media footprints, and reclaimable build caches</p>
      </div>
      <div class="header-action-group">
        <button id="rescan-storage-btn" class="btn btn-secondary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Rescan Index
        </button>
      </div>
    </div>

    <!-- Storage Visual Multi-segment Bar & Stats -->
    <div id="storage-summary-container"></div>

    <div class="studio-toolbar">
      <div class="search-box">
        <span class="search-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </span>
        <input type="text" id="storage-search-input" class="search-input" placeholder="Search by project name, category, or path..." />
      </div>
    </div>

    <div id="storage-table-container">
      ${hasCache ? '' : `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading storage inventory metrics...</p>
        </div>
      `}
    </div>
  `;

  let currentSort = { key: "total_size", asc: false };
  let allProjects = [];
  let categoriesConfig = {};

  function updateSummary(data) {
    const summaryContainer = document.getElementById("storage-summary-container");
    if (!summaryContainer) return;

    const total = data.total_size || 0;
    const media = data.media_size || 0;
    const reclaimable = data.reclaimable_size || 0;
    const other = Math.max(0, total - media - reclaimable);

    const mediaPct = total > 0 ? ((media / total) * 100).toFixed(1) : 0;
    const reclaimablePct = total > 0 ? ((reclaimable / total) * 100).toFixed(1) : 0;
    const otherPct = total > 0 ? ((other / total) * 100).toFixed(1) : 0;

    // Top 3 heaviest projects
    const topProjects = [...(data.projects || [])]
      .sort((a, b) => (b.total_size || 0) - (a.total_size || 0))
      .slice(0, 3);

    summaryContainer.innerHTML = `
      <!-- Visual Breakdown Card -->
      <div class="storage-visual-card">
        <div class="storage-bar-header">
          <div>
            <span class="storage-bar-title">Disk Allocation Breakdown</span>
            <span class="storage-bar-sub font-mono">${formatBytes(total)} Total</span>
          </div>
          <div class="storage-legend">
            <span class="legend-item"><span class="legend-dot" style="background-color: var(--color-accent-cyan);"></span> Media Assets (${mediaPct}%)</span>
            <span class="legend-item"><span class="legend-dot" style="background-color: var(--color-warning);"></span> Reclaimable (${reclaimablePct}%)</span>
            <span class="legend-item"><span class="legend-dot" style="background-color: var(--text-primary);"></span> Workspace &amp; Docs (${otherPct}%)</span>
          </div>
        </div>

        <div class="multi-segment-bar">
          <div class="segment-media" style="width: ${mediaPct}%;" title="Media Assets: ${formatBytes(media)} (${mediaPct}%)"></div>
          <div class="segment-reclaimable" style="width: ${reclaimablePct}%;" title="Reclaimable Cache: ${formatBytes(reclaimable)} (${reclaimablePct}%)"></div>
          <div class="segment-other" style="width: ${otherPct}%;" title="Workspace: ${formatBytes(other)} (${otherPct}%)"></div>
        </div>
      </div>

      <div class="storage-insights">
        <div class="storage-insight-card">
          <span class="insight-label">Total Footprint</span>
          <span class="insight-val font-mono">${formatBytes(total)}</span>
          <span class="insight-sub">${data.project_count || 0} projects indexed</span>
        </div>
        <div class="storage-insight-card">
          <span class="insight-label">Media Assets</span>
          <span class="insight-val font-mono" style="color: var(--color-accent-cyan);">${formatBytes(media)}</span>
          <span class="insight-sub">RAW, Video, Stems &amp; Audio</span>
        </div>
        <div class="storage-insight-card">
          <span class="insight-label">Reclaimable Cache</span>
          <span class="insight-val font-mono" style="color: var(--color-warning);">${formatBytes(reclaimable)}</span>
          <span class="insight-sub">Build outputs &amp; cache dirs</span>
        </div>
        <div class="storage-insight-card">
          <span class="insight-label">Index Timestamp</span>
          <span class="insight-val font-mono" style="font-size: 1rem; margin-top: 0.15rem;">${data.scanned_at ? data.scanned_at.substring(0, 19).replace('T', ' ') : 'Live'}</span>
          <span class="insight-sub">${data.stale_count || 0} stale projects (&gt;90d)</span>
        </div>
      </div>

      <!-- Top Consumers Spotlight -->
      ${topProjects.length > 0 ? `
        <div class="top-consumers-panel">
          <span class="top-consumers-title">Top Storage Consumers</span>
          <div class="top-consumers-grid">
            ${topProjects.map((p, idx) => `
              <div class="top-consumer-card" data-slug="${p.slug}">
                <div class="consumer-rank font-mono">#${idx + 1}</div>
                <div class="consumer-info">
                  <span class="consumer-name" title="${p.name}">${p.name}</span>
                  <span class="consumer-cat">${p.type || 'Video'} &bull; ${p.file_count || 0} files</span>
                </div>
                <div class="consumer-size font-mono">${formatBytes(p.total_size)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ''}
    `;

    // Attach click handlers to top consumer cards
    summaryContainer.querySelectorAll(".top-consumer-card").forEach(card => {
      card.addEventListener("click", () => {
        const slug = card.getAttribute("data-slug");
        const target = allProjects.find(p => p.slug === slug || p.name === slug);
        if (target) openProjectInspector(target, categoriesConfig);
      });
    });
  }

  function renderTable() {
    const tableContainer = document.getElementById("storage-table-container");
    const searchInput = document.getElementById("storage-search-input");
    const query = (searchInput?.value || "").toLowerCase().trim();

    const filtered = allProjects.filter(p => {
      if (!query) return true;
      return (p.name && p.name.toLowerCase().includes(query)) ||
             (p.type && p.type.toLowerCase().includes(query)) ||
             (p.slug && p.slug.toLowerCase().includes(query)) ||
             (p.path && p.path.toLowerCase().includes(query));
    });

    if (tableContainer) {
      tableContainer.innerHTML = renderStorageTable(filtered, currentSort);
      attachSortHandlers();
      attachRowInspectors(filtered);

      if (targetProject) {
        const rows = [...document.querySelectorAll(".storage-row")];
        const match = rows.find(r => {
          const s = r.getAttribute("data-slug") || "";
          const n = r.getAttribute("data-name") || "";
          const p = r.getAttribute("data-path") || "";
          const target = targetProject.toLowerCase();
          return s.toLowerCase() === target ||
                 n.toLowerCase() === target ||
                 p.toLowerCase() === target ||
                 p.toLowerCase().includes(target);
        });

        if (match) {
          match.classList.add("storage-row-highlighted");
          setTimeout(() => {
            match.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }
      }
    }
  }

  function attachSortHandlers() {
    const ths = document.querySelectorAll("#storage-table-container th.sortable");
    ths.forEach(th => {
      th.addEventListener("click", () => {
        const sortKey = th.getAttribute("data-sort");
        if (currentSort.key === sortKey) {
          currentSort.asc = !currentSort.asc;
        } else {
          currentSort.key = sortKey;
          currentSort.asc = false;
        }
        renderTable();
      });
    });
  }

  function attachRowInspectors(filteredList) {
    document.querySelectorAll(".storage-row").forEach(row => {
      row.addEventListener("click", () => {
        const slug = row.getAttribute("data-slug");
        const target = filteredList.find(p => p.slug === slug || p.name === slug);
        if (target) openProjectInspector(target, categoriesConfig);
      });
    });
  }

  async function loadData() {
    try {
      if (hasCache) {
        categoriesConfig = cachedCats?.categories || {};
        allProjects = cachedStorage.projects || [];
        updateSummary(cachedStorage);
        renderTable();
      }

      api.getStorageSWR((freshStorage) => {
        allProjects = freshStorage.projects || [];
        updateSummary(freshStorage);
        renderTable();
      });

      api.getCategoriesSWR((freshCats) => {
        categoriesConfig = freshCats.categories || {};
        renderTable();
      });
    } catch (err) {
      const tableContainer = document.getElementById("storage-table-container");
      if (tableContainer && allProjects.length === 0) {
        tableContainer.innerHTML = `
          <div class="empty-state" style="border-color: var(--color-danger);">
            <h3 style="color: var(--color-danger); margin-bottom: 0.35rem; font-size: 1rem;">Failed to Index Storage</h3>
            <p style="font-size: 0.85rem;">${err.message}</p>
          </div>
        `;
      }
      showToast("Error loading storage index", "error");
    }
  }

  const rescanBtn = document.getElementById("rescan-storage-btn");
  rescanBtn?.addEventListener("click", async () => {
    rescanBtn.disabled = true;
    rescanBtn.innerHTML = `
      <span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin: 0;"></span>
      Scanning...
    `;
    showToast("Storage rescan triggered in background...", "info");

    try {
      const updated = await api.refreshStorage();
      allProjects = updated.projects || [];
      updateSummary(updated);
      renderTable();
      showToast("Storage index refreshed successfully", "success");
    } catch (err) {
      showToast(`Rescan failed: ${err.message}`, "error");
    } finally {
      rescanBtn.disabled = false;
      rescanBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Rescan Index
      `;
    }
  });

  const searchInput = document.getElementById("storage-search-input");
  searchInput?.addEventListener("input", renderTable);

  await loadData();
}
