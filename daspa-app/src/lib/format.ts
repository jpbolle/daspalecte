const DATE = new Intl.DateTimeFormat("fr-BE", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("fr-BE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const RELATIVE = new Intl.RelativeTimeFormat("fr-BE", { numeric: "auto" });

export function formatDate(ms: number): string {
  return DATE.format(ms);
}

export function formatDateTime(ms: number): string {
  return DATE_TIME.format(ms);
}

/** « aujourd'hui », « il y a 3 jours »… puis la date au-dela d'un mois. */
export function formatSince(ms: number, now = Date.now()): string {
  const days = Math.round((ms - now) / 86_400_000);
  if (days > -31) return RELATIVE.format(days, "day");
  return formatDate(ms);
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`;
}

const NUMBER = new Intl.NumberFormat("fr-BE");

/** Grands nombres (tokens) avec separateur de milliers. */
export function formatNumber(value: number): string {
  return NUMBER.format(Math.round(value));
}
