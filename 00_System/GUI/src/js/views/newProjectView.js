/**
 * New Project View
 */

import { api } from "../api.js";
import { showToast } from "../components/toast.js";

export async function renderNewProject(container) {
  container.innerHTML = `
    <div class="form-container">
      <div class="page-header" style="justify-content: center; text-align: center; margin-bottom: 2rem;">
        <div>
          <h1 class="page-title">Create New Project</h1>
          <p class="page-description">Initialize a structured project directory with templates and Obsidian sync metadata</p>
        </div>
      </div>

      <div class="form-card">
        <form id="new-project-form">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="project-name">Project Name <span style="color: var(--color-danger);">*</span></label>
              <input type="text" id="project-name" class="form-input" placeholder="e.g. Summer Promo, Brand Redesign, Mobile App" required autofocus />
              <span class="form-hint">Spaces and hyphens are supported; special characters will be sanitized.</span>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="project-category">Category</label>
                <select id="project-category" class="form-select">
                  <option value="Video">🎬 Video</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="project-client">Client (Optional)</label>
                <input type="text" id="project-client" class="form-input" placeholder="e.g. Acme Corp, Nike" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="project-date">Date Override (Optional)</label>
              <input type="date" id="project-date" class="form-input" />
              <span class="form-hint">Leave blank to use today's date for the slug prefix.</span>
            </div>

            <div class="form-group" style="gap: 0.75rem; margin-top: 0.25rem;">
              <label class="form-checkbox-group">
                <input type="checkbox" id="project-git" class="form-checkbox" />
                <span class="checkbox-label"><strong>Initialize Git Repository</strong> (add standard .gitignore and git init)</span>
              </label>

              <label class="form-checkbox-group">
                <input type="checkbox" id="project-simple" class="form-checkbox" />
                <span class="checkbox-label"><strong>Use Simple Template</strong> (minimal skeleton instead of full category structure)</span>
              </label>
            </div>

            <!-- Live Preview Box -->
            <div class="preview-box">
              <div class="preview-title">Target Directory Preview</div>
              <div id="preview-slug" class="preview-path">01_Projects/Video/YYYY-MM-DD_Project_Name</div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
              <a href="#dashboard" class="btn btn-secondary">Cancel</a>
              <button type="submit" id="submit-project-btn" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Project
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
          ${config.icon || '📁'} ${name} — ${config.description || ''}
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
  const previewSlug = document.getElementById("preview-slug");
  const form = document.getElementById("new-project-form");
  const submitBtn = document.getElementById("submit-project-btn");

  function updatePreview() {
    const rawName = (nameInput?.value || "").trim() || "My_Project";
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
    const catFolder = categoriesData[selectedCat]?.physical_folder || selectedCat;
    const client = (clientInput?.value || "").trim();

    let targetPath = `01_Projects/${catFolder}/${slug}`;
    if (client) {
      const safeClient = client.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");
      targetPath = `01_Projects/Clients/${safeClient}/${slug}`;
    }

    if (previewSlug) {
      previewSlug.textContent = targetPath;
    }
  }

  nameInput?.addEventListener("input", updatePreview);
  categorySelect?.addEventListener("change", updatePreview);
  clientInput?.addEventListener("input", updatePreview);
  dateInput?.addEventListener("change", updatePreview);
  updatePreview();

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!nameInput?.value) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin: 0;"></span>
      Spawning...
    `;

    const payload = {
      name: nameInput.value.trim(),
      category: categorySelect?.value || defaultCategory,
      client: clientInput?.value.trim() || null,
      date: dateInput?.value || null,
      git: document.getElementById("project-git")?.checked || false,
      simple: document.getElementById("project-simple")?.checked || false,
    };

    try {
      const res = await api.createProject(payload);
      showToast(`Project created: ${res.project.name}`, "success");
      setTimeout(() => {
        window.location.hash = "#dashboard";
      }, 500);
    } catch (err) {
      showToast(`Creation failed: ${err.message}`, "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Create Project
      `;
    }
  });
}
