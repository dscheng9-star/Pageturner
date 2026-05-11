import { supabase } from './supabase';
import type { Book, MatchupResultType } from './database.types';

const K = 32;
const SCALE = 400;
// Internal ELO range maps to 0–10 display scale
const ELO_MIN = 800;
const ELO_MAX = 2200;

export function eloToScore(elo: number): number {
  const clamped = Math.max(ELO_MIN, Math.min(ELO_MAX, elo));
  return Math.round(((clamped - ELO_MIN) / (ELO_MAX - ELO_MIN)) * 100) / 10;
}

export function scoreToElo(score: number): number {
  return ELO_MIN + (score / 10) * (ELO_MAX - ELO_MIN);
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / SCALE));
}

export function calcEloUpdate(
  ratingA: number,
  ratingB: number,
  result: MatchupResultType
): { newA: number; newB: number } {
  const expA = expectedScore(ratingA, ratingB);
  const expB = expectedScore(ratingB, ratingA);

  let scoreA: number;
  let scoreB: number;

  if (result === 'win') {
    scoreA = 1;
    scoreB = 0;
  } else if (result === 'too_close') {
    scoreA = 0.5;
    scoreB = 0.5;
  } else {
    // skip — no change
    return { newA: ratingA, newB: ratingB };
  }

  return {
    newA: ratingA + K * (scoreA - expA),
    newB: ratingB + K * (scoreB - expB),
  };
}

export function tierSeedElo(tier: 'bad' | 'okay' | 'loved'): number {
  if (tier === 'bad') return scoreToElo(2);
  if (tier === 'okay') return scoreToElo(5);
  return scoreToElo(8);
}

export function selectMatchupCandidates(
  newBook: Book,
  library: Book[],
  count: number
): Book[] {
  const candidates = library.filter(b => b.id !== newBook.id);
  if (candidates.length === 0) return [];

  const sameGenre = candidates.filter(
    b => b.genre && newBook.genre && b.genre.toLowerCase() === newBook.genre.toLowerCase()
  );
  const crossGenre = candidates.filter(
    b => !b.genre || !newBook.genre || b.genre.toLowerCase() !== newBook.genre.toLowerCase()
  );

  // Sort same-genre by proximity to new book's ELO
  const sortByProximity = (a: Book, b: Book) =>
    Math.abs(a.elo_score - newBook.elo_score) - Math.abs(b.elo_score - newBook.elo_score);

  sameGenre.sort(sortByProximity);
  crossGenre.sort(sortByProximity);

  const sameCount = Math.min(Math.round(count * 0.7), sameGenre.length);
  const crossCount = Math.min(count - sameCount, crossGenre.length);
  const extra = count - sameCount - crossCount;

  const picked = [
    ...sameGenre.slice(0, sameCount + extra),
    ...crossGenre.slice(0, crossCount),
  ];

  // Shuffle for varied presentation
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }

  return picked.slice(0, count);
}

export async function recalculateEloFromMatchups(books: Book[]): Promise<void> {
  const { data: matchups } = await supabase
    .from('matchups')
    .select('*')
    .order('created_at', { ascending: true });

  if (!matchups || matchups.length === 0) return;

  // Reset all to seed value then replay matchup history
  const scores: Record<string, number> = {};
  for (const b of books) {
    scores[b.id] = scoreToElo(5);
  }

  for (const m of matchups) {
    if (m.result_type === 'skip') continue;
    const winnerElo = scores[m.winner_book_id];
    const loserElo = scores[m.loser_book_id];
    if (winnerElo === undefined || loserElo === undefined) continue;

    const { newA, newB } = calcEloUpdate(winnerElo, loserElo, m.result_type);
    scores[m.winner_book_id] = newA;
    scores[m.loser_book_id] = newB;
  }

  // Persist updated scores
  const updates = Object.entries(scores).map(([id, elo]) =>
    supabase.from('books').update({ elo_score: eloToScore(elo) }).eq('id', id)
  );
  await Promise.all(updates);
}
