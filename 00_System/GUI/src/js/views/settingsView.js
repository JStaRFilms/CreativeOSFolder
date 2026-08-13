/**
 * Settings & Sync View
 */

import { api } from "../api.js";
import { showToast } from "../components/toast.js";

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">System Settings & Vault Sync</h1>
        <p class="page-description">Inspect active system paths, category mappings, and synchronize notes with Obsidian</p>
      </div>
    </div>

    <!-- Obsidian Sync Section -->
    <div class="settings-section">
      <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 class="section-title">Obsidian Brain Sync</h2>
          <p class="section-desc">Bidirectional synchronization between project <code>00_Notes/</code> and your Obsidian Vault</p>
        </div>
        <button id="trigger-sync-btn" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Sync With Vault
        </button>
      </div>

      <div id="sync-console" class="log-console" style="display: none;">
        <div id="sync-log-entries"></div>
      </div>
    </div>

    <!-- System Paths -->
    <div class="settings-section">
      <div class="section-header">
        <h2 class="section-title">Configured Paths</h2>
        <p class="section-desc">Paths resolved from <code>00_System/Config/config.json</code></p>
      </div>
      <div id="paths-list-container">
        <div class="loading-state" style="padding: 2rem;">
          <div class="spinner"></div>
          <p>Loading configuration...</p>
        </div>
      </div>
    </div>

    <!-- Category Configurations -->
    <div class="settings-section">
      <div class="section-header">
        <h2 class="section-title">Category Definitions</h2>
        <p class="section-desc">Dynamic project templates configured in <code>00_System/Config/categories.json</code></p>
      </div>
      <div id="categories-table-container">
        <div class="loading-state" style="padding: 2rem;">
          <div class="spinner"></div>
          <p>Loading categories...</p>
        </div>
      </div>
    </div>
  `;

  async function loadSettingsData() {
    try {
      const [configData, catData] = await Promise.all([
        api.getConfig(),
        api.getCategories(),
      ]);

      // Render Paths
      const pathsContainer = document.getElementById("paths-list-container");
      if (pathsContainer) {
        const paths = configData.paths || {};
        pathsContainer.innerHTML = `
          <div class="path-list">
            ${Object.entries(paths).map(([key, info]) => `
              <div class="path-item">
                <div class="path-meta">
                  <span class="path-name">${key}</span>
                  <span class="path-val">${info.path}</span>
                </div>
                <span class="path-status ${info.exists ? 'status-ok' : 'status-missing'}">
                  ${info.exists ? 'Connected' : 'Missing'}
                </span>
              </div>
            `).join("")}
          </div>
        `;
      }

      // Render Categories
      const categoriesContainer = document.getElementById("categories-table-container");
      if (categoriesContainer) {
        const categories = catData.categories || {};
        categoriesContainer.innerHTML = `
          <div class="table-card">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Folder</th>
                    <th>Template</th>
                    <th>Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(categories).map(([name, cat]) => `
                    <tr>
                      <td class="cell-project-name">
                        <span>${cat.icon || '📁'}</span>
                        <span>${name}</span>
                      </td>
                      <td class="cell-mono">${cat.physical_folder || name}</td>
                      <td class="cell-mono">${cat.template || 'simple'}</td>
                      <td>${cat.description || '—'}</td>
                      <td>
                        <span class="status-badge ${cat.enabled !== false ? 'status-active' : 'status-stale'}">
                          ${cat.enabled !== false ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    } catch (err) {
      showToast(`Error loading settings: ${err.message}`, "error");
    }
  }

  // Handle Sync
  const syncBtn = document.getElementById("trigger-sync-btn");
  const syncConsole = document.getElementById("sync-console");
  const syncLogEntries = document.getElementById("sync-log-entries");

  syncBtn?.addEventListener("click", async () => {
    syncBtn.disabled = true;
    syncBtn.innerHTML = `
      <span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin: 0;"></span>
      Syncing...
    `;

    if (syncConsole) {
      syncConsole.style.display = "block";
      if (syncLogEntries) {
        syncLogEntries.innerHTML = `<div class="log-entry"><span>Connecting to Obsidian Vault...</span></div>`;
      }
    }

    try {
      const result = await api.triggerSync();
      showToast(`Sync complete: ${result.total_changes} operations across ${result.projects_synced} projects`, "success");

      if (syncLogEntries) {
        if (result.logs && result.logs.length > 0) {
          syncLogEntries.innerHTML = result.logs.map(l => {
            const typeClass = `log-${l.type}`;
            return `<div class="log-entry ${typeClass}"><span>[${l.project}]</span> <span>${l.type.toUpperCase()}: ${l.file}</span></div>`;
          }).join("") + `<div class="log-entry" style="color: var(--color-success); margin-top: 0.5rem;"><span>✅ Sync finished successfully at ${result.last_sync}</span></div>`;
        } else {
          syncLogEntries.innerHTML = `<div class="log-entry" style="color: var(--color-success);"><span>✅ All notes are already in sync. No changes needed (${result.projects_synced} projects scanned).</span></div>`;
        }
      }
    } catch (err) {
      showToast(`Sync failed: ${err.message}`, "error");
      if (syncLogEntries) {
        syncLogEntries.innerHTML += `<div class="log-entry log-error"><span>❌ Error: ${err.message}</span></div>`;
      }
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Sync With Vault
      `;
    }
  });

  await loadSettingsData();
}
