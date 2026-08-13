/**
 * Project Card Component — Sleek Studio Workspace Card
 */

import { formatBytes } from "../api.js";

export function renderProjectCard(project, maxProjectSize = 1) {
  const isStale = project.is_stale || project.status === "stale";
  const cat = project.type || "Video";
  const clientName = project.client && project.client !== "None" ? project.client : null;
  const createdDate = project.created || "—";
  const totalSize = project.total_size || 0;
  const formattedSize = formatBytes(totalSize);
  const fileCount = project.file_count || 0;

  const relTime = getRelativeTime(project.last_meaningful_update || project.created);

  return `
    <div class="project-card" data-slug="${project.slug || ''}" data-category="${cat}" tabindex="0" role="button" aria-label="Inspect ${project.name}">
      <div class="card-top-row">
        <div class="card-title-lockup">
          <div class="card-icon-tag">${project.icon || "📁"}</div>
          <div class="card-heading-group">
            <h3 class="card-title" title="${project.name}">${project.name}</h3>
            <span class="card-subpath font-mono" title="${project.relative_path || project.path}">${project.relative_path || project.slug}</span>
          </div>
        </div>
        <span class="status-indicator-tag ${isStale ? 'is-stale' : 'is-active'}" title="${isStale ? 'Inactive > 90 days' : 'Active Workspace'}">
          <span class="status-dot"></span>
          <span>${isStale ? 'Stale' : 'Active'}</span>
        </span>
      </div>

      <div class="card-spec-row font-mono">
        <div class="spec-cell">
          <span class="spec-label">Size</span>
          <span class="spec-val font-bold">${formattedSize}</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Files</span>
          <span class="spec-val">${fileCount}</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Client</span>
          <span class="spec-val text-ellipsis" title="${clientName || 'Internal'}">${clientName || "Internal"}</span>
        </div>
        <div class="spec-cell">
          <span class="spec-label">Active</span>
          <span class="spec-val" title="${relTime}">${relTime}</span>
        </div>
      </div>

      <div class="card-bottom-row">
        <div class="card-badges">
          <span class="card-cat-badge">${cat}</span>
          ${project.reclaimable_size > 0 ? `
            <span class="card-cache-badge" title="Reclaimable build cache">
              ⚡ ${formatBytes(project.reclaimable_size)}
            </span>
          ` : ''}
        </div>
        <span class="card-inspect-action">
          <span>Inspect</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </div>
    </div>
  `;
}

function getRelativeTime(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return dateStr.substring(0, 10);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch (e) {
    return dateStr.substring(0, 10);
  }
}
