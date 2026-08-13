/**
 * Reclaim Space & Dependency Cache Modal Component
 * Precision Studio tools for selective and bulk cache recovery.
 */

import { api, formatBytes } from "../api.js";
import { getCategoryIconSvg, icons } from "../icons.js";
import { showToast } from "./toast.js";

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
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="reclaim-title" style="max-width: 580px;">
      <div class="modal-header">
        <div class="modal-title-group">
          <span class="modal-cat-icon">${catIcon}</span>
          <div>
            <h3 id="reclaim-title" class="modal-title">Reclaim Project Space</h3>
            <span class="modal-subtitle font-mono">${project.relative_path || project.name}</span>
          </div>
        </div>
        <button class="modal-close-btn" id="reclaim-close-btn" aria-label="Close dialog">
          ${icons.close}
        </button>
      </div>

      <div class="modal-body" style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
        <div id="reclaim-loading-state" class="loading-state" style="padding: 2rem 1rem;">
          <div class="spinner"></div>
          <p>Analyzing regenerable directories...</p>
        </div>

        <div id="reclaim-content-wrap" style="display: none; flex-direction: column; gap: 1rem;">
          <!-- Hero Strip -->
          <div class="reclaim-hero-strip">
            <div class="reclaim-hero-left">
              <div class="reclaim-hero-icon">${icons.zap}</div>
              <div>
                <div class="reclaim-hero-title">${project.name}</div>
                <div class="reclaim-hero-sub font-mono">01_Projects/${project.relative_path || project.slug}/</div>
              </div>
            </div>
            <div class="reclaim-hero-stat">
              <span id="reclaim-selected-bytes" class="reclaim-hero-badge font-mono">0 B</span>
              <span class="reclaim-hero-label">Recoverable</span>
            </div>
          </div>

          <!-- Items Breakdown -->
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.725rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
              Detected Caches &amp; Dependencies
            </span>
            <button type="button" id="reclaim-select-all-btn" class="btn btn-secondary btn-sm" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">
              Select All
            </button>
          </div>

          <div id="reclaim-items-list" class="reclaim-items-container"></div>

          <!-- Safety Notice -->
          <div class="reclaim-safety-notice">
            ${icons.info}
            <span>
              <strong>Safe Recovery:</strong> Only regenerable dependencies and caches will be deleted. Source code, notes, and media files are never removed and remain completely safe.
            </span>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="padding: 1rem 1.5rem; justify-content: space-between;">
        <button type="button" class="btn btn-secondary" id="reclaim-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-danger" id="reclaim-execute-btn" disabled style="display: flex; align-items: center; gap: 0.4rem;">
          ${icons.zap}
          <span id="reclaim-btn-label">Purge &amp; Reclaim</span>
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
      <div class="reclaim-item-row is-selected" data-idx="${idx}" data-path="${item.relative_path}" data-size="${item.size}">
        <div class="reclaim-item-left">
          <input type="checkbox" class="reclaim-item-checkbox" checked data-idx="${idx}" />
          <div class="reclaim-item-meta">
            <span class="reclaim-item-name">
              <span style="color: var(--color-warning);">${icons.folder}</span>
              <span class="font-mono">${item.relative_path}/</span>
            </span>
            <span class="reclaim-item-desc">${item.description}</span>
          </div>
        </div>
        <div class="reclaim-item-right">
          <span class="reclaim-item-size font-mono">${formatBytes(item.size)}</span>
          <span class="reclaim-item-files font-mono">${item.file_count || 0} files</span>
        </div>
      </div>
    `).join("");

    const updateTotals = () => {
      let selectedSize = 0;
      let selectedCount = 0;

      listEl.querySelectorAll(".reclaim-item-row").forEach(row => {
        const checkbox = row.querySelector(".reclaim-item-checkbox");
        if (checkbox && checkbox.checked) {
          selectedSize += Number(row.getAttribute("data-size") || 0);
          selectedCount += 1;
          row.classList.add("is-selected");
        } else {
          row.classList.remove("is-selected");
        }
      });

      selectedBadge.textContent = formatBytes(selectedSize);
      executeBtn.disabled = selectedCount === 0;
      btnLabel.textContent = selectedCount > 0 ? `Purge & Reclaim ${formatBytes(selectedSize)}` : "Select Folders to Reclaim";
    };

    updateTotals();

    // Attach row toggle listeners
    listEl.querySelectorAll(".reclaim-item-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.type !== "checkbox") {
          const cb = row.querySelector(".reclaim-item-checkbox");
          if (cb) {
            cb.checked = !cb.checked;
            updateTotals();
          }
        }
      });

      const cb = row.querySelector(".reclaim-item-checkbox");
      if (cb) {
        cb.addEventListener("change", updateTotals);
      }
    });

    // Select all toggle
    let allSelected = true;
    selectAllBtn.addEventListener("click", () => {
      allSelected = !allSelected;
      listEl.querySelectorAll(".reclaim-item-checkbox").forEach(cb => {
        cb.checked = allSelected;
      });
      selectAllBtn.textContent = allSelected ? "Deselect All" : "Select All";
      updateTotals();
    });

    // Execute button
    executeBtn.addEventListener("click", async () => {
      const selectedTargets = [];
      listEl.querySelectorAll(".reclaim-item-row").forEach(row => {
        const cb = row.querySelector(".reclaim-item-checkbox");
        if (cb && cb.checked) {
          selectedTargets.push(row.getAttribute("data-path"));
        }
      });

      if (selectedTargets.length === 0) return;

      executeBtn.disabled = true;
      executeBtn.innerHTML = `<div class="spinner spinner-sm" style="width: 14px; height: 14px;"></div> <span>Purging...</span>`;

      try {
        const purgeRes = await api.reclaimProject(lookupKey, selectedTargets);
        showToast(`⚡ Reclaimed ${formatBytes(purgeRes.freed_bytes || 0)} from ${project.name}!`, "success");
        close();
        if (onReclaimed) onReclaimed(purgeRes);
      } catch (err) {
        showToast(err.message || "Failed to reclaim space", "error");
        executeBtn.disabled = false;
        executeBtn.innerHTML = `${icons.zap} <span>Purge &amp; Reclaim</span>`;
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
    <div class="modal-dialog modal-dialog-lg" role="dialog" aria-modal="true" aria-labelledby="bulk-reclaim-title">
      <div class="modal-header">
        <div class="modal-title-group">
          <span class="reclaim-hero-icon" style="width: 32px; height: 32px; font-size: 1rem;">${icons.zap}</span>
          <div>
            <h3 id="bulk-reclaim-title" class="modal-title">Workspace Reclaim Engine</h3>
            <span class="modal-subtitle">Purge dependency caches across inactive projects</span>
          </div>
        </div>
        <button class="modal-close-btn" id="bulk-reclaim-close-btn" aria-label="Close dialog">
          ${icons.close}
        </button>
      </div>

      <div class="modal-body" style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
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
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span id="bulk-selection-summary" style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary);">
              0 projects selected
            </span>
            <span id="bulk-selection-bytes" class="badge font-mono" style="background-color: rgba(245, 158, 11, 0.12); color: var(--color-warning); font-size: 0.75rem; font-weight: 700;">
              0 B
            </span>
          </div>
          <button type="button" id="bulk-select-all-btn" class="btn btn-secondary btn-sm" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">
            Select All
          </button>
        </div>

        <!-- Projects Checklist -->
        <div id="bulk-projects-list-container" class="bulk-projects-list"></div>

        <!-- Real-time Execution Console (Shown while or after running) -->
        <div id="bulk-reclaim-console" class="log-console" style="display: none; margin-top: 0.25rem;">
          <div class="console-top-bar">
            <span class="console-title font-mono">Reclaim Engine Stream</span>
            <span id="bulk-console-status" class="console-time font-mono">Ready</span>
          </div>
          <div id="bulk-console-body" class="console-body font-mono" style="max-height: 160px;"></div>
        </div>

        <!-- Safety Notice -->
        <div class="reclaim-safety-notice">
          ${icons.info}
          <span>
            <strong>Zero Source Code Risk:</strong> Only rebuildable cache folders (e.g. <code>node_modules</code>, <code>.next</code>, <code>dist</code>, <code>.venv</code>) are removed. Everything else is untouched.
          </span>
        </div>
      </div>

      <div class="modal-footer" style="padding: 1rem 1.5rem; justify-content: space-between;">
        <button type="button" class="btn btn-secondary" id="bulk-reclaim-cancel-btn">Close</button>
        <button type="button" class="btn btn-danger" id="bulk-reclaim-execute-btn" style="display: flex; align-items: center; gap: 0.4rem;">
          ${icons.zap}
          <span id="bulk-reclaim-btn-label">Purge Selected Caches</span>
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
        <div class="bulk-project-card is-selected" data-idx="${idx}" data-path="${p.path || ''}" data-slug="${p.slug || p.name}" data-size="${p.reclaimable_size || 0}">
          <div class="bulk-project-identity">
            <input type="checkbox" class="reclaim-item-checkbox" checked data-slug="${p.slug || p.name}" />
            <span style="display: flex; align-items: center; color: var(--color-primary); flex-shrink: 0;">${icon}</span>
            <div style="display: flex; flex-direction: column; min-width: 0;">
              <span class="bulk-project-name">${p.name}</span>
              <span class="bulk-project-path font-mono">01_Projects/${p.relative_path || p.slug}/</span>
            </div>
          </div>
          <div class="bulk-project-stat">
            <span class="bulk-project-size font-mono">${formatBytes(p.reclaimable_size || 0)}</span>
            <span class="bulk-project-stale-tag font-mono">
              ${isStale ? '<span style="color: var(--color-warning);">Stale (&gt;90d)</span>' : (p.last_meaningful_update ? p.last_meaningful_update.substring(0, 10) : 'Active')}
            </span>
          </div>
        </div>
      `;
    }).join("");

    listContainer.querySelectorAll(".bulk-project-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.type !== "checkbox") {
          const cb = card.querySelector(".reclaim-item-checkbox");
          if (cb) {
            cb.checked = !cb.checked;
            updateSummary();
          }
        }
      });

      const cb = card.querySelector(".reclaim-item-checkbox");
      if (cb) {
        cb.addEventListener("change", updateSummary);
      }
    });

    updateSummary();
  }

  function updateSummary() {
    let totalBytes = 0;
    let selectedCount = 0;

    listContainer.querySelectorAll(".bulk-project-card").forEach(card => {
      const cb = card.querySelector(".reclaim-item-checkbox");
      if (cb && cb.checked) {
        totalBytes += Number(card.getAttribute("data-size") || 0);
        selectedCount += 1;
        card.classList.add("is-selected");
      } else {
        card.classList.remove("is-selected");
      }
    });

    summaryCount.textContent = `${selectedCount} project${selectedCount === 1 ? '' : 's'} selected`;
    summaryBytes.textContent = formatBytes(totalBytes);
    executeBtn.disabled = selectedCount === 0;
    btnLabel.textContent = selectedCount > 0 ? `Purge & Reclaim ${formatBytes(totalBytes)}` : "Select Projects";
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
    listContainer.querySelectorAll(".reclaim-item-checkbox").forEach(cb => {
      cb.checked = allSelected;
    });
    selectAllBtn.textContent = allSelected ? "Deselect All" : "Select All";
    updateSummary();
  });

  // Execute Bulk Reclaim
  executeBtn.addEventListener("click", async () => {
    const selectedSlugs = [];
    listContainer.querySelectorAll(".bulk-project-card").forEach(card => {
      const cb = card.querySelector(".reclaim-item-checkbox");
      if (cb && cb.checked) {
        selectedSlugs.push(card.getAttribute("data-slug"));
      }
    });

    if (selectedSlugs.length === 0) return;

    executeBtn.disabled = true;
    executeBtn.innerHTML = `<div class="spinner spinner-sm" style="width: 14px; height: 14px;"></div> <span>Purging Caches...</span>`;
    consoleEl.style.display = "block";
    consoleStatus.textContent = "Running Purge...";
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
              <span>[Purged]</span>
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
      executeBtn.innerHTML = `${icons.zap} <span>Purge Selected Caches</span>`;
    }
  });

  renderTabContent();
}
