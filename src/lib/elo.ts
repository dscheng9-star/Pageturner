import { supabase } from './supabase';
import { getBookGenreGroup, canBooksMatch } from './genreGroups';
import type { Book, MatchupResultType, TierBucket } from './database.types';

// Bucket score ranges (display scale 0–10)
const BUCKET_RANGES: Record<TierBucket, [number, number]> = {
  dislike: [0.0, 3.9],
  okay:    [3.0, 6.9],
  like:    [6.0, 10.0],
};

// Seed scores placed at the centre of each bucket
const BUCKET_SEEDS: Record<TierBucket, number> = {
  dislike: 2.0,
  okay:    5.0,
  like:    8.0,
};

// K-factor: lower for cross-bucket matchups to reduce volatility
const K_SAME   = 32;
const K_CROSS  = 16;
const SCALE    = 400;
const ELO_BASE = 1200; // internal ELO for a score of 5.0

export function tierBucket(tier: 'bad' | 'okay' | 'loved'): TierBucket {
  if (tier === 'bad')   return 'dislike';
  if (tier === 'okay')  return 'okay';
  return 'like';
}

export function tierSeedScore(tier: 'bad' | 'okay' | 'loved'): number {
  return BUCKET_SEEDS[tierBucket(tier)];
}

export function tierSeedElo(tier: 'bad' | 'okay' | 'loved'): number {
  return scoreToElo(tierSeedScore(tier));
}

// ---------- score ↔ ELO conversion (internal only) ----------
const ELO_MIN = 800;
const ELO_MAX = 2200;

export function eloToScore(elo: number): number {
  const clamped = Math.max(ELO_MIN, Math.min(ELO_MAX, elo));
  return Math.round(((clamped - ELO_MIN) / (ELO_MAX - ELO_MIN)) * 100) / 10;
}

export function scoreToElo(score: number): number {
  return ELO_MIN + (score / 10) * (ELO_MAX - ELO_MIN);
}

// ---------- bucket helpers ----------
export function bucketForScore(score: number): TierBucket {
  if (score < 4.0) return 'dislike';
  if (score < 7.0) return 'okay';
  return 'like';
}

function clampToBucket(score: number, bucket: TierBucket): number {
  const [lo, hi] = BUCKET_RANGES[bucket];
  return Math.max(lo, Math.min(hi, score));
}

function bucketsAreAdjacent(a: TierBucket, b: TierBucket): boolean {
  if (a === b) return true;
  if ((a === 'dislike' && b === 'okay') || (a === 'okay' && b === 'dislike')) return true;
  if ((a === 'okay' && b === 'like')    || (a === 'like'    && b === 'okay'))  return true;
  return false;
}

// ---------- adaptive session config ----------
export interface MatchupConfig {
  min: number;
  standard: number;
  max: number;
}

export function getMatchupConfig(librarySize: number): MatchupConfig {
  if (librarySize < 10) return { min: 3, standard: 4, max: 8 };
  if (librarySize <= 30) return { min: 4, standard: 6, max: 10 };
  return { min: 5, standard: 8, max: 12 };
}

// ---------- streak evaluation ----------
export type StreakState = 'winning_streak' | 'losing_streak' | 'mixed' | 'neutral';

export interface MatchupRecord {
  outcome: 'win' | 'loss' | 'draw';
  opponentId: string;
}

export function evaluateStreak(results: MatchupRecord[]): StreakState {
  if (results.length < 2) return 'neutral';

  const recent = results.slice(-3);
  const wins   = recent.filter(r => r.outcome === 'win').length;
  const losses = recent.filter(r => r.outcome === 'loss').length;

  if (wins === 3) return 'winning_streak';
  if (losses === 3) return 'losing_streak';
  if (wins >= 1 && losses >= 1) return 'mixed';
  return 'neutral';
}

/** True when the most recent result breaks the prior streak. */
export function isStreakBreak(results: MatchupRecord[]): boolean {
  if (results.length < 2) return false;
  const streakBefore = evaluateStreak(results.slice(0, -1));
  if (streakBefore === 'winning_streak' && results[results.length - 1].outcome === 'loss') return true;
  if (streakBefore === 'losing_streak'  && results[results.length - 1].outcome === 'win')  return true;
  return false;
}

/** Decide whether the adaptive session should continue. */
export function shouldContinueSession(
  results: MatchupRecord[],
  config: MatchupConfig,
): boolean {
  const count  = results.length;
  const streak = evaluateStreak(results);

  if (count >= config.max) return false;
  if (count < config.min)  return true;

  // Past minimum: stop if streak just broke or is neutral/mixed
  if (isStreakBreak(results)) return false;
  if (streak === 'winning_streak' || streak === 'losing_streak') return true;
  return false;
}

// ---------- adaptive opponent selection ----------
export function selectNextOpponent(
  currentBook: Book,
  eligibleBooks: Book[],
  results: MatchupRecord[],
  library: Book[],
): Book | null {
  const streak       = evaluateStreak(results);
  const currentScore = currentBook.elo_score;
  const seenIds      = new Set(results.map(r => r.opponentId));

  const newBucket = currentBook.tier ?? bucketForScore(currentScore);
  const candidates = eligibleBooks.filter(b => {
    if (b.id === currentBook.id) return false;
    if (seenIds.has(b.id))       return false;
    const bBucket = b.tier ?? bucketForScore(b.elo_score);
    return bucketsAreAdjacent(newBucket, bBucket) && canBooksMatch(currentBook, b, library);
  });

  if (candidates.length === 0) return null;

  let targetScore: number;
  if (streak === 'winning_streak') {
    targetScore = currentScore + 1.5;
  } else if (streak === 'losing_streak') {
    targetScore = currentScore - 1.5;
  } else {
    targetScore = currentScore;
  }

  const sorted = [...candidates].sort(
    (a, b) => Math.abs(a.elo_score - targetScore) - Math.abs(b.elo_score - targetScore)
  );

  // Pick randomly from the top 3 closest
  const pool = sorted.slice(0, 3);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- streak-aware K factor ----------
export function getKFactor(
  bucketA: TierBucket,
  bucketB: TierBucket,
  streak: StreakState,
  matchupNumber: number,
): number {
  const baseK       = bucketA === bucketB ? K_SAME : K_CROSS;
  const earlyBonus  = matchupNumber <= 2 ? 1.5 : 1.0;
  const streakMult  = (streak === 'winning_streak' || streak === 'losing_streak') ? 1.3 : 1.0;
  return baseK * earlyBonus * streakMult;
}

// ---------- matchup ELO update (bucket-clamped) ----------
export function calcEloUpdate(
  scoreA: number,
  scoreB: number,
  bucketA: TierBucket,
  bucketB: TierBucket,
  result: MatchupResultType,
  kOverride?: number,
): { newA: number; newB: number } {
  if (result === 'skip') return { newA: scoreA, newB: scoreB };

  const eloA = scoreToElo(scoreA);
  const eloB = scoreToElo(scoreB);
  const K    = kOverride ?? (bucketA === bucketB ? K_SAME : K_CROSS);

  const expA = 1 / (1 + Math.pow(10, (eloB - eloA) / SCALE));
  const expB = 1 - expA;
  const sA   = result === 'win' ? 1 : 0.5;
  const sB   = 1 - sA;

  const rawA = eloToScore(eloA + K * (sA - expA));
  const rawB = eloToScore(eloB + K * (sB - expB));

  return {
    newA: clampToBucket(rawA, bucketA),
    newB: clampToBucket(rawB, bucketB),
  };
}

// ---------- matchup candidate selection (kept for initial seeding) ----------
export function selectMatchupCandidates(
  newBook: Book,
  library: Book[],
  count: number
): Book[] {
  const newBucket = newBook.tier ?? bucketForScore(newBook.elo_score);
  const newGroup = getBookGenreGroup(newBook, library);

  const eligible = library.filter(b => {
    if (b.id === newBook.id) return false;
    const bBucket = b.tier ?? bucketForScore(b.elo_score);
    return bucketsAreAdjacent(newBucket, bBucket) && canBooksMatch(newBook, b, library);
  });

  if (eligible.length === 0) return [];

  const actualCount = Math.min(count, eligible.length);

  const sameGroup  = eligible.filter(b => getBookGenreGroup(b, library) === newGroup);
  const crossGroup = eligible.filter(b => getBookGenreGroup(b, library) !== newGroup);

  const byProximity = (a: Book, b: Book) =>
    Math.abs(a.elo_score - newBook.elo_score) - Math.abs(b.elo_score - newBook.elo_score);

  sameGroup.sort(byProximity);
  crossGroup.sort(byProximity);

  const sameCount  = Math.min(Math.round(actualCount * 0.8), sameGroup.length);
  const crossCount = Math.min(actualCount - sameCount, crossGroup.length);
  const extra      = actualCount - sameCount - crossCount;

  const picked = [
    ...sameGroup.slice(0, sameCount + extra),
    ...crossGroup.slice(0, crossCount),
  ];

  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }

  return picked.slice(0, actualCount);
}

// ---------- full recalculation from matchup history ----------
export async function recalculateEloFromMatchups(books: Book[]): Promise<void> {
  const { data: matchups } = await supabase
    .from('matchups')
    .select('*')
    .order('created_at', { ascending: true });

  if (!matchups || matchups.length === 0) return;

  const bucketMap: Record<string, TierBucket> = {};
  for (const b of books) {
    bucketMap[b.id] = b.tier ?? bucketForScore(b.elo_score);
  }

  const scores: Record<string, number> = {};
  for (const b of books) {
    scores[b.id] = BUCKET_SEEDS[bucketMap[b.id]];
  }

  for (const m of matchups) {
    if (m.result_type === 'skip') continue;
    const wId = m.winner_book_id;
    const lId = m.loser_book_id;
    if (scores[wId] === undefined || scores[lId] === undefined) continue;

    const wBucket = bucketMap[wId];
    const lBucket = bucketMap[lId];

    const { newA, newB } = calcEloUpdate(scores[wId], scores[lId], wBucket, lBucket, m.result_type);
    scores[wId] = newA;
    scores[lId] = newB;
  }

  const updates = Object.entries(scores).map(([id, score]) =>
    supabase.from('books').update({ elo_score: score }).eq('id', id)
  );
  await Promise.all(updates);
}
