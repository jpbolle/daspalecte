/* eslint-disable @next/next/no-img-element */

/**
 * Les photos de profil viennent de googleusercontent.com. On les sert en <img>
 * plutot qu'en next/image : ce sont de petites vignettes, et l'optimiseur
 * exigerait une allowlist de domaines pour un gain nul a cette taille.
 */
export function Avatar({
  name,
  src,
  className = "size-9",
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className={`${className} shrink-0 rounded-full border border-line object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-element text-[0.8125rem] font-semibold text-primary`}
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
