/**
 * CreativeOS API Client with SWR Caching & Background Revalidation
 */

const API_BASE = "/api";
let activeRequestsCount = 0;

export function showTopLoader() {
  activeRequestsCount++;
  const bar = document.getElementById("top-progress-bar");
  if (bar) bar.style.display = "block";
}

export function hideTopLoader() {
  activeRequestsCount = Math.max(0, activeRequestsCount - 1);
  if (activeRequestsCount === 0) {
    const bar = document.getElementById("top-progress-bar");
    if (bar) {
      setTimeout(() => {
        if (activeRequestsCount === 0) bar.style.display = "none";
      }, 150);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Client Local Storage Cache Layer
// ──────────────────────────────────────────────────────────────────────────────

export const cacheStore = {
  get: (key) => {
    try {
      const raw = localStorage.getItem(`cos_cache_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set: (key, data) => {
    try {
      localStorage.setItem(`cos_cache_${key}`, JSON.stringify(data));
    } catch {}
  },
  invalidate: (key) => {
    try {
      if (key) {
        localStorage.removeItem(`cos_cache_${key}`);
      } else {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("cos_cache_"))
          .forEach((k) => localStorage.removeItem(k));
      }
    } catch {}
  },
};

async function request(endpoint, options = {}, trackProgress = true) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (trackProgress) showTopLoader();

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
  } finally {
    if (trackProgress) hideTopLoader();
  }
}

/**
 * Stale-While-Revalidate (SWR) Fetch Pattern
 * Returns cached data immediately if present; revalidates in the background.
 */
export async function fetchSWR(cacheKey, fetcher, onUpdate = null) {
  const cached = cacheStore.get(cacheKey);

  // Background revalidation task
  const revalidate = async () => {
    try {
      showTopLoader();
      const fresh = await fetcher();
      const cachedStr = JSON.stringify(cached);
      const freshStr = JSON.stringify(fresh);
      cacheStore.set(cacheKey, fresh);

      if (onUpdate && (!cached || cachedStr !== freshStr)) {
        onUpdate(fresh);
      }
      return fresh;
    } catch (err) {
      console.warn(`[SWR Revalidation Failed] ${cacheKey}:`, err);
    } finally {
      hideTopLoader();
    }
  };

  if (cached !== null) {
    // Fire revalidation in the background without blocking UI
    setTimeout(revalidate, 10);
    return cached;
  }

  // Cold start: wait for network
  return await revalidate();
}

export const api = {
  // System Health & Config
  getHealth: () => request("/health", {}, false),
  getConfig: () => request("/config"),
  getCategories: () => request("/categories"),

  // SWR Cached Endpoints for Instant UI Rendering
  getProjectsSWR: (onUpdate) => fetchSWR("projects", () => request("/projects", {}, false), onUpdate),
  getCategoriesSWR: (onUpdate) => fetchSWR("categories", () => request("/categories", {}, false), onUpdate),
  getConfigSWR: (onUpdate) => fetchSWR("config", () => request("/config", {}, false), onUpdate),
  getStorageSWR: (onUpdate) => fetchSWR("storage", () => request("/storage", {}, false), onUpdate),

  // Projects CRUD & Actions (Mutations automatically invalidate local cache)
  getProjects: () => request("/projects"),
  createProject: async (payload) => {
    const res = await request("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    cacheStore.invalidate("projects");
    cacheStore.invalidate("storage");
    return res;
  },
  updateProject: async (name, payload) => {
    const res = await request(`/projects/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    cacheStore.invalidate("projects");
    cacheStore.invalidate("storage");
    return res;
  },
  travelProject: (name) => request(`/projects/${encodeURIComponent(name)}/travel`, {
    method: "POST",
  }),
  archiveProject: async (name) => {
    const res = await request(`/projects/${encodeURIComponent(name)}/archive`, {
      method: "POST",
    });
    cacheStore.invalidate("projects");
    cacheStore.invalidate("storage");
    return res;
  },
  getArchivedProjects: () => request("/projects/archived"),
  resurrectProject: async (name) => {
    const res = await request(`/projects/${encodeURIComponent(name)}/resurrect`, {
      method: "POST",
    });
    cacheStore.invalidate("projects");
    cacheStore.invalidate("storage");
    return res;
  },

  // File Explorer & Media Preview
  listFiles: (path = "") => request(`/fs/list${path ? `?path=${encodeURIComponent(path)}` : ""}`),
  openPath: (path) => request("/fs/open", {
    method: "POST",
    body: JSON.stringify({ path }),
  }),
  getRawFileUrl: (path) => `/api/fs/raw?path=${encodeURIComponent(path)}`,
  getFileContent: (path, maxBytes = 500000) => request(`/fs/content?path=${encodeURIComponent(path)}&max_bytes=${maxBytes}`),

  // Storage
  getStorage: () => request("/storage"),
  refreshStorage: async () => {
    const res = await request("/storage/refresh", {
      method: "POST",
    });
    cacheStore.invalidate("projects");
    cacheStore.invalidate("storage");
    return res;
  },

  // Note Sync
  triggerSync: () => request("/sync", {
    method: "POST",
  }),

  // Update Config Paths
  updatePaths: async (pathsMap, moveFiles = false) => {
    const res = await request("/config/paths", {
      method: "PUT",
      body: JSON.stringify({
        paths: pathsMap,
        move_files: moveFiles,
      }),
    });
    cacheStore.invalidate("config");
    return res;
  },

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
          if (data.event === "complete") {
            cacheStore.invalidate("projects");
            if (onComplete) onComplete(data);
          }
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

