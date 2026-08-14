/**
 * Studio Telemetry Strip Component
 */

import { formatBytes } from "../api.js";

export function renderStatsOverview(stats) {
  const { totalProjects = 0, totalSize = 0, activeCount = 0, staleCount = 0, mediaSize = 0, reclaimableSize = 0 } = stats;
  const activeRate = totalProjects > 0 ? Math.round((activeCount / totalProjects) * 100) : 100;

  return `
    <div class="telemetry-strip">
      <div class="telemetry-cell">
        <div class="telemetry-label">Projects Indexed</div>
        <div class="telemetry-val font-mono">${totalProjects}</div>
        <div class="telemetry-meta">
          <span class="dot-active"></span> ${activeCount} active
          <span class="meta-sep">&bull;</span>
          <span class="dot-stale"></span> ${staleCount} stale
        </div>
      </div>

      <div class="telemetry-divider"></div>

      <div class="telemetry-cell">
        <div class="telemetry-label">Total Disk Footprint</div>
        <div class="telemetry-val font-mono">${formatBytes(totalSize)}</div>
        <div class="telemetry-meta">
          ${mediaSize > 0 ? `${formatBytes(mediaSize)} media assets` : 'Indexed across categories'}
        </div>
      </div>

      <div class="telemetry-divider"></div>

      <div class="telemetry-cell">
        <div class="telemetry-label">Studio Health</div>
        <div class="telemetry-val font-mono ${activeRate >= 50 ? 'health-good' : 'health-warn'}">${activeRate}%</div>
        <div class="telemetry-meta">Active within last 90 days</div>
      </div>

      <div class="telemetry-divider"></div>

      <div class="telemetry-cell">
        <div class="telemetry-label">Reclaimable Cache</div>
        <div class="telemetry-val font-mono ${reclaimableSize > 0 ? 'text-amber' : ''}">${reclaimableSize > 0 ? formatBytes(reclaimableSize) : '0 B'}</div>
        <div class="telemetry-meta">Build outputs &amp; temp files</div>
      </div>
    </div>
  `;
}
