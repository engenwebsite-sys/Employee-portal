const ACCESS = "nemilink.access";
const REFRESH = "nemilink.refresh";
const SESSION = "nemilink.session";
let accessToken = null;

export const tokenStore = {
  getAccess: () => accessToken,
  getLegacyRefresh: () => localStorage.getItem(REFRESH),
  hasSession: () => Boolean(localStorage.getItem(SESSION) || localStorage.getItem(REFRESH)),
  set({ access_token }) {
    accessToken = access_token;
    localStorage.setItem(SESSION, "1");
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
  clear() {
    accessToken = null;
    localStorage.removeItem(SESSION);
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};
