/**
 * Storage Overview View
 */

import { api, formatBytes } from "../api.js";
import { renderStorageTable } from "../components/storageTable.js";
import { showToast } from "../components/toast.js";

export async function renderStorage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Storage Inventory</h1>
        <p class="page-description">Review project disk consumption safely (read-only inventory)</p>
      </div>
      <div>
        <button id="rescan-storage-btn" class="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Rescan Storage
        </button>
      </div>
    </div>

    <div id="storage-summary"></div>

    <div class="toolbar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="storage-search-input" class="search-input" placeholder="Search by project or category..." />
      </div>
    </div>

    <div id="storage-table-container">
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading storage inventory...</p>
      </div>
    </div>
  `;

  let currentSort = { key: "total_size", asc: false };
  let allProjects = [];

  function updateSummary(data) {
    const summaryEl = document.getElementById("storage-summary");
    if (!summaryEl) return;

    summaryEl.innerHTML = `
      <div class="storage-insights">
        <div class="stat-card">
          <span class="stat-label">Total Footprint</span>
          <span class="stat-value">${formatBytes(data.total_size || 0)}</span>
          <span class="stat-subtext">${data.project_count || 0} projects measured</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Media Assets</span>
          <span class="stat-value" style="color: var(--color-primary);">${formatBytes(data.media_size || 0)}</span>
          <span class="stat-subtext">Video, Audio, RAW, Images</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Reclaimable Cache</span>
          <span class="stat-value" style="color: var(--color-warning);">${formatBytes(data.reclaimable_size || 0)}</span>
          <span class="stat-subtext">node_modules, build artifacts, cache</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Last Scanned</span>
          <span class="stat-value" style="font-size: 1.15rem; margin-top: 0.25rem;">${data.scanned_at ? data.scanned_at.substring(0, 19).replace('T', ' ') : 'Never'}</span>
          <span class="stat-subtext">Cached storage index</span>
        </div>
      </div>
    `;
  }

  function renderTable() {
    const tableContainer = document.getElementById("storage-table-container");
    const searchInput = document.getElementById("storage-search-input");
    const query = (searchInput?.value || "").toLowerCase().trim();

    const filtered = allProjects.filter(p => {
      if (!query) return true;
      return (p.name && p.name.toLowerCase().includes(query)) ||
             (p.type && p.type.toLowerCase().includes(query)) ||
             (p.path && p.path.toLowerCase().includes(query));
    });

    if (tableContainer) {
      tableContainer.innerHTML = renderStorageTable(filtered, currentSort);
      attachSortHandlers();
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

  async function loadData() {
    try {
      const data = await api.getStorage();
      allProjects = data.projects || [];
      updateSummary(data);
      renderTable();
    } catch (err) {
      const tableContainer = document.getElementById("storage-table-container");
      if (tableContainer) {
        tableContainer.innerHTML = `
          <div class="empty-state" style="border-color: var(--color-danger);">
            <h3 style="color: var(--color-danger); margin-bottom: 0.5rem;">Failed to load storage</h3>
            <p>${err.message}</p>
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
    showToast("Storage rescan started in background...", "info");

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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Rescan Storage
      `;
    }
  });

  const searchInput = document.getElementById("storage-search-input");
  searchInput?.addEventListener("input", renderTable);

  await loadData();
}
