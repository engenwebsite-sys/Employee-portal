import { Link } from "react-router-dom";
import Brand from "../components/Brand";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-nemilink-lavender p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <Brand />
        <h1 className="text-3xl font-bold text-nemilink-navy">Page not found</h1>
        <Link className="font-semibold text-nemilink-coral" to="/login">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
