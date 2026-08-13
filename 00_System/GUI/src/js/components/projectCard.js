/**
 * Project Card Component
 */

import { formatBytes } from "../api.js";

export function renderProjectCard(project) {
  const isStale = project.is_stale || project.status === "stale";
  const statusClass = isStale ? "status-stale" : "status-active";
  const statusText = isStale ? "Stale" : "Active";

  const clientName = project.client && project.client !== "None" ? project.client : null;
  const createdDate = project.created || "Unknown";
  const formattedSize = formatBytes(project.total_size || 0);
  const fileCount = project.file_count || 0;

  return `
    <div class="project-card" data-slug="${project.slug || ''}" data-category="${project.type || ''}">
      <div class="card-header">
        <div class="card-title-group">
          <span class="card-category-icon">${project.icon || "📁"}</span>
          <div>
            <h3 class="card-title" title="${project.name}">${project.name}</h3>
            <span class="card-slug" title="${project.relative_path || project.path}">${project.relative_path || project.slug}</span>
          </div>
        </div>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>

      <div class="card-details">
        <div class="detail-item">
          <span class="detail-label">Created</span>
          <span class="detail-value">${createdDate}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Storage</span>
          <span class="detail-value">${formattedSize}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Files</span>
          <span class="detail-value">${fileCount} files</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Client</span>
          <span class="detail-value">${clientName || "—"}</span>
        </div>
      </div>

      <div class="card-footer">
        <span class="card-category-tag">${project.type || "Unknown"}</span>
        <span class="detail-label">${project.last_meaningful_update ? 'Updated: ' + project.last_meaningful_update.substring(0, 10) : ''}</span>
      </div>
    </div>
  `;
}
