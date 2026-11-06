import "server-only";

/**
 * The two places a model earns its keep, and the hard line between them.
 *
 * **Embeddings decide who is worth showing.** Free text is where the
 * specific, interesting things live — "warehouse automation", "a CTO who
 * has shipped hardware" — and exact-string matching finds none of it:
 * "factory robotics" and "warehouse automation" are the same answer
 * written twice and scored as nothing in common. A vector finds that.
 *
 * **A model writes the opening line and nothing else.** It never invents
 * a reason two people match: the reason is still computed from what they
 * actually ticked and typed, and the model is handed those facts and asked
 * to phrase them. That distinction is the product's whole premise — a
 * reason you can check — and it does not survive a model deciding *why*
 * anybody should meet.
 *
 * Both degrade to nothing. No key is a perfectly valid deployment: the
 * deterministic matcher and the templated opener are what runs, exactly as
 * before, and the only thing missing is the extra recall. Same contract as
 * the email and blob integrations — never hard-depend on a credential
 * nobody has set up yet.
 */

/**
 * One key, both jobs. OpenRouter routes the chat model and proxies
 * OpenAI's embeddings endpoint, which keeps this to a single credential
 * and a single vendor relationship — worth more at this size than
 * shaving a few milliseconds off by going direct.
 */
const KEY = process.env.OPENROUTER_API_KEY ?? "";
const BASE = "https://openrouter.ai/api/v1";

/** Truncatable by design — see the migration for why 256 and not 1536. */
export const EMBED_DIMS = 256;
const EMBED_MODEL = "openai/text-embedding-3-small";
const WRITE_MODEL = "anthropic/claude-haiku-4.5";

export const canEmbed = Boolean(KEY);
export const canWrite = Boolean(KEY);

/** Identifies this app to OpenRouter, which is how its dashboard breaks down spend. */
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${KEY}`,
  "HTTP-Referer": "https://www.opennetworks.in",
  "X-Title": "OpenNetworks",
});

/**
 * Everything about a person that carries meaning, as one string.
 *
 * Only the fields the matcher is allowed to reason about. A bio can say
 * anything and a location says where somebody is, not what they want —
 * including either would make "similar" mean "writes like me" or "lives
 * near me", both of which this product already answers better elsewhere.
 */
export function signalText(p: {
  headline?: string | null;
  workingOn?: string | null;
  lookingFor?: readonly string[] | null;
  canHelpWith?: readonly string[] | null;
  interests?: readonly string[] | null;
  customLookingFor?: readonly string[] | null;
  customCanHelpWith?: readonly string[] | null;
  customInterests?: readonly string[] | null;
}): string {
  const list = (xs?: readonly string[] | null) => (xs ?? []).filter(Boolean).join(", ");
  return [
    p.headline,
    p.workingOn ? `Working on ${p.workingOn}` : "",
    `Needs: ${list(p.lookingFor)} ${list(p.customLookingFor)}`.trim(),
    `Offers: ${list(p.canHelpWith)} ${list(p.customCanHelpWith)}`.trim(),
    `Interested in: ${list(p.interests)} ${list(p.customInterests)}`.trim(),
  ]
    .filter((s) => s && s.trim() && !/^(Needs|Offers|Interested in):$/.test(s.trim()))
    .join(". ")
    .slice(0, 1200);
}

/** One vector, or null on any failure. Callers must treat null as normal. */
export async function embed(text: string): Promise<number[] | null> {
  if (!canEmbed || !text.trim()) return null;
  try {
    const res = await fetch(`${BASE}/embeddings`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model: EMBED_MODEL, input: text, dimensions: EMBED_DIMS }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.error("[ai] embed failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const v = data?.data?.[0]?.embedding;
    return Array.isArray(v) && v.length === EMBED_DIMS ? v : null;
  } catch (err) {
    console.error("[ai] embed threw", err);
    return null;
  }
}

export type OpenerContext = {
  theirName: string;
  /**
   * The overlaps, already established by the matcher, as plain statements.
   *
   * The *only* thing the model is told. Their headline and what they are
   * working on used to be in here as colour, and that is precisely what
   * it embellished from: given "I offer sales and go-to-market" next to
   * her headline it wrote "I'm building go-to-market strategy for a
   * payments product", which is a sentence about the sender that nobody
   * had said. Removing the context cost a little warmth and removed the
   * whole fabrication surface.
   */
  facts: string[];
};

/**
 * One sentence somebody could actually send, or null.
 *
 * Grounded hard: the prompt carries the overlaps the deterministic matcher
 * already found and forbids anything else. A fluent, plausible, invented
 * reason is worse here than a blunt true one — the person receiving it can
 * see their own profile and will know.
 */
export async function writeOpener(ctx: OpenerContext): Promise<string | null> {
  if (!canWrite || ctx.facts.length === 0) return null;
  const prompt = [
    `Draft the opening message of a note to ${ctx.theirName}, a stranger on a professional networking app.`,
    "",
    "These are the only true things you know. You know nothing else about either person:",
    ...ctx.facts.map((f) => `- ${f}`),
    "",
    `Begin with "Hi ${ctx.theirName} —". One or two short sentences, first person. Name the thing in common, then ask a question or make an offer they can reply to.`,
    "",
    "Strict rules:",
    "- Every clause must be traceable to a fact above. Invent nothing about either person's job, company, product or history.",
    '- Never strengthen a fact. "interested in X" is not "works in X" or "builds X".',
    "- Do not say you noticed, saw, came across, or were impressed. State the thing plainly.",
    "- No flattery, no exclamation marks, no em-dashes except the greeting.",
    "- Plain British English, under 35 words. Output the message only.",
  ].join("\n");

  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: WRITE_MODEL,
        max_tokens: 120,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[ai] opener failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    // A model that ignored the brief and wrote an essay is a failure, not
    // something to truncate into the box and hope.
    if (!text || text.length > 400) return null;
    return text.replace(/^["“]|["”]$/g, "").trim();
  } catch (err) {
    console.error("[ai] opener threw", err);
    return null;
  }
}
