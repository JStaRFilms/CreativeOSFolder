/**
 * Storage Data Table Component — Precision Studio Instrument
 */

import { formatBytes } from "../api.js";
import { getCategoryIconSvg, icons } from "../icons.js";

export function renderStorageTable(projects, currentSort = { key: "total_size", asc: false }) {
  if (!projects || projects.length === 0) {
    return `
      <div class="empty-state">
        <h3 style="margin-bottom: 0.35rem; color: var(--text-primary); font-size: 1rem;">No Projects Found</h3>
        <p style="font-size: 0.85rem;">No projects matched your storage search or filter query.</p>
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

  const maxSize = Math.max(...projects.map(p => p.total_size || 0), 1);

  const getSortIcon = (key) => {
    if (currentSort.key !== key) return `<span class="sort-icon-idle">↕</span>`;
    return currentSort.asc ? `<span class="sort-icon-active">▲</span>` : `<span class="sort-icon-active">▼</span>`;
  };

  const getThClass = (key) => {
    return `sortable ${currentSort.key === key ? "sorted" : ""}`;
  };

  const rows = sorted.map((p) => {
    const cat = p.type || "Video";
    const percent = Math.min(100, Math.max(3, ((p.total_size || 0) / maxSize) * 100));
    const catIconSvg = getCategoryIconSvg(cat);

    return `
      <tr class="storage-row" data-slug="${p.slug || ''}" data-name="${p.name || ''}" data-path="${p.path || ''}">
        <td>
          <div class="cell-project-name">
            <span class="cell-cat-icon" aria-hidden="true">${catIconSvg}</span>
            <div class="cell-name-wrap">
              <span class="cell-title" title="${p.path}">${p.name}</span>
              <span class="cell-rel-path">${p.relative_path || p.slug}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="card-cat-badge">
            ${cat}
          </span>
        </td>
        <td class="cell-mono">${p.created || "—"}</td>
        <td>
          <div class="cell-storage-wrap">
            <span class="cell-mono font-bold" style="color: var(--text-primary);">${formatBytes(p.total_size)}</span>
            <div class="cell-size-track">
              <div class="cell-size-fill" style="width: ${percent}%;"></div>
            </div>
          </div>
        </td>
        <td class="cell-mono cell-media">${formatBytes(p.media_size)}</td>
        <td class="cell-mono cell-reclaimable">
          ${p.reclaimable_size > 0 ? `<span>${icons.zap} ${formatBytes(p.reclaimable_size)}</span>` : `<span style="color: var(--text-dim);">0 B</span>`}
        </td>
        <td class="cell-mono">${p.file_count || 0}</td>
        <td class="cell-mono">${p.last_meaningful_update ? p.last_meaningful_update.substring(0, 10) : "—"}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th class="${getThClass("name")}" data-sort="name">Project Name ${getSortIcon("name")}</th>
              <th class="${getThClass("type")}" data-sort="type">Category ${getSortIcon("type")}</th>
              <th class="${getThClass("created")}" data-sort="created">Created ${getSortIcon("created")}</th>
              <th class="${getThClass("total_size")}" data-sort="total_size">Total Footprint ${getSortIcon("total_size")}</th>
              <th class="${getThClass("media_size")}" data-sort="media_size">Media ${getSortIcon("media_size")}</th>
              <th class="${getThClass("reclaimable_size")}" data-sort="reclaimable_size">Reclaimable ${getSortIcon("reclaimable_size")}</th>
              <th class="${getThClass("file_count")}" data-sort="file_count">Files ${getSortIcon("file_count")}</th>
              <th class="${getThClass("last_meaningful_update")}" data-sort="last_meaningful_update">Last Active ${getSortIcon("last_meaningful_update")}</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <div class="table-footer-info">
        <span>Showing <strong>${sorted.length}</strong> project${sorted.length === 1 ? '' : 's'}</span>
        <span class="safe-tag">Storage inventory is <strong>read-only</strong></span>
      </div>
    </div>
  `;
}
