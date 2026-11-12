export function NemilinkEmblem({ className = "h-7 w-auto shrink-0" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 44 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Top Slate / Navy Chevron */}
      <polygon points="14,2 42,2 34,12 6,12" fill="#1e293b" />
      {/* Bottom Coral / Red Accent Chevron */}
      <polygon points="8,14 36,14 28,24 0,24" fill="#ea384d" />
    </svg>
  );
}

export default function Brand({ compact = false }) {
  if (compact) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/80 transition hover:bg-slate-100">
        <NemilinkEmblem className="h-4.5 w-auto" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <NemilinkEmblem className="h-7 w-auto" />
      <div className="flex flex-col leading-none">
        <span className="text-[17px] font-extrabold tracking-tight text-[#16192e]">
          Nemilink
        </span>
        <span className="mt-1 text-[8.5px] font-bold tracking-widest text-[#ea384d] uppercase">
          Technologies Pvt Ltd
        </span>
      </div>
    </div>
  );
}
