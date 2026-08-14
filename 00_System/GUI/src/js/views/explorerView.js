/**
 * Explorer View — Studio File & Workspace Browser with Built-in Media Preview
 */

import { api, formatBytes } from "../api.js";
import { getFileIconSvg, icons } from "../icons.js";
import { showToast } from "../components/toast.js";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdownSafe(rawText) {
  if (!rawText) return '<p style="color: var(--text-muted); font-style: italic;">Empty document</p>';

  let html = escapeHtml(rawText);

  // Code blocks: ```code```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre class="font-mono"><code>${code}</code></pre>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="font-mono">$1</code>');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 2px solid var(--color-primary); padding-left: 0.5rem; margin: 0.35rem 0; color: var(--text-secondary);">$1</blockquote>');

  // Bullet lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  // Paragraphs
  html = html.split('\n\n').map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<ul') || p.startsWith('<blockquote')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

export async function renderExplorer(container, initialPath = "") {
  let showPreview = localStorage.getItem("cos_explorer_preview_pane") !== "false";
  let viewMode = localStorage.getItem("cos_explorer_view_mode") || "list";
  let sortField = localStorage.getItem("cos_explorer_sort_field") || "name";
  let sortDir = localStorage.getItem("cos_explorer_sort_dir") || "asc";
  let currentPath = initialPath;
  let currentParentPath = null;
  let currentEntries = [];
  let selectedItem = null;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-eyebrow">
          <span class="studio-status-indicator" style="background-color: var(--text-primary);"></span>
          <span>FILE EXPLORER</span>
        </div>
        <h1 class="page-title">Workspace Explorer</h1>
        <p class="page-description">Browse project directories, preview assets, and launch in OS apps</p>
      </div>

      <div class="header-action-group">
        <button id="explorer-open-os-btn" class="btn btn-secondary" title="Open current folder in OS file manager">
          ${icons.externalLink}
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
    <div class="studio-toolbar" style="margin-top: 0.85rem;">
      <div class="search-box">
        <span class="search-icon">${icons.search}</span>
        <input type="text" id="explorer-search-input" class="search-input" placeholder="Filter files in current folder..." />
      </div>

      <div class="toolbar-controls">
        <button id="explorer-parent-btn" class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.785rem;" disabled>
          ${icons.arrowUp}
          Up
        </button>

        <button id="explorer-toggle-preview-btn" class="btn btn-secondary ${showPreview ? 'active' : ''}" style="padding: 0.35rem 0.65rem; font-size: 0.785rem;" title="Toggle Inspector Dock">
          ${icons.eye}
          <span id="preview-btn-label">Inspector</span>
        </button>

        <div class="view-mode-toggle">
          <button class="view-toggle-btn ${viewMode === 'list' ? 'active' : ''}" id="explorer-view-list-btn" title="Detailed List" aria-label="Detailed List">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button class="view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}" id="explorer-view-grid-btn" title="Grid View" aria-label="Grid View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Unified Explorer Studio Shell -->
    <div class="explorer-studio-shell ${showPreview ? 'has-inspector' : ''}" id="explorer-main-shell">
      <!-- Left: Files Pane -->
      <div class="explorer-files-pane" id="explorer-files-pane">
        <div class="explorer-files-scroll" id="explorer-content-area" style="min-height: 360px;">
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Scanning directory...</p>
          </div>
        </div>
      </div>

      <!-- Right: Seamless Inspector Dock -->
      <div class="explorer-inspector-pane" id="explorer-inspector-pane" style="${showPreview ? '' : 'display: none;'}">
        <div class="inspector-empty-state">
          <span style="font-size: 2rem; color: var(--text-muted);">${icons.eye}</span>
          <p style="font-size: 0.85rem;">Select a file to inspect</p>
        </div>
      </div>
    </div>
  `;

  // DOM Elements
  const breadcrumbsEl = document.getElementById("explorer-breadcrumbs");
  const contentAreaEl = document.getElementById("explorer-content-area");
  const inspectorPaneEl = document.getElementById("explorer-inspector-pane");
  const mainShellEl = document.getElementById("explorer-main-shell");
  const searchInput = document.getElementById("explorer-search-input");
  const parentBtn = document.getElementById("explorer-parent-btn");
  const refreshBtn = document.getElementById("explorer-refresh-btn");
  const openOsBtn = document.getElementById("explorer-open-os-btn");
  const gridBtn = document.getElementById("explorer-view-grid-btn");
  const listBtn = document.getElementById("explorer-view-list-btn");
  const togglePreviewBtn = document.getElementById("explorer-toggle-preview-btn");

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

      if (parentBtn) {
        parentBtn.disabled = !currentParentPath;
      }

      renderBreadcrumbs(data.current_path, data.relative_display);
      renderEntries();

      // Reset or auto-select preview
      if (currentEntries.length > 0) {
        selectItem(currentEntries[0]);
      } else {
        renderInspector(null);
      }

    } catch (err) {
      if (contentAreaEl) {
        contentAreaEl.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 2rem; color: var(--color-danger); margin-bottom: 0.5rem;">${icons.warning}</div>
            <h3 style="color: var(--text-primary); margin-bottom: 0.35rem; font-size: 1.05rem;">Cannot Access Directory</h3>
            <p style="font-size: 0.85rem; margin-bottom: 1.25rem; color: var(--text-muted);">${escapeHtml(err.message)}</p>
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

  function sortEntries(entries) {
    return [...entries].sort((a, b) => {
      // Always group folders on top by default
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;

      let comp = 0;
      if (sortField === "name") {
        comp = (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
      } else if (sortField === "type") {
        const typeA = a.is_dir ? "Folder" : (a.type || a.extension || "");
        const typeB = b.is_dir ? "Folder" : (b.type || b.extension || "");
        comp = typeA.localeCompare(typeB, undefined, { numeric: true, sensitivity: "base" });
        if (comp === 0) {
          comp = (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
        }
      } else if (sortField === "size") {
        const sizeA = a.size || 0;
        const sizeB = b.size || 0;
        comp = sizeA - sizeB;
        if (comp === 0) {
          comp = (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
        }
      } else if (sortField === "modified") {
        const dateA = a.modified ? new Date(a.modified).getTime() : 0;
        const dateB = b.modified ? new Date(b.modified).getTime() : 0;
        comp = dateA - dateB;
        if (comp === 0) {
          comp = (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
        }
      }

      return sortDir === "desc" ? -comp : comp;
    });
  }

  function getSortIndicator(field) {
    if (sortField !== field) return '';
    return `<span class="sort-indicator">${sortDir === 'asc' ? '▲' : '▼'}</span>`;
  }

  function renderEntries() {
    if (!contentAreaEl) return;

    const query = (searchInput?.value || "").toLowerCase().trim();
    let filtered = currentEntries.filter(entry => {
      if (!query) return true;
      return entry.name.toLowerCase().includes(query) || (entry.type && entry.type.toLowerCase().includes(query));
    });

    filtered = sortEntries(filtered);

    if (filtered.length === 0) {
      contentAreaEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 2rem; margin-bottom: 0.5rem; color: var(--text-muted);">${icons.folder}</div>
          <h3 style="margin-bottom: 0.35rem; color: var(--text-primary); font-size: 1.05rem;">${query ? 'No Matching Items' : 'Directory is Empty'}</h3>
          <p style="font-size: 0.85rem; margin-bottom: 1.25rem; color: var(--text-muted);">${query ? `No items matching "${query}" in this folder` : 'This workspace folder has no tracked files'}</p>
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
            const isSel = selectedItem && selectedItem.path === entry.path;

            return `
              <div class="explorer-card ${entry.is_dir ? 'is-folder' : 'is-file'} ${isSel ? 'is-selected' : ''}" data-path="${entry.path}" data-isdir="${entry.is_dir}" tabindex="0" role="button">
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
        <table class="explorer-data-table">
          <thead>
            <tr>
              <th class="col-name sortable ${sortField === 'name' ? 'is-sorted' : ''}" data-sort="name" title="Sort by Name">
                <div class="sort-header-inner">
                  <span>Name</span>
                  ${getSortIndicator('name')}
                </div>
              </th>
              <th class="col-type sortable ${sortField === 'type' ? 'is-sorted' : ''}" data-sort="type" title="Sort by Type">
                <div class="sort-header-inner">
                  <span>Type</span>
                  ${getSortIndicator('type')}
                </div>
              </th>
              <th class="col-size sortable ${sortField === 'size' ? 'is-sorted' : ''}" data-sort="size" title="Sort by Size">
                <div class="sort-header-inner">
                  <span>Size</span>
                  ${getSortIndicator('size')}
                </div>
              </th>
              <th class="col-date sortable ${sortField === 'modified' ? 'is-sorted' : ''}" data-sort="modified" title="Sort by Date Modified">
                <div class="sort-header-inner">
                  <span>Modified</span>
                  ${getSortIndicator('modified')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(entry => {
              const iconSvg = getFileIconSvg(entry.extension, entry.is_dir);
              const sizeStr = entry.is_dir ? "—" : formatBytes(entry.size);
              const modDate = entry.modified ? entry.modified.substring(0, 19).replace('T', ' ') : "—";
              const typeLabel = entry.is_dir ? "Folder" : (entry.type ? entry.type.toUpperCase() : "File");
              const isSel = selectedItem && selectedItem.path === entry.path;

              return `
                <tr class="explorer-row ${entry.is_dir ? 'is-folder-row' : ''} ${isSel ? 'is-selected' : ''}" data-path="${entry.path}" data-isdir="${entry.is_dir}">
                  <td class="col-name">
                    <div class="table-name-lockup">
                      <span class="table-icon-tag">${iconSvg}</span>
                      <span class="table-title font-mono" title="${entry.name}">${entry.name}</span>
                    </div>
                  </td>
                  <td class="col-type font-mono" style="color: var(--text-muted); font-size: 0.785rem;">${typeLabel}</td>
                  <td class="col-size font-mono font-bold" style="font-size: 0.785rem;">${sizeStr}</td>
                  <td class="col-date font-mono" style="color: var(--text-muted); font-size: 0.785rem;">${modDate}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;
    }

    // Attach Header Sorting Click Handlers
    contentAreaEl.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.getAttribute("data-sort");
        if (!field) return;
        if (sortField === field) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortField = field;
          sortDir = (field === "size" || field === "modified") ? "desc" : "asc";
        }
        localStorage.setItem("cos_explorer_sort_field", sortField);
        localStorage.setItem("cos_explorer_sort_dir", sortDir);
        renderEntries();
      });
    });

    // Attach Click / Selection / Open Handlers
    const items = contentAreaEl.querySelectorAll(".explorer-card, .explorer-row");
    items.forEach(el => {
      const itemPath = el.getAttribute("data-path");
      const isDir = el.getAttribute("data-isdir") === "true";
      const entry = currentEntries.find(e => e.path === itemPath);

      // Single Click: Select item and update Inspector Pane
      el.addEventListener("click", (e) => {
        if (e.target.closest(".item-open-btn")) return;
        if (entry) selectItem(entry);
      });

      // Double Click: Enter folder or open file natively
      el.addEventListener("dblclick", (e) => {
        e.preventDefault();
        if (isDir) {
          loadDirectory(itemPath);
        } else {
          openItemNatively(itemPath);
        }
      });

      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (isDir) {
            loadDirectory(itemPath);
          } else {
            openItemNatively(itemPath);
          }
        }
      });

      el.querySelector(".item-open-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isDir) {
          loadDirectory(itemPath);
        } else {
          openItemNatively(itemPath);
        }
      });
    });
  }

  function selectItem(entry) {
    selectedItem = entry;
    contentAreaEl.querySelectorAll(".explorer-card, .explorer-row").forEach(el => {
      if (el.getAttribute("data-path") === entry.path) {
        el.classList.add("is-selected");
      } else {
        el.classList.remove("is-selected");
      }
    });

    if (showPreview) {
      renderInspector(entry);
    }
  }

  async function openItemNatively(itemPath) {
    try {
      showToast(`Opening ${itemPath.split(/[\\/]/).pop()}...`, "info", 1500);
      await api.openPath(itemPath);
    } catch (e) {
      showToast(`Failed to open: ${e.message}`, "error");
    }
  }

  async function renderInspector(item) {
    if (!inspectorPaneEl) return;

    if (!item) {
      inspectorPaneEl.innerHTML = `
        <div class="inspector-header">
          <span class="inspector-eyebrow">INSPECTOR</span>
          <button class="inspector-icon-btn" id="inspector-close-btn" title="Close Inspector">${icons.x}</button>
        </div>
        <div class="inspector-empty-state">
          <span style="font-size: 2rem; color: var(--text-muted);">${icons.eye}</span>
          <p style="font-size: 0.825rem;">Select an asset to inspect</p>
        </div>
      `;
      document.getElementById("inspector-close-btn")?.addEventListener("click", togglePreview);
      return;
    }

    const ext = (item.extension || "").toLowerCase();
    const isDir = item.is_dir;
    const rawUrl = api.getRawFileUrl(item.path);

    const isVideo = [".mp4", ".webm", ".mov", ".m4v", ".mkv"].includes(ext);
    const isAudio = [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"].includes(ext);
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp", ".ico"].includes(ext);
    const isDoc = [".md", ".markdown", ".txt", ".json", ".csv", ".log", ".py", ".js", ".css", ".html", ".yaml", ".yml", ".ts", ".jsx", ".tsx", ".sh", ".bat", ".toml", ".ini"].includes(ext);

    let mediaViewerHtml = "";

    if (isDir) {
      mediaViewerHtml = `
        <div class="inspector-media-frame">
          <div class="preview-folder-hero">
            <span class="folder-big-icon">${icons.folder}</span>
            <span class="font-mono" style="font-size: 0.75rem;">Workspace Folder</span>
          </div>
        </div>
      `;
    } else if (isVideo) {
      mediaViewerHtml = `
        <div class="inspector-media-frame">
          <video controls autoplay playsinline class="preview-video-element" id="preview-video-tag" src="${rawUrl}">
            Your browser does not support video playback.
          </video>
        </div>
      `;
    } else if (isAudio) {
      mediaViewerHtml = `
        <div class="inspector-media-frame">
          <div class="preview-audio-container">
            <div class="preview-audio-icon">${icons.audio}</div>
            <audio controls autoplay class="preview-audio-element" src="${rawUrl}"></audio>
          </div>
        </div>
      `;
    } else if (isImage) {
      mediaViewerHtml = `
        <div class="inspector-media-frame">
          <img class="preview-image-element" id="preview-img-tag" src="${rawUrl}" alt="${escapeHtml(item.name)}" />
        </div>
      `;
    } else if (isDoc) {
      mediaViewerHtml = `
        <div class="inspector-doc-frame" id="preview-doc-content">
          <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted);">
            <div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>
            <span>Loading document...</span>
          </div>
        </div>
      `;
    } else {
      mediaViewerHtml = `
        <div class="inspector-media-frame">
          <div class="preview-folder-hero">
            <span class="folder-big-icon">${getFileIconSvg(item.extension, false)}</span>
            <span class="font-mono" style="font-size: 0.75rem;">Binary File (${ext.toUpperCase()})</span>
          </div>
        </div>
      `;
    }

    const typeDesc = isDir ? "File Folder" : (
      isVideo ? "Video File" : (
        isAudio ? "Audio Track" : (
          isImage ? `${ext.replace('.', '').toUpperCase()} Image` : (
            ext === ".md" ? "Markdown Document" : (
              ext === ".json" ? "JSON Source File" : `${ext.replace('.', '').toUpperCase() || 'Binary'} File`
            )
          )
        )
      )
    );

    inspectorPaneEl.innerHTML = `
      <div class="inspector-header">
        <span class="inspector-eyebrow">INSPECTOR</span>
        <div class="inspector-header-actions">
          <button class="inspector-icon-btn" id="inspector-open-btn" title="Open in OS Default App">
            ${icons.externalLink}
          </button>
          <button class="inspector-icon-btn" id="inspector-copy-btn" title="Copy Path">
            ${icons.copy}
          </button>
          <button class="inspector-icon-btn" id="inspector-close-btn" title="Close Inspector">
            ${icons.x}
          </button>
        </div>
      </div>

      <div class="inspector-body">
        ${mediaViewerHtml}

        <div class="inspector-identity">
          <div class="inspector-file-name font-mono">${escapeHtml(item.name)}</div>
          <div class="inspector-badges-row">
            <span class="inspector-tag font-mono">${typeDesc}</span>
            <span class="inspector-tag font-mono font-bold">${isDir ? 'Directory' : formatBytes(item.size)}</span>
          </div>
        </div>

        <div class="inspector-props-section">
          <div class="inspector-props-heading">Properties</div>
          <div class="inspector-prop-row font-mono" id="inspector-dimensions-row" style="display: none;">
            <span class="inspector-prop-key">Dimensions</span>
            <span class="inspector-prop-val" id="inspector-dimensions-val">—</span>
          </div>
          <div class="inspector-prop-row font-mono">
            <span class="inspector-prop-key">Modified</span>
            <span class="inspector-prop-val">${item.modified ? item.modified.substring(0, 19).replace('T', ' ') : '—'}</span>
          </div>
          <div class="inspector-prop-row font-mono">
            <span class="inspector-prop-key">Location</span>
            <span class="inspector-prop-val" style="font-size: 0.675rem; max-width: 220px;" title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</span>
          </div>
        </div>
      </div>
    `;

    // Wire Pane Buttons
    document.getElementById("inspector-close-btn")?.addEventListener("click", togglePreview);

    document.getElementById("inspector-open-btn")?.addEventListener("click", () => {
      openItemNatively(item.path);
    });

    document.getElementById("inspector-copy-btn")?.addEventListener("click", () => {
      navigator.clipboard.writeText(item.path).then(() => {
        showToast("Path copied to clipboard", "success", 1500);
      }).catch(() => {
        showToast("Could not copy path", "error");
      });
    });

    // Image Dimensions calculation
    if (isImage) {
      const imgEl = document.getElementById("preview-img-tag");
      if (imgEl) {
        imgEl.onload = () => {
          const dimRow = document.getElementById("inspector-dimensions-row");
          const dimVal = document.getElementById("inspector-dimensions-val");
          if (dimRow && dimVal && imgEl.naturalWidth) {
            dimVal.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight} px`;
            dimRow.style.display = "flex";
          }
        };
      }
    }

    // Video Dimensions calculation
    if (isVideo) {
      const videoEl = document.getElementById("preview-video-tag");
      if (videoEl) {
        videoEl.onloadedmetadata = () => {
          const dimRow = document.getElementById("inspector-dimensions-row");
          const dimVal = document.getElementById("inspector-dimensions-val");
          if (dimRow && dimVal && videoEl.videoWidth) {
            dimVal.textContent = `${videoEl.videoWidth} × ${videoEl.videoHeight} px`;
            dimRow.style.display = "flex";
          }
        };
      }
    }

    // Async Fetch Text/Markdown Content with fallback
    if (isDoc) {
      const docContentEl = document.getElementById("preview-doc-content");
      try {
        const fileData = await api.getFileContent(item.path);
        if (docContentEl) {
          if (ext === ".md" || ext === ".markdown") {
            docContentEl.innerHTML = renderMarkdownSafe(fileData.content);
          } else {
            docContentEl.innerHTML = `<pre class="font-mono" style="margin: 0; font-size: 0.725rem;"><code>${escapeHtml(fileData.content)}</code></pre>`;
          }
        }
      } catch (err) {
        // Graceful fallback: try fetching raw content
        try {
          const rawRes = await fetch(api.getRawFileUrl(item.path));
          if (rawRes.ok && docContentEl) {
            const rawText = await rawRes.text();
            if (ext === ".md" || ext === ".markdown") {
              docContentEl.innerHTML = renderMarkdownSafe(rawText);
            } else {
              docContentEl.innerHTML = `<pre class="font-mono" style="margin: 0; font-size: 0.725rem;"><code>${escapeHtml(rawText)}</code></pre>`;
            }
            return;
          }
        } catch {}

        if (docContentEl) {
          docContentEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.75rem; font-style: italic;">Preview will reload after backend restarts.</p>`;
        }
      }
    }
  }

  function togglePreview() {
    showPreview = !showPreview;
    localStorage.setItem("cos_explorer_preview_pane", showPreview ? "true" : "false");

    if (showPreview) {
      mainShellEl?.classList.add("has-inspector");
      if (inspectorPaneEl) inspectorPaneEl.style.display = "flex";
      togglePreviewBtn?.classList.add("active");
      if (selectedItem) {
        renderInspector(selectedItem);
      }
    } else {
      mainShellEl?.classList.remove("has-inspector");
      if (inspectorPaneEl) inspectorPaneEl.style.display = "none";
      togglePreviewBtn?.classList.remove("active");
    }
  }

  // Toolbar Handlers
  togglePreviewBtn?.addEventListener("click", togglePreview);
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

