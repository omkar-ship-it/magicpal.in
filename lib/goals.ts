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
  group: GoalGroup;
  lookingFor: string[];
  /** What this goal means you can obviously help with — pre-ticked, since it's implied by what you picked. */
  canHelpWith: string[];
  /**
   * Said in words too, when the goal is more specific than its topic —
   * "an internship" is more than "a new role". Stored with the person's
   * own phrases, which the matcher reads for meaning.
   */
  phrase?: string;
};

export type GoalGroup = "Career" | "Building something" | "Business & clients" | "Hiring & giving back" | "People & community";
export const GOAL_GROUPS: GoalGroup[] = ["Career", "Building something", "Business & clients", "Hiring & giving back", "People & community"];

const g = (id: string, emoji: string, label: string, group: GoalGroup, lookingFor: string[], canHelpWith: string[] = [], phrase?: string): Goal => ({
  id,
  emoji,
  label,
  group,
  lookingFor,
  canHelpWith,
  phrase,
});

export const GOALS: Goal[] = [
  // Career
  g("job", "🔎", "Finding a job", "Career", ["role"]),
  g("switch", "🔁", "Switching careers", "Career", ["role", "advice"], [], "Switching careers"),
  g("intern", "🎓", "Internship or first job", "Career", ["role", "advice"], [], "An internship or first job"),
  g("freelance", "💻", "Freelance or gig work", "Career", ["gtm"], [], "Freelance projects"),
  g("mentor-me", "🧭", "A mentor or career advice", "Career", ["advice"]),
  g("learn", "📚", "Learning a new skill", "Career", ["advice", "peers"], [], "Learning a new skill"),
  // Building something
  g("start", "🚀", "Starting a company", "Building something", ["cofounder", "advice"], [], "Starting a company"),
  g("cofounder", "🤝", "Finding a co-founder", "Building something", ["cofounder"]),
  g("raising", "💰", "Raising money", "Building something", ["funding"]),
  g("tech", "🛠️", "Tech help to build", "Building something", ["technical"]),
  g("feedback", "🧪", "Product feedback or testers", "Building something", ["product"]),
  g("side", "💡", "A side project", "Building something", ["peers", "technical"], [], "Collaborators for a side project"),
  // Business & clients
  g("customers", "🛒", "Finding customers", "Business & clients", ["gtm"]),
  g("clients", "🧾", "Finding clients for my practice", "Business & clients", ["gtm"], [], "Clients for my practice"),
  g("growth", "📣", "Growing my brand or audience", "Business & clients", ["growth"]),
  g("partners", "🔗", "Partners or distributors", "Business & clients", ["gtm", "market"], [], "Business partners"),
  g("suppliers", "📦", "Suppliers or service providers", "Business & clients", ["market"], [], "Suppliers and service providers"),
  g("market", "🌍", "Entering a new market or city", "Business & clients", ["market"]),
  // Hiring & giving back
  g("hiring", "💼", "Hiring", "Hiring & giving back", ["hiring"], ["role"]),
  g("talent", "👩‍💻", "Freelancers or an agency", "Hiring & giving back", ["hiring"], [], "Freelancers or an agency"),
  g("investing", "📈", "Investing / angel deals", "Hiring & giving back", ["peers"], ["funding"], "Deal flow"),
  g("mentoring", "🧑‍🏫", "Mentoring others", "Hiring & giving back", ["peers"], ["advice"]),
  g("advising", "🎯", "Advising startups", "Hiring & giving back", ["peers"], ["advice", "gtm"], "Startups to advise"),
  g("volunteer", "❤️", "Volunteering or social impact", "Hiring & giving back", ["peers"], [], "Social impact projects"),
  // People & community
  g("peers", "🌱", "Meeting people in my field", "People & community", ["peers"]),
  g("new", "🏙️", "New in town — meeting people", "People & community", ["peers"], [], "New in the city"),
  g("creative", "🎨", "Creative collaborators", "People & community", ["peers", "product"], [], "Creative collaborators"),
  g("research", "🔬", "Research collaborators", "People & community", ["peers", "technical"], [], "Research collaborators"),
  g("events", "🎟️", "Events and meetups", "People & community", ["peers"], [], "Events and meetups"),
  g("speaking", "🎤", "Speaking or hosting", "People & community", ["peers", "growth"], [], "Speaking and hosting"),
];

/** Picks allowed in "What brings you here?", counting anything typed. */
export const MAX_GOALS = 3;

const PHRASES = new Set(GOALS.flatMap((x) => (x.phrase ? [x.phrase.toLowerCase()] : [])));
/** A phrase that one of the goals wrote, as opposed to one the person typed. */
export const isGoalPhrase = (s: string) => PHRASES.has(s.trim().toLowerCase());

/** Which goals a saved profile already amounts to (for resuming and re-editing). */
export function goalsFrom(lookingFor: readonly string[], canHelpWith: readonly string[], custom: readonly string[] = []): string[] {
  const said = new Set(custom.map((c) => c.trim().toLowerCase()));
  const out: string[] = [];
  // Goals with their own phrase are known exactly.
  for (const x of GOALS) if (x.phrase && said.has(x.phrase.toLowerCase())) out.push(x.id);
  // The rest: when every topic they stand for is there, and nothing more specific already claimed it.
  const claimed = new Set(out.flatMap((id) => GOALS.find((x) => x.id === id)!.lookingFor));
  for (const x of GOALS) {
    if (x.phrase || out.length >= MAX_GOALS) continue;
    const fits = x.lookingFor.every((t) => lookingFor.includes(t)) && x.canHelpWith.every((t) => canHelpWith.includes(t));
    if (fits && !x.lookingFor.every((t) => claimed.has(t))) {
      out.push(x.id);
      x.lookingFor.forEach((t) => claimed.add(t));
    }
  }
  return out.slice(0, MAX_GOALS);
}

/** The profile lists a set of goals stands for. */
export function fromGoals(ids: readonly string[]): { lookingFor: string[]; canHelpWith: string[]; phrases: string[] } {
  const picked = GOALS.filter((x) => ids.includes(x.id));
  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    lookingFor: uniq(picked.flatMap((x) => x.lookingFor)),
    canHelpWith: uniq(picked.flatMap((x) => x.canHelpWith)),
    phrases: uniq(picked.flatMap((x) => (x.phrase ? [x.phrase] : []))),
  };
}

/** Words in a headline or company → what that person can probably help with. */
const HELP_HINTS: [RegExp, string][] = [
  [/\b(engineer|developer|dev|cto|software|backend|frontend|full[- ]?stack|ml|data scien|architect|tech lead)/i, "technical"],
  [/\b(design|ux|ui|product manager|\bpm\b|product)/i, "product"],
  [/\b(sales|business development|\bbd\b|account exec|gtm|go[- ]to[- ]market|partnerships)/i, "gtm"],
  [/\b(marketing|growth|brand|content|seo|community|social media)/i, "growth"],
  [/\b(recruit|talent|\bhr\b|people ops|human resources)/i, "hiring"],
  [/\b(investor|\bvc\b|angel|venture|capital|fund)/i, "funding"],
  [/\b(founder|ceo|director|head of|\bvp\b|lead|manager|coach|mentor|consultant|advisor|professor|teacher)/i, "advice"],
  [/\b(doctor|dr\.?\s|physician|surgeon|dermatolog|dentist|therapist|psycholog|lawyer|advocate|attorney|legal|chartered accountant|\bca\b|accountant|architect)/i, "advice"],
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
