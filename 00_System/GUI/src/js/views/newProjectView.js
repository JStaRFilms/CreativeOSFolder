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
                <span class="form-hint">Places the project in <code>01_Projects/Clients/[Client]/</code></span>
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
                  <span class="switch-desc">Use minimal 4-folder skeleton instead of full category structure</span>
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

  try {
    const data = await api.getCategories();
    categoriesData = data.categories || {};
    defaultCategory = data.default_category || "Video";

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
  const previewSlugPath = document.getElementById("preview-slug-path");
  const previewCategoryTag = document.getElementById("preview-category-tag");
  const treeOutput = document.getElementById("scaffold-tree-output");
  const form = document.getElementById("new-project-form");
  const submitBtn = document.getElementById("submit-project-btn");

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

    let targetPath = `01_Projects/${catFolder}/${slug}`;
    if (client) {
      const safeClient = client.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");
      targetPath = `01_Projects/Clients/${safeClient}/${slug}`;
    }

    if (previewSlugPath) previewSlugPath.textContent = targetPath;
    if (previewCategoryTag) previewCategoryTag.textContent = selectedCat;

    // Subfolders list
    let subfolders = [];
    if (isSimple) {
      subfolders = ["00_Notes", "01_Source", "02_Build", "03_Exports"];
    } else {
      subfolders = catConfig.folder_structure || ["00_Notes", "01_Source", "02_Build", "03_Exports"];
    }

    if (treeOutput) {
      treeOutput.innerHTML = `
        <div class="tree-root">
          <span class="tree-icon">${icons.folder}</span>
          <strong>${slug}</strong>
        </div>
        <div class="tree-branches">
          ${subfolders.map((folder, idx) => `
            <div class="tree-node">
              <span class="tree-line">${idx === subfolders.length - 1 && !isGit ? '└─' : '├─'}</span>
              <span class="tree-folder-icon">${icons.folder}</span>
              <span class="tree-name ${folder === '00_Notes' ? 'notes-highlight' : ''}">${folder}</span>
              ${folder === '00_Notes' ? '<span class="tree-tag-obsidian">Obsidian Brain</span>' : ''}
            </div>
          `).join("")}
          <div class="tree-node">
            <span class="tree-line">├─</span>
            <span class="tree-file-icon">${icons.file}</span>
            <span class="tree-name font-mono">meta.json</span>
            <span class="tree-tag-meta">Metadata</span>
          </div>
          ${isGit ? `
            <div class="tree-node">
              <span class="tree-line">└─</span>
              <span class="tree-file-icon">${icons.git}</span>
              <span class="tree-name font-mono">.git/ &amp; .gitignore</span>
              <span class="tree-tag-git">Git</span>
            </div>
          ` : ''}
        </div>
      `;
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

    const payload = {
      name: nameInput.value.trim(),
      category: categorySelect?.value || defaultCategory,
      client: clientInput?.value.trim() || null,
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
