/**
 * New Project & Repository Modal Dialog
 * Supports: Template Blueprint Scaffolding (/api/projects), Git Repo Cloning (/api/projects/clone),
 * and Existing Directory Adoption (/api/projects/init).
 */

import { api } from "../api.js";
import { getCategoryIconSvg, icons } from "../icons.js";
import { showToast } from "./toast.js";

let activeModalCloser = null;

export function closeNewProjectModal() {
  if (activeModalCloser) {
    activeModalCloser();
  }
}

export async function openNewProjectModal(onCreated = () => {}) {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  let activeTab = "scaffold"; // "scaffold" | "clone" | "adopt"
  let categoriesData = {};
  let defaultCategory = "Video";
  let simpleStructure = { "00_Notes": ["Notes.md", "Client_Links.md"] };

  try {
    const data = await api.getCategories();
    categoriesData = data.categories || {};
    defaultCategory = data.default_category || "Video";
    if (data.simple_structure) simpleStructure = data.simple_structure;
  } catch (err) {
    console.warn("Could not load categories in modal:", err);
  }

  modalContainer.innerHTML = `
    <div class="modal-backdrop win11-modal-backdrop" id="new-project-modal-backdrop">
      <div class="modal-dialog win11-dialog" role="dialog" aria-modal="true" aria-labelledby="new-proj-title" style="max-width: 620px;">
        <!-- Fluent Header with Tabs -->
        <div class="win11-modal-header">
          <div class="win11-modal-title-group">
            <div class="win11-modal-icon">
              ${icons.plus}
            </div>
            <div>
              <span class="win11-modal-eyebrow font-mono">CREATIVEOS WORKSPACE</span>
              <h2 id="new-proj-title" class="win11-modal-title">Create / Import Project</h2>
            </div>
          </div>
          <button class="win11-modal-close" id="new-proj-close-btn" aria-label="Close modal">
            ${icons.x}
          </button>
        </div>

        <!-- Mode Switcher Tabs -->
        <div class="win11-modal-tabs">
          <button class="win11-modal-tab active" data-tab="scaffold" id="tab-btn-scaffold">
            ${icons.folder}
            <span>Blueprint Scaffold</span>
          </button>
          <button class="win11-modal-tab" data-tab="clone" id="tab-btn-clone">
            ${icons.git}
            <span>Clone Git Repo</span>
          </button>
          <button class="win11-modal-tab" data-tab="adopt" id="tab-btn-adopt">
            ${icons.externalLink}
            <span>Adopt Existing</span>
          </button>
        </div>

        <!-- Tab Body Container -->
        <div class="win11-modal-body" id="modal-tab-content">
          <!-- Dynamically populated -->
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

  activeModalCloser = closeModal;

  document.getElementById("new-proj-close-btn")?.addEventListener("click", closeModal);
  document.getElementById("new-project-modal-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "new-project-modal-backdrop") closeModal();
  });

  // Tab switching
  const tabBtns = modalContainer.querySelectorAll(".win11-modal-tab");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.getAttribute("data-tab");
      renderTabBody();
    });
  });

  function renderTabBody() {
    const bodyEl = document.getElementById("modal-tab-content");
    if (!bodyEl) return;

    if (activeTab === "scaffold") {
      bodyEl.innerHTML = `
        <form id="modal-scaffold-form" class="win11-modal-form">
          <div class="win11-form-row">
            <div class="win11-form-group flex-1">
              <label class="win11-label" for="m-proj-name">Project Title <span class="req">*</span></label>
              <input type="text" id="m-proj-name" class="win11-input" placeholder="e.g. Summer Commercial, Brand Redesign" required autofocus />
            </div>
          </div>

          <div class="win11-form-row two-col">
            <div class="win11-form-group">
              <label class="win11-label" for="m-proj-category">Category</label>
              <select id="m-proj-category" class="win11-select">
                ${Object.keys(categoriesData).map(k => `
                  <option value="${k}" ${k === defaultCategory ? 'selected' : ''}>${k}</option>
                `).join("")}
              </select>
            </div>
            <div class="win11-form-group">
              <label class="win11-label" for="m-proj-client">Client (Optional)</label>
              <input type="text" id="m-proj-client" class="win11-input" placeholder="e.g. Nike, Internal" />
            </div>
          </div>

          <div class="win11-form-row two-col">
            <div class="win11-form-group">
              <label class="win11-label" for="m-proj-date">Date Prefix (Optional)</label>
              <input type="date" id="m-proj-date" class="win11-input font-mono" />
            </div>
            <div class="win11-form-group">
              <label class="win11-label" for="m-proj-subfolder">Custom Subfolder</label>
              <input type="text" id="m-proj-subfolder" class="win11-input font-mono" placeholder="e.g. 2026/Campaigns" />
            </div>
          </div>

          <!-- Switches -->
          <div class="win11-switches-strip">
            <label class="win11-switch-label">
              <input type="checkbox" id="m-proj-git" />
              <span>Initialize Git repository</span>
            </label>
            <label class="win11-switch-label">
              <input type="checkbox" id="m-proj-simple" />
              <span>Minimal template (notes only)</span>
            </label>
          </div>

          <!-- Preview -->
          <div class="win11-scaffold-preview">
            <div class="win11-preview-header">
              <span class="font-mono" style="font-size: 0.725rem; color: var(--text-muted);">TARGET PATH</span>
              <span class="font-mono" id="m-preview-path" style="font-size: 0.75rem; color: var(--color-primary); font-weight: 600;">01_Projects/Video/...</span>
            </div>
          </div>

          <div class="win11-modal-actions">
            <button type="button" class="btn btn-secondary" id="m-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="m-submit-btn">
              ${icons.plus}
              Create Project
            </button>
          </div>
        </form>
      `;

      // Handlers for scaffold
      const nameInp = document.getElementById("m-proj-name");
      const catSel = document.getElementById("m-proj-category");
      const clientInp = document.getElementById("m-proj-client");
      const dateInp = document.getElementById("m-proj-date");
      const subInp = document.getElementById("m-proj-subfolder");
      const previewEl = document.getElementById("m-preview-path");

      function updatePreview() {
        const title = (nameInp?.value || "").trim() || "New_Project";
        const cleanTitle = title.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");
        const now = new Date();
        const datePrefix = dateInp?.value || now.toISOString().substring(0, 10);
        const slug = `${datePrefix}_${cleanTitle}`;
        const cat = catSel?.value || "Video";
        const client = (clientInp?.value || "").trim();
        const sub = (subInp?.value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

        let rel = client ? `Clients/${client}` : cat;
        if (sub) rel += `/${sub}`;
        rel += `/${slug}`;

        if (previewEl) previewEl.textContent = `01_Projects/${rel}`;
      }

      nameInp?.addEventListener("input", updatePreview);
      catSel?.addEventListener("change", updatePreview);
      clientInp?.addEventListener("input", updatePreview);
      dateInp?.addEventListener("change", updatePreview);
      subInp?.addEventListener("input", updatePreview);
      updatePreview();

      document.getElementById("m-cancel-btn")?.addEventListener("click", closeModal);

      document.getElementById("modal-scaffold-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById("m-submit-btn");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span class="spinner" style="width: 12px; height: 12px; border-width: 2px; margin: 0;"></span> Creating...`;
        }

        try {
          const payload = {
            name: nameInp.value.trim(),
            category: catSel.value,
            client: clientInp.value.trim() || null,
            destination_subpath: subInp.value.trim() || null,
            date: dateInp.value || null,
            git: Boolean(document.getElementById("m-proj-git")?.checked),
            simple: Boolean(document.getElementById("m-proj-simple")?.checked),
          };

          const res = await api.createProject(payload);
          showToast(`Project '${res.project.name || payload.name}' created!`, "success");
          closeModal();
          onCreated(res.project);
        } catch (err) {
          showToast(`Creation failed: ${err.message}`, "error");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `${icons.plus} Create Project`;
          }
        }
      });

    } else if (activeTab === "clone") {
      bodyEl.innerHTML = `
        <form id="modal-clone-form" class="win11-modal-form">
          <div class="win11-form-row">
            <div class="win11-form-group flex-1">
              <label class="win11-label" for="m-clone-url">Git Repository URL <span class="req">*</span></label>
              <input type="text" id="m-clone-url" class="win11-input font-mono" placeholder="https://github.com/user/repository.git" required autofocus />
              <span class="win11-form-hint">Supports HTTPS and SSH Git clone URLs.</span>
            </div>
          </div>

          <div class="win11-form-row two-col">
            <div class="win11-form-group">
              <label class="win11-label" for="m-clone-category">Category</label>
              <select id="m-clone-category" class="win11-select">
                <option value="Code" selected>Code</option>
                ${Object.keys(categoriesData).filter(k => k !== "Code").map(k => `
                  <option value="${k}">${k}</option>
                `).join("")}
              </select>
            </div>
            <div class="win11-form-group">
              <label class="win11-label" for="m-clone-client">Client (Optional)</label>
              <input type="text" id="m-clone-client" class="win11-input" placeholder="e.g. Acme, Internal" />
            </div>
          </div>

          <div class="win11-form-row">
            <div class="win11-form-group flex-1">
              <label class="win11-label" for="m-clone-name">Folder Name Override (Optional)</label>
              <input type="text" id="m-clone-name" class="win11-input font-mono" placeholder="Leave empty to use repository name" />
            </div>
          </div>

          <div class="win11-info-banner">
            <div class="win11-banner-icon">${icons.info}</div>
            <div class="win11-banner-text">
              CreativeOS will clone the repository, index its workspace files, and scaffold <code>00_Notes/Idea.md</code> linked to Obsidian Brain.
            </div>
          </div>

          <div class="win11-modal-actions">
            <button type="button" class="btn btn-secondary" id="m-clone-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="m-clone-submit-btn">
              ${icons.git}
              Clone &amp; Adopt
            </button>
          </div>
        </form>
      `;

      document.getElementById("m-clone-cancel-btn")?.addEventListener("click", closeModal);

      document.getElementById("modal-clone-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const urlInp = document.getElementById("m-clone-url");
        const catInp = document.getElementById("m-clone-category");
        const clientInp = document.getElementById("m-clone-client");
        const nameInp = document.getElementById("m-clone-name");
        const submitBtn = document.getElementById("m-clone-submit-btn");

        if (!urlInp?.value.trim()) return;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span class="spinner" style="width: 12px; height: 12px; border-width: 2px; margin: 0;"></span> Cloning Repository...`;
        }

        try {
          const payload = {
            url: urlInp.value.trim(),
            category: catInp.value,
            client: clientInp.value.trim() || null,
            name: nameInp.value.trim() || null,
          };

          const res = await api.cloneProject(payload);
          showToast(`Cloned repo to '${res.project.name || res.project.slug}'!`, "success");
          closeModal();
          onCreated(res.project);
        } catch (err) {
          showToast(`Clone failed: ${err.message}`, "error");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `${icons.git} Clone &amp; Adopt`;
          }
        }
      });

    } else if (activeTab === "adopt") {
      bodyEl.innerHTML = `
        <form id="modal-adopt-form" class="win11-modal-form">
          <div class="win11-form-row">
            <div class="win11-form-group flex-1">
              <label class="win11-label" for="m-adopt-path">Existing Folder Path <span class="req">*</span></label>
              <input type="text" id="m-adopt-path" class="win11-input font-mono" placeholder="C:\\Projects\\MyExistingFolder or 01_Projects\\Video\\..." required autofocus />
              <span class="win11-form-hint">Directory to adopt as a tracked CreativeOS project.</span>
            </div>
          </div>

          <div class="win11-form-row two-col">
            <div class="win11-form-group">
              <label class="win11-label" for="m-adopt-category">Category</label>
              <select id="m-adopt-category" class="win11-select">
                ${Object.keys(categoriesData).map(k => `
                  <option value="${k}" ${k === defaultCategory ? 'selected' : ''}>${k}</option>
                `).join("")}
              </select>
            </div>
            <div class="win11-form-group">
              <label class="win11-label" for="m-adopt-client">Client (Optional)</label>
              <input type="text" id="m-adopt-client" class="win11-input" placeholder="e.g. Acme, Internal" />
            </div>
          </div>

          <div class="win11-form-row">
            <div class="win11-form-group flex-1">
              <label class="win11-label" for="m-adopt-name">Project Title Override (Optional)</label>
              <input type="text" id="m-adopt-name" class="win11-input" placeholder="Defaults to folder name" />
            </div>
          </div>

          <div class="win11-modal-actions">
            <button type="button" class="btn btn-secondary" id="m-adopt-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="m-adopt-submit-btn">
              ${icons.check}
              Adopt as Project
            </button>
          </div>
        </form>
      `;

      document.getElementById("m-adopt-cancel-btn")?.addEventListener("click", closeModal);

      document.getElementById("modal-adopt-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pathInp = document.getElementById("m-adopt-path");
        const catInp = document.getElementById("m-adopt-category");
        const clientInp = document.getElementById("m-adopt-client");
        const nameInp = document.getElementById("m-adopt-name");
        const submitBtn = document.getElementById("m-adopt-submit-btn");

        if (!pathInp?.value.trim()) return;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span class="spinner" style="width: 12px; height: 12px; border-width: 2px; margin: 0;"></span> Adopting...`;
        }

        try {
          const payload = {
            path: pathInp.value.trim(),
            category: catInp.value,
            client: clientInp.value.trim() || null,
            name: nameInp.value.trim() || null,
          };

          const res = await api.initProject(payload);
          showToast(`Project '${res.project.name}' adopted!`, "success");
          closeModal();
          onCreated(res.project);
        } catch (err) {
          showToast(`Adoption failed: ${err.message}`, "error");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `${icons.check} Adopt as Project`;
          }
        }
      });
    }
  }

  renderTabBody();
}
