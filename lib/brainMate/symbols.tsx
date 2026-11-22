import type { ArchetypeId } from "./archetypes";

/**
 * The twelve marks. Geometric, one line weight plus one solid shape, on a
 * 100×100 grid inside the Brain-Mate circle.
 *
 * Column sets the shape language so related archetypes look related:
 * Ignite marks radiate (rays, angles), Seek marks are open (orbits, gaps),
 * Steady marks are closed (stacked, interlocked). Plain SVG with no hooks,
 * classes or filters, so the same element renders in the DOM and inside
 * next/og's image renderer — the share cards use exactly these marks.
 */
export function ArchetypeMark({
  id,
  color = "currentColor",
  size = 64,
  stroke = 5,
}: {
  id: ArchetypeId;
  color?: string;
  size?: number;
  stroke?: number;
}) {
  const s = { stroke: color, strokeWidth: stroke, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const f = { fill: color };
  let body: React.ReactNode;
  switch (id) {
    case "dreamer": // rising horizon
      body = (
        <>
          <line x1="14" y1="64" x2="86" y2="64" {...s} />
          <path d="M 30 64 A 20 20 0 0 1 70 64 Z" {...f} />
          <line x1="50" y1="36" x2="50" y2="18" {...s} />
          <line x1="28" y1="44" x2="18" y2="32" {...s} />
          <line x1="72" y1="44" x2="82" y2="32" {...s} />
        </>
      );
      break;
    case "explorer": // compass, needle off north
      body = (
        <>
          <path d="M 50 14 A 36 36 0 1 1 22 28" {...s} />
          <polygon points="58,30 44,56 50,50 56,52" {...f} />
          <polygon points="42,70 56,44 50,50 44,48" {...f} opacity="0.45" />
        </>
      );
      break;
    case "creator": // closed spiral with a solid centre
      body = (
        <>
          <path d="M 50 50 m 0 -8 a 8 8 0 1 1 -8 8 a 16 16 0 1 1 16 16 a 24 24 0 1 1 -24 -24 a 32 32 0 1 1 32 32" {...s} />
          <circle cx="50" cy="50" r="6" {...f} />
        </>
      );
      break;
    case "maverick": // a straight line broken by a bolt
      body = (
        <>
          <line x1="12" y1="50" x2="38" y2="50" {...s} />
          <line x1="62" y1="50" x2="88" y2="50" {...s} />
          <polygon points="54,14 36,54 50,54 44,86 66,42 52,42 60,14" {...f} />
        </>
      );
      break;
    case "detective": // a lens with a gap, and the dot it's focused on
      body = (
        <>
          <path d="M 70 40 A 26 26 0 1 0 64 66" {...s} />
          <line x1="64" y1="66" x2="84" y2="86" {...s} />
          <circle cx="46" cy="46" r="7" {...f} />
        </>
      );
      break;
    case "strategist": // waypoints on a stepped path, enclosed
      body = (
        <>
          <rect x="14" y="14" width="72" height="72" rx="10" {...s} />
          <path d="M 28 70 L 28 50 L 50 50 L 50 30 L 72 30" {...s} />
          <circle cx="28" cy="70" r="6" {...f} />
          <circle cx="50" cy="50" r="6" {...f} />
          <circle cx="72" cy="30" r="6" {...f} />
        </>
      );
      break;
    case "spark": // starburst, uneven rays around a core
      body = (
        <>
          <circle cx="50" cy="50" r="12" {...f} />
          <line x1="50" y1="30" x2="50" y2="8" {...s} />
          <line x1="50" y1="70" x2="50" y2="86" {...s} />
          <line x1="30" y1="50" x2="12" y2="50" {...s} />
          <line x1="70" y1="50" x2="92" y2="50" {...s} />
          <line x1="64" y1="36" x2="80" y2="20" {...s} />
          <line x1="36" y1="64" x2="24" y2="76" {...s} />
          <line x1="36" y1="36" x2="22" y2="22" {...s} />
          <line x1="64" y1="64" x2="78" y2="78" {...s} />
        </>
      );
      break;
    case "maker": // isometric cube with one open face
      body = (
        <>
          <polygon points="50,14 82,32 50,50 18,32" {...f} />
          <path d="M 18 32 L 18 68 L 50 86 L 50 50" {...s} />
          <path d="M 82 32 L 82 68 L 62 79" {...s} />
        </>
      );
      break;
    case "doer": // concentric rings with an arrow landed in the centre
      body = (
        <>
          <circle cx="46" cy="54" r="32" {...s} />
          <circle cx="46" cy="54" r="18" {...s} />
          <circle cx="46" cy="54" r="6" {...f} />
          <line x1="46" y1="54" x2="84" y2="16" {...s} />
          <polygon points="84,16 70,18 82,30" {...f} />
        </>
      );
      break;
    case "connector": // three nodes, one bright, links reaching out
      body = (
        <>
          <line x1="50" y1="28" x2="24" y2="70" {...s} />
          <line x1="50" y1="28" x2="76" y2="70" {...s} />
          <line x1="24" y1="70" x2="76" y2="70" {...s} />
          <line x1="76" y1="70" x2="92" y2="86" {...s} />
          <circle cx="50" cy="28" r="12" {...f} />
          <circle cx="24" cy="70" r="8" {...f} />
          <circle cx="76" cy="70" r="8" {...f} />
        </>
      );
      break;
    case "mentor": // a lantern, open glowing centre
      body = (
        <>
          <path d="M 38 18 L 62 18" {...s} />
          <path d="M 50 8 L 50 18" {...s} />
          <path d="M 32 26 L 68 26 L 72 76 L 28 76 Z" {...s} />
          <path d="M 50 38 C 60 50 58 64 50 66 C 42 64 40 50 50 38 Z" {...f} />
          <path d="M 36 86 L 64 86" {...s} />
        </>
      );
      break;
    case "peacemaker": // two overlapping circles, the shared part solid
      body = (
        <>
          <circle cx="38" cy="50" r="26" {...s} />
          <circle cx="62" cy="50" r="26" {...s} />
          <path d="M 50 26.9 A 26 26 0 0 1 50 73.1 A 26 26 0 0 1 50 26.9 Z" {...f} />
        </>
      );
      break;
  }
  // next/og's renderer accepts only real SVG elements inside <svg>, not a
  // fragment, so the fragment's children are lifted out.
  const parts = (body as React.ReactElement<{ children: React.ReactNode }>).props.children;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {parts}
    </svg>
  );
}
