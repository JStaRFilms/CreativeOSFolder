/**
 * Client Card Component — Studio Client Directory Card
 */

import { formatBytes } from "../api.js";
import { getCategoryIconSvg, icons } from "../icons.js";

export function renderClientCard(client) {
  const { name, projects = [], totalSize = 0, mediaSize = 0, categories = new Set(), lastActive = null } = client;
  const projectCount = projects.length;
  const staleCount = projects.filter(p => p.is_stale || p.status === "stale").length;
  const activeCount = projectCount - staleCount;

  // Generate 2 initials for avatar
  const initials = getInitials(name);
  const relTime = getRelativeTime(lastActive);

  // Category breakdown tags
  const catCounts = {};
  projects.forEach(p => {
    const c = p.type || "Video";
    catCounts[c] = (catCounts[c] || 0) + 1;
  });

  return `
    <div class="client-card" data-client="${name}" tabindex="0" role="button" aria-label="Open ${name} projects">
      <div class="client-card-header">
        <div class="client-avatar" aria-hidden="true">${initials}</div>
        <div class="client-title-group">
          <h3 class="client-name" title="${name}">${name}</h3>
          <span class="client-badge-pill">${projectCount} project${projectCount === 1 ? '' : 's'}</span>
        </div>
        <span class="status-indicator-tag ${activeCount > 0 ? 'is-active' : 'is-stale'}">
          <span class="status-dot"></span>
          <span>${activeCount > 0 ? `${activeCount} Active` : 'Archival'}</span>
        </span>
      </div>

      <div class="client-metrics-bar font-mono">
        <div class="spec-cell">
          <span class="client-meta-label">Footprint</span>
          <span class="client-meta-val font-bold">${formatBytes(totalSize)}</span>
        </div>
        <div class="spec-cell">
          <span class="client-meta-label">Projects</span>
          <span class="client-meta-val">${projectCount}</span>
        </div>
        <div class="spec-cell">
          <span class="client-meta-label">Active</span>
          <span class="client-meta-val" title="${relTime}">${relTime}</span>
        </div>
      </div>

      <div class="client-card-footer">
        <div class="client-category-tags">
          ${Object.entries(catCounts).map(([cat, count]) => `
            <span class="card-cat-badge" title="${count} ${cat} project${count === 1 ? '' : 's'}">
              ${cat} <strong style="margin-left: 2px;">${count}</strong>
            </span>
          `).join("")}
        </div>
        <span class="client-open-prompt">
          <span>View Projects</span>
          ${icons.chevronRight}
        </span>
      </div>
    </div>
  `;
}

function getInitials(name) {
  if (!name) return "CL";
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase() || "CL";
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
