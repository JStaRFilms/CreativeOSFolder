/**
 * New Project View — Interactive Studio Scaffold
 */

import { api } from "../api.js";
import { getCategoryIconSvg, icons } from "../icons.js";
import { showToast } from "../components/toast.js";

export async function renderNewProject(container) {
  container.innerHTML = `
    <div class="form-container">
      <div class="page-header" style="justify-content: center; text-align: center; margin-bottom: 1.75rem;">
        <div>
          <div class="page-eyebrow" style="justify-content: center;">
            <span>SCAFFOLD WORKSPACE</span>
          </div>
          <h1 class="page-title">Create New Project</h1>
          <p class="page-description">Generate a structured workspace directory with category blueprints and Obsidian notes linkage</p>
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
              <input type="text" id="project-name" class="form-input" placeholder="e.g. Summer Promo, Brand Redesign, AI Agent Hub" required autofocus autocomplete="off" />
              <span class="form-hint">Spaces and hyphens are supported; special characters will be sanitized automatically.</span>
            </div>

            <!-- Category & Client -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="project-category">Category Blueprint</label>
                <select id="project-category" class="form-select">
                  <option value="Video">Video — Video production projects</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="project-client">Client (Optional)</label>
                <input type="text" id="project-client" class="form-input" placeholder="e.g. Nike, Acme Corp, Sony" autocomplete="off" />
                <span class="form-hint">Places project inside <code>01_Projects/Clients/[Client]/</code></span>
              </div>
            </div>

            <!-- Destination Folder Mode -->
            <div class="form-group" style="padding: 1rem; border-radius: var(--radius-md); background: var(--bg-surface); border: 1px solid var(--border-subtle);">
              <label class="checkbox-label" style="display: flex; align-items: flex-start; gap: 0.65rem; cursor: pointer; user-select: none;">
                <input type="checkbox" id="project-custom-subfolder-toggle" style="margin-top: 0.2rem; accent-color: var(--color-primary); width: 15px; height: 15px;" />
                <div>
                  <span style="font-weight: 600; font-size: 0.825rem; color: var(--text-primary);">Nest inside specific subfolder or child hierarchy</span>
                  <p style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.15rem; line-height: 1.4;">
                    Nest this project inside a sub-directory under the selected category or client (e.g. <code>2026_Campaigns/Series_1</code>).
                  </p>
                </div>
              </label>

              <div id="custom-subfolder-box" style="display: none; margin-top: 0.75rem;">
                <div style="font-size: 0.75rem; margin-bottom: 0.35rem; color: var(--text-secondary);">
                  <span>Base starting location: </span>
                  <strong id="subfolder-base-badge" class="font-mono" style="color: var(--color-primary);">01_Projects/Video/</strong>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                  <input type="text" id="project-subfolder-input" class="form-input font-mono" placeholder="e.g. 2026_Campaigns/Summer or Experiments/Phase1" style="font-size: 0.8rem;" list="existing-folders-list" />
                  <datalist id="existing-folders-list"></datalist>
                </div>
                <span class="form-hint" style="font-size: 0.7rem;">Enter any folder structure inside the base; all intermediate directories will be generated automatically.</span>
              </div>
            </div>

            <!-- Date Override -->
            <div class="form-group">
              <label class="form-label" for="project-date">Date Override (Optional)</label>
              <input type="date" id="project-date" class="form-input" />
              <span class="form-hint">Leave blank to use today's timestamp (<code>YYYY-MM-DD</code>) for the directory slug prefix.</span>
            </div>

            <!-- Blueprint Options -->
            <div class="form-group-switches">
              <label class="switch-row">
                <div class="switch-info">
                  <span class="switch-title">Initialize Git Repository</span>
                  <span class="switch-desc">Creates <code>.git</code> repository and studio <code>.gitignore</code></span>
                </div>
                <input type="checkbox" id="project-git" class="toggle-checkbox" />
              </label>

              <label class="switch-row">
                <div class="switch-info">
                  <span class="switch-title">Minimal Template</span>
                  <span class="switch-desc">Use streamlined notes-only scaffold (<code>00_Notes/</code>) instead of full category structure</span>
                </div>
                <input type="checkbox" id="project-simple" class="toggle-checkbox" />
              </label>
            </div>

            <!-- Live Interactive Folder Tree Preview -->
            <div class="scaffold-preview-card">
              <div class="preview-card-header">
                <span class="preview-card-title">Scaffold Directory Preview</span>
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

  // Load existing folder paths for datalist suggestions
  try {
    const projects = await api.getProjects();
    const folderSet = new Set();
    projects.forEach(p => {
      if (p.relative_path) {
        const parts = p.relative_path.split("/");
        parts.pop(); // Remove project name to get parent folder
        if (parts.length > 1) {
          folderSet.add(parts.slice(1).join("/"));
        }
      }
    });
    const datalist = document.getElementById("existing-folders-list");
    if (datalist) {
      datalist.innerHTML = Array.from(folderSet).sort().map(f => `<option value="${f}"></option>`).join("");
    }
  } catch (err) {
    console.warn("Could not load folder suggestions:", err);
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

  const nameInput = document.getElementById("project-name");
  const categorySelect = document.getElementById("project-category");
  const clientInput = document.getElementById("project-client");
  const dateInput = document.getElementById("project-date");
  const gitCheckbox = document.getElementById("project-git");
  const simpleCheckbox = document.getElementById("project-simple");
  const customSubfolderToggle = document.getElementById("project-custom-subfolder-toggle");
  const customSubfolderBox = document.getElementById("custom-subfolder-box");
  const subfolderInput = document.getElementById("project-subfolder-input");
  const subfolderBaseBadge = document.getElementById("subfolder-base-badge");
  const previewSlugPath = document.getElementById("preview-slug-path");
  const previewCategoryTag = document.getElementById("preview-category-tag");
  const treeOutput = document.getElementById("scaffold-tree-output");
  const form = document.getElementById("new-project-form");
  const submitBtn = document.getElementById("submit-project-btn");

  customSubfolderToggle?.addEventListener("change", () => {
    if (customSubfolderBox) {
      customSubfolderBox.style.display = customSubfolderToggle.checked ? "block" : "none";
    }
    updateScaffoldPreview();
  });

  subfolderInput?.addEventListener("input", updateScaffoldPreview);

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
    const catFolder = catConfig.physical_folder || selectedCat;
    const client = (clientInput?.value || "").trim();
    const isSimple = simpleCheckbox?.checked || false;
    const isGit = gitCheckbox?.checked || false;
    const useCustomSubfolder = customSubfolderToggle?.checked || false;
    const customSubfolderVal = (subfolderInput?.value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

    let baseRel = `01_Projects/${catFolder}`;
    if (client) {
      const safeClient = client.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");
      baseRel = `01_Projects/Clients/${safeClient}`;
    }

    if (subfolderBaseBadge) subfolderBaseBadge.textContent = `${baseRel}/`;

    let targetPath = `${baseRel}/${slug}`;
    if (useCustomSubfolder && customSubfolderVal) {
      targetPath = `${baseRel}/${customSubfolderVal}/${slug}`;
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
  categorySelect?.addEventListener("change", updateScaffoldPreview);
  clientInput?.addEventListener("input", updateScaffoldPreview);
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
