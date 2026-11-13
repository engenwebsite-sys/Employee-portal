export function NemilinkEmblem({ className = "h-7 w-auto shrink-0" }) {
  return (
    <img
      src="/nemilink-emblem.png"
      alt="Nemilink Emblem"
      className={`${className} object-contain`}
      loading="eager"
    />
  );
}

export default function Brand({ compact = false }) {
  if (compact) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50/80 border border-slate-200/80 transition hover:bg-slate-100 hover:border-slate-300">
        <img
          src="/nemilink-emblem.png"
          alt="Nemilink Emblem"
          className="h-5 w-auto object-contain"
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <img
        src="/nemilink-logo-clean.png"
        alt="Nemilink Technologies Pvt Ltd"
        className="h-8.5 w-auto object-contain max-w-[210px]"
        loading="eager"
      />
    </div>
  );
}
