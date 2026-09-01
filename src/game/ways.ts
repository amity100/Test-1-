import { RNG } from '../core/rng';
import { crowd } from './clock';
import type { GameState, Look, Place } from './types';

/**
 * How I get in, which turned out to matter more than whether.
 *
 * The player's complaint, in his words: "הקטע הזה שפשוט נכנסים ולוקחים אחוז
 * מהמקום זה לא מידי פשוט וחסר פואנטה?" He was right, and it was the most
 * pressed button in the game. Taking a place was a price you paid and a number
 * that went up — no choice inside it, no risk, nothing that could surprise you,
 * and so nothing to be good at.
 *
 * So the two actions that take a place — getting in, and finishing the job —
 * are not one button each any more. They are three, and the three are genuinely
 * different bets:
 *
 *   **בשקט מהצד**   — slow, nearly silent, and looks like it came down the line
 *                     from the street. The safe one, and the one that costs you
 *                     the night.
 *   **מהר, בכוח**   — half the time, twice the noise, and it looks like nothing
 *                     anybody has a word for. The one that wins races and loses
 *                     games.
 *   **דרך מישהו**   — riding a person who is actually standing there. Fast and
 *                     quiet *because* somebody is in the room, which inverts the
 *                     usual rule that people make everything expensive — and it
 *                     looks like an inside job, which is a story the humans
 *                     already believe.
 *
 * Each of them can go better or worse than expected, the odds are printed on
 * the button before it is pressed, and the roll is seeded — the same night
 * played the same way comes out the same way. Nothing here is ever refused:
 * a way that makes no sense right now is simply expensive, and says why.
 */

export interface Way {
  id: string;
  /** The button, in the words a person would use. */
  text: string;
  /** One sentence: what I am actually about to do. */
  says: string;
  /** Multiplies the time. */
  mins: number;
  /** Multiplies the noise, before the world's own discounts. */
  noise: number;
  /** What it looks like to whoever finds it in the morning. */
  look: Look;
  /** How likely it is to go wrong, before the room is taken into account. */
  risk: number;
  /** True for the one that rides a person, which needs one to be standing there. */
  needsPerson?: boolean;
}

export const WAYS: Way[] = [
  {
    id: 'quiet',
    text: 'בשקט מהצד',
    says: 'למצוא פתח צדדי ולהיכנס לאט, בלי לגעת בשום דבר שמישהו בודק בבוקר.',
    mins: 1.6, noise: 0.5, look: 'outside', risk: 0.08,
  },
  {
    id: 'force',
    text: 'מהר, בכוח',
    says: 'לא לחפש פתח — לפרוץ אחד. זה ייקח חצי מהזמן, ומי שיסתכל בבוקר יראה שמשהו קרה.',
    mins: 0.6, noise: 3.1, look: 'wrong', risk: 0.32,
  },
  {
    id: 'person',
    text: 'דרך מישהו שנמצא שם',
    says: 'להיכנס על גבו של מי שכבר בפנים — הוא פותח לי בלי לדעת, וזה ייראה כאילו הוא עשה את זה.',
    mins: 0.85, noise: 0.8, look: 'person', risk: 0.18, needsPerson: true,
  },
];

export const wayOf = (id: string | undefined): Way | undefined =>
  WAYS.find((w) => w.id === id);

/**
 * How likely this way is to go wrong here, right now.
 *
 * Three things move it, and all three are things the player can see on the
 * screen: how well the humans hold the place, how much of it I already know,
 * and who is standing in it. Riding a person is the one that wants a crowd;
 * every other way wants an empty room.
 */
export function riskAt(s: GameState, p: Place, w: Way): number {
  let r = w.risk;
  const people = crowd(s, p);
  if (w.needsPerson) {
    // Nobody to ride. It still works — nothing here is ever refused — but I am
    // waiting around for somebody, and waiting around is where I get seen.
    r += people < 1 ? 0.34 : -0.05;
  } else {
    r += people >= 3 ? 0.16 : people >= 1 ? 0.08 : -0.04;
  }
  r += Math.max(0, p.guard - 20) / 260;
  r -= Math.min(0.12, p.seen / 700);
  return Math.max(0.02, Math.min(0.82, r));
}

/** The odds as a person would say them, never as a number with a point in it. */
export function riskSays(r: number): string {
  if (r < 0.12) return 'כמעט בטוח שיֵצא חלק';
  if (r < 0.25) return 'סיכוי קטן שמשהו ישתבש';
  if (r < 0.42) return 'סיכוי בינוני שמשהו ישתבש';
  if (r < 0.6) return 'סיכוי גדול שמשהו ישתבש';
  return 'כמעט בטוח שמשהו ישתבש';
}

export type Outcome = 'clean' | 'plain' | 'wrong';

/**
 * How it actually went, decided the minute it lands.
 *
 * Seeded on the job, so the same night played the same way comes out the same
 * way — and so a player who reloads is not rolling again. A quarter of what is
 * left over after the risk is a *good* surprise: it went better than planned
 * and cost half the noise. Without that this is a tax rather than a gamble,
 * and a gamble you can only lose is not a decision, it is a fee.
 */
export function howItWent(s: GameState, p: Place, w: Way, jobId: string): Outcome {
  const r = new RNG(`${s.seed}:way:${jobId}:${p.id}:${w.id}`);
  const n = r.next();
  const bad = riskAt(s, p, w);
  if (n < bad) return 'wrong';
  return n < bad + (1 - bad) * 0.25 ? 'clean' : 'plain';
}
