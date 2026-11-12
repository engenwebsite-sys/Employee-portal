// Tokens live in localStorage so a page refresh keeps you signed in.
// Trade-off: any XSS bug could read them. Moving the refresh token to an
// httpOnly cookie is a possible hardening step before going live.
const ACCESS = "nemilink.access";
const REFRESH = "nemilink.refresh";

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS),
  getRefresh: () => localStorage.getItem(REFRESH),
  set({ access_token, refresh_token }) {
    localStorage.setItem(ACCESS, access_token);
    localStorage.setItem(REFRESH, refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};
