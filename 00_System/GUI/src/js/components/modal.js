/**
 * Precision Studio Modals & Dialogs
 * Includes: Project Inspector (with Metadata Editing, Travel, Archive),
 * Resurrect Picker Modal, Confirmation Warning Dialogs, and Live SSE Sync Stream.
 */

import { api, formatBytes } from "../api.js";
import { getCategoryIconSvg, icons } from "../icons.js";
import { showToast } from "./toast.js";

let activeModalCloser = null;

export function closeActiveModal() {
  if (activeModalCloser) {
    activeModalCloser();
  }
}

/**
 * Generic Confirmation / Warning Modal
 */
export function openConfirmModal({
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  subtext = "",
  confirmText = "Proceed",
  cancelText = "Cancel",
  variant = "warning", // "warning", "danger", "info"
  onConfirm = async () => {},
}) {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  const isDanger = variant === "danger";
  const accentColor = isDanger ? "var(--color-danger)" : "var(--color-warning)";

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="confirm-modal-backdrop">
      <div class="modal-dialog modal-dialog-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="modal-header" style="border-bottom-color: ${accentColor}22;">
          <div class="modal-title-group">
            <div class="modal-category-icon" style="color: ${accentColor}; background: ${accentColor}18;">
              ${isDanger ? icons.error : icons.warning}
            </div>
            <div>
              <div class="modal-eyebrow">
                <span class="status-pill" style="color: ${accentColor}; background: ${accentColor}18; border-color: ${accentColor}33;">
                  ${variant.toUpperCase()} REQUIRED
                </span>
              </div>
              <h2 id="confirm-title" class="modal-title">${title}</h2>
            </div>
          </div>
          <button class="modal-close-btn" id="confirm-modal-close-btn" aria-label="Close dialog">
            ${icons.x}
          </button>
        </div>

        <div class="modal-body">
          <div class="confirm-message-box" style="border-left: 3px solid ${accentColor}; padding: 0.75rem 1rem; background: var(--surface-bg-card); border-radius: 4px;">
            <p style="color: var(--text-primary); font-size: 0.9rem; margin-bottom: ${subtext ? '0.5rem' : '0'}; line-height: 1.5;">${message}</p>
            ${subtext ? `<p class="font-mono" style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">${subtext}</p>` : ''}
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-secondary" id="confirm-cancel-btn">${cancelText}</button>
          <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirm-proceed-btn">
            ${confirmText}
          </button>
        </div>
      </div>
    </div>
  `;

  modalContainer.style.display = "block";
  document.body.style.overflow = "hidden";

  function closeModal() {
    modalContainer.style.display = "none";
    document.body.style.overflow = "";
    modalContainer.innerHTML = "";
    activeModalCloser = null;
  }

  document.getElementById("confirm-modal-close-btn")?.addEventListener("click", closeModal);
  document.getElementById("confirm-cancel-btn")?.addEventListener("click", closeModal);
  document.getElementById("confirm-modal-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "confirm-modal-backdrop") closeModal();
  });

  document.getElementById("confirm-proceed-btn")?.addEventListener("click", async () => {
    const btn = document.getElementById("confirm-proceed-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width: 12px; height: 12px; border-width: 2px; margin: 0;"></span> Processing...`;
    }
    try {
      await onConfirm();
      closeModal();
    } catch (err) {
      showToast(`Action failed: ${err.message}`, "error");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = confirmText;
      }
    }
  });

  activeModalCloser = closeModal;
}

/**
 * Project Inspector Modal with Editable Metadata, File Explorer Jump, Travel & Archive
 */
export function openProjectInspector(project, categoryConfig = {}, onProjectUpdated = () => {}) {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  let currentProject = { ...project };
  let isEditMode = false;

  function renderModal() {
    const isStale = currentProject.is_stale || currentProject.status === "stale";
    const cat = currentProject.type || "Video";
    const catInfo = categoryConfig[cat] || {};
    const folderTree = catInfo.folder_structure || ["00_Notes", "01_Source", "02_Build", "03_Exports"];

    const fullPath = currentProject.path || "";
    const relPath = currentProject.relative_path || currentProject.slug || "";
    const cdCommand = `cd "${fullPath}"`;
    const catIconSvg = getCategoryIconSvg(cat);

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <!-- Modal Header -->
          <div class="modal-header">
            <div class="modal-title-group">
              <div class="modal-category-icon">
                ${catIconSvg}
              </div>
              <div>
                <div class="modal-eyebrow">
                  <span class="category-pill-tag">${cat} Workspace</span>
                  <span class="status-pill ${isStale ? 'status-stale' : 'status-active'}">
                    ${isStale ? 'Stale (>90d)' : 'Active'}
                  </span>
                </div>
                <h2 id="modal-title" class="modal-title" title="${currentProject.name}">${currentProject.name}</h2>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <button class="btn btn-secondary" id="modal-toggle-edit-btn" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;">
                ${isEditMode ? icons.x : icons.edit}
                <span>${isEditMode ? 'Cancel Edit' : 'Edit Metadata'}</span>
              </button>
              <button class="modal-close-btn" id="modal-close-btn" aria-label="Close modal">
                ${icons.x}
              </button>
            </div>
          </div>

          <!-- Modal Body -->
          <div class="modal-body">
            ${isEditMode ? `
              <!-- Editable Metadata Form -->
              <div class="modal-section" style="background: var(--surface-bg-card); padding: 1.25rem; border-radius: 6px; border: 1px solid var(--border-subtle); margin-bottom: 1.25rem;">
                <h4 class="modal-section-heading" style="margin-bottom: 1rem; color: var(--color-accent-cyan);">Edit Project Metadata</h4>
                <form id="edit-metadata-form" class="studio-form">
                  <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                      <label class="form-label" for="edit-project-name">Project Title *</label>
                      <input type="text" id="edit-project-name" class="form-input font-mono" value="${currentProject.name || ''}" required />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="edit-project-client">Client / Entity</label>
                      <input type="text" id="edit-project-client" class="form-input" value="${currentProject.client && currentProject.client !== 'None' ? currentProject.client : ''}" placeholder="Internal / None" />
                    </div>
                  </div>

                  <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
                    <div class="form-group">
                      <label class="form-label" for="edit-project-category">Category</label>
                      <select id="edit-project-category" class="studio-select" style="width: 100%;">
                        ${Object.keys(categoryConfig).map(c => `
                          <option value="${c}" ${c.toLowerCase() === (currentProject.type || '').toLowerCase() ? 'selected' : ''}>${c}</option>
                        `).join("")}
                      </select>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="edit-project-tags">Tags (comma separated)</label>
                      <input type="text" id="edit-project-tags" class="form-input font-mono" value="${(currentProject.tags || []).join(', ')}" placeholder="e.g. commercial, 4k, vfx" />
                    </div>
                  </div>

                  <div class="form-group" style="margin-top: 0.75rem;">
                    <label class="form-label" for="edit-project-desc">Description / Brief</label>
                    <textarea id="edit-project-desc" class="form-textarea" rows="2" placeholder="Brief project summary or client deliverable goal...">${currentProject.description || ''}</textarea>
                  </div>

                  <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                    <button type="button" class="btn btn-secondary" id="cancel-edit-btn">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="save-metadata-btn">
                      ${icons.check} Save Changes
                    </button>
                  </div>
                </form>
              </div>
            ` : `
              <!-- Metrics Banner -->
              <div class="modal-metrics-grid">
                <div class="modal-metric-card">
                  <span class="metric-label">Total Footprint</span>
                  <span class="metric-val font-mono" style="color: var(--text-primary);">${formatBytes(currentProject.total_size || 0)}</span>
                  <span class="metric-sub font-mono">${currentProject.file_count || 0} tracked files</span>
                </div>
                <div class="modal-metric-card">
                  <span class="metric-label">Media Assets</span>
                  <span class="metric-val font-mono" style="color: var(--color-accent-cyan);">${formatBytes(currentProject.media_size || 0)}</span>
                  <span class="metric-sub">RAW &amp; Audio</span>
                </div>
                <div class="modal-metric-card">
                  <span class="metric-label">Reclaimable Cache</span>
                  <span class="metric-val font-mono" style="color: var(--color-warning);">${formatBytes(currentProject.reclaimable_size || 0)}</span>
                  <span class="metric-sub">Build caches</span>
                </div>
              </div>

              <!-- Metadata Properties -->
              <div class="modal-section">
                <h4 class="modal-section-heading">Project Metadata</h4>
                <div class="modal-props-grid">
                  <div class="prop-item">
                    <span class="prop-label">Client</span>
                    <span class="prop-val">${currentProject.client && currentProject.client !== "None" ? currentProject.client : "Internal"}</span>
                  </div>
                  <div class="prop-item">
                    <span class="prop-label">Date Created</span>
                    <span class="prop-val font-mono">${currentProject.created || "—"}</span>
                  </div>
                  <div class="prop-item">
                    <span class="prop-label">Last Modified</span>
                    <span class="prop-val font-mono">${currentProject.last_meaningful_update ? currentProject.last_meaningful_update.substring(0, 19).replace('T', ' ') : '—'}</span>
                  </div>
                  <div class="prop-item">
                    <span class="prop-label">Obsidian Sync</span>
                    <span class="prop-val font-mono" style="color: var(--color-success);">00_Notes &harr; Vault</span>
                  </div>
                </div>
                ${currentProject.description ? `
                  <div style="margin-top: 0.75rem; padding: 0.6rem 0.8rem; background: var(--surface-bg-card); border-radius: 4px; font-size: 0.82rem; color: var(--text-secondary);">
                    ${currentProject.description}
                  </div>
                ` : ''}
              </div>
            `}

            <!-- Quick Paths & Native Launch -->
            <div class="modal-section">
              <h4 class="modal-section-heading">Location &amp; Terminal</h4>
              <div class="modal-path-box">
                <div class="path-display-row">
                  <span class="path-chip">Relative</span>
                  <code class="path-code font-mono" title="${relPath}">${relPath}</code>
                  <button class="copy-path-btn" data-copy="${relPath}" title="Copy relative path" aria-label="Copy relative path">${icons.copy}</button>
                </div>
                <div class="path-display-row">
                  <span class="path-chip">System Path</span>
                  <code class="path-code font-mono" title="${fullPath}">${fullPath}</code>
                  <button class="copy-path-btn" data-copy="${fullPath}" title="Copy full path" aria-label="Copy full path">${icons.copy}</button>
                </div>
              </div>
            </div>

            <!-- Workspace Actions Strip (Explorer / Travel / Archive) -->
            <div class="modal-section">
              <h4 class="modal-section-heading">Workspace Actions</h4>
              <div class="workspace-actions-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
                <button class="btn btn-secondary action-btn-explorer" id="modal-explore-files-btn">
                  ${icons.folderOpen}
                  Browse Files
                </button>
                <button class="btn btn-secondary action-btn-openos" id="modal-open-native-btn">
                  ${icons.externalLink}
                  Open in OS
                </button>
                <button class="btn btn-secondary action-btn-travel" id="modal-travel-btn" title="Export to Shuttle Drive">
                  ${icons.travel}
                  Shuttle Travel
                </button>
                <button class="btn btn-secondary action-btn-archive" id="modal-archive-btn" style="color: var(--color-warning);" title="Move to Cold Storage">
                  ${icons.archive}
                  Archive
                </button>
              </div>
            </div>

            <!-- Blueprint Structure -->
            <div class="modal-section">
              <div class="modal-section-header">
                <h4 class="modal-section-heading">Directory Structure</h4>
                <span class="folder-count-tag font-mono">${folderTree.length} subfolders</span>
              </div>
              <div class="folder-tree-view">
                <div class="tree-root">
                  <span class="tree-icon">${icons.folder}</span>
                  <strong>${currentProject.slug || currentProject.name}</strong>
                </div>
                <div class="tree-branches">
                  ${folderTree.map((f, idx) => `
                    <div class="tree-node">
                      <span class="tree-line">${idx === folderTree.length - 1 ? '└─' : '├─'}</span>
                      <span class="tree-folder-icon">${icons.folder}</span>
                      <span class="tree-name ${f === '00_Notes' ? 'notes-highlight' : ''}">${f}</span>
                      ${f === '00_Notes' ? '<span class="tree-tag-obsidian">Obsidian Brain</span>' : ''}
                    </div>
                  `).join("")}
                  <div class="tree-node">
                    <span class="tree-line">└─</span>
                    <span class="tree-file-icon">${icons.file}</span>
                    <span class="tree-name font-mono">meta.json</span>
                    <span class="tree-tag-meta">Metadata</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer Actions -->
          <div class="modal-footer">
            <button class="btn btn-secondary copy-cd-btn" data-copy="${cdCommand}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              Copy Terminal cd
            </button>
            <a href="#storage" class="btn btn-primary" id="modal-view-storage-btn">
              View in Storage Table
            </a>
          </div>
        </div>
      </div>
    `;

    // Reattach Event Handlers
    attachModalHandlers();
  }

  function closeModal() {
    modalContainer.style.display = "none";
    document.body.style.overflow = "";
    modalContainer.innerHTML = "";
    activeModalCloser = null;
  }

  function attachModalHandlers() {
    document.getElementById("modal-close-btn")?.addEventListener("click", closeModal);
    document.getElementById("modal-backdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-backdrop") closeModal();
    });

    document.getElementById("modal-view-storage-btn")?.addEventListener("click", closeModal);

    // Toggle Edit Mode
    document.getElementById("modal-toggle-edit-btn")?.addEventListener("click", () => {
      isEditMode = !isEditMode;
      renderModal();
    });

    document.getElementById("cancel-edit-btn")?.addEventListener("click", () => {
      isEditMode = false;
      renderModal();
    });

    // Save Metadata Form Submit
    document.getElementById("edit-metadata-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("edit-project-name");
      const clientInput = document.getElementById("edit-project-client");
      const categorySelect = document.getElementById("edit-project-category");
      const tagsInput = document.getElementById("edit-project-tags");
      const descInput = document.getElementById("edit-project-desc");

      const newName = nameInput?.value.trim();
      if (!newName) {
        showToast("Project title cannot be empty", "error");
        return;
      }

      const tagsArray = (tagsInput?.value || "")
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);

      const payload = {
        name: newName,
        client: clientInput?.value.trim() || "None",
        category: categorySelect?.value || currentProject.type,
        tags: tagsArray,
        description: descInput?.value.trim() || "",
      };

      const saveBtn = document.getElementById("save-metadata-btn");
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner" style="width: 12px; height: 12px; border-width: 2px; margin: 0;"></span> Saving...`;
      }

      try {
        const res = await api.updateProject(currentProject.name || currentProject.slug, payload);
        showToast("Project metadata updated successfully", "success");
        currentProject = {
          ...currentProject,
          ...res.project,
          name: res.project.name,
          client: res.project.client,
          type: res.project.type,
          tags: res.project.tags,
          description: res.project.description,
        };
        isEditMode = false;
        renderModal();
        onProjectUpdated(currentProject);
      } catch (err) {
        showToast(`Failed to update metadata: ${err.message}`, "error");
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `${icons.check} Save Changes`;
        }
      }
    });

    // Browse in Explorer Action
    document.getElementById("modal-explore-files-btn")?.addEventListener("click", () => {
      closeModal();
      window.location.hash = `#explorer?path=${encodeURIComponent(currentProject.path || "")}`;
    });

    // Open Natively in OS
    document.getElementById("modal-open-native-btn")?.addEventListener("click", async () => {
      try {
        showToast("Opening project folder natively...", "info", 1500);
        await api.openPath(currentProject.path);
      } catch (err) {
        showToast(`Failed to open: ${err.message}`, "error");
      }
    });

    // Travel to Shuttle
    document.getElementById("modal-travel-btn")?.addEventListener("click", () => {
      openConfirmModal({
        title: "Launch Shuttle Travel",
        message: `Export and sync '${currentProject.name}' to your external Shuttle Drive?`,
        subtext: `Target: <SHUTTLE_PATH>/Projects/${currentProject.relative_path || currentProject.slug}`,
        confirmText: "Launch Travel",
        variant: "info",
        onConfirm: async () => {
          const res = await api.travelProject(currentProject.name || currentProject.slug);
          showToast(`Exported to Shuttle: ${res.dest_path}`, "success", 3000);
        },
      });
    });

    // Archive Project
    document.getElementById("modal-archive-btn")?.addEventListener("click", () => {
      openConfirmModal({
        title: "Archive Project to Cold Storage",
        message: `Move '${currentProject.name}' from active projects to the Cold Archive?`,
        subtext: "This safely moves project files out of the active studio tree. You can resurrect it anytime.",
        confirmText: "Archive Project",
        variant: "danger",
        onConfirm: async () => {
          const res = await api.archiveProject(currentProject.name || currentProject.slug);
          showToast(`Project archived to ${res.archive_path}`, "success", 3000);
          closeModal();
          onProjectUpdated(null); // Signal removal
        },
      });
    });

    // Copy buttons
    modalContainer.querySelectorAll(".copy-path-btn, .copy-cd-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const textToCopy = btn.getAttribute("data-copy");
        if (!textToCopy) return;
        try {
          await navigator.clipboard.writeText(textToCopy);
          showToast("Copied to clipboard", "info", 1500);
        } catch (err) {
          showToast("Copied to clipboard", "info", 1500);
        }
      });
    });
  }

  modalContainer.style.display = "block";
  document.body.style.overflow = "hidden";
  activeModalCloser = closeModal;

  renderModal();
}

/**
 * Resurrect Archived Projects Modal Picker
 */
export async function openResurrectModal(onResurrected = () => {}) {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="resurrect-modal-backdrop">
      <div class="modal-dialog modal-dialog-lg" role="dialog" aria-modal="true" aria-labelledby="resurrect-title">
        <div class="modal-header">
          <div class="modal-title-group">
            <div class="modal-category-icon" style="color: var(--color-accent-cyan); background: rgba(56, 189, 248, 0.1);">
              ${icons.resurrect}
            </div>
            <div>
              <div class="modal-eyebrow">
                <span class="status-pill" style="color: var(--color-accent-cyan); background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.2);">
                  COLD STORAGE RESTORE
                </span>
              </div>
              <h2 id="resurrect-title" class="modal-title">Resurrect Archived Project</h2>
            </div>
          </div>
          <button class="modal-close-btn" id="resurrect-close-btn" aria-label="Close modal">
            ${icons.x}
          </button>
        </div>

        <div class="modal-body">
          <div class="search-box" style="margin-bottom: 1rem;">
            <span class="search-icon">${icons.search}</span>
            <input type="text" id="resurrect-search-input" class="search-input" placeholder="Filter archived projects by name or client..." />
          </div>

          <div id="archived-projects-container" style="max-height: 400px; overflow-y: auto;">
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Scanning cold archive index...</p>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary" id="resurrect-cancel-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  modalContainer.style.display = "block";
  document.body.style.overflow = "hidden";

  function closeModal() {
    modalContainer.style.display = "none";
    document.body.style.overflow = "";
    modalContainer.innerHTML = "";
    activeModalCloser = null;
  }

  document.getElementById("resurrect-close-btn")?.addEventListener("click", closeModal);
  document.getElementById("resurrect-cancel-btn")?.addEventListener("click", closeModal);
  document.getElementById("resurrect-modal-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "resurrect-modal-backdrop") closeModal();
  });
  activeModalCloser = closeModal;

  try {
    const archivedProjects = await api.getArchivedProjects();
    const container = document.getElementById("archived-projects-container");
    const searchInput = document.getElementById("resurrect-search-input");

    function renderList() {
      if (!container) return;
      const query = (searchInput?.value || "").toLowerCase().trim();
      const filtered = archivedProjects.filter(p => {
        if (!query) return true;
        return (p.name && p.name.toLowerCase().includes(query)) ||
               (p.client && p.client.toLowerCase().includes(query)) ||
               (p.type && p.type.toLowerCase().includes(query));
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <h3 style="margin-bottom: 0.35rem; color: var(--text-primary); font-size: 1.05rem;">
              ${archivedProjects.length === 0 ? 'No Archived Projects Found' : 'No Matches Found'}
            </h3>
            <p style="font-size: 0.85rem;">${archivedProjects.length === 0 ? 'Your cold archive storage has no archived projects' : `No projects matching "${query}"`}</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="archived-cards-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${filtered.map(p => {
            const iconSvg = getCategoryIconSvg(p.type);
            return `
              <div class="archived-item-card" style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; background: var(--surface-bg-card); border: 1px solid var(--border-subtle); border-radius: 6px; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 0;">
                  <div class="card-icon-tag" style="width: 32px; height: 32px; font-size: 14px; flex-shrink: 0;">${iconSvg}</div>
                  <div style="min-width: 0;">
                    <h4 style="margin: 0; font-size: 0.95rem; color: var(--text-primary); font-weight: 600;" class="text-ellipsis">${p.name}</h4>
                    <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 0.75rem; margin-top: 0.2rem;" class="font-mono">
                      <span>${p.type}</span>
                      <span>Client: ${p.client && p.client !== 'None' ? p.client : 'Internal'}</span>
                      <span>${p.created || ''}</span>
                    </div>
                  </div>
                </div>
                <button class="btn btn-primary restore-action-btn" data-name="${p.name || p.slug}" style="flex-shrink: 0; padding: 0.4rem 0.85rem; font-size: 0.8rem;">
                  ${icons.resurrect}
                  Restore
                </button>
              </div>
            `;
          }).join("")}
        </div>
      `;

      container.querySelectorAll(".restore-action-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const projName = btn.getAttribute("data-name");
          openConfirmModal({
            title: "Resurrect Project",
            message: `Restore '${projName}' back to active Projects workspace?`,
            subtext: "The project will be moved back into its designated category folder and re-indexed.",
            confirmText: "Restore Project",
            variant: "info",
            onConfirm: async () => {
              const res = await api.resurrectProject(projName);
              showToast(`Project restored: ${res.path}`, "success", 3000);
              closeModal();
              onResurrected(res);
            },
          });
        });
      });
    }

    searchInput?.addEventListener("input", renderList);
    renderList();

  } catch (err) {
    const container = document.getElementById("archived-projects-container");
    if (container) {
      container.innerHTML = `
        <div class="empty-state" style="border-color: var(--color-danger);">
          <h3 style="color: var(--color-danger); margin-bottom: 0.35rem; font-size: 1.05rem;">Cannot Access Archive</h3>
          <p style="font-size: 0.85rem;">${err.message}</p>
        </div>
      `;
    }
  }
}

/**
 * Real-time SSE Live Sync Modal & Console
 */
export function openLiveSyncModal(onComplete = () => {}) {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="sync-modal-backdrop">
      <div class="modal-dialog modal-dialog-lg" role="dialog" aria-modal="true" aria-labelledby="sync-modal-title">
        <div class="modal-header">
          <div class="modal-title-group">
            <div class="modal-category-icon" style="color: var(--color-success); background: rgba(34, 197, 94, 0.1);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </div>
            <div>
              <div class="modal-eyebrow">
                <span class="status-pill status-active" id="sync-modal-status-badge">
                  <span class="status-dot pulsing"></span>
                  STREAMING SYNC
                </span>
              </div>
              <h2 id="sync-modal-title" class="modal-title">Obsidian Brain Live Sync</h2>
            </div>
          </div>
          <button class="modal-close-btn" id="sync-modal-close-btn" aria-label="Close modal">
            ${icons.x}
          </button>
        </div>

        <div class="modal-body">
          <div class="sync-live-summary" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
            <div class="modal-metric-card" style="padding: 0.75rem 1rem;">
              <span class="metric-label">Status</span>
              <span class="metric-val font-mono" id="sync-metric-status" style="font-size: 1.1rem; color: var(--color-accent-cyan);">Connecting</span>
            </div>
            <div class="modal-metric-card" style="padding: 0.75rem 1rem;">
              <span class="metric-label">Projects Scanned</span>
              <span class="metric-val font-mono" id="sync-metric-projects" style="font-size: 1.1rem;">0</span>
            </div>
            <div class="modal-metric-card" style="padding: 0.75rem 1rem;">
              <span class="metric-label">Notes Synced</span>
              <span class="metric-val font-mono" id="sync-metric-changes" style="font-size: 1.1rem; color: var(--color-success);">0</span>
            </div>
          </div>

          <div class="log-console" style="display: block; max-height: 280px; overflow-y: auto;">
            <div class="console-top-bar">
              <span class="console-title font-mono">Server-Sent Events Stream (SSE)</span>
              <span id="sync-stream-status" class="console-time font-mono">Live</span>
            </div>
            <div id="sync-stream-log-body" class="console-body font-mono" style="font-size: 0.78rem;">
              <div class="log-entry"><span>Connecting to /api/sync/stream...</span></div>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: flex-end;">
          <button class="btn btn-primary" id="sync-modal-done-btn" disabled>
            ${icons.check} Done
          </button>
        </div>
      </div>
    </div>
  `;

  modalContainer.style.display = "block";
  document.body.style.overflow = "hidden";

  let closeStream = null;

  function closeModal() {
    if (closeStream) closeStream();
    modalContainer.style.display = "none";
    document.body.style.overflow = "";
    modalContainer.innerHTML = "";
    activeModalCloser = null;
  }

  document.getElementById("sync-modal-close-btn")?.addEventListener("click", closeModal);
  document.getElementById("sync-modal-done-btn")?.addEventListener("click", closeModal);
  document.getElementById("sync-modal-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "sync-modal-backdrop") closeModal();
  });
  activeModalCloser = closeModal;

  const logBody = document.getElementById("sync-stream-log-body");
  const metricStatus = document.getElementById("sync-metric-status");
  const metricProjects = document.getElementById("sync-metric-projects");
  const metricChanges = document.getElementById("sync-metric-changes");
  const statusBadge = document.getElementById("sync-modal-status-badge");
  const doneBtn = document.getElementById("sync-modal-done-btn");

  let projectsCount = 0;
  let changesCount = 0;

  closeStream = api.streamSync(
    (event) => {
      if (!logBody) return;

      if (event.event === "start") {
        if (metricStatus) metricStatus.textContent = "Scanning";
        logBody.innerHTML += `<div class="log-entry log-info"><span>[Engine]</span> <span>${event.message}</span></div>`;
      } else if (event.event === "scanning_project") {
        projectsCount++;
        if (metricProjects) metricProjects.textContent = String(projectsCount);
        logBody.innerHTML += `<div class="log-entry font-mono" style="opacity: 0.7;"><span>[Scan]</span> <span>Checking project: ${event.project}</span></div>`;
      } else if (event.event === "file_sync") {
        changesCount++;
        if (metricChanges) metricChanges.textContent = String(changesCount);
        const typeClass = `log-${event.type || 'info'}`;
        logBody.innerHTML += `<div class="log-entry ${typeClass}"><span>[${event.project}]</span> <span>${(event.type || 'SYNC').toUpperCase()}: ${event.file} &rarr; ${event.msg}</span></div>`;
      } else if (event.event === "complete") {
        if (metricStatus) {
          metricStatus.textContent = "Synchronized";
          metricStatus.style.color = "var(--color-success)";
        }
        if (metricProjects) metricProjects.textContent = String(event.projects_synced || projectsCount);
        if (metricChanges) metricChanges.textContent = String(event.total_changes || changesCount);
        if (statusBadge) {
          statusBadge.innerHTML = `${icons.check} SYNC COMPLETE`;
          statusBadge.classList.add("status-active");
        }
        if (doneBtn) {
          doneBtn.disabled = false;
        }
        logBody.innerHTML += `<div class="log-entry log-push" style="margin-top: 0.5rem; font-weight: bold;"><span>✨ Sync complete. ${event.total_changes || 0} operations across ${event.projects_synced || 0} projects.</span></div>`;
        showToast("Obsidian Brain sync complete", "success");
        onComplete(event);
      }
      logBody.scrollTop = logBody.scrollHeight;
    },
    (err) => {
      if (metricStatus) {
        metricStatus.textContent = "Error";
        metricStatus.style.color = "var(--color-danger)";
      }
      if (doneBtn) doneBtn.disabled = false;
      if (logBody) {
        logBody.innerHTML += `<div class="log-entry log-error"><span>[Error] ${err.message || 'Stream disconnected'}</span></div>`;
      }
      showToast(`Sync error: ${err.message}`, "error");
    },
    (completeData) => {
      if (doneBtn) doneBtn.disabled = false;
    }
  );
}
