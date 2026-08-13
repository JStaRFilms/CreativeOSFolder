/**
 * New Project View — Interactive Studio Scaffold with Subfolder Tree Navigator
 */

import { api } from "../api.js";
import { getCategoryIconSvg, icons } from "../icons.js";
import { showToast } from "../components/toast.js";

export async function renderNewProject(container) {
  container.innerHTML = `
    <div class="form-container" id="scaffold-form-container">
      <div class="page-header" style="text-align: left; margin-bottom: 1.25rem;">
        <div>
          <div class="page-eyebrow">
            <span>SCAFFOLD WORKSPACE</span>
          </div>
          <h1 class="page-title">New Project</h1>
          <p class="page-description">Generate a structured workspace directory with category blueprints and note templates</p>
        </div>
      </div>

      <div class="form-card">
        <form id="new-project-form">
          <div class="form-grid">
            <!-- Project Name -->
            <div class="form-group">
              <label class="form-label" for="project-name">
                <span>Project Name</span>
                <span class="required-star">*</span>
              </label>
              <input type="text" id="project-name" class="form-input" placeholder="e.g. Summer Promo, Brand Redesign" required autofocus autocomplete="off" />
              <span class="form-hint">Special characters are automatically sanitized.</span>
            </div>

            <!-- Category & Client -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="project-category">Category Blueprint</label>
                <select id="project-category" class="form-select">
                  <option value="Video">Video — Production</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="project-client">Client (Optional)</label>
                <input type="text" id="project-client" class="form-input" placeholder="e.g. Nike, Acme Corp" autocomplete="off" />
                <span class="form-hint">Places inside <code>Clients/[Client]/</code></span>
              </div>
            </div>

            <!-- Destination Folder Mode (Inline Accordion) -->
            <div class="form-group" style="padding: 0.75rem 0.85rem; border-radius: var(--radius-md); background: var(--badge-bg); border: 1px solid var(--border-subtle);">
              <label class="checkbox-label" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                <div>
                  <span style="font-weight: 600; font-size: 0.8rem; color: var(--text-primary);">Custom Subfolder Location</span>
                  <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.1rem;">
                    Nest project within a sub-directory
                  </p>
                </div>
                <input type="checkbox" id="project-custom-subfolder-toggle" class="toggle-checkbox" />
              </label>

              <div id="subfolder-inline-panel" class="subfolder-inline-panel" style="display: none;">
                <div class="subfolder-panel-header">
                  <div class="subfolder-panel-title">
                    ${icons.folder}
                    <span>Folder Navigator</span>
                  </div>
                  <button type="button" class="btn btn-secondary" id="refresh-tree-btn" title="Refresh Tree" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;">
                    ${icons.refresh}
                  </button>
                </div>

                <div class="subfolder-target-badge">
                  <span class="target-badge-label">Destination</span>
                  <span id="sidepanel-target-path" class="target-badge-path font-mono">01_Projects/Video/</span>
                </div>

                <div id="subfolder-tree-list" class="tree-explorer">
                  <div style="padding: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">Loading folders...</div>
                </div>

                <div style="display: flex; gap: 0.4rem; align-items: center;">
                  <input type="text" id="project-subfolder-input" class="form-input font-mono" placeholder="Selected path or type e.g. 2026/Campaigns" style="font-size: 0.75rem; padding: 0.35rem 0.6rem;" />
                  <button type="button" class="btn btn-secondary" id="reset-subfolder-btn" style="padding: 0.35rem 0.6rem; font-size: 0.725rem; white-space: nowrap;">Reset</button>
                </div>
              </div>
            </div>

            <!-- Date Override -->
            <div class="form-group">
              <label class="form-label" for="project-date">Date Prefix (Optional)</label>
              <input type="date" id="project-date" class="form-input" />
              <span class="form-hint">Defaults to today's date (<code>YYYY-MM-DD</code>).</span>
            </div>

            <!-- Blueprint Switches -->
            <div class="form-group-switches">
              <label class="switch-row">
                <div class="switch-info">
                  <span class="switch-title">Initialize Git Repository</span>
                  <span class="switch-desc">Creates <code>.git</code> repository and <code>.gitignore</code></span>
                </div>
                <input type="checkbox" id="project-git" class="toggle-checkbox" />
              </label>

              <label class="switch-row">
                <div class="switch-info">
                  <span class="switch-title">Minimal Template</span>
                  <span class="switch-desc">Notes-only scaffold (<code>00_Notes/</code>)</span>
                </div>
                <input type="checkbox" id="project-simple" class="toggle-checkbox" />
              </label>
            </div>

            <!-- Live Scaffold Directory Preview -->
            <div class="scaffold-preview-section">
              <div class="preview-card-header">
                <span class="preview-card-title">Scaffold Preview</span>
                <span id="preview-category-tag" class="card-cat-badge">Video</span>
              </div>
              <div id="preview-slug-path" class="preview-path font-mono">01_Projects/Video/YYYY-MM-DD_Project_Name</div>
              
              <div class="scaffold-tree-container">
                <div id="scaffold-tree-output" class="folder-tree-view"></div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="form-actions-row">
              <a href="#dashboard" class="btn btn-secondary">Cancel</a>
              <button type="submit" id="submit-project-btn" class="btn btn-primary">
                Scaffold Project
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  let categoriesData = {};
  let defaultCategory = "Video";
  let simpleStructure = { "00_Notes": ["Notes.md", "Client_Links.md"] };
  let allProjects = [];

  try {
    allProjects = await api.getProjects();
  } catch (err) {
    console.warn("Could not load projects for tree:", err);
  }

  try {
    const data = await api.getCategories();
    categoriesData = data.categories || {};
    defaultCategory = data.default_category || "Video";
    if (data.simple_structure) simpleStructure = data.simple_structure;

    const selectEl = document.getElementById("project-category");
    if (selectEl) {
      const enabled = data.enabled || categoriesData;
      selectEl.innerHTML = Object.entries(enabled).map(([name, config]) => `
        <option value="${name}" ${name === defaultCategory ? 'selected' : ''}>
          ${name} — ${config.description || ''}
        </option>
      `).join("");
    }
  } catch (err) {
    console.warn("Could not load categories for form:", err);
  }

  const scaffoldContainer = document.getElementById("scaffold-form-container");
  const nameInput = document.getElementById("project-name");
  const categorySelect = document.getElementById("project-category");
  const clientInput = document.getElementById("project-client");
  const dateInput = document.getElementById("project-date");
  const gitCheckbox = document.getElementById("project-git");
  const simpleCheckbox = document.getElementById("project-simple");
  const customSubfolderToggle = document.getElementById("project-custom-subfolder-toggle");
  const subfolderInlinePanel = document.getElementById("subfolder-inline-panel");
  const subfolderInput = document.getElementById("project-subfolder-input");
  const subfolderTreeList = document.getElementById("subfolder-tree-list");
  const sidepanelTargetPath = document.getElementById("sidepanel-target-path");
  const refreshTreeBtn = document.getElementById("refresh-tree-btn");
  const resetSubfolderBtn = document.getElementById("reset-subfolder-btn");

  const previewSlugPath = document.getElementById("preview-slug-path");
  const previewCategoryTag = document.getElementById("preview-category-tag");
  const treeOutput = document.getElementById("scaffold-tree-output");
  const form = document.getElementById("new-project-form");
  const submitBtn = document.getElementById("submit-project-btn");

  function getBaseRelative() {
    const selectedCat = categorySelect?.value || defaultCategory;
    const catConfig = categoriesData[selectedCat] || {};
    const catFolder = catConfig.physical_folder || selectedCat;
    const client = (clientInput?.value || "").trim();

    if (client) {
      const safeClient = client.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");
      return `Clients/${safeClient}`;
    }
    return catFolder;
  }

  async function loadSubfolderTree() {
    if (!subfolderTreeList) return;
    const baseRel = getBaseRelative();
    const currentSub = (subfolderInput?.value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

    subfolderTreeList.innerHTML = `<div class="loading-state" style="padding: 0.75rem 0; font-size: 0.75rem;">Scanning folders in ${baseRel}...</div>`;

    try {
      // 1. Try listing physical folders via API
      let fsEntries = [];
      try {
        const fsRes = await api.listFiles(baseRel);
        fsEntries = (fsRes.entries || []).filter(e => e.is_dir);
      } catch (e) {
        // Base folder might not exist on disk yet
      }

      // 2. Extract nested paths from projects matching this base
      const discoveredSubpaths = new Set();
      allProjects.forEach(p => {
        if (p.relative_path && p.relative_path.startsWith(baseRel + "/")) {
          const rest = p.relative_path.substring(baseRel.length + 1);
          const parts = rest.split("/");
          parts.pop(); // Remove project folder
          if (parts.length > 0) {
            for (let i = 1; i <= parts.length; i++) {
              discoveredSubpaths.add(parts.slice(0, i).join("/"));
            }
          }
        }
      });

      fsEntries.forEach(e => {
        discoveredSubpaths.add(e.name);
      });

      const sortedPaths = Array.from(discoveredSubpaths).sort();

      let html = `
        <div class="tree-explorer-item ${!currentSub ? 'is-selected' : ''}" data-subpath="">
          <div class="tree-item-name">
            <span style="color: var(--color-primary);">${icons.folder}</span>
            <span><strong>/ (Root)</strong></span>
          </div>
          <span class="tree-item-tag">Base</span>
        </div>
      `;

      if (sortedPaths.length === 0) {
        html += `
          <div style="padding: 0.5rem; font-size: 0.725rem; color: var(--text-muted); font-style: italic;">
            No subfolders inside <code>${baseRel}/</code>. Type one below to create it.
          </div>
        `;
      } else {
        sortedPaths.forEach(sub => {
          const isSelected = currentSub === sub;
          const depth = sub.split("/").length - 1;
          const indent = depth * 12;
          const displayName = sub.split("/").pop();

          html += `
            <div class="tree-explorer-item ${isSelected ? 'is-selected' : ''}" data-subpath="${sub}" style="padding-left: ${0.5 + (indent / 16)}rem;">
              <div class="tree-item-name">
                <span style="color: ${isSelected ? 'var(--color-primary)' : 'var(--text-muted)'};">${icons.folder}</span>
                <span class="font-mono">${displayName}</span>
              </div>
              <span class="tree-item-tag">${sub}</span>
            </div>
          `;
        });
      }

      subfolderTreeList.innerHTML = html;

      // Attach click listeners to tree items
      subfolderTreeList.querySelectorAll(".tree-explorer-item").forEach(item => {
        item.addEventListener("click", () => {
          const sub = item.getAttribute("data-subpath") || "";
          if (subfolderInput) subfolderInput.value = sub;
          updateScaffoldPreview();
          loadSubfolderTree();
        });
      });
    } catch (err) {
      subfolderTreeList.innerHTML = `<div style="color: var(--color-danger); font-size: 0.75rem;">Failed to load tree: ${err.message}</div>`;
    }
  }

  customSubfolderToggle?.addEventListener("change", () => {
    const isChecked = customSubfolderToggle.checked;
    if (subfolderInlinePanel) subfolderInlinePanel.style.display = isChecked ? "flex" : "none";
    if (isChecked) {
      loadSubfolderTree();
    }
    updateScaffoldPreview();
  });

  subfolderInput?.addEventListener("input", () => {
    updateScaffoldPreview();
    loadSubfolderTree();
  });

  resetSubfolderBtn?.addEventListener("click", () => {
    if (subfolderInput) subfolderInput.value = "";
    updateScaffoldPreview();
    loadSubfolderTree();
  });

  refreshTreeBtn?.addEventListener("click", () => {
    loadSubfolderTree();
  });

  function updateScaffoldPreview() {
    const rawName = (nameInput?.value || "").trim() || "My_New_Project";
    const safeName = rawName.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");
    
    let datePrefix;
    if (dateInput?.value) {
      datePrefix = dateInput.value;
    } else {
      const now = new Date();
      datePrefix = now.toISOString().substring(0, 10);
    }

    const slug = `${datePrefix}_${safeName}`;
    const selectedCat = categorySelect?.value || defaultCategory;
    const catConfig = categoriesData[selectedCat] || {};
    const baseRel = getBaseRelative();
    const isSimple = simpleCheckbox?.checked || false;
    const isGit = gitCheckbox?.checked || false;
    const useCustomSubfolder = customSubfolderToggle?.checked || false;
    const customSubfolderVal = (subfolderInput?.value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

    const fullBaseRel = `01_Projects/${baseRel}`;

    let targetPath = `${fullBaseRel}/${slug}`;
    if (useCustomSubfolder && customSubfolderVal) {
      targetPath = `${fullBaseRel}/${customSubfolderVal}/${slug}`;
    }

    if (sidepanelTargetPath) {
      sidepanelTargetPath.textContent = useCustomSubfolder && customSubfolderVal ? `${fullBaseRel}/${customSubfolderVal}/` : `${fullBaseRel}/`;
    }

    if (previewSlugPath) previewSlugPath.textContent = targetPath;
    if (previewCategoryTag) previewCategoryTag.textContent = isSimple ? `${selectedCat} (Minimal)` : selectedCat;

    // Build real structure nodes from backend template structure
    let struct = {};
    if (isSimple) {
      struct = simpleStructure;
    } else if (catConfig.template_structure && Object.keys(catConfig.template_structure).length > 0) {
      struct = catConfig.template_structure;
    } else {
      const list = catConfig.folder_structure || ["00_Notes", "01_Footage", "02_Audio", "03_Exports"];
      list.forEach(f => { struct[f] = []; });
    }

    if (treeOutput) {
      const folders = Object.keys(struct);
      let treeHtml = `
        <div class="tree-root">
          <span class="tree-icon">${icons.folder}</span>
          <strong>${slug}</strong>
        </div>
        <div class="tree-branches">
      `;

      folders.forEach((folder, fIdx) => {
        const contents = struct[folder] || [];
        const isNotes = folder === "00_Notes";
        treeHtml += `
          <div class="tree-node" style="margin-top: 0.2rem;">
            <span class="tree-line">├─</span>
            <span class="tree-folder-icon">${icons.folder}</span>
            <span class="tree-name ${isNotes ? 'notes-highlight' : ''}">${folder}/</span>
            ${isNotes ? '<span class="tree-tag-obsidian">Obsidian Brain</span>' : ''}
          </div>
        `;

        contents.forEach((item, iIdx) => {
          const isLastItem = iIdx === contents.length - 1;
          const isFile = item.includes(".");
          treeHtml += `
            <div class="tree-node" style="padding-left: 1.5rem; opacity: 0.85;">
              <span class="tree-line">${isLastItem ? '└─' : '├─'}</span>
              <span class="tree-file-icon">${isFile ? icons.file : icons.folder}</span>
              <span class="tree-name font-mono" style="font-size: 0.725rem;">${item}</span>
            </div>
          `;
        });
      });

      // Show metadata file
      treeHtml += `
        <div class="tree-node">
          <span class="tree-line">${!isGit ? '└─' : '├─'}</span>
          <span class="tree-file-icon">${icons.file}</span>
          <span class="tree-name font-mono">.project_meta.json</span>
          <span class="tree-tag-meta">Metadata</span>
        </div>
      `;

      if (isGit) {
        treeHtml += `
          <div class="tree-node">
            <span class="tree-line">└─</span>
            <span class="tree-file-icon">${icons.git}</span>
            <span class="tree-name font-mono">.git/ &amp; .gitignore</span>
            <span class="tree-tag-git">Git</span>
          </div>
        `;
      }

      treeHtml += `</div>`;
      treeOutput.innerHTML = treeHtml;
    }
  }

  nameInput?.addEventListener("input", updateScaffoldPreview);
  categorySelect?.addEventListener("change", () => {
    updateScaffoldPreview();
    if (customSubfolderToggle?.checked) loadSubfolderTree();
  });
  clientInput?.addEventListener("input", () => {
    updateScaffoldPreview();
    if (customSubfolderToggle?.checked) loadSubfolderTree();
  });
  dateInput?.addEventListener("change", updateScaffoldPreview);
  gitCheckbox?.addEventListener("change", updateScaffoldPreview);
  simpleCheckbox?.addEventListener("change", updateScaffoldPreview);
  updateScaffoldPreview();

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!nameInput?.value) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin: 0;"></span>
      Scaffolding...
    `;

    const useCustomSubfolder = customSubfolderToggle?.checked || false;
    const subfolderVal = (subfolderInput?.value || "").trim();

    const payload = {
      name: nameInput.value.trim(),
      category: categorySelect?.value || defaultCategory,
      client: clientInput?.value.trim() || null,
      destination_subpath: useCustomSubfolder && subfolderVal ? subfolderVal : null,
      date: dateInput?.value || null,
      git: gitCheckbox?.checked || false,
      simple: simpleCheckbox?.checked || false,
    };

    try {
      const res = await api.createProject(payload);
      showToast(`Project created: ${res.project.name || payload.name}`, "success");
      setTimeout(() => {
        window.location.hash = "#dashboard";
      }, 500);
    } catch (err) {
      showToast(`Creation failed: ${err.message}`, "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Scaffold Project`;
    }
  });
}
