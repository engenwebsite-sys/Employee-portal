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
          Sign in with your organization Microsoft account to access daily timesheets, leave balances, and team management.
        </p>

        <button
          type="button"
          onClick={handleMicrosoftClick}
          disabled={redirecting}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#16192e] px-4 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-900 disabled:opacity-60"
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
