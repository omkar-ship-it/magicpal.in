import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ARCHETYPES, type ArchetypeId } from "./archetypes";
import { OUTCOMES, type Comparison } from "./compare";
import type { Answers } from "./score";
import { ArchetypeMark } from "./symbols";

/**
 * The share cards, as next/og elements. Story-sized (1080×1920) for the
 * images people post, and 1200×630 for the link preview WhatsApp draws when
 * a link is pasted — which is the first impression for everyone who didn't
 * play, so it gets designed as carefully as the card.
 *
 * Satori rules apply: flexbox only, every element with more than one child
 * needs display:flex, no classes.
 */

export const BRAND = "#FF6B4A";
const CREAM = "#FAF7F5";
const INK = "#241A16";

let fontCache: { name: string; data: ArrayBuffer; weight: 500 | 800; style: "normal" }[] | null = null;
export async function cardFonts() {
  if (fontCache) return fontCache;
  const dir = join(process.cwd(), "assets/brain-mate");
  const [regular, heavy] = await Promise.all([
    readFile(join(dir, "inter-latin-500-normal.woff")),
    readFile(join(dir, "inter-latin-800-normal.woff")),
  ]);
  const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  fontCache = [
    { name: "Inter", data: ab(regular), weight: 500, style: "normal" },
    { name: "Inter", data: ab(heavy), weight: 800, style: "normal" },
  ];
  return fontCache;
}

const short = (id: ArchetypeId) => ARCHETYPES[id].name.replace("The ", "");

function Frame({ bg, children, label, right, ink = INK, edge = BRAND }: { bg: string; children: React.ReactNode; label: string; right?: string; ink?: string; edge?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: bg, padding: 44, fontFamily: "Inter" }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: 56,
          border: `6px solid ${edge}`,
          padding: "52px 60px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              background: BRAND,
              color: "#fff",
              fontWeight: 800,
              fontSize: 30,
              letterSpacing: 2,
              padding: "10px 22px",
              borderRadius: 999,
            }}
          >
            {label}
          </div>
          {right ? <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: 3, color: ink }}>{right}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Your archetype card, in OpenNetworks' own look: cream, a coral frame, the
 * archetype's colour only on its mark. Name, tagline, three strengths, the
 * superpower — nothing more. (`colleague`, `rarity`, `mix` and `answers`
 * are accepted for older callers but no longer drawn: less is the point.)
 */
export function IdentityCard({
  name,
  archetype,
  site,
  strengths,
}: {
  mix?: { id: ArchetypeId; pct: number }[];
  /** The person's own top three strengths — shown instead of generic traits. */
  strengths?: string[];
  name: string;
  archetype: ArchetypeId;
  streak?: ArchetypeId;
  answers?: Answers;
  rarity?: number | null;
  site: string;
  colleague?: boolean;
}) {
  const a = ARCHETYPES[archetype];
  const SOFT = "#7A6B63";
  return (
    <Frame bg={CREAM} label="BRAIN-MATE" right={name.split(" ")[0].toUpperCase()}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, color: INK }}>
        <div style={{ display: "flex", flex: 1 }} />
        <div
          style={{
            display: "flex",
            width: 360,
            height: 360,
            borderRadius: 999,
            background: a.color,
            alignItems: "center",
            justifyContent: "center",
            border: `22px solid ${a.tint}`,
          }}
        >
          <ArchetypeMark id={archetype} color={a.ink} size={200} stroke={5} />
        </div>
        <div style={{ display: "flex", fontSize: 34, letterSpacing: 6, fontWeight: 800, color: SOFT, marginTop: 70 }}>{`${name.split(" ")[0].toUpperCase()} IS`}</div>
        <div style={{ display: "flex", fontSize: 118, fontWeight: 800, letterSpacing: -4, marginTop: 6 }}>{a.name}</div>
        <div style={{ display: "flex", fontSize: 46, marginTop: 10, color: SOFT }}>{a.tagline}</div>
        <div style={{ display: "flex", width: 90, height: 6, borderRadius: 3, background: BRAND, marginTop: 64 }} />
        <div style={{ display: "flex", fontSize: 52, fontWeight: 800, marginTop: 56, textAlign: "center", maxWidth: 820, lineHeight: 1.25 }}>
          {`“${a.superpower}”`}
        </div>
        <div style={{ display: "flex", marginTop: 60, gap: 18 }}>
          {(strengths?.length ? strengths : a.traits).map((t) => (
            <div key={t} style={{ display: "flex", padding: "14px 30px", borderRadius: 999, background: "#F1E9E4", fontSize: 32, fontWeight: 800 }}>
              {t}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignSelf: "stretch", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>What are you? Find your Brain-Mate</div>
            <div style={{ display: "flex", fontSize: 30, color: SOFT, marginTop: 6 }}>{`${site}/brain-mate  ·  by OpenNetworks`}</div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** The Wavelength card: two people, one relationship. */
export function CompareCard({ c, site, slug }: { c: Comparison; site: string; slug: string }) {
  const A = ARCHETYPES[c.a.archetype];
  const B = ARCHETYPES[c.b.archetype];
  const o = OUTCOMES[c.outcome];
  const person = (name: string, id: ArchetypeId) => {
    const x = ARCHETYPES[id];
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 400 }}>
        <div
          style={{ display: "flex", width: 260, height: 260, borderRadius: 999, background: x.color, alignItems: "center", justifyContent: "center" }}
        >
          <ArchetypeMark id={id} color={x.ink} size={170} />
        </div>
        <div style={{ display: "flex", fontSize: 58, fontWeight: 800, marginTop: 22 }}>{name.toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: 36, color: x.color, fontWeight: 800 }}>{short(id)}</div>
      </div>
    );
  };
  return (
    <Frame bg={CREAM} label="YOUR WAVELENGTH">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, color: INK }}>
        <div style={{ display: "flex", marginTop: 70, alignItems: "center" }}>
          {person(c.a.name, A.id)}
          <div style={{ display: "flex", fontSize: 80, fontWeight: 800, color: BRAND, marginTop: -60 }}>{"×"}</div>
          {person(c.b.name, B.id)}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 70,
            background: o.color,
            color: "#fff",
            fontSize: 74,
            fontWeight: 800,
            padding: "18px 44px",
            borderRadius: 28,
            letterSpacing: 1,
          }}
        >
          {o.label.toUpperCase()}
        </div>
        <div style={{ display: "flex", fontSize: 38, marginTop: 22, color: "#7A6B63" }}>{o.stamp}</div>
        <div style={{ display: "flex", fontSize: 52, fontWeight: 800, marginTop: 90, textAlign: "center", maxWidth: 860, lineHeight: 1.2 }}>
          {`“${c.dynamic}”`}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignSelf: "stretch", marginTop: 80, gap: 22, fontSize: 34, color: "#5A4A42" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, fontWeight: 800, color: BRAND }}>WHAT WE LOVE ABOUT EACH OTHER</div>
          <div style={{ display: "flex" }}>{c.loves.aSees}</div>
          <div style={{ display: "flex" }}>{c.loves.bSees}</div>
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignSelf: "stretch", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>Find your Brain-Mate</div>
            <div style={{ display: "flex", fontSize: 30, color: "#7A6B63", marginTop: 6 }}>{`${site}/brain-mate/${slug}  ·  by OpenNetworks`}</div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/**
 * Link preview while waiting — what WhatsApp draws under the message. In
 * OpenNetworks' own look: two initials joined by a wave, the invitation in
 * big type, and the twelve minds along the bottom as the tease.
 */
export function InvitePreview({ sender, recipient }: { sender: string; recipient: string }) {
  const SOFT = "#7A6B63";
  const ids = Object.keys(ARCHETYPES) as ArchetypeId[];
  const wave = (() => {
    let d = "";
    for (let x = 0; x <= 150; x += 3) d += `${x === 0 ? "M" : "L"} ${x} ${(40 + 18 * Math.sin((x / 150) * Math.PI * 3)).toFixed(1)} `;
    return d;
  })();
  const initial = (name: string, filled: boolean) => (
    <div
      style={{
        display: "flex",
        width: 150,
        height: 150,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        fontSize: 72,
        fontWeight: 800,
        color: filled ? "#fff" : BRAND,
        background: filled ? `linear-gradient(135deg, ${BRAND}, #E0266B)` : "#fff",
        border: filled ? "none" : `6px dashed ${BRAND}`,
      }}
    >
      {filled ? name.charAt(0).toUpperCase() : "?"}
    </div>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, padding: 30, fontFamily: "Inter", color: INK }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: 40,
          background: "#fff",
          border: `4px solid ${BRAND}`,
          padding: "40px 54px 36px",
        }}
      >
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {initial(sender, true)}
            <svg width="150" height="80" viewBox="0 0 150 80" xmlns="http://www.w3.org/2000/svg">
              <path d={wave} stroke={BRAND} strokeWidth="6" fill="none" strokeLinecap="round" />
            </svg>
            {initial(recipient, false)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 4, color: BRAND }}>{`BRAIN-MATE · FOR ${recipient.toUpperCase()}`}</div>
            <div style={{ display: "flex", fontSize: 58, fontWeight: 800, marginTop: 12, lineHeight: 1.06, letterSpacing: -1.5 }}>
              {`${sender} wants to find your Wavelength`}
            </div>
            <div style={{ display: "flex", fontSize: 28, marginTop: 16, color: SOFT }}>{`Play 3 minutes — then see how you two click.`}</div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {ids.map((id) => (
              <div
                key={id}
                style={{ display: "flex", width: 44, height: 44, borderRadius: 999, background: ARCHETYPES[id].color, alignItems: "center", justifyContent: "center" }}
              >
                <ArchetypeMark id={id} color={ARCHETYPES[id].ink} size={26} stroke={8} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: SOFT }}>Which of 12 minds are you?</div>
        </div>
      </div>
    </div>
  );
}

/** Link preview once finished: the pair at a glance. */
export function CompareWide({ c }: { c: Comparison }) {
  const o = OUTCOMES[c.outcome];
  const dot = (id: ArchetypeId) => (
    <div
      style={{
        display: "flex",
        width: 190,
        height: 190,
        borderRadius: 999,
        background: ARCHETYPES[id].color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ArchetypeMark id={id} color={ARCHETYPES[id].ink} size={120} />
    </div>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, padding: 36, fontFamily: "Inter", color: INK }}>
      <div style={{ flex: 1, display: "flex", borderRadius: 40, border: `5px solid ${BRAND}`, padding: 50, alignItems: "center", gap: 40 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {dot(c.a.archetype)}
          <div style={{ display: "flex", marginLeft: -30 }}>{dot(c.b.archetype)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 3, color: BRAND }}>
            {`${c.a.name.toUpperCase()} × ${c.b.name.toUpperCase()}`}
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: o.color, marginTop: 6 }}>{o.label}</div>
          <div style={{ display: "flex", fontSize: 30, marginTop: 6, color: "#7A6B63" }}>{o.stamp}</div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, marginTop: 18 }}>{`“${c.dynamic}”`}</div>
        </div>
      </div>
    </div>
  );
}

/** Link preview for the landing page itself. */
export function LandingWide() {
  const ids: ArchetypeId[] = ["dreamer", "detective", "spark", "connector", "creator", "doer"];
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, padding: 36, fontFamily: "Inter", color: INK }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRadius: 40, border: `5px solid ${BRAND}`, padding: 56 }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 3, color: BRAND }}>BRAIN-MATE</div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, letterSpacing: -3, marginTop: 10 }}>Find your Brain-Mate</div>
        <div style={{ display: "flex", fontSize: 36, marginTop: 10, color: "#7A6B63" }}>12 kinds of minds. Which one is yours? About 3 minutes.</div>
        <div style={{ display: "flex", gap: 22, marginTop: 50 }}>
          {ids.map((id) => (
            <div
              key={id}
              style={{
                display: "flex",
                width: 120,
                height: 120,
                borderRadius: 999,
                background: ARCHETYPES[id].color,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArchetypeMark id={id} color={ARCHETYPES[id].ink} size={78} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function siteFrom(req: Request | null, fallbackHost?: string | null): string {
  const host = req ? new URL(req.url).host : fallbackHost;
  return (host ?? "opennetworks.in").replace(/^www\./, "");
}
