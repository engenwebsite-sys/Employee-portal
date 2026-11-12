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
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const { user, loading } = useAuth();
  const location = useLocation();
  const destination = location.state?.from ?? "/dashboard";

  if (!loading && user) {
    return <Navigate to={user.must_change_password ? "/change-password" : destination} replace />;
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
    <main className="flex min-h-dvh flex-col justify-between bg-[#f8f9fb] px-4 py-8 antialiased">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <Brand />
      </header>

      <motion.section
        aria-labelledby="login-title"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto my-auto w-full max-w-[380px] rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs sm:p-7"
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Employee &amp; HR Portal
        </div>
        <h1 id="login-title" className="mt-1 text-xl font-bold text-slate-900">
          Sign in to workspace
        </h1>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          Use your official Microsoft account to access daily timesheets, leave balances, and team essentials.
        </p>

        <button
          type="button"
          onClick={handleMicrosoftClick}
          disabled={redirecting}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-800 disabled:opacity-60"
        >
          <MicrosoftMark />
          {redirecting ? "Connecting to Microsoft..." : "Continue with Microsoft (Teams)"}
        </button>

        {error && (
          <p
            className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 leading-relaxed"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-5 border-t border-slate-100 pt-3 text-center text-[11px] text-slate-400">
          Allowed domains: <span className="font-semibold text-slate-600">@nemilink.com</span> ·{" "}
          <span className="font-semibold text-slate-600">@maargaai.com</span> ·{" "}
          <span className="font-semibold text-slate-600">@engencbss.com</span>
        </div>
      </motion.section>

      <footer className="mx-auto w-full max-w-4xl text-center text-[11px] text-slate-400">
        © {new Date().getFullYear()} Nemilink Technologies Pvt Ltd
      </footer>
    </main>
  );
}
