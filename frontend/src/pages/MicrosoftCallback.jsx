import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Brand from "../components/Brand";
import { useAuth } from "../context/AuthContext";

export default function MicrosoftCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithMicrosoft } = useAuth();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const msError = searchParams.get("error_description") || searchParams.get("error");
    if (msError) {
      setError(msError);
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      setError("Missing authorization code from Microsoft.");
      return;
    }

    loginWithMicrosoft(code)
      .then(() => {
        navigate("/dashboard", { replace: true });
      })
      .catch((err) => {
        setError(err.message || "Microsoft sign-in failed.");
      });
  }, [searchParams, loginWithMicrosoft, navigate]);

  return (
    <main className="flex min-h-dvh flex-col justify-between bg-nemilink-lavender px-4 py-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-5xl items-center">
        <Brand />
      </header>

      <section className="mx-auto my-6 w-full max-w-[420px] rounded-3xl border border-[#e7e5fb] bg-white p-8 text-center shadow-lg shadow-indigo-950/5">
        {error ? (
          <>
            <div className="text-[11px] font-bold tracking-[0.16em] text-nemilink-coral uppercase">
              Sign-in blocked
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-nemilink-navy">
              Could not sign you in
            </h1>
            <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-xs leading-relaxed font-semibold text-rose-700">
              {error}
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block rounded-2xl bg-nemilink-navy px-5 py-3 text-sm font-bold text-white no-underline transition hover:opacity-95"
            >
              Back to Sign in
            </Link>
          </>
        ) : (
          <>
            <div className="text-[11px] font-bold tracking-[0.16em] text-nemilink-coral uppercase">
              Microsoft SSO
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-nemilink-navy">
              Signing you in…
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Verifying your company Microsoft account with Nemilink.
            </p>
          </>
        )}
      </section>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Nemilink Technologies Pvt Ltd
      </footer>
    </main>
  );
}

