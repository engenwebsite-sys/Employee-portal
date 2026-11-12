export default function Brand({ compact = false }) {
  if (compact) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-extrabold text-white shadow-xs">
        N
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-extrabold text-white shadow-xs">
        N
      </span>
      <div className="flex flex-col">
        <span className="text-base font-bold tracking-tight text-slate-900">
          Nemilink
        </span>
        <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
          Technologies
        </span>
      </div>
    </div>
  );
}
