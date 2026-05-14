// ── FSRS v5 Scheduler ──────────────────────────────────────────────
// Pure TypeScript implementation of the Free Spaced Repetition Scheduler
// Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki

export interface Card {
  stability: number;    // S — memory stability in days
  difficulty: number;   // D — inherent difficulty [0,1]
  state: number;        // 0=New, 1=Learning, 2=Review, 3=Relearning
  elapsedDays: number;  // time since last review
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: number | null; // timestamp
  due: number;          // timestamp
}

export type Rating = 1 | 2 | 3 | 4; // Again=1, Hard=2, Good=3, Easy=4

// Default parameters from FSRS-5 (optimized defaults)
const PARAM_W: number[] = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
  1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
  2.9898, 0.51655, 0.6621,
];

const DECAY = -0.5;
const FACTOR = 0.9 ** (1 / DECAY) - 1;

export function createNewCard(): Card {
  return {
    stability: 0,
    difficulty: 0.3,
    state: 0, // New
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    due: Date.now(),
  };
}

/** Initialize card for first review */
export function initCard(card: Card): Card {
  return {
    ...card,
    difficulty: initDifficulty(card.difficulty),
    stability: initStability(card.difficulty),
  };
}

function initDifficulty(d: number): number {
  return Math.min(Math.max(d, 0), 1);
}

function initStability(d: number): number {
  return Math.max(PARAM_W[2] * Math.exp(PARAM_W[3] * (1 - d)) - 1, 0.1);
}

/** Same-day review stability */
function sameDayStability(s: number): number {
  return s * Math.exp(PARAM_W[17] * (DECAY - 1));
}

function linearDamping(d: number, deltaD: number): number {
  return (deltaD * (10 - d)) / 9;
}

/** Compute retrievability R(t, S) */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.exp(Math.log(0.9) * (elapsedDays / stability));
}

/** Compute next interval */
function nextInterval(s: number): number {
  return Math.max(s * (1 / (FACTOR * s + 1)), 1);
}

function nextDifficulty(d: number, rating: Rating): number {
  const deltaD = -PARAM_W[6] * (rating - 3);
  const newD = d + linearDamping(d, deltaD);
  return Math.min(Math.max(newD, 0), 1);
}

function meanReversion(init: number, current: number): number {
  return PARAM_W[7] * init + (1 - PARAM_W[7]) * current;
}

function nextRecallStability(d: number, s: number, r: number, rating: Rating): number {
  const hardPenalty = rating === 2 ? PARAM_W[15] : 1;
  const easyBonus = rating === 4 ? PARAM_W[16] : 1;
  return (
    s *
    (1 + hardPenalty * easyBonus * PARAM_W[8] * Math.pow(11 - d, DECAY) * (Math.exp((1 - r) * PARAM_W[9]) - 1))
  );
}

function nextForgetStability(d: number, s: number, r: number): number {
  return PARAM_W[11] * Math.pow(d, -PARAM_W[12]) * ((s + 1) ** PARAM_W[13] - 1) * Math.exp((1 - r) * PARAM_W[14]);
}

/**
 * Main FSRS scheduling function.
 * Returns updated card with new interval and due date.
 */
export function schedule(card: Card, rating: Rating, now: number = Date.now()): Card {
  if (card.state === 0) {
    // New card — initialize
    card = initCard(card);
  }

  const r = retrievability(card.elapsedDays, card.stability);

  let nextCard: Card = { ...card };

  if (rating === 1) {
    // Again — forget
    nextCard.difficulty = nextDifficulty(card.difficulty, 1);
    nextCard.stability = nextForgetStability(card.difficulty, card.stability, r);
    nextCard.elapsedDays = 0;
    nextCard.scheduledDays = 0;
    nextCard.state = 1; // Relearning
    nextCard.lapses += 1;
    nextCard.lastReview = now;
    // Due immediately (or short interval)
    nextCard.due = now + 60 * 1000; // 1 minute
  } else {
    // Hard / Good / Easy
    if (card.state === 1) {
      // Learning → Review
      nextCard.difficulty = nextDifficulty(card.difficulty, rating);
      nextCard.stability = nextRecallStability(
        nextCard.difficulty,
        sameDayStability(card.stability),
        r,
        rating
      );
      nextCard.scheduledDays = nextInterval(nextCard.stability);
      nextCard.elapsedDays = nextCard.scheduledDays;
      nextCard.state = 2;
      nextCard.reps += 1;
      nextCard.lastReview = now;
      nextCard.due = now + nextCard.scheduledDays * 24 * 60 * 60 * 1000;
    } else {
      // Review / Relearning
      nextCard.difficulty = nextDifficulty(card.difficulty, rating);
      const adjustedStability = meanReversion(
        PARAM_W[2] * Math.exp(PARAM_W[3] * (1 - card.difficulty)) - 1,
        card.stability
      );

      if (rating === 2) {
        // Hard
        nextCard.stability = nextRecallStability(
          nextCard.difficulty,
          adjustedStability,
          r,
          2
        );
      } else {
        nextCard.stability = nextRecallStability(
          nextCard.difficulty,
          adjustedStability,
          r,
          rating
        );
      }
      nextCard.scheduledDays = nextInterval(nextCard.stability);
      nextCard.elapsedDays = nextCard.scheduledDays;
      nextCard.state = 2;
      nextCard.reps += 1;
      nextCard.lastReview = now;
      nextCard.due = now + nextCard.scheduledDays * 24 * 60 * 60 * 1000;
    }
  }

  return nextCard;
}

/** Map question record to FSRS card */
export function cardFromQuestion(q: {
  fsrsStability: number | null;
  fsrsDifficulty: number | null;
  fsrsState: number | null;
  fsrsDue: number | null;
  fsrsElapsedDays: number | null;
  fsrsScheduledDays: number | null;
  fsrsReps: number | null;
  fsrsLapses: number | null;
  fsrsLastReview: number | null;
}): Card {
  return {
    stability: q.fsrsStability ?? 0,
    difficulty: q.fsrsDifficulty ?? 0.3,
    state: q.fsrsState ?? 0,
    due: q.fsrsDue ? new Date(q.fsrsDue).getTime() : Date.now(),
    elapsedDays: q.fsrsElapsedDays ?? 0,
    scheduledDays: q.fsrsScheduledDays ?? 0,
    reps: q.fsrsReps ?? 0,
    lapses: q.fsrsLapses ?? 0,
    lastReview: q.fsrsLastReview ? new Date(q.fsrsLastReview).getTime() : null,
  };
}
