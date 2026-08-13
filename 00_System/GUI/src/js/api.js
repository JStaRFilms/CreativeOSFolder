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
  // System Health & Config
  getHealth: () => request("/health"),
  getConfig: () => request("/config"),
  getCategories: () => request("/categories"),

  // Projects CRUD & Actions
  getProjects: () => request("/projects"),
  createProject: (payload) => request("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  updateProject: (name, payload) => request(`/projects/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }),
  travelProject: (name) => request(`/projects/${encodeURIComponent(name)}/travel`, {
    method: "POST",
  }),
  archiveProject: (name) => request(`/projects/${encodeURIComponent(name)}/archive`, {
    method: "POST",
  }),
  getArchivedProjects: () => request("/projects/archived"),
  resurrectProject: (name) => request(`/projects/${encodeURIComponent(name)}/resurrect`, {
    method: "POST",
  }),

  // File Explorer
  listFiles: (path = "") => request(`/fs/list${path ? `?path=${encodeURIComponent(path)}` : ""}`),
  openPath: (path) => request("/fs/open", {
    method: "POST",
    body: JSON.stringify({ path }),
  }),

  // Storage
  getStorage: () => request("/storage"),
  refreshStorage: () => request("/storage/refresh", {
    method: "POST",
  }),

  // Note Sync
  triggerSync: () => request("/sync", {
    method: "POST",
  }),

  /**
   * Real-time Server-Sent Events (SSE) Sync Stream
   */
  streamSync: (onEvent, onError, onComplete) => {
    const url = `${API_BASE}/sync/stream`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (onEvent) onEvent(data);
        if (data.event === "complete" || data.event === "error") {
          eventSource.close();
          if (data.event === "complete" && onComplete) onComplete(data);
          if (data.event === "error" && onError) onError(new Error(data.message || "Sync error"));
        }
      } catch (err) {
        console.error("Failed to parse SSE payload:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn("SSE stream encountered an error / connection closed:", err);
      eventSource.close();
      if (onError) onError(err);
    };

    return () => eventSource.close();
  },
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
