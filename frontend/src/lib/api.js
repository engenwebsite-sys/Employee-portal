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
