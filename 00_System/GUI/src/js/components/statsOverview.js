/**
 * Stats Overview Component
 */

import { formatBytes } from "../api.js";

export function renderStatsOverview(stats) {
  const { totalProjects = 0, totalSize = 0, activeCount = 0, staleCount = 0 } = stats;

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total Projects</span>
        <span class="stat-value">${totalProjects}</span>
        <span class="stat-subtext">${activeCount} active, ${staleCount} stale</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">Total Disk Space</span>
        <span class="stat-value">${formatBytes(totalSize)}</span>
        <span class="stat-subtext">Across all active categories</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">Active Projects</span>
        <span class="stat-value" style="color: var(--color-success);">${activeCount}</span>
        <span class="stat-subtext">Updated in last 90 days</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">Stale Projects</span>
        <span class="stat-value" style="color: var(--color-warning);">${staleCount}</span>
        <span class="stat-subtext">Inactive for &gt; 90 days</span>
      </div>
    </div>
  `;
}
