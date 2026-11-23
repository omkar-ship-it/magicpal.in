import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ARCHETYPES, streakLine, type ArchetypeId } from "./archetypes";
import { OUTCOMES, type Comparison } from "./compare";
import { strandsFor, type Answers } from "./score";
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

function Strands({ answers, seed, size, color }: { answers: Answers; seed: string; size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      {strandsFor(answers, seed).map((s, i) => (
        <path
          key={i}
          d={s.d}
          stroke={color ?? s.color}
          strokeWidth={s.width}
          strokeOpacity={color ? 0.28 : s.opacity}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function Frame({ bg, children, label, right, ink = INK }: { bg: string; children: React.ReactNode; label: string; right?: string; ink?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: bg, padding: 44, fontFamily: "Inter" }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: 56,
          border: `6px solid ${BRAND}`,
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

/** Your Brain-Mate card. `colleague` swaps the roast for the work-safe blind spot. */
export function IdentityCard({
  name,
  archetype,
  streak,
  answers,
  rarity,
  site,
  colleague = false,
  mix,
  strengths,
}: {
  mix?: { id: ArchetypeId; pct: number }[];
  /** The person's own top three strengths — shown instead of generic traits. */
  strengths?: string[];
  name: string;
  archetype: ArchetypeId;
  streak: ArchetypeId;
  answers: Answers;
  rarity: number | null;
  site: string;
  colleague?: boolean;
}) {
  const a = ARCHETYPES[archetype];
  const ink = a.ink;
  const soft = ink === "#ffffff" ? "rgba(255,255,255,0.78)" : "rgba(42,30,0,0.72)";
  const chip = ink === "#ffffff" ? "rgba(255,255,255,0.16)" : "rgba(42,30,0,0.1)";
  return (
    <Frame bg={a.color} label="BRAIN-MATE" right={name.split(" ")[0].toUpperCase()} ink={a.ink}>
      <div style={{ display: "flex", color: ink, flexDirection: "column", alignItems: "center", flex: 1 }}>
        <div style={{ display: "flex", position: "relative", width: 560, height: 560, alignItems: "center", justifyContent: "center", marginTop: 10 }}>
          <div style={{ display: "flex", position: "absolute", top: 0, left: 0 }}>
            <Strands answers={answers} seed={name} size={560} color={ink} />
          </div>
          <div
            style={{
              display: "flex",
              width: 300,
              height: 300,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              background: chip,
            }}
          >
            <ArchetypeMark id={archetype} color={ink} size={210} stroke={5} />
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 104, fontWeight: 800, letterSpacing: -3, marginTop: 6 }}>{a.name.toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: 44, marginTop: 6, color: soft }}>{a.tagline}</div>
        {mix ? (
          <div style={{ display: "flex", fontSize: 30, marginTop: 10, color: soft, fontWeight: 800 }}>
            {mix.map((m) => `${m.pct}% ${short(m.id)}`).join("  ·  ")}
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 34, marginTop: 18, alignItems: "center" }}>
          {streakLine(streak)}
          {rarity !== null ? (
            <div style={{ display: "flex", marginLeft: 20, padding: "6px 18px", borderRadius: 999, background: chip, fontSize: 30, fontWeight: 800 }}>
              {`1 in ${Math.max(2, Math.round(1 / Math.max(rarity, 0.01)))}`}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", marginTop: 34, gap: 16 }}>
          {(strengths?.length ? strengths : a.traits).map((t) => (
            <div key={t} style={{ display: "flex", padding: "12px 24px", borderRadius: 999, background: chip, fontSize: 30, fontWeight: 800 }}>
              {t}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignSelf: "stretch", marginTop: 44, gap: 26 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, fontWeight: 800, color: soft }}>SUPERPOWER</div>
            <div style={{ display: "flex", fontSize: 42, fontWeight: 800, marginTop: 6 }}>{a.superpower}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, fontWeight: 800, color: soft }}>PEOPLE LOVE ME FOR</div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, marginTop: 6 }}>{a.lovedFor}</div>
          </div>
          {colleague ? null : (
            <div style={{ display: "flex", fontSize: 32, color: soft }}>{`Guilty habit 😅  ${a.roast}`}</div>
          )}
          <div style={{ display: "flex", fontSize: 34, color: soft }}>
            {`My Power Duo: ${short(a.powerDuo[0])}  ·  ${a.edge.kind === "clash" ? "I clash with" : "My opposite"}: ${short(a.edge.id)}`}
          </div>
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignSelf: "stretch", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>Find your Brain-Mates</div>
            <div style={{ display: "flex", fontSize: 32, color: soft, marginTop: 4 }}>{`${site}/brain-mate`}</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: soft }}>by OpenNetworks</div>
        </div>
      </div>
    </Frame>
  );
}

function Score({ value, label, color, ink }: { value: number; label: string; color: string; ink: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", fontSize: 150, fontWeight: 800, color, letterSpacing: -6, lineHeight: 1 }}>{String(value)}</div>
      <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: ink, marginTop: 8 }}>{label}</div>
    </div>
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
        <div style={{ display: "flex", marginTop: 70, gap: 120 }}>
          <Score value={c.similarity} label="Same wavelength" color={INK} ink="#7A6B63" />
          <Score value={c.compatibility} label="Compatibility" color={BRAND} ink="#7A6B63" />
        </div>
        <div style={{ display: "flex", fontSize: 48, fontWeight: 800, marginTop: 80, textAlign: "center", maxWidth: 860 }}>
          {`“${c.dynamic}”`}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignSelf: "stretch", marginTop: 50, gap: 14, fontSize: 32 }}>
          <div style={{ display: "flex" }}>{`💛 ${c.loves.aSees}`}</div>
          <div style={{ display: "flex" }}>{`💛 ${c.loves.bSees}`}</div>
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignSelf: "stretch", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>Find your Brain-Mates</div>
            <div style={{ display: "flex", fontSize: 30, color: "#7A6B63", marginTop: 4 }}>{`${site}/brain-mate/${slug}`}</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#7A6B63" }}>by OpenNetworks</div>
        </div>
      </div>
    </Frame>
  );
}

/** Link preview while waiting: the sender's card face-down. */
export function InvitePreview({ sender, recipient }: { sender: string; recipient: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: INK, padding: 36, fontFamily: "Inter" }}>
      <div style={{ flex: 1, display: "flex", borderRadius: 40, border: `5px solid ${BRAND}`, padding: 56, alignItems: "center", gap: 56 }}>
        <div
          style={{
            display: "flex",
            width: 300,
            height: 300,
            borderRadius: 999,
            background: BRAND,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 190,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          ?
        </div>
        <div style={{ display: "flex", flexDirection: "column", color: "#fff", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 3, color: BRAND }}>BRAIN-MATE</div>
          <div style={{ display: "flex", fontSize: 62, fontWeight: 800, marginTop: 14, lineHeight: 1.1 }}>
            {`${sender} wants to find your Wavelength, ${recipient}.`}
          </div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 20, color: "rgba(255,255,255,0.7)" }}>
            {`${sender}'s type stays hidden until you play. About 3 minutes.`}
          </div>
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
          <div style={{ display: "flex", fontSize: 34, marginTop: 10 }}>
            {`${c.similarity} same wavelength · ${c.compatibility} compatible`}
          </div>
          <div style={{ display: "flex", fontSize: 30, marginTop: 14, color: "#7A6B63" }}>{`“${c.dynamic}”`}</div>
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
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, letterSpacing: -3, marginTop: 10 }}>Find your Brain-Mates</div>
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
