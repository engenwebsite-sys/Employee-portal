import Brand from "./Brand";

export default function PageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f8fafc] p-4 text-center antialiased" role="status" aria-live="polite">
      <Brand />
      <div className="mt-5 h-1 w-28 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-12 rounded-full bg-[#ff3366] animate-pulse" />
      </div>
      <p className="mt-2 text-xs font-medium text-slate-400">Loading workspace...</p>
    </div>
  );
}
