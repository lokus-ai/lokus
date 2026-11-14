/** @part-of ui.onboarding */

/**
 * The small sounds of the first-run setup, made on the spot rather than shipped as files: a
 * tick as each thing appears, a pop when something is chosen, a soft sweep between questions
 * and a chime at the end. Quiet by design, and one switch turns them all off.
 */
const MUTED = "lokus.sounds.off";
let context: AudioContext | null = null;
let muted = localStorage.getItem(MUTED) === "1";

export const soundsMuted = () => muted;

export function muteSounds(off: boolean): void {
  muted = off;
  if (off) localStorage.setItem(MUTED, "1");
  else localStorage.removeItem(MUTED);
}

/** Sound may only start after the person has clicked or typed; call this from that. */
export function wakeSounds(): void {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
  } catch {
    context = null;
  }
}

interface Voice {
  /** Pitch in hertz, and where it glides to. */
  from: number;
  to?: number;
  /** Seconds. */
  length: number;
  loud?: number;
  shape?: OscillatorType;
  /** Seconds from now. */
  after?: number;
}

function voice({ from, to, length, loud = 0.05, shape = "sine", after = 0 }: Voice): void {
  if (muted || !context || context.state !== "running") return;
  const start = context.currentTime + after;
  const tone = context.createOscillator();
  const level = context.createGain();
  tone.type = shape;
  tone.frequency.setValueAtTime(from, start);
  if (to) tone.frequency.exponentialRampToValueAtTime(to, start + length);
  level.gain.setValueAtTime(0.0001, start);
  level.gain.exponentialRampToValueAtTime(loud, start + 0.008);
  level.gain.exponentialRampToValueAtTime(0.0001, start + length);
  tone.connect(level).connect(context.destination);
  tone.start(start);
  tone.stop(start + length + 0.02);
}

/** Something appeared. `nth` raises the pitch a little, so a row of things arriving climbs. */
export const tick = (nth = 0, after = 0) => voice({ from: 1250 + nth * 70, to: 900 + nth * 70, length: 0.045, loud: 0.022, shape: "triangle", after });

/** Something was chosen (or let go of). */
export const pop = (on = true, nth = 0) => voice(on ? { from: 420 + nth * 45, to: 760 + nth * 45, length: 0.09, loud: 0.06 } : { from: 520, to: 300, length: 0.08, loud: 0.04 });

/** On to the next question. */
export const sweep = () => voice({ from: 220, to: 520, length: 0.22, loud: 0.025, shape: "sine" });

/** One line of the set-up finished. */
export const done = (nth = 0) => voice({ from: 660 + nth * 110, length: 0.12, loud: 0.045, shape: "triangle" });

/** All set. */
export function chime(): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => voice({ from: note, length: 0.5, loud: 0.05, after: i * 0.09 }));
}
