import Link from "next/link";

/**
 * Action link — the bundle's mono UPPERCASE text action (the govCast row,
 * inner.html govern body): juniper mono label + juniper › chevron. Rows carry
 * rust chevrons; ACTIONS carry juniper — keep the distinction.
 */
function JuniperChevron() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#36563D"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

const actionClass =
  "inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function ActionLink({
  href,
  label,
  download,
}: {
  href: string;
  label: string;
  download?: boolean;
}) {
  // Plain <a> when downloading (Content-Disposition routes handle it).
  if (download) {
    return (
      <a href={href} download className={actionClass}>
        {label}
        <JuniperChevron />
      </a>
    );
  }
  return (
    <Link href={href} className={actionClass}>
      {label}
      <JuniperChevron />
    </Link>
  );
}
