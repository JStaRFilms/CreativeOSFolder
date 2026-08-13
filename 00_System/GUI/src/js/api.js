/**
 * CreativeOS API Client
 */

const API_BASE = "/api";

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.detail || data.message || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  getHealth: () => request("/health"),
  getProjects: () => request("/projects"),
  createProject: (payload) => request("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  getStorage: () => request("/storage"),
  refreshStorage: () => request("/storage/refresh", {
    method: "POST",
  }),
  getCategories: () => request("/categories"),
  getConfig: () => request("/config"),
  triggerSync: () => request("/sync", {
    method: "POST",
  }),
};

/**
 * Format bytes to readable size
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = bytes;
  let unitIndex = 0;
  while (val >= 1024 && unitIndex < units.length - 1) {
    val /= 1024;
    unitIndex++;
  }
  return `${val.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
