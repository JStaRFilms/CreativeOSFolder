/**
 * Settings & Obsidian Sync View — Studio Blueprint Explorer
 */

import { api, cacheStore } from "../api.js";
import { getCategoryIconSvg, icons } from "../icons.js";
import { showToast } from "../components/toast.js";

export async function renderSettings(container) {
  const cachedConfig = cacheStore.get("config");
  const cachedCats = cacheStore.get("categories");
  const hasCache = Boolean(cachedConfig && cachedCats);

  let isEditingPaths = false;
  let currentConfigData = cachedConfig || null;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-eyebrow">
          <span class="studio-status-indicator" style="background-color: var(--text-primary);"></span>
          <span>SYSTEM RUNTIME &amp; INTEGRATION</span>
        </div>
        <h1 class="page-title">System &amp; Vault Sync</h1>
        <p class="page-description">Inspect active system paths, category blueprints, and synchronize notes with Obsidian</p>
      </div>
    </div>

    <!-- Obsidian Sync Section -->
    <div class="settings-section">
      <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 class="section-title">Obsidian Brain Sync</h2>
          <p class="section-desc">Bidirectional synchronization between project notes (<code>00_Notes/</code>) and your Obsidian Vault</p>
        </div>
        <button id="trigger-sync-btn" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Sync With Vault
        </button>
      </div>

      <div id="sync-console" class="log-console" style="display: none;">
        <div class="console-top-bar">
          <span class="console-title font-mono">Obsidian Vault Sync Stream</span>
          <span id="sync-time-stamp" class="console-time font-mono">Ready</span>
        </div>
        <div id="sync-log-entries" class="console-body font-mono"></div>
      </div>
    </div>

    <!-- System Paths -->
    <div class="settings-section">
      <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 class="section-title">System Paths</h2>
          <p class="section-desc">Configured workspace storage locations loaded from <code>00_System/Config/config.json</code></p>
        </div>
        <button id="toggle-edit-paths-btn" class="btn btn-secondary" style="font-size: 0.8rem;">
          ${icons.edit}
          <span id="edit-paths-btn-text">Edit Paths</span>
        </button>
      </div>
      <div id="paths-list-container">
        ${hasCache ? '' : `
          <div class="loading-state" style="padding: 2rem;">
            <div class="spinner"></div>
            <p>Loading configuration...</p>
          </div>
        `}
      </div>
    </div>

    <!-- Category Configurations -->
    <div class="settings-section">
      <div class="section-header">
        <h2 class="section-title">Category Blueprints</h2>
        <p class="section-desc">Real project scaffolding templates and seeded files loaded from <code>00_System/Config/categories.json</code></p>
      </div>
      <div id="categories-table-container">
        ${hasCache ? '' : `
          <div class="loading-state" style="padding: 2rem;">
            <div class="spinner"></div>
            <p>Loading category blueprints...</p>
          </div>
        `}
      </div>
    </div>
  `;

  function renderPaths(configData) {
    currentConfigData = configData;
    const pathsContainer = document.getElementById("paths-list-container");
    if (!pathsContainer) return;
    const paths = configData?.paths || {};

    if (isEditingPaths) {
      pathsContainer.innerHTML = `
        <form id="edit-paths-form" class="studio-form" style="background: var(--surface-bg-card); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${Object.entries(paths).map(([key, info]) => `
              <div class="form-group">
                <label class="form-label font-mono" for="path-input-${key}" style="text-transform: none;">${key}</label>
                <input type="text" id="path-input-${key}" name="${key}" class="form-input font-mono" value="${info.path || ''}" required />
              </div>
            `).join("")}

            <div class="form-group" style="padding: 0.75rem 1rem; border-radius: var(--radius-sm); background: var(--bg-app); border: 1px dashed var(--border-subtle); margin-top: 0.5rem;">
              <label class="checkbox-label" style="display: flex; align-items: flex-start; gap: 0.65rem; cursor: pointer;">
                <input type="checkbox" id="migrate-files-check" style="margin-top: 0.2rem; accent-color: var(--color-primary); width: 15px; height: 15px;" />
                <div>
                  <span style="font-weight: 600; font-size: 0.825rem; color: var(--text-primary);">Migrate &amp; copy existing files to new locations</span>
                  <p style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.15rem;">
                    If changing a folder location, copy all existing contents from old path to the newly configured path.
                  </p>
                </div>
              </label>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.75rem;">
              <button type="button" class="btn btn-secondary" id="cancel-edit-paths-btn">Cancel</button>
              <button type="submit" class="btn btn-primary" id="save-paths-btn">
                ${icons.check} Save Configuration
              </button>
            </div>
          </div>
        </form>
      `;

      document.getElementById("cancel-edit-paths-btn")?.addEventListener("click", () => {
        isEditingPaths = false;
        const btnText = document.getElementById("edit-paths-btn-text");
        if (btnText) btnText.textContent = "Edit Paths";
        renderPaths(currentConfigData);
      });

      document.getElementById("edit-paths-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        const pathsMap = {};
        Object.keys(paths).forEach(key => {
          const input = form.querySelector(`[name="${key}"]`);
          if (input) pathsMap[key] = input.value.trim();
        });

        const migrateFiles = Boolean(document.getElementById("migrate-files-check")?.checked);
        const saveBtn = document.getElementById("save-paths-btn");
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = `<span class="spinner" style="width: 12px; height: 12px; border-width: 2px; margin: 0;"></span> Saving...`;
        }

        try {
          const res = await api.updatePaths(pathsMap, migrateFiles);
          showToast("System configuration paths updated successfully", "success");
          isEditingPaths = false;
          const btnText = document.getElementById("edit-paths-btn-text");
          if (btnText) btnText.textContent = "Edit Paths";

          const freshConfig = await api.getConfig();
          renderPaths(freshConfig);
        } catch (err) {
          showToast(`Failed to update paths: ${err.message}`, "error");
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `${icons.check} Save Configuration`;
          }
        }
      });

      return;
    }

    pathsContainer.innerHTML = `
      <div class="path-list">
        ${Object.entries(paths).map(([key, info]) => `
          <div class="path-item">
            <div class="path-meta">
              <div class="path-title-row">
                <span class="path-name">${key}</span>
                <span class="path-status ${info.exists ? 'status-ok' : 'status-missing'}">
                  ${info.exists ? 'Connected' : 'Missing'}
                </span>
              </div>
              <span class="path-val font-mono">${info.path}</span>
            </div>
            <button class="icon-button copy-path-btn" data-copy="${info.path}" title="Copy path" aria-label="Copy path">
              ${icons.copy}
            </button>
          </div>
        `).join("")}
      </div>
    `;

    pathsContainer.querySelectorAll(".copy-path-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const text = btn.getAttribute("data-copy");
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          showToast("Path copied to clipboard", "info", 1500);
        } catch (err) {
          showToast("Path copied", "info", 1500);
        }
      });
    });
  }

  document.getElementById("toggle-edit-paths-btn")?.addEventListener("click", () => {
    isEditingPaths = !isEditingPaths;
    const btnText = document.getElementById("edit-paths-btn-text");
    if (btnText) btnText.textContent = isEditingPaths ? "Cancel Edit" : "Edit Paths";
    renderPaths(currentConfigData);
  });

  function renderCategories(catData) {
    const categoriesContainer = document.getElementById("categories-table-container");
    if (!categoriesContainer) return;
    const categories = catData?.categories || {};
    categoriesContainer.innerHTML = `
      <div class="category-cards-grid">
        ${Object.entries(categories).map(([name, cat]) => {
          const tStruct = cat.template_structure || {};
          const folders = Object.keys(tStruct).length > 0 ? Object.keys(tStruct) : (cat.folder_structure || []);
          const catIconSvg = getCategoryIconSvg(name);
          return `
            <div class="category-blueprint-card">
              <div class="blueprint-header">
                <div class="blueprint-title-group">
                  <span class="blueprint-icon">
                    ${catIconSvg}
                  </span>
                  <div>
                    <h4 class="blueprint-name">${name}</h4>
                    <span class="blueprint-folder font-mono">01_Projects/${cat.physical_folder || name}/</span>
                  </div>
                </div>
                <span class="status-indicator-tag ${cat.enabled !== false ? 'is-active' : 'is-stale'}">
                  <span class="status-dot"></span>
                  <span>${cat.enabled !== false ? 'Enabled' : 'Disabled'}</span>
                </span>
              </div>
              
              <p class="blueprint-desc">${cat.description || 'Standard project scaffold'}</p>
              
              <div class="blueprint-folders-list">
                ${folders.map(f => {
                  const files = tStruct[f] || [];
                  return `
                    <div style="display: flex; flex-direction: column; gap: 0.15rem; margin-bottom: 0.35rem;">
                      <span class="blueprint-folder-chip font-mono ${f === '00_Notes' ? 'chip-notes' : ''}">
                        ${f}/
                      </span>
                      ${files.length > 0 ? `
                        <span style="font-size: 0.675rem; color: var(--text-muted); padding-left: 0.35rem;" class="font-mono">
                          ↳ ${files.join(", ")}
                        </span>
                      ` : ''}
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  async function loadSettingsData() {
    try {
      if (hasCache) {
        renderPaths(cachedConfig);
        renderCategories(cachedCats);
      }

      api.getConfigSWR((freshConfig) => {
        renderPaths(freshConfig);
      });

      api.getCategoriesSWR((freshCats) => {
        renderCategories(freshCats);
      });
    } catch (err) {
      console.error("Error loading settings data:", err);
      showToast("Error loading system settings", "error");
    }
  }

  // Handle Sync
  const syncBtn = document.getElementById("trigger-sync-btn");
  const syncConsole = document.getElementById("sync-console");
  const syncLogEntries = document.getElementById("sync-log-entries");
  const syncTimeStamp = document.getElementById("sync-time-stamp");

  syncBtn?.addEventListener("click", () => {
    syncBtn.disabled = true;
    syncBtn.innerHTML = `
      <span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin: 0;"></span>
      Syncing...
    `;

    if (syncConsole) {
      syncConsole.style.display = "block";
      if (syncLogEntries) {
        syncLogEntries.innerHTML = `<div class="log-entry log-info"><span>[Engine]</span> <span>Connecting to /api/sync/stream...</span></div>`;
      }
    }

    let syncedChanges = 0;
    let projectsSynced = 0;

    api.streamSync(
      (event) => {
        if (!syncLogEntries) return;

        if (event.event === "start") {
          syncLogEntries.innerHTML += `<div class="log-entry log-info"><span>[Engine]</span> <span>${event.message}</span></div>`;
        } else if (event.event === "scanning_project") {
          projectsSynced++;
          if (syncTimeStamp) {
            syncTimeStamp.textContent = `Scanning: ${event.project}`;
          }
        } else if (event.event === "file_sync") {
          syncedChanges++;
          const typeClass = `log-${event.type || 'info'}`;
          syncLogEntries.innerHTML += `<div class="log-entry ${typeClass}"><span>[${event.project}]</span> <span>${(event.type || 'SYNC').toUpperCase()}: ${event.file} (${event.msg})</span></div>`;
        } else if (event.event === "complete") {
          if (syncTimeStamp) {
            syncTimeStamp.textContent = event.last_sync ? `Synced at ${event.last_sync.substring(11, 19)}` : "Finished";
          }
          syncLogEntries.innerHTML += `<div class="log-entry log-push" style="margin-top: 0.5rem; font-weight: bold;"><span>✨ Sync complete. ${event.total_changes || syncedChanges} operations across ${event.projects_synced || projectsSynced} projects.</span></div>`;
          showToast(`Sync complete: ${event.total_changes || 0} operations`, "success");
        }
        syncLogEntries.scrollTop = syncLogEntries.scrollHeight;
      },
      (err) => {
        showToast(`Sync failed: ${err.message}`, "error");
        if (syncLogEntries) {
          syncLogEntries.innerHTML += `<div class="log-entry log-error"><span>[Error]</span> <span>${err.message}</span></div>`;
        }
        syncBtn.disabled = false;
        syncBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Sync With Vault
        `;
      },
      (completeData) => {
        syncBtn.disabled = false;
        syncBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Sync With Vault
        `;
      }
    );
  });

  loadSettingsData();
}
