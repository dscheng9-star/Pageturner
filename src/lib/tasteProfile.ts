import type { SupabaseClient } from '@supabase/supabase-js';

export async function assembleTasteProfile(supabase: SupabaseClient): Promise<string | null> {
  // Fetch all books with completed reviews, joining opinion_signals via reviews
  const { data: books } = await supabase
    .from('books')
    .select(`
      title,
      author,
      genres,
      elo_score,
      tier,
      reviews!inner(
        review_status,
        opinion_signals(
          statement_text,
          response
        )
      )
    `)
    .eq('reviews.review_status', 'complete')
    .order('elo_score', { ascending: false });

  if (!books || books.length === 0) return null;

  // Build genre preference summary
  const genreScores: Record<string, { total: number; count: number }> = {};
  books.forEach(book => {
    book.genres?.forEach((genre: string) => {
      if (!genreScores[genre]) genreScores[genre] = { total: 0, count: 0 };
      genreScores[genre].total += book.elo_score ?? 5;
      genreScores[genre].count++;
    });
  });

  const genreAverages = Object.entries(genreScores)
    .map(([genre, data]) => ({
      genre,
      average: (data.total / data.count).toFixed(1),
      count: data.count,
    }))
    .sort((a, b) => parseFloat(b.average) - parseFloat(a.average));

  // Collect opinion patterns across all reviews
  const opinionPatterns: Record<string, string[]> = {};
  books.forEach(book => {
    // reviews is an array; iterate all completed reviews for this book
    const reviewsArr = Array.isArray(book.reviews) ? book.reviews : [book.reviews];
    reviewsArr.forEach((rev: { opinion_signals?: { statement_text: string; response: string }[] }) => {
      rev.opinion_signals?.forEach(signal => {
        if (!opinionPatterns[signal.response]) opinionPatterns[signal.response] = [];
        opinionPatterns[signal.response].push(signal.statement_text);
      });
    });
  });

  const topBooks    = books.slice(0, 5);
  const bottomBooks = books.slice(-3);
  const likeBooks    = books.filter(b => b.tier === 'like');
  const okayBooks    = books.filter(b => b.tier === 'okay');
  const dislikeBooks = books.filter(b => b.tier === 'dislike');

  const profile = `
LIBRARY OVERVIEW:
Total books reviewed: ${books.length}
Books loved (Like tier): ${likeBooks.length}
Books enjoyed (Okay tier): ${okayBooks.length}
Books disliked (Dislike tier): ${dislikeBooks.length}

TOP RATED BOOKS (highest scores):
${topBooks.map(b => `- "${b.title}" by ${b.author} | Genres: ${b.genres?.join(', ') ?? 'Unknown'} | Score: ${(b.elo_score ?? 5).toFixed(1)}/10 | Tier: ${b.tier ?? 'unknown'}`).join('\n')}

LOWEST RATED BOOKS:
${bottomBooks.map(b => `- "${b.title}" by ${b.author} | Genres: ${b.genres?.join(', ') ?? 'Unknown'} | Score: ${(b.elo_score ?? 5).toFixed(1)}/10 | Tier: ${b.tier ?? 'unknown'}`).join('\n')}

GENRE PREFERENCES (by average rating):
${genreAverages.map(g => `- ${g.genre}: avg ${g.average}/10 across ${g.count} book(s)`).join('\n')}

COMPLETE LIBRARY (for exclusion — do not recommend these):
${books.map(b => `"${b.title}" by ${b.author}`).join(', ')}

OPINION PATTERNS:
Things this reader tends to AGREE with in reviews:
${(opinionPatterns['agree'] ?? []).slice(0, 8).map(s => `- ${s}`).join('\n')}

Things this reader tends to DISAGREE with in reviews:
${(opinionPatterns['disagree'] ?? []).slice(0, 8).map(s => `- ${s}`).join('\n')}
`.trim();

  return profile;
}
