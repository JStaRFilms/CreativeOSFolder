/**
 * Dashboard View — Studio Command Center
 */

import { api, formatBytes, cacheStore } from "../api.js";
import { icons } from "../icons.js";
import { renderProjectCard } from "../components/projectCard.js";
import { renderClientCard } from "../components/clientCard.js";
import { renderStatsOverview } from "../components/statsOverview.js";
import { openProjectInspector, openResurrectModal, openLiveSyncModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

export async function renderDashboard(container) {
  const cachedProjects = cacheStore.get("projects");
  const cachedCats = cacheStore.get("categories");
  const hasCache = Boolean(cachedProjects && cachedProjects.length > 0);

  container.innerHTML = `
    <!-- Top Telemetry Stats Strip -->
    <div id="dashboard-stats" style="margin-bottom: 1.5rem;"></div>

    <!-- Integrated Studio Toolbar -->
    <div class="studio-toolbar">
      <div class="search-box">
        <span class="search-icon">${icons.search}</span>
        <input type="text" id="project-search-input" class="search-input" placeholder="Filter projects by name, path, client..." />
        <span class="search-kbd-hint">/</span>
      </div>

      <div class="toolbar-controls">
        <button id="dashboard-sync-btn" class="btn btn-secondary" title="Live sync notes with Obsidian Vault" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Sync Brain
        </button>

        <button id="dashboard-resurrect-btn" class="btn btn-secondary" title="Restore projects from cold archive" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;">
          ${icons.resurrect}
          Resurrect
        </button>

        <select id="status-filter-select" class="studio-select" aria-label="Filter status">
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="stale">Stale Only (&gt;90d)</option>
        </select>

        <select id="sort-select" class="studio-select" aria-label="Sort projects">
          <option value="created_desc">Date (Newest)</option>
          <option value="created_asc">Date (Oldest)</option>
          <option value="size_desc">Size (Largest)</option>
          <option value="size_asc">Size (Smallest)</option>
          <option value="name_asc">Name (A &rarr; Z)</option>
          <option value="activity_desc">Recent Activity</option>
        </select>

        <div class="view-mode-toggle" id="view-mode-toggle">
          <button class="view-toggle-btn active" id="view-grid-btn" title="Grid View" aria-label="Grid View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          <button class="view-toggle-btn" id="view-list-btn" title="Compact List" aria-label="Compact List">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Category Channel Selector -->
    <div id="category-filters" class="category-channel-strip"></div>

    <!-- Projects Grid / List Container -->
    <div id="projects-container">
      ${hasCache ? '' : `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Scanning CreativeOS workspace index...</p>
        </div>
      `}
    </div>
  `;

  let projects = cachedProjects || [];
  let catData = cachedCats || { categories: {} };
  let selectedCategory = "All";
  let selectedClient = null;
  let currentViewMode = localStorage.getItem("cos_dashboard_view_mode") || "grid";

  function processAndRender() {
    if (!projects || projects.length === 0) return;

    const categoriesConfig = catData.categories || {};

    // Calculate Stats
    const totalSize = projects.reduce((acc, p) => acc + (p.total_size || 0), 0);
    const mediaSize = projects.reduce((acc, p) => acc + (p.media_size || 0), 0);
    const reclaimableSize = projects.reduce((acc, p) => acc + (p.reclaimable_size || 0), 0);
    const staleCount = projects.filter(p => p.is_stale || p.status === "stale").length;
    const activeCount = projects.length - staleCount;
    const maxProjectSize = Math.max(...projects.map(p => p.total_size || 0), 1);

    const statsEl = document.getElementById("dashboard-stats");
    if (statsEl) {
      statsEl.innerHTML = renderStatsOverview({
        totalProjects: projects.length,
        totalSize,
        mediaSize,
        reclaimableSize,
        activeCount,
        staleCount,
      });
    }

    // Helper to identify client-commissioned projects and extract client name
    const getClientNameForProject = (p) => {
      if (p.client && p.client !== "None" && p.client !== "Internal" && p.client.trim() !== "") {
        return p.client.trim();
      }
      if (p.relative_path && p.relative_path.startsWith("Clients/")) {
        const parts = p.relative_path.split("/");
        if (parts.length >= 2 && parts[1]) {
          return parts[1];
        }
      }
      return null;
    };

    // Group projects by client
    const clientMap = {};
    projects.forEach(p => {
      const cName = getClientNameForProject(p);
      if (cName) {
        if (!clientMap[cName]) {
          clientMap[cName] = {
            name: cName,
            projects: [],
            totalSize: 0,
            mediaSize: 0,
            reclaimableSize: 0,
            categories: new Set(),
            lastActive: null,
          };
        }
        clientMap[cName].projects.push(p);
        clientMap[cName].totalSize += (p.total_size || 0);
        clientMap[cName].mediaSize += (p.media_size || 0);
        clientMap[cName].reclaimableSize += (p.reclaimable_size || 0);
        if (p.type) clientMap[cName].categories.add(p.type);
        const projDate = p.last_meaningful_update || p.created;
        if (projDate && (!clientMap[cName].lastActive || projDate > clientMap[cName].lastActive)) {
          clientMap[cName].lastActive = projDate;
        }
      }
    });

    // Count projects per category
    const catCounts = {};
    projects.forEach(p => {
      const c = p.type || "Video";
      catCounts[c] = (catCounts[c] || 0) + 1;
    });
    // Set Client count to the number of unique clients
    catCounts["Client"] = Object.keys(clientMap).length;

    // Render Category Channel Strip
    const categories = Object.keys(categoriesConfig);
    const filterContainer = document.getElementById("category-filters");

    function renderCategoryStrip() {
      if (!filterContainer) return;
      const allChannels = [
        { id: "All", label: "All", count: projects.length },
        ...categories.map(cat => ({
          id: cat,
          label: cat,
          count: catCounts[cat] || 0,
        })),
      ];

      filterContainer.innerHTML = allChannels.map(item => `
        <button class="channel-btn ${selectedCategory === item.id ? 'active' : ''}" data-cat="${item.id}">
          <span class="channel-label">${item.label}</span>
          <span class="channel-count font-mono">${item.count}</span>
        </button>
      `).join("");

      filterContainer.querySelectorAll(".channel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const nextCat = btn.getAttribute("data-cat");
          if (nextCat !== selectedCategory) {
            selectedClient = null; // reset drill-down when changing category
          }
          selectedCategory = nextCat;
          renderCategoryStrip();
          applyFilters();
        });
      });
    }

    renderCategoryStrip();

    // View Mode Toggle
    const gridBtn = document.getElementById("view-grid-btn");
    const listBtn = document.getElementById("view-list-btn");

    if (currentViewMode === "list") {
      listBtn?.classList.add("active");
      gridBtn?.classList.remove("active");
    } else {
      gridBtn?.classList.add("active");
      listBtn?.classList.remove("active");
    }

    gridBtn?.addEventListener("click", () => {
      currentViewMode = "grid";
      localStorage.setItem("cos_dashboard_view_mode", "grid");
      gridBtn.classList.add("active");
      listBtn?.classList.remove("active");
      applyFilters();
    });

    listBtn?.addEventListener("click", () => {
      currentViewMode = "list";
      localStorage.setItem("cos_dashboard_view_mode", "list");
      listBtn.classList.add("active");
      gridBtn?.classList.remove("active");
      applyFilters();
    });

    // Filtering & Sorting Projects
    const searchInput = document.getElementById("project-search-input");
    const statusSelect = document.getElementById("status-filter-select");
    const sortSelect = document.getElementById("sort-select");
    const projectsContainer = document.getElementById("projects-container");

    function applyFilters() {
      const query = (searchInput?.value || "").toLowerCase().trim();
      const statusFilter = statusSelect?.value || "all";
      const sortMode = sortSelect?.value || "created_desc";

      if (!projectsContainer) return;

      // ──────────────────────────────────────────────────────────────────────────
      // Case 1: Client Directory View (Level 1: Show List of Clients)
      // ──────────────────────────────────────────────────────────────────────────
      if (selectedCategory.toLowerCase() === "client" && selectedClient === null) {
        let clientList = Object.values(clientMap);

        // Filter by client search query
        if (query) {
          clientList = clientList.filter(c => c.name.toLowerCase().includes(query));
        }

        // Sort clients
        clientList.sort((a, b) => {
          switch (sortMode) {
            case "size_desc":
              return b.totalSize - a.totalSize;
            case "size_asc":
              return a.totalSize - b.totalSize;
            case "name_asc":
              return a.name.localeCompare(b.name);
            case "created_desc":
            case "activity_desc":
              return (b.lastActive || "").localeCompare(a.lastActive || "");
            case "created_asc":
              return (a.lastActive || "").localeCompare(b.lastActive || "");
            default:
              return b.projects.length - a.projects.length;
          }
        });

        if (clientList.length === 0) {
          projectsContainer.innerHTML = `
            <div class="empty-state">
              <h3 style="margin-bottom: 0.35rem; color: var(--text-primary); font-size: 1.05rem;">No Clients Found</h3>
              <p style="font-size: 0.85rem;">${query ? `No client accounts matching "${query}"` : `No client directories found in workspace`}</p>
            </div>
          `;
          return;
        }

        projectsContainer.innerHTML = `
          <div class="clients-grid">
            ${clientList.map(c => renderClientCard(c)).join("")}
          </div>
        `;

        // Attach Click Handlers to Client Cards to Drill-Down
        projectsContainer.querySelectorAll(".client-card").forEach(card => {
          card.addEventListener("click", () => {
            const cName = card.getAttribute("data-client");
            if (cName && clientMap[cName]) {
              selectedClient = cName;
              applyFilters();
            }
          });

          card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              card.click();
            }
          });
        });

        return;
      }

      // ──────────────────────────────────────────────────────────────────────────
      // Case 2: Project Cards View (Category Projects or Client Drill-down)
      // ──────────────────────────────────────────────────────────────────────────
      let sourceProjects = projects;

      if (selectedCategory.toLowerCase() === "client" && selectedClient !== null) {
        sourceProjects = clientMap[selectedClient]?.projects || [];
      }

      let filtered = sourceProjects.filter(p => {
        if (selectedCategory.toLowerCase() !== "client" && selectedCategory !== "All") {
          if (!p.type || p.type.toLowerCase() !== selectedCategory.toLowerCase()) {
            return false;
          }
        }

        let matchesStatus = true;
        const isStale = p.is_stale || p.status === "stale";
        if (statusFilter === "active") matchesStatus = !isStale;
        if (statusFilter === "stale") matchesStatus = isStale;

        const matchesSearch = !query ||
          (p.name && p.name.toLowerCase().includes(query)) ||
          (p.slug && p.slug.toLowerCase().includes(query)) ||
          (p.client && p.client.toLowerCase().includes(query)) ||
          (p.type && p.type.toLowerCase().includes(query));

        return matchesStatus && matchesSearch;
      });

      // Sorting
      filtered.sort((a, b) => {
        switch (sortMode) {
          case "created_asc":
            return (a.created || "").localeCompare(b.created || "");
          case "created_desc":
            return (b.created || "").localeCompare(a.created || "");
          case "size_desc":
            return (b.total_size || 0) - (a.total_size || 0);
          case "size_asc":
            return (a.total_size || 0) - (b.total_size || 0);
          case "name_asc":
            return (a.name || "").localeCompare(b.name || "");
          case "activity_desc":
            return (b.last_meaningful_update || b.created || "").localeCompare(a.last_meaningful_update || a.created || "");
          default:
            return 0;
        }
      });

      // Drill-down header when a specific client is selected
      let drilldownHeaderHtml = "";
      if (selectedCategory.toLowerCase() === "client" && selectedClient !== null) {
        const clientData = clientMap[selectedClient];
        drilldownHeaderHtml = `
          <div class="client-drilldown-header">
            <div class="client-drilldown-left">
              <button id="client-back-btn" class="client-back-btn" title="Back to All Clients">
                ${icons.arrowLeft}
                <span>All Clients</span>
              </button>
              <div class="client-drilldown-info">
                <h2 class="client-drilldown-title">${selectedClient}</h2>
                <span class="status-indicator-tag is-active">${clientData?.projects.length || filtered.length} Projects</span>
              </div>
            </div>
            <div class="client-drilldown-meta font-mono">
              <span>Footprint: <strong>${formatBytes(clientData?.totalSize || 0)}</strong></span>
            </div>
          </div>
        `;
      }

      if (filtered.length === 0) {
        projectsContainer.innerHTML = `
          ${drilldownHeaderHtml}
          <div class="empty-state">
            <h3 style="margin-bottom: 0.35rem; color: var(--text-primary); font-size: 1.05rem;">No Projects Found</h3>
            <p style="font-size: 0.85rem;">${query ? `No projects matching "${query}"` : `No projects found in this view`}</p>
          </div>
        `;
      } else {
        const layoutClass = currentViewMode === "list" ? "projects-list-view" : "projects-grid";
        projectsContainer.innerHTML = `
          ${drilldownHeaderHtml}
          <div class="${layoutClass}">
            ${filtered.map(p => renderProjectCard(p, maxProjectSize)).join("")}
          </div>
        `;

        // Attach Card Click Handlers for Inspector Modal
        projectsContainer.querySelectorAll(".project-card").forEach(card => {
          card.addEventListener("click", () => {
            const path = card.getAttribute("data-path");
            const slug = card.getAttribute("data-slug");
            const name = card.getAttribute("data-name");
            const target = filtered.find(p => (path && p.path === path) || (slug && p.slug === slug) || (name && p.name === name));
            if (target) {
              openProjectInspector(target, categoriesConfig, () => {
                loadDashboardData();
              });
            }
          });

          card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              card.click();
            }
          });
        });
      }

      // Attach Back to All Clients Handler
      document.getElementById("client-back-btn")?.addEventListener("click", () => {
        selectedClient = null;
        applyFilters();
      });
    }

    searchInput?.addEventListener("input", applyFilters);
    statusSelect?.addEventListener("change", applyFilters);
    sortSelect?.addEventListener("change", applyFilters);
    applyFilters();
  }

  async function loadDashboardData() {
    try {
      // 1. If we have cached data, process and render immediately!
      if (projects.length > 0) {
        processAndRender();
      }

      // 2. Concurrently revalidate with SWR in background
      api.getProjectsSWR((freshProjects) => {
        projects = freshProjects;
        processAndRender();
      });

      api.getCategoriesSWR((freshCats) => {
        catData = freshCats;
        processAndRender();
      });
    } catch (err) {
      const projectsContainer = document.getElementById("projects-container");
      if (projectsContainer && projects.length === 0) {
        projectsContainer.innerHTML = `
          <div class="empty-state" style="border-color: var(--color-danger);">
            <h3 style="color: var(--color-danger); margin-bottom: 0.35rem; font-size: 1.05rem;">Failed to Index Projects</h3>
            <p style="font-size: 0.85rem;">${err.message}</p>
          </div>
        `;
      }
    }
  }

  // Sync Brain Modal Trigger
  document.getElementById("dashboard-sync-btn")?.addEventListener("click", () => {
    openLiveSyncModal(() => {
      loadDashboardData();
    });
  });

  // Resurrect Modal Trigger
  document.getElementById("dashboard-resurrect-btn")?.addEventListener("click", () => {
    openResurrectModal(() => {
      loadDashboardData();
    });
  });

  await loadDashboardData();
}

