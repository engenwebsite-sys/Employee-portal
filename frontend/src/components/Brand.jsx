export function EngenEmblem({ className = "h-7 w-auto shrink-0" }) {
  return (
    <img
      src="/engen-emblem.png"
      alt="Engen Emblem"
      className={`${className} object-contain`}
      loading="eager"
    />
  );
}

// Keep NemilinkEmblem alias for backwards compatibility
export const NemilinkEmblem = EngenEmblem;

export default function Brand({ compact = false }) {
  if (compact) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50/80 border border-slate-200/80 transition hover:bg-slate-100 hover:border-slate-300">
        <img
          src="/engen-emblem.png"
          alt="Engen Emblem"
          className="h-6 w-auto object-contain"
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <img
        src="/engen-logo.png"
        alt="Engen - Scaling Heights"
        className="h-9 w-auto object-contain max-w-[195px]"
        loading="eager"
      />
    </div>
  );
}
