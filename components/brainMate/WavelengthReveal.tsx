"use client";

import { useEffect, useState } from "react";
import { ARCHETYPES, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { OUTCOMES, type Outcome } from "@/lib/brainMate/compare";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { buzz, tone } from "./feel";

/**
 * The second peak. Two waves slide in and fall into rhythm — as far as the
 * two of you are alike — while the lines underneath change as it works.
 * Then the two pieces click together and the stamp lands. No numbers: the
 * relationship is the story, not a score. Played once, for the two
 * players, the first time they open the finished link.
 */

type Props = {
  a: { name: string; archetype: ArchetypeId };
  b: { name: string; archetype: ArchetypeId };
  /** Only shapes how far the waves fall into phase; never shown. */
  similarity: number;
  outcome: Outcome;
  children: React.ReactNode;
};

function wave(phase: number, amp: number, freq: number) {
  let d = "";
  for (let x = 0; x <= 600; x += 6) {
    const y = 60 + amp * Math.sin((x / 600) * Math.PI * 2 * freq + phase);
    d += `${x === 0 ? "M" : "L"} ${x} ${y.toFixed(1)} `;
  }
  return d;
}

export default function WavelengthReveal({ a, b, similarity, outcome, children }: Props) {
  const [step, setStep] = useState(0);
  const [t, setT] = useState(0);
  const A = ARCHETYPES[a.archetype];
  const B = ARCHETYPES[b.archetype];
  const o = OUTCOMES[outcome];

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(1), 300),
      window.setTimeout(() => {
        setStep(2);
        buzz(15);
        tone(7, 0.3);
      }, 2600),
      window.setTimeout(() => {
        setStep(3);
        buzz([30, 50, 90]);
        tone(0, 0.4);
        tone(12, 0.6);
      }, 4200),
    ];
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT(Math.min(1, (now - start) / 2300));
      if (now - start < 2300) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      timers.forEach((x) => window.clearTimeout(x));
      cancelAnimationFrame(raf);
    };
  }, []);

  if (step >= 4) return <>{children}</>;

  // Out of phase at the start; ends offset by how *unlike* you are.
  const ease = 1 - Math.pow(1 - t, 3);
  const finalOffset = ((100 - similarity) / 100) * Math.PI;
  const offset = Math.PI * 1.6 * (1 - ease) + finalOffset * ease;
  const line = t < 0.35 ? "Tuning into two minds…" : t < 0.7 ? "Lining up your waves…" : t < 1 ? "Finding the rhythm…" : "Locked in.";

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
      <p className="text-[12px] font-extrabold tracking-[0.14em] text-[var(--bm-brand)]">
        {a.name.toUpperCase()} × {b.name.toUpperCase()}
      </p>
      <div className="relative mt-6 w-full overflow-hidden">
        <svg viewBox="0 0 600 120" className="w-full">
          <path d={wave(0, 34, 2.2)} stroke={A.color} strokeWidth="6" fill="none" strokeLinecap="round" opacity={step >= 1 ? 1 : 0} />
          <path d={wave(offset, 34, 2.2)} stroke={B.color} strokeWidth="6" fill="none" strokeLinecap="round" opacity={step >= 1 ? 0.85 : 0} />
        </svg>
      </div>
      <p key={line} className="bm-fade-up mt-3 text-[15px] font-semibold text-[var(--bm-soft)]">
        {line}
      </p>

      {step >= 2 && (
        <div className="mt-8 flex flex-col items-center">
          <div className="flex items-center">
            <span className="bm-piece-left grid h-16 w-16 place-items-center rounded-l-[1.2rem] rounded-r-md" style={{ background: A.color }}>
              <ArchetypeMark id={A.id} size={36} color={A.ink} />
            </span>
            <span className="bm-piece-right grid h-16 w-16 place-items-center rounded-r-[1.2rem] rounded-l-md" style={{ background: B.color }}>
              <ArchetypeMark id={B.id} size={36} color={B.ink} />
            </span>
          </div>
        </div>
      )}

      {step >= 3 && (
        <>
          <div className="bm-stamp mt-8 whitespace-nowrap rounded-[16px] px-5 py-2.5 text-[clamp(1.3rem,7vw,2rem)] font-extrabold text-white" style={{ background: o.color }}>
            {o.label.toUpperCase()}
          </div>
          <p className="bm-fade-up mt-2 text-[14px] text-[var(--bm-soft)]">{o.stamp}</p>
          <button className="bm-btn bm-fade-up mt-8" style={{ animationDelay: "0.6s" }} onClick={() => setStep(4)}>
            See everything →
          </button>
        </>
      )}
    </div>
  );
}
