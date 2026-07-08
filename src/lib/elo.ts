import { supabase } from './supabase';
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

// ---------- matchup ELO update (bucket-clamped) ----------
export function calcEloUpdate(
  scoreA: number,
  scoreB: number,
  bucketA: TierBucket,
  bucketB: TierBucket,
  result: MatchupResultType
): { newA: number; newB: number } {
  if (result === 'skip') return { newA: scoreA, newB: scoreB };

  const eloA = scoreToElo(scoreA);
  const eloB = scoreToElo(scoreB);
  const K = bucketA === bucketB ? K_SAME : K_CROSS;

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

// ---------- matchup candidate selection ----------
export function selectMatchupCandidates(
  newBook: Book,
  library: Book[],
  count: number
): Book[] {
  const newBucket = newBook.tier ?? bucketForScore(newBook.elo_score);

  // Only match against same or adjacent bucket
  const eligible = library.filter(b => {
    if (b.id === newBook.id) return false;
    const bBucket = b.tier ?? bucketForScore(b.elo_score);
    return bucketsAreAdjacent(newBucket, bBucket);
  });

  if (eligible.length === 0) return [];

  const sameBucket = eligible.filter(b => (b.tier ?? bucketForScore(b.elo_score)) === newBucket);
  const adjBucket  = eligible.filter(b => (b.tier ?? bucketForScore(b.elo_score)) !== newBucket);

  const byProximity = (a: Book, b: Book) =>
    Math.abs(a.elo_score - newBook.elo_score) - Math.abs(b.elo_score - newBook.elo_score);

  sameBucket.sort(byProximity);
  adjBucket.sort(byProximity);

  const sameCount = Math.min(Math.round(count * 0.7), sameBucket.length);
  const adjCount  = Math.min(count - sameCount, adjBucket.length);
  const extra     = count - sameCount - adjCount;

  const picked = [
    ...sameBucket.slice(0, sameCount + extra),
    ...adjBucket.slice(0, adjCount),
  ];

  // Fisher-Yates shuffle
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }

  return picked.slice(0, count);
}

// ---------- full recalculation from matchup history ----------
export async function recalculateEloFromMatchups(books: Book[]): Promise<void> {
  const { data: matchups } = await supabase
    .from('matchups')
    .select('*')
    .order('created_at', { ascending: true });

  if (!matchups || matchups.length === 0) return;

  // Build a bucket map from current DB values (authoritative tier assignment)
  const bucketMap: Record<string, TierBucket> = {};
  for (const b of books) {
    bucketMap[b.id] = b.tier ?? bucketForScore(b.elo_score);
  }

  // Start each book at its bucket seed score
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
