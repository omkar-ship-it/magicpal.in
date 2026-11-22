/**
 * The small physical responses: a tap you can feel and a tone you can hear.
 *
 * Sound is off unless switched on (most people play in public), and the
 * preference is remembered. Vibration only exists on Android browsers; on an
 * iPhone the visuals carry the feedback alone.
 */

let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem("bm_sound") === "1";
  } catch {
    return false;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem("bm_sound", on ? "1" : "0");
  } catch {
    /* private mode */
  }
}

/** A short soft tone. `step` picks the pitch, so each row has its own note. */
export function tone(step = 0, length = 0.12) {
  if (!soundOn()) return;
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 392 * Math.pow(2, step / 12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + length + 0.02);
  } catch {
    /* audio blocked */
  }
}

export function buzz(ms: number | number[] = 12) {
  try {
    // Browsers refuse (and log) vibration before the first tap on a page.
    const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
    if (nav.userActivation && !nav.userActivation.hasBeenActive) return;
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
