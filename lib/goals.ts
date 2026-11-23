/**
 * "What brings you here?" — onboarding's one question about intent.
 *
 * A goal is one tap that stands for things the matcher already understands:
 * it sets what you're looking for, and sometimes what you can obviously
 * help with (somebody hiring can help people looking for a role). Nothing
 * new is stored — goals are read back from `lookingFor` / `canHelpWith`.
 *
 * Suggestions come from what people have already told us — the headline
 * and company — so the next two questions are a tick, not a blank. They are
 * offered, never pre-ticked: a profile that claims things somebody didn't
 * mean produces confident, useless introductions.
 */

export type Goal = {
  id: string;
  emoji: string;
  label: string;
  lookingFor: string[];
  /** What this goal means you can obviously help with — pre-ticked, since it's implied by what you picked. */
  canHelpWith: string[];
};

export const GOALS: Goal[] = [
  { id: "hiring", emoji: "💼", label: "Hiring", lookingFor: ["hiring"], canHelpWith: ["role"] },
  { id: "job", emoji: "🔎", label: "Finding a job", lookingFor: ["role"], canHelpWith: [] },
  { id: "raising", emoji: "💰", label: "Raising money", lookingFor: ["funding"], canHelpWith: [] },
  { id: "investing", emoji: "📈", label: "Investing", lookingFor: ["peers"], canHelpWith: ["funding"] },
  { id: "cofounder", emoji: "🤝", label: "Finding a co-founder", lookingFor: ["cofounder"], canHelpWith: [] },
  { id: "customers", emoji: "🛒", label: "Finding customers", lookingFor: ["gtm"], canHelpWith: [] },
  { id: "advice", emoji: "🧭", label: "Advice & mentoring", lookingFor: ["advice"], canHelpWith: [] },
  { id: "peers", emoji: "🌱", label: "Meeting people in my field", lookingFor: ["peers"], canHelpWith: [] },
];

export const MAX_GOALS = 2;

/** Which goals a saved profile already amounts to (for resuming and re-editing). */
export function goalsFrom(lookingFor: readonly string[], canHelpWith: readonly string[]): string[] {
  return GOALS.filter((g) => {
    if (g.id === "investing") return canHelpWith.includes("funding");
    if (g.id === "peers") return lookingFor.includes("peers") && !canHelpWith.includes("funding");
    return g.lookingFor.every((t) => lookingFor.includes(t));
  })
    .map((g) => g.id)
    .slice(0, MAX_GOALS);
}

/** The profile lists a set of goals stands for. */
export function fromGoals(ids: readonly string[]): { lookingFor: string[]; canHelpWith: string[] } {
  const picked = GOALS.filter((g) => ids.includes(g.id));
  const uniq = (xs: string[]) => [...new Set(xs)];
  return { lookingFor: uniq(picked.flatMap((g) => g.lookingFor)), canHelpWith: uniq(picked.flatMap((g) => g.canHelpWith)) };
}

/** Words in a headline or company → what that person can probably help with. */
const HELP_HINTS: [RegExp, string][] = [
  [/\b(engineer|developer|dev|cto|software|backend|frontend|full[- ]?stack|ml|data scien|architect|tech lead)/i, "technical"],
  [/\b(design|ux|ui|product manager|\bpm\b|product)/i, "product"],
  [/\b(sales|business development|\bbd\b|account exec|gtm|go[- ]to[- ]market|partnerships)/i, "gtm"],
  [/\b(marketing|growth|brand|content|seo|community|social media)/i, "growth"],
  [/\b(recruit|talent|\bhr\b|people ops|human resources)/i, "hiring"],
  [/\b(investor|\bvc\b|angel|venture|capital|fund)/i, "funding"],
  [/\b(founder|ceo|director|head of|\bvp\b|lead|manager|coach|mentor|consultant|advisor)/i, "advice"],
];

/** Words → interests (sectors). */
const SECTOR_HINTS: [RegExp, string][] = [
  [/\b(fintech|bank|payment|lending|insur|finance|crypto|web3)/i, "fintech"],
  [/\b(\bai\b|machine learning|\bml\b|data|llm|genai|analytics)/i, "ai"],
  [/\b(climate|energy|solar|\bev\b|electric vehicle|sustainab|carbon)/i, "climate"],
  [/\b(health|medic|doctor|pharma|bio|clinic|hospital|wellness)/i, "health"],
  [/\b(retail|d2c|consumer|e-?commerce|fmcg|fashion|food)/i, "consumer"],
  [/\b(saas|b2b|enterprise|cloud|devtools|platform)/i, "saas"],
  [/\b(design|brand|creative|ux|ui)/i, "design"],
  [/\b(edtech|education|teacher|school|universit|learning|student)/i, "education"],
  [/\b(media|creator|content|film|journalis|writer|podcast|youtube)/i, "media"],
  [/\b(hardware|robot|semiconductor|deep ?tech|iot|drone|aerospace|space)/i, "deeptech"],
  [/\b(ngo|non-?profit|impact|social|foundation)/i, "social"],
  [/\b(game|gaming|esports)/i, "gaming"],
];

const match = (text: string, hints: [RegExp, string][], max: number) => {
  const out: string[] = [];
  for (const [re, id] of hints) if (re.test(text) && !out.includes(id)) out.push(id);
  return out.slice(0, max);
};

/** Suggested "can help with" topics and interests for this person, best first. */
export function suggestFor(headline: string, company: string, goals: readonly string[]): { help: string[]; interests: string[] } {
  const text = `${headline} ${company}`;
  const implied = fromGoals(goals).canHelpWith;
  const help = [...new Set([...implied, ...match(text, HELP_HINTS, 4), "peers"])].slice(0, 4);
  const interests = match(text, SECTOR_HINTS, 3);
  return { help, interests };
}
