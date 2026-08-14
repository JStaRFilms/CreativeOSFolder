/**
 * Reclaim Space & Dependency Cache Modal Component
 * Precision Studio tools for selective and bulk cache recovery.
 */

import { api, formatBytes } from "../api.js";
import { getCategoryIconSvg, icons } from "../icons.js";
import { showToast } from "./toast.js";

function getReclaimTag(path) {
  const p = (path || "").toLowerCase();
  if (p.includes("node_modules")) return "Node.js";
  if (p.includes("venv") || p.includes(".venv") || p.includes("env")) return "Python venv";
  if (p.includes("__pycache__")) return "Pycache";
  if (p.includes(".next") || p.includes(".nuxt") || p.includes(".turbo") || p.includes(".cache")) return "Build Cache";
  return "Cache";
}

/**
 * Open Single Project Reclaim Inspector Modal
 */
export async function openReclaimModal(project, onReclaimed) {
  const existingModal = document.getElementById("reclaim-modal-container");
  if (existingModal) existingModal.remove();

  const container = document.createElement("div");
  container.id = "reclaim-modal-container";
  container.className = "modal-backdrop is-open";

  const cat = project.type || "Video";
  const catIcon = getCategoryIconSvg(cat);
  const lookupKey = project.relative_path || project.slug || project.name;

  container.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="reclaim-title" style="max-width: 520px;">
      <div class="modal-header">
        <div class="modal-title-group">
          <span class="modal-cat-icon" style="color: var(--color-warning);">${icons.zap}</span>
          <div>
            <h3 id="reclaim-title" class="modal-title">Reclaim Project Space</h3>
            <span class="modal-subtitle font-mono">${project.name} &bull; ${project.relative_path || project.slug}</span>
          </div>
        </div>
        <button class="modal-close-btn" id="reclaim-close-btn" aria-label="Close dialog">
          ${icons.close}
        </button>
      </div>

      <div class="modal-body" style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
        <div id="reclaim-loading-state" class="loading-state" style="padding: 2.5rem 1rem;">
          <div class="spinner"></div>
          <p>Analyzing regenerable directories...</p>
        </div>

        <div id="reclaim-content-wrap" style="display: none; flex-direction: column; gap: 0.85rem;">
          <!-- Clean Summary Bar -->
          <div class="reclaim-summary-bar">
            <span>Selected: <strong id="reclaim-selected-bytes" class="font-mono">0 B</strong> across <span id="reclaim-selected-count">0 items</span></span>
            <button type="button" id="reclaim-select-all-btn" class="btn-link-action">Deselect All</button>
          </div>

          <!-- Single Unified Table Surface -->
          <div id="reclaim-items-list" class="reclaim-table-surface"></div>

          <!-- Minimal Safety Line -->
          <div class="reclaim-safe-line">
            ${icons.info}
            <span>Safe: only rebuildable build artifacts &amp; dependencies are deleted. Source code is never touched.</span>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="padding: 1rem 1.5rem; justify-content: space-between;">
        <button type="button" class="btn btn-secondary" id="reclaim-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-warning" id="reclaim-execute-btn" disabled style="display: flex; align-items: center; gap: 0.4rem;">
          ${icons.zap}
          <span id="reclaim-btn-label">Reclaim Space</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const close = () => {
    container.classList.remove("is-open");
    setTimeout(() => container.remove(), 200);
  };

  container.querySelector("#reclaim-close-btn").addEventListener("click", close);
  container.querySelector("#reclaim-cancel-btn").addEventListener("click", close);
  container.addEventListener("click", (e) => {
    if (e.target === container) close();
  });

  try {
    const res = await api.getProjectReclaimable(lookupKey);
    const items = res.items || [];

    const loadingEl = container.querySelector("#reclaim-loading-state");
    const contentEl = container.querySelector("#reclaim-content-wrap");
    const listEl = container.querySelector("#reclaim-items-list");
    const executeBtn = container.querySelector("#reclaim-execute-btn");
    const btnLabel = container.querySelector("#reclaim-btn-label");
    const selectedBadge = container.querySelector("#reclaim-selected-bytes");
    const selectedCountEl = container.querySelector("#reclaim-selected-count");
    const selectAllBtn = container.querySelector("#reclaim-select-all-btn");

    loadingEl.style.display = "none";
    contentEl.style.display = "flex";

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem 1rem;">
          <p style="font-size: 0.85rem; color: var(--text-muted);">No regenerable dependencies or caches found in this project.</p>
        </div>
      `;
      executeBtn.disabled = true;
      selectedBadge.textContent = "0 B";
      return;
    }

    // Render list
    listEl.innerHTML = items.map((item, idx) => `
      <div class="reclaim-table-row" data-idx="${idx}" data-path="${item.relative_path}" data-size="${item.size}">
        <div class="reclaim-row-left">
          <input type="checkbox" class="reclaim-checkbox" checked data-idx="${idx}" />
          <div class="reclaim-row-info">
            <div class="reclaim-row-title">
              <span class="font-mono">${item.relative_path}/</span>
              <span class="reclaim-pill-tag">${getReclaimTag(item.relative_path)}</span>
            </div>
            <span class="reclaim-row-desc">${item.description}</span>
          </div>
        </div>
        <div class="reclaim-row-right">
          <span class="reclaim-row-size font-mono">${formatBytes(item.size)}</span>
          <span class="reclaim-row-files font-mono">${(item.file_count || 0).toLocaleString()} files</span>
        </div>
      </div>
    `).join("");

    const updateTotals = () => {
      let selectedSize = 0;
      let selectedCount = 0;

      listEl.querySelectorAll(".reclaim-table-row").forEach(row => {
        const checkbox = row.querySelector(".reclaim-checkbox");
        if (checkbox && checkbox.checked) {
          selectedSize += Number(row.getAttribute("data-size") || 0);
          selectedCount += 1;
          row.classList.remove("is-muted");
        } else {
          row.classList.add("is-muted");
        }
      });

      selectedBadge.textContent = formatBytes(selectedSize);
      if (selectedCountEl) selectedCountEl.textContent = `${selectedCount} item${selectedCount === 1 ? '' : 's'}`;
      executeBtn.disabled = selectedCount === 0;
      btnLabel.textContent = selectedCount > 0 ? `Reclaim ${formatBytes(selectedSize)}` : "Select Items to Reclaim";
    };

    updateTotals();

    // Attach row toggle listeners
    listEl.querySelectorAll(".reclaim-table-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.type !== "checkbox") {
          const cb = row.querySelector(".reclaim-checkbox");
          if (cb) {
            cb.checked = !cb.checked;
            updateTotals();
          }
        }
      });

      const cb = row.querySelector(".reclaim-checkbox");
      if (cb) {
        cb.addEventListener("change", updateTotals);
      }
    });

    // Select all toggle
    let allSelected = true;
    selectAllBtn.addEventListener("click", () => {
      allSelected = !allSelected;
      listEl.querySelectorAll(".reclaim-checkbox").forEach(cb => {
        cb.checked = allSelected;
      });
      selectAllBtn.textContent = allSelected ? "Deselect All" : "Select All";
      updateTotals();
    });

    // Execute button
    executeBtn.addEventListener("click", async () => {
      const selectedTargets = [];
      listEl.querySelectorAll(".reclaim-table-row").forEach(row => {
        const cb = row.querySelector(".reclaim-checkbox");
        if (cb && cb.checked) {
          selectedTargets.push(row.getAttribute("data-path"));
        }
      });

      if (selectedTargets.length === 0) return;

      executeBtn.disabled = true;
      executeBtn.innerHTML = `<div class="spinner spinner-sm" style="width: 14px; height: 14px;"></div> <span>Reclaiming...</span>`;

      try {
        const purgeRes = await api.reclaimProject(lookupKey, selectedTargets);
        showToast(`⚡ Reclaimed ${formatBytes(purgeRes.freed_bytes || 0)} from ${project.name}!`, "success");
        close();
        if (onReclaimed) onReclaimed(purgeRes);
      } catch (err) {
        showToast(err.message || "Failed to reclaim space", "error");
        executeBtn.disabled = false;
        executeBtn.innerHTML = `${icons.zap} <span>Reclaim Space</span>`;
      }
    });

  } catch (err) {
    const loadingEl = container.querySelector("#reclaim-loading-state");
    if (loadingEl) {
      loadingEl.innerHTML = `<p style="color: var(--color-danger);">Error analyzing project: ${err.message}</p>`;
    }
  }
}

/**
 * Open Workspace-Wide Bulk Reclaim Modal (Stale >90d or All Projects)
 */
export function openBulkReclaimModal(storageData, onReclaimed) {
  const existingModal = document.getElementById("bulk-reclaim-modal-container");
  if (existingModal) existingModal.remove();

  const container = document.createElement("div");
  container.id = "bulk-reclaim-modal-container";
  container.className = "modal-backdrop is-open";

  const allProjects = storageData.projects || [];
  const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000);

  // Group candidate projects
  const allBloat = allProjects.filter(p => (p.reclaimable_size || 0) > 0);
  const staleBloat = allBloat.filter(p => {
    if (p.is_stale || p.status === "stale") return true;
    if (!p.last_meaningful_update) return true;
    const dt = new Date(p.last_meaningful_update).getTime();
    return dt < cutoffTime;
  });

  let currentTab = staleBloat.length > 0 ? "stale" : "all";

  container.innerHTML = `
    <div class="modal-dialog modal-dialog-lg" role="dialog" aria-modal="true" aria-labelledby="bulk-reclaim-title" style="max-width: 600px;">
      <div class="modal-header">
        <div class="modal-title-group">
          <span class="modal-cat-icon" style="color: var(--color-warning);">${icons.zap}</span>
          <div>
            <h3 id="bulk-reclaim-title" class="modal-title">Bulk Cache Recovery</h3>
            <span class="modal-subtitle">Purge dependency caches across inactive projects</span>
          </div>
        </div>
        <button class="modal-close-btn" id="bulk-reclaim-close-btn" aria-label="Close dialog">
          ${icons.close}
        </button>
      </div>

      <div class="modal-body" style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
        <!-- Tabs -->
        <div class="bulk-reclaim-tabs">
          <button type="button" class="bulk-tab-btn ${currentTab === 'stale' ? 'is-active' : ''}" data-tab="stale">
            <span>Stale Projects (&gt;90d Inactive)</span>
            <span class="badge font-mono" style="font-size: 0.65rem;">${staleBloat.length}</span>
          </button>
          <button type="button" class="bulk-tab-btn ${currentTab === 'all' ? 'is-active' : ''}" data-tab="all">
            <span>All Projects with Cache</span>
            <span class="badge font-mono" style="font-size: 0.65rem;">${allBloat.length}</span>
          </button>
        </div>

        <!-- Summary & Select Bar -->
        <div class="reclaim-summary-bar">
          <span>Selected: <strong id="bulk-selection-bytes" class="font-mono">0 B</strong> across <span id="bulk-selection-summary">0 projects</span></span>
          <button type="button" id="bulk-select-all-btn" class="btn-link-action">Deselect All</button>
        </div>

        <!-- Projects Checklist Surface -->
        <div id="bulk-projects-list-container" class="reclaim-table-surface" style="max-height: 280px;"></div>

        <!-- Real-time Execution Console (Shown while or after running) -->
        <div id="bulk-reclaim-console" class="log-console" style="display: none; margin-top: 0.25rem;">
          <div class="console-top-bar">
            <span class="console-title font-mono">Reclaim Engine Stream</span>
            <span id="bulk-console-status" class="console-time font-mono">Ready</span>
          </div>
          <div id="bulk-console-body" class="console-body font-mono" style="max-height: 160px;"></div>
        </div>

        <!-- Safety Notice -->
        <div class="reclaim-safe-line">
          ${icons.info}
          <span>Safe: only regenerable dependency folders (e.g. <code>node_modules</code>, <code>.venv</code>) are removed.</span>
        </div>
      </div>

      <div class="modal-footer" style="padding: 1rem 1.5rem; justify-content: space-between;">
        <button type="button" class="btn btn-secondary" id="bulk-reclaim-cancel-btn">Close</button>
        <button type="button" class="btn btn-warning" id="bulk-reclaim-execute-btn" style="display: flex; align-items: center; gap: 0.4rem;">
          ${icons.zap}
          <span id="bulk-reclaim-btn-label">Reclaim Selected Caches</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const close = () => {
    container.classList.remove("is-open");
    setTimeout(() => container.remove(), 200);
  };

  container.querySelector("#bulk-reclaim-close-btn").addEventListener("click", close);
  container.querySelector("#bulk-reclaim-cancel-btn").addEventListener("click", close);
  container.addEventListener("click", (e) => {
    if (e.target === container) close();
  });

  const listContainer = container.querySelector("#bulk-projects-list-container");
  const summaryCount = container.querySelector("#bulk-selection-summary");
  const summaryBytes = container.querySelector("#bulk-selection-bytes");
  const selectAllBtn = container.querySelector("#bulk-select-all-btn");
  const executeBtn = container.querySelector("#bulk-reclaim-execute-btn");
  const btnLabel = container.querySelector("#bulk-reclaim-btn-label");
  const consoleEl = container.querySelector("#bulk-reclaim-console");
  const consoleBody = container.querySelector("#bulk-console-body");
  const consoleStatus = container.querySelector("#bulk-console-status");

  function renderTabContent() {
    const list = currentTab === "stale" ? staleBloat : allBloat;

    if (list.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <p style="color: var(--text-muted); font-size: 0.85rem;">
            ${currentTab === 'stale' ? 'No stale projects (>90d inactive) with reclaimable space found!' : 'No projects with reclaimable cache found.'}
          </p>
        </div>
      `;
      updateSummary();
      return;
    }

    listContainer.innerHTML = list.map((p, idx) => {
      const cat = p.type || "Video";
      const icon = getCategoryIconSvg(cat);
      const isStale = p.is_stale || p.status === "stale" || (p.last_meaningful_update && new Date(p.last_meaningful_update).getTime() < cutoffTime);

      return `
        <div class="reclaim-table-row" data-idx="${idx}" data-path="${p.path || ''}" data-slug="${p.slug || p.name}" data-size="${p.reclaimable_size || 0}">
          <div class="reclaim-row-left">
            <input type="checkbox" class="reclaim-checkbox" checked data-slug="${p.slug || p.name}" />
            <div class="reclaim-row-info">
              <div class="reclaim-row-title">
                <span style="font-weight: 700;">${p.name}</span>
                <span class="reclaim-pill-tag font-mono">${cat}</span>
                ${isStale ? '<span class="cell-status-dot dot-stale" title="Stale (>90d)"></span>' : ''}
              </div>
              <span class="reclaim-row-desc font-mono">${p.relative_path || p.slug}</span>
            </div>
          </div>
          <div class="reclaim-row-right">
            <span class="reclaim-row-size font-mono">${formatBytes(p.reclaimable_size || 0)}</span>
            <span class="reclaim-row-files font-mono">${(p.file_count || 0).toLocaleString()} files</span>
          </div>
        </div>
      `;
    }).join("");

    listContainer.querySelectorAll(".reclaim-table-row").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.type !== "checkbox") {
          const cb = card.querySelector(".reclaim-checkbox");
          if (cb) {
            cb.checked = !cb.checked;
            updateSummary();
          }
        }
      });

      const cb = card.querySelector(".reclaim-checkbox");
      if (cb) {
        cb.addEventListener("change", updateSummary);
      }
    });

    updateSummary();
  }

  function updateSummary() {
    let totalBytes = 0;
    let selectedCount = 0;

    listContainer.querySelectorAll(".reclaim-table-row").forEach(card => {
      const cb = card.querySelector(".reclaim-checkbox");
      if (cb && cb.checked) {
        totalBytes += Number(card.getAttribute("data-size") || 0);
        selectedCount += 1;
        card.classList.remove("is-muted");
      } else {
        card.classList.add("is-muted");
      }
    });

    summaryCount.textContent = `${selectedCount} project${selectedCount === 1 ? '' : 's'}`;
    summaryBytes.textContent = formatBytes(totalBytes);
    executeBtn.disabled = selectedCount === 0;
    btnLabel.textContent = selectedCount > 0 ? `Reclaim ${formatBytes(totalBytes)}` : "Select Projects";
  }

  // Switch tab buttons
  container.querySelectorAll(".bulk-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".bulk-tab-btn").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentTab = btn.getAttribute("data-tab");
      renderTabContent();
    });
  });

  // Select all toggle
  let allSelected = true;
  selectAllBtn.addEventListener("click", () => {
    allSelected = !allSelected;
    listContainer.querySelectorAll(".reclaim-checkbox").forEach(cb => {
      cb.checked = allSelected;
    });
    selectAllBtn.textContent = allSelected ? "Deselect All" : "Select All";
    updateSummary();
  });

  // Execute Bulk Reclaim
  executeBtn.addEventListener("click", async () => {
    const selectedSlugs = [];
    listContainer.querySelectorAll(".reclaim-table-row").forEach(card => {
      const cb = card.querySelector(".reclaim-checkbox");
      if (cb && cb.checked) {
        selectedSlugs.push(card.getAttribute("data-slug"));
      }
    });

    if (selectedSlugs.length === 0) return;

    executeBtn.disabled = true;
    executeBtn.innerHTML = `<div class="spinner spinner-sm" style="width: 14px; height: 14px;"></div> <span>Reclaiming Caches...</span>`;
    consoleEl.style.display = "block";
    consoleStatus.textContent = "Running Reclaim...";
    consoleBody.innerHTML = `<div class="log-entry log-info"><span>[Engine]</span> <span>Starting bulk reclaim for ${selectedSlugs.length} projects...</span></div>`;

    try {
      const result = await api.reclaimBulk({
        project_slugs: selectedSlugs,
      });

      const logEntries = result.log_entries || [];
      if (logEntries.length > 0) {
        logEntries.forEach(entry => {
          consoleBody.innerHTML += `
            <div class="log-entry log-purge">
              <span>[Reclaimed]</span>
              <span>${entry.project} / ${entry.folder} &rarr; Freed ${formatBytes(entry.freed_bytes || 0)}</span>
            </div>
          `;
        });
      } else {
        consoleBody.innerHTML += `<div class="log-entry log-info"><span>[Info]</span> <span>No regenerable folders required deletion.</span></div>`;
      }

      const totalFreed = result.total_freed_bytes || 0;
      consoleBody.innerHTML += `
        <div class="log-entry log-push" style="margin-top: 0.5rem; font-weight: bold;">
          <span>✨ Space Recovery Complete. ${formatBytes(totalFreed)} reclaimed across ${result.projects_cleaned_count || 0} projects.</span>
        </div>
      `;
      consoleBody.scrollTop = consoleBody.scrollHeight;
      consoleStatus.textContent = "Finished";

      showToast(`⚡ Successfully reclaimed ${formatBytes(totalFreed)}!`, "success");

      executeBtn.style.display = "none";
      const cancelBtn = container.querySelector("#bulk-reclaim-cancel-btn");
      if (cancelBtn) {
        cancelBtn.textContent = "Done";
        cancelBtn.classList.remove("btn-secondary");
        cancelBtn.classList.add("btn-primary");
      }

      if (onReclaimed) onReclaimed(result);
    } catch (err) {
      consoleBody.innerHTML += `<div class="log-entry log-error"><span>[Error]</span> <span>${err.message || 'Bulk reclaim failed'}</span></div>`;
      consoleStatus.textContent = "Error";
      showToast(err.message || "Bulk reclaim failed", "error");
      executeBtn.disabled = false;
      executeBtn.innerHTML = `${icons.zap} <span>Reclaim Selected Caches</span>`;
    }
  });

  renderTabContent();
}
