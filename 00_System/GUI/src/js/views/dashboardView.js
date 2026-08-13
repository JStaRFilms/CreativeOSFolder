/**
 * Dashboard View
 */

import { api } from "../api.js";
import { renderProjectCard } from "../components/projectCard.js";
import { renderStatsOverview } from "../components/statsOverview.js";
import { showToast } from "../components/toast.js";

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Creative Dashboard</h1>
        <p class="page-description">Manage and monitor your active and archived creative projects</p>
      </div>
      <div>
        <a href="#new" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </a>
      </div>
    </div>

    <div id="dashboard-stats"></div>

    <div class="toolbar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="project-search-input" class="search-input" placeholder="Search projects by name, slug, client..." />
      </div>
      <div id="category-filters" class="filter-pills"></div>
    </div>

    <div id="projects-container">
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading projects from CreativeOS...</p>
      </div>
    </div>
  `;

  try {
    const [projects, catData] = await Promise.all([
      api.getProjects(),
      api.getCategories(),
    ]);

    // Calculate Stats
    const totalSize = projects.reduce((acc, p) => acc + (p.total_size || 0), 0);
    const staleCount = projects.filter(p => p.is_stale || p.status === "stale").length;
    const activeCount = projects.length - staleCount;

    const statsEl = document.getElementById("dashboard-stats");
    if (statsEl) {
      statsEl.innerHTML = renderStatsOverview({
        totalProjects: projects.length,
        totalSize,
        activeCount,
        staleCount,
      });
    }

    // Render Category Filter Pills
    const categories = Object.keys(catData.categories || {});
    const filterContainer = document.getElementById("category-filters");
    let selectedCategory = "All";

    function renderFilterPills() {
      if (!filterContainer) return;
      const allPills = ["All", ...categories];
      filterContainer.innerHTML = allPills.map(cat => `
        <button class="filter-pill ${selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">
          ${cat === "All" ? "All Projects" : `${catData.categories[cat]?.icon || '📁'} ${cat}`}
        </button>
      `).join("");

      filterContainer.querySelectorAll(".filter-pill").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedCategory = btn.getAttribute("data-cat");
          renderFilterPills();
          applyFilters();
        });
      });
    }

    renderFilterPills();

    // Filtering & Rendering Projects
    const searchInput = document.getElementById("project-search-input");
    const projectsContainer = document.getElementById("projects-container");

    function applyFilters() {
      const query = (searchInput?.value || "").toLowerCase().trim();
      
      const filtered = projects.filter(p => {
        const matchesCategory = selectedCategory === "All" || (p.type && p.type.toLowerCase() === selectedCategory.toLowerCase());
        const matchesSearch = !query || 
          (p.name && p.name.toLowerCase().includes(query)) ||
          (p.slug && p.slug.toLowerCase().includes(query)) ||
          (p.client && p.client.toLowerCase().includes(query));
        return matchesCategory && matchesSearch;
      });

      if (!projectsContainer) return;

      if (filtered.length === 0) {
        projectsContainer.innerHTML = `
          <div class="empty-state">
            <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">No Projects Found</h3>
            <p>${query ? `No projects matching "${query}" in category ${selectedCategory}` : `No projects found in category ${selectedCategory}`}</p>
          </div>
        `;
      } else {
        projectsContainer.innerHTML = `
          <div class="projects-grid">
            ${filtered.map(p => renderProjectCard(p)).join("")}
          </div>
        `;
      }
    }

    searchInput?.addEventListener("input", applyFilters);
    applyFilters();

  } catch (err) {
    const projectsContainer = document.getElementById("projects-container");
    if (projectsContainer) {
      projectsContainer.innerHTML = `
        <div class="empty-state" style="border-color: var(--color-danger);">
          <h3 style="color: var(--color-danger); margin-bottom: 0.5rem;">Failed to load projects</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
    showToast("Error loading projects", "error");
  }
}
