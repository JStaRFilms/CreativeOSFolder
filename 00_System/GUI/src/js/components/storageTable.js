/**
 * Storage Data Table Component
 */

import { formatBytes } from "../api.js";

export function renderStorageTable(projects, currentSort = { key: "total_size", asc: false }) {
  if (!projects || projects.length === 0) {
    return `
      <div class="empty-state">
        <p>No projects found in storage index.</p>
      </div>
    `;
  }

  const sorted = [...projects].sort((a, b) => {
    let valA = a[currentSort.key];
    let valB = b[currentSort.key];

    if (typeof valA === "string") {
      valA = valA.toLowerCase();
      valB = (valB || "").toLowerCase();
      return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    valA = valA || 0;
    valB = valB || 0;
    return currentSort.asc ? valA - valB : valB - valA;
  });

  const getSortIcon = (key) => {
    if (currentSort.key !== key) return "↕";
    return currentSort.asc ? "▲" : "▼";
  };

  const getThClass = (key) => {
    return `sortable ${currentSort.key === key ? "sorted" : ""}`;
  };

  const rows = sorted.map((p) => `
    <tr>
      <td>
        <div class="cell-project-name">
          <span>${p.icon || "📁"}</span>
          <span title="${p.path}">${p.name}</span>
        </div>
      </td>
      <td><span class="card-category-tag">${p.type || "—"}</span></td>
      <td class="cell-mono">${p.created || "—"}</td>
      <td class="cell-mono" style="font-weight: 600; color: var(--text-primary);">${formatBytes(p.total_size)}</td>
      <td class="cell-mono cell-media">${formatBytes(p.media_size)}</td>
      <td class="cell-mono cell-reclaimable">${formatBytes(p.reclaimable_size)}</td>
      <td class="cell-mono">${p.file_count || 0}</td>
      <td class="cell-mono">${p.last_meaningful_update ? p.last_meaningful_update.substring(0, 10) : "—"}</td>
    </tr>
  `).join("");

  return `
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th class="${getThClass("name")}" data-sort="name">Project Name <span class="sort-icon">${getSortIcon("name")}</span></th>
              <th class="${getThClass("type")}" data-sort="type">Category <span class="sort-icon">${getSortIcon("type")}</span></th>
              <th class="${getThClass("created")}" data-sort="created">Created <span class="sort-icon">${getSortIcon("created")}</span></th>
              <th class="${getThClass("total_size")}" data-sort="total_size">Total Size <span class="sort-icon">${getSortIcon("total_size")}</span></th>
              <th class="${getThClass("media_size")}" data-sort="media_size">Media <span class="sort-icon">${getSortIcon("media_size")}</span></th>
              <th class="${getThClass("reclaimable_size")}" data-sort="reclaimable_size">Reclaimable <span class="sort-icon">${getSortIcon("reclaimable_size")}</span></th>
              <th class="${getThClass("file_count")}" data-sort="file_count">Files <span class="sort-icon">${getSortIcon("file_count")}</span></th>
              <th class="${getThClass("last_meaningful_update")}" data-sort="last_meaningful_update">Last Active <span class="sort-icon">${getSortIcon("last_meaningful_update")}</span></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <div class="table-footer-info">
        <span>Showing <strong>${sorted.length}</strong> project${sorted.length === 1 ? '' : 's'}</span>
        <span>Storage review is <strong>read-only</strong></span>
      </div>
    </div>
  `;
}
