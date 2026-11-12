import { Link } from "react-router-dom";
import Brand from "../components/Brand";

export default function Forbidden() {
  return (
    <main className="grid min-h-dvh place-items-center bg-nemilink-lavender p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <Brand />
        <h1 className="text-3xl font-bold text-nemilink-navy">You don't have access to this page</h1>
        <p className="text-sm text-gray-500">Ask HR if you think this is a mistake.</p>
        <Link className="font-semibold text-nemilink-coral" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
