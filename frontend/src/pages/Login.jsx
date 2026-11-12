import { useState } from "react";
import { motion } from "motion/react";
import { Navigate, useLocation } from "react-router-dom";
import Brand from "../components/Brand";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

function MicrosoftMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 21 21" aria-hidden="true">
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
    <main className="flex min-h-dvh flex-col justify-between bg-nemilink-lavender px-4 py-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Brand />
      </header>

      <motion.section
        aria-labelledby="login-title"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto my-6 w-full max-w-[420px] rounded-3xl border border-[#e7e5fb] bg-white p-8 shadow-lg shadow-indigo-950/5 sm:p-10"
      >
        <div className="text-[11px] font-bold tracking-[0.16em] text-nemilink-coral uppercase">
          Employee &amp; HR Portal
        </div>
        <h1 id="login-title" className="mt-2 text-2xl font-extrabold text-nemilink-navy sm:text-3xl">
          Sign in to workspace
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Use your company Microsoft 365 / Teams account to access your profile, leave requests, and team directory.
        </p>

        <button
          type="button"
          onClick={handleMicrosoftClick}
          disabled={redirecting}
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-nemilink-navy px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
        >
          <MicrosoftMark />
          {redirecting ? "Redirecting to Microsoft…" : "Continue with Microsoft (Teams)"}
        </button>

        {error && (
          <p
            className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs leading-relaxed font-semibold text-rose-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <p className="mt-6 border-t border-gray-100 pt-5 text-center text-xs text-gray-400">
          Need workspace access? Contact your{" "}
          <span className="font-semibold text-gray-600">HR administrator</span>.
        </p>
      </motion.section>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Nemilink Technologies Pvt Ltd
      </footer>
    </main>
  );
}
