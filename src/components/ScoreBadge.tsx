import type { Book, Review, TierBucket } from '../lib/database.types';

const TIER_BADGE_STYLES: Record<TierBucket, string> = {
  like:    'bg-emerald-100 text-emerald-700',
  okay:    'bg-amber-100 text-amber-700',
  dislike: 'bg-red-100 text-red-600',
};

const TIER_BADGE_LABELS: Record<TierBucket, string> = {
  like:    'Like',
  okay:    'Okay',
  dislike: 'Dislike',
};

/** Returns true if the book's latest review has completed matchups and a locked/complete status. */
export function hasCompleteScore(reviews: Review[]): boolean {
  const latest = reviews[reviews.length - 1];
  if (!latest) return false;
  return (
    latest.matchups_complete &&
    (latest.review_status === 'complete' || latest.review_status === 'manually_locked')
  );
}

/** Returns true if ANY review for this book is incomplete (mid-review, not yet finished). */
export function hasIncompleteReview(reviews: Review[]): boolean {
  return reviews.some(r => r.review_status === 'incomplete');
}

/** Returns true if the book has a tier assigned (from matchups or manual placement). */
export function hasTier(book: Book): boolean {
  return book.tier !== null;
}

interface ScoreBadgeProps {
  book: Book;
  reviews: Review[];
  size?: 'sm' | 'lg';
}

/**
 * Shows the numerical score (X.X / 10) when matchups are complete and review is
 * complete/manually_locked. Otherwise shows a tier pill badge (Like/Okay/Dislike)
 * if the book has a tier. If neither, renders nothing.
 */
export default function ScoreBadge({ book, reviews, size = 'sm' }: ScoreBadgeProps) {
  const scored = hasCompleteScore(reviews) && !hasIncompleteReview(reviews);

  if (scored) {
    if (size === 'lg') {
      return (
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-stone-900 tabular-nums">
            {book.elo_score.toFixed(1)}
          </span>
          <span className="text-base text-stone-400 font-normal">/ 10</span>
        </div>
      );
    }
    return (
      <p className="text-xs font-semibold text-stone-700 mt-1 tabular-nums">
        {book.elo_score.toFixed(1)}
        <span className="font-normal text-stone-400"> / 10</span>
      </p>
    );
  }

  if (hasTier(book)) {
    const tier = book.tier as TierBucket;
    const padding = size === 'lg' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs';
    return (
      <span
        className={`inline-block ${padding} rounded-full font-medium ${TIER_BADGE_STYLES[tier]}`}
      >
        {TIER_BADGE_LABELS[tier]}
      </span>
    );
  }

  return null;
}
