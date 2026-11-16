import { tokenStore } from "./tokenStore";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code; // raw `detail` from the server, e.g. "password_change_required"
  }
}

function send(path, { auth = true, body, headers, ...rest }) {
  const token = auth ? tokenStore.getAccess() : null;
  return fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// If several requests hit an expired token together, only one refresh runs.
let refreshing = null;

function refreshTokens() {
  refreshing ??= (async () => {
    const refresh_token = tokenStore.getRefresh();
    const response = refresh_token
      ? await send("/auth/refresh", { method: "POST", auth: false, body: { refresh_token } })
      : null;
    if (!response?.ok) {
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:logout"));
      throw new ApiError("Session expired. Please sign in again.", 401);
    }
    tokenStore.set(await response.json());
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function friendlyMessage(detail, fallback) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) {
    return detail[0].msg.replace(/^Value error, /, "");
  }
  return fallback || "Request failed";
}

/** JSON fetch wrapper: adds the JWT, refreshes it once on 401, throws ApiError. */
export async function api(path, options = {}) {
  let response = await send(path, options);

  if (response.status === 401 && options.auth !== false && tokenStore.getRefresh()) {
    await refreshTokens();
    response = await send(path, options);
  }

  if (!response.ok) {
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {
      /* response had no JSON body */
    }
    throw new ApiError(friendlyMessage(detail, response.statusText), response.status, detail);
  }

  return response.status === 204 ? null : response.json();
}

/** Download binary file (e.g. Excel) with JWT auth and auto-trigger browser download */
export async function downloadFile(path, defaultFilename = "download.xlsx") {
  const token = tokenStore.getAccess();
  let response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (response.status === 401 && tokenStore.getRefresh()) {
    await refreshTokens();
    const newToken = tokenStore.getAccess();
    response = await fetch(`${API_URL}${path}`, {
      headers: newToken ? { Authorization: `Bearer ${newToken}` } : {},
    });
  }

  if (!response.ok) {
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(friendlyMessage(detail, "Download failed"), response.status, detail);
  }

  let filename = defaultFilename;
  const disposition = response.headers.get("content-disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** Formats local or relative upload path into full accessible URL */
export function getAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("data:")) return path;

  // If path is a full URL but pointing to localhost in non-localhost browser, strip origin
  let normalized = path;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const u = new URL(normalized);
      if (
        (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
        typeof window !== "undefined" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        normalized = u.pathname;
      } else {
        return normalized;
      }
    } catch {
      return normalized;
    }
  }

  // Ensure path routes through /api/v1 so Nginx forwards it to FastAPI backend
  if (normalized.startsWith("/uploads/")) {
    normalized = `/api/v1${normalized}`;
  } else if (!normalized.startsWith("/api/")) {
    normalized = `/api/v1/uploads/${normalized.replace(/^\/+/, "")}`;
  }

  // If in browser production environment, check API_URL host
  if (typeof window !== "undefined" && window.location?.origin) {
    if (API_URL.startsWith("http://") || API_URL.startsWith("https://")) {
      try {
        const apiUrlObj = new URL(API_URL);
        if (
          (apiUrlObj.hostname === "localhost" || apiUrlObj.hostname === "127.0.0.1") &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1"
        ) {
          // Use same-origin relative URL so it goes to nemilink-portal.duckdns.org/api/...
          return normalized;
        }
        return `${apiUrlObj.origin}${normalized}`;
      } catch {
        return normalized;
      }
    }
    return normalized;
  }
  return normalized;
}

/** Upload avatar image file via multipart form-data */
export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("file", file);
  const token = tokenStore.getAccess();

  let res = await fetch(`${API_URL}/me/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401 && tokenStore.getRefresh()) {
    await refreshTokens();
    const newToken = tokenStore.getAccess();
    res = await fetch(`${API_URL}/me/avatar`, {
      method: "POST",
      headers: newToken ? { Authorization: `Bearer ${newToken}` } : {},
      body: formData,
    });
  }

  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(friendlyMessage(detail, "Avatar upload failed"), res.status, detail);
  }

  return res.json();
}

/** Delete avatar */
export async function deleteAvatar() {
  return api("/me/avatar", { method: "DELETE" });
}
