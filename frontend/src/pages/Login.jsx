import { useState } from "react";
import { motion } from "motion/react";
import { Navigate, useLocation } from "react-router-dom";
import Brand from "../components/Brand";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

function MicrosoftMark() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const destination = location.state?.from ?? "/dashboard";

  if (!loading && user) {
    return <Navigate to={user.must_change_password ? "/change-password" : destination} replace />;
  }

  async function handleEmailLogin(e) {
    e.preventDefault();
    setError("");
    setSigningIn(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || "Invalid work email or password.");
    } finally {
      setSigningIn(false);
    }
  }

  async function handleMicrosoftClick() {
    setError("");
    setRedirecting(true);
    try {
      const data = await api("/auth/microsoft/url", { auth: false });
      window.location.href = data.auth_url;
    } catch (err) {
      setError(err.message || "Could not start Microsoft sign-in.");
      setRedirecting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-between bg-[#f8fafc] px-4 py-6 sm:py-8 antialiased">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <Brand />
      </header>

      <motion.section
        aria-labelledby="login-title"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto my-auto w-full max-w-[390px] card-pastel p-5 sm:p-7 shadow-sm"
      >
        {/* Official Pill Style from Nemilink.com */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50/60 px-2.5 py-0.5 text-[10.5px] font-bold text-[#ea384d]">
          Nemilink Technologies
        </div>

        <h1 id="login-title" className="mt-2 text-xl font-extrabold tracking-tight text-[#16192e]">
          Employee &amp; HR Workspace
        </h1>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          Sign in to access your daily timesheets, leave balances, and profile.
        </p>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailLogin} className="mt-4 space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-slate-700">Work Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="e.g. employee@nemilink.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-slate-400 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px] font-semibold"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={signingIn}
            className="w-full btn-brand-gradient rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:shadow-md disabled:opacity-60 transition-all active:scale-[0.99]"
          >
            {signingIn ? "Signing in..." : "Sign In with Password"}
          </button>
        </form>

        {error && (
          <p
            className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 leading-relaxed"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Divider */}
        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <span className="relative bg-white px-2.5 text-[11px] font-semibold text-slate-400">
            or
          </span>
        </div>

        <button
          type="button"
          onClick={handleMicrosoftClick}
          disabled={redirecting}
          className="flex w-full items-center justify-center gap-2.5 btn-navy-gradient rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-md hover:shadow-lg disabled:opacity-60 transition-all"
        >
          <MicrosoftMark />
          {redirecting ? "Connecting to Microsoft..." : "Continue with Microsoft (Teams)"}
        </button>

        <div className="mt-5 border-t border-slate-100 pt-3 text-center text-[10.5px] text-slate-400">
          Authorized domains: <span className="font-semibold text-slate-700">@nemilink.com</span> ·{" "}
          <span className="font-semibold text-slate-700">@maargaai.com</span> ·{" "}
          <span className="font-semibold text-slate-700">@engencbss.com</span>
        </div>
      </motion.section>

      <footer className="mx-auto w-full max-w-4xl text-center text-[10.5px] text-slate-400">
        © {new Date().getFullYear()} Nemilink Technologies Pvt Ltd · All rights reserved.
      </footer>
    </main>
  );
}
