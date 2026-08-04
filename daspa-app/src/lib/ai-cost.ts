/**
 * Cout des appels a Claude, calcule a partir des tokens reellement consommes.
 *
 * Les tokens viennent de l'en-tete `X-Daspalecte-Usage` que pose la Cloud
 * Function, remontent par un evenement `ai_call` et sont stockes tels quels.
 * Le prix, lui, n'est PAS stocke : les tarifs changent, et un tarif figé dans
 * la base rendrait tout l'historique faux le jour d'une revision. On garde les
 * tokens (un fait) et on recalcule le cout a l'affichage (une convention).
 */

/** Prix en dollars par million de tokens. */
export interface ModelPricing {
  input: number;
  output: number;
  /** Ecriture de cache : 1,25x le prix d'entree (TTL 5 minutes). */
  cacheWrite: number;
  /** Lecture de cache : 0,1x le prix d'entree. */
  cacheRead: number;
}

/**
 * Tarifs Anthropic par modele. `claude-sonnet-4-5` est celui qu'appelle la
 * Cloud Function (`cloud-function/index.js`) ; si le backend change de modele,
 * ajouter la ligne ici, sinon le cout retombe sur le tarif par defaut.
 */
export const AI_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-5": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
};

/** Applique quand le modele renvoye est inconnu — evite un cout de zero, qui se lirait comme « gratuit ». */
const FALLBACK_PRICING: ModelPricing = AI_PRICING["claude-sonnet-4-5"];

/**
 * Les identifiants renvoyes par l'API portent un suffixe de date
 * (`claude-sonnet-4-5-20250929`). On le retire pour retrouver la famille.
 */
export function pricingFor(model: string | null): ModelPricing {
  if (!model) return FALLBACK_PRICING;
  const family = model.replace(/-\d{8}$/, "");
  return AI_PRICING[family] ?? FALLBACK_PRICING;
}

export interface TokenTally {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

const PER_MILLION = 1_000_000;

/** Cout en dollars d'un lot de tokens pour un modele donne. */
export function costOf(tokens: TokenTally, model: string | null): number {
  const price = pricingFor(model);
  return (
    (tokens.inputTokens * price.input +
      tokens.outputTokens * price.output +
      tokens.cacheReadTokens * price.cacheRead +
      tokens.cacheWriteTokens * price.cacheWrite) /
    PER_MILLION
  );
}

/**
 * Formate un cout en dollars. Les montants sont minuscules (un appel coute de
 * l'ordre du dixieme de centime) : afficher « 0,00 $ » ferait croire a une
 * erreur, d'ou les quatre decimales sous un cent.
 */
export function formatCost(dollars: number): string {
  if (dollars === 0) return "0 $";
  if (dollars < 0.01) return `${dollars.toFixed(4).replace(".", ",")} $`;
  return `${dollars.toFixed(2).replace(".", ",")} $`;
}

/** Libelles des actions du backend, pour l'affichage. */
export const AI_ACTION_LABELS: Record<string, string> = {
  summarize: "Aide à la compréhension",
  generate_exercises: "Génération d’exercices",
  generate_comprehension_test: "Test de lecture",
  analyze_screenshot: "Capture et lecture",
  verify_sentence: "Vérification de phrase",
  verify_tags_answers: "Vérification des étiquettes",
};

export function labelForAction(action: string): string {
  return AI_ACTION_LABELS[action] ?? action;
}
