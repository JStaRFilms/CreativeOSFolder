/**
 * Project Inspector Modal Component
 */

import { formatBytes } from "../api.js";
import { showToast } from "./toast.js";

let activeModal = null;

export function openProjectInspector(project, categoryConfig = {}) {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  const isStale = project.is_stale || project.status === "stale";
  const cat = project.type || "Video";
  const catInfo = categoryConfig[cat] || {};
  const folderTree = catInfo.folder_structure || ["00_Notes", "01_Source", "02_Build", "03_Exports"];

  const fullPath = project.path || "";
  const relPath = project.relative_path || project.slug || "";
  const cdCommand = `cd "${fullPath}"`;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-title-group">
            <div class="modal-category-icon" style="background-color: var(--cat-${cat.toLowerCase()}-bg, var(--badge-bg)); color: var(--cat-${cat.toLowerCase()}, var(--color-primary));">
              ${project.icon || catInfo.icon || "📁"}
            </div>
            <div>
              <div class="modal-eyebrow">
                <span class="category-pill-tag">${cat} Project</span>
                <span class="status-pill ${isStale ? 'status-stale' : 'status-active'}">
                  ${isStale ? 'Stale (>90d)' : 'Active Workspace'}
                </span>
              </div>
              <h2 id="modal-title" class="modal-title" title="${project.name}">${project.name}</h2>
            </div>
          </div>
          <button class="modal-close-btn" id="modal-close-btn" aria-label="Close modal">✕</button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body">
          <!-- Metrics Banner -->
          <div class="modal-metrics-grid">
            <div class="modal-metric-card">
              <span class="metric-label">Total Footprint</span>
              <span class="metric-val" style="color: var(--text-primary); font-family: var(--font-mono);">${formatBytes(project.total_size || 0)}</span>
              <span class="metric-sub">${project.file_count || 0} tracked files</span>
            </div>
            <div class="modal-metric-card">
              <span class="metric-label">Media Data</span>
              <span class="metric-val" style="color: var(--color-accent-cyan); font-family: var(--font-mono);">${formatBytes(project.media_size || 0)}</span>
              <span class="metric-sub">Footage & Stems</span>
            </div>
            <div class="modal-metric-card">
              <span class="metric-label">Reclaimable Cache</span>
              <span class="metric-val" style="color: var(--color-warning); font-family: var(--font-mono);">${formatBytes(project.reclaimable_size || 0)}</span>
              <span class="metric-sub">Builds & Cache</span>
            </div>
          </div>

          <!-- Metadata Properties -->
          <div class="modal-section">
            <h4 class="modal-section-heading">Project Specs</h4>
            <div class="modal-props-grid">
              <div class="prop-item">
                <span class="prop-label">Client</span>
                <span class="prop-val">${project.client && project.client !== "None" ? project.client : "Internal / Self"}</span>
              </div>
              <div class="prop-item">
                <span class="prop-label">Date Created</span>
                <span class="prop-val font-mono">${project.created || "—"}</span>
              </div>
              <div class="prop-item">
                <span class="prop-label">Last Modified</span>
                <span class="prop-val font-mono">${project.last_meaningful_update ? project.last_meaningful_update.substring(0, 19).replace('T', ' ') : '—'}</span>
              </div>
              <div class="prop-item">
                <span class="prop-label">Obsidian Sync</span>
                <span class="prop-val" style="color: var(--color-success);">00_Notes &harr; Vault</span>
              </div>
            </div>
          </div>

          <!-- Quick Paths & Terminal Copy -->
          <div class="modal-section">
            <h4 class="modal-section-heading">Location & Commands</h4>
            <div class="modal-path-box">
              <div class="path-display-row">
                <span class="path-chip">Relative</span>
                <code class="path-code" title="${relPath}">${relPath}</code>
                <button class="copy-path-btn" data-copy="${relPath}" title="Copy relative path">📋</button>
              </div>
              <div class="path-display-row">
                <span class="path-chip">System Path</span>
                <code class="path-code" title="${fullPath}">${fullPath}</code>
                <button class="copy-path-btn" data-copy="${fullPath}" title="Copy full path">📋</button>
              </div>
            </div>
          </div>

          <!-- Blueprint Structure -->
          <div class="modal-section">
            <div class="modal-section-header">
              <h4 class="modal-section-heading">Directory Structure Blueprint</h4>
              <span class="folder-count-tag">${folderTree.length} subfolders</span>
            </div>
            <div class="folder-tree-view">
              <div class="tree-root">
                <span class="tree-icon">📁</span>
                <strong>${project.slug || project.name}</strong>
              </div>
              <div class="tree-branches">
                ${folderTree.map((f, idx) => `
                  <div class="tree-node">
                    <span class="tree-line">${idx === folderTree.length - 1 ? '└─' : '├─'}</span>
                    <span class="tree-folder-icon">📂</span>
                    <span class="tree-name ${f === '00_Notes' ? 'notes-highlight' : ''}">${f}</span>
                    ${f === '00_Notes' ? '<span class="tree-tag-obsidian">Obsidian Brain</span>' : ''}
                  </div>
                `).join("")}
                <div class="tree-node">
                  <span class="tree-line">└─</span>
                  <span class="tree-file-icon">📄</span>
                  <span class="tree-name font-mono">meta.json</span>
                  <span class="tree-tag-meta">CreativeOS Metadata</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div class="modal-footer">
          <button class="btn btn-secondary copy-cd-btn" data-copy="${cdCommand}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            Copy Terminal Command
          </button>
          <a href="#storage" class="btn btn-primary" id="modal-view-storage-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            View in Storage Table
          </a>
        </div>
      </div>
    </div>
  `;

  modalContainer.style.display = "block";
  document.body.style.overflow = "hidden";

  // Event handlers
  const closeBtn = document.getElementById("modal-close-btn");
  const backdrop = document.getElementById("modal-backdrop");
  const storageBtn = document.getElementById("modal-view-storage-btn");

  function closeModal() {
    modalContainer.style.display = "none";
    document.body.style.overflow = "";
    modalContainer.innerHTML = "";
    activeModal = null;
  }

  closeBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  storageBtn?.addEventListener("click", () => {
    closeModal();
  });

  // Copy buttons
  modalContainer.querySelectorAll(".copy-path-btn, .copy-cd-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const textToCopy = btn.getAttribute("data-copy");
      if (!textToCopy) return;
      try {
        await navigator.clipboard.writeText(textToCopy);
        showToast("Copied to clipboard!", "info", 1500);
      } catch (err) {
        // Fallback
        const temp = document.createElement("textarea");
        temp.value = textToCopy;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        showToast("Copied to clipboard!", "info", 1500);
      }
    });
  });

  activeModal = closeModal;
}

export function closeActiveModal() {
  if (activeModal) {
    activeModal();
  }
}
