import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../components/Brand";
import { useAuth } from "../context/AuthContext";

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const firstLogin = user?.must_change_password;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (next !== confirm) return setError("The new passwords do not match.");
    setSubmitting(true);
    try {
      await changePassword(current, next);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-nemilink-lavender p-6">
      <div className="login-card" style={{ margin: 0 }}>
        <Brand />
        <span className="section-label" style={{ display: "block", marginTop: 28 }}>
          {firstLogin ? "FIRST SIGN-IN" : "ACCOUNT SECURITY"}
        </span>
        <h2>{firstLogin ? "Set your own password." : "Change password."}</h2>
        <p className="form-description">
          {firstLogin
            ? "You are using a temporary password. Choose a new one to continue."
            : "Use at least 8 characters, with a letter and a number."}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="current">{firstLogin ? "Temporary password" : "Current password"}</label>
            <input id="current" type="password" autoComplete="current-password" required
              value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="next">New password</label>
            <input id="next" type="password" autoComplete="new-password" required minLength={8}
              value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm new password</label>
            <input id="confirm" type="password" autoComplete="new-password" required
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>

          <button className="sign-in-button" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save and continue"}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="form-notice is-error" role="alert">{error}</p>
        </form>

        <div className="help-note">
          <p>
            Signed in as <strong>{user?.email}</strong>.{" "}
            <button type="button" onClick={logout} className="font-semibold text-nemilink-coral">
              Sign out
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
