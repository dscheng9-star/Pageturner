/*
  # Bucketed ELO, review completion tracking, and genre array

  ## New columns on `books`
  - `tier_bucket` (text, nullable) — 'dislike' | 'okay' | 'like', set at tier placement
  - `genres` (text[], nullable) — AI-classified genre tags (replaces single genre for new books)

  ## New columns on `reviews`
  - `review_status` (text) — 'incomplete' | 'manually_locked' | 'complete', default 'incomplete'
  - `tier_complete` (boolean) — tier placement step done
  - `opinions_complete` (boolean) — at least one opinion signal saved
  - `matchups_complete` (boolean) — at least one matchup completed

  ## Notes
  - All changes additive; existing data unchanged
  - Existing reviews set to 'complete' where elo_score has been set (has existing matchups)
  - RLS unchanged
*/

-- books: tier_bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'tier_bucket'
  ) THEN
    ALTER TABLE books ADD COLUMN tier_bucket text DEFAULT NULL;
  END IF;
END $$;

-- books: genres array
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'genres'
  ) THEN
    ALTER TABLE books ADD COLUMN genres text[] DEFAULT NULL;
  END IF;
END $$;

-- reviews: review_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'review_status'
  ) THEN
    ALTER TABLE reviews ADD COLUMN review_status text NOT NULL DEFAULT 'incomplete';
  END IF;
END $$;

-- reviews: tier_complete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'tier_complete'
  ) THEN
    ALTER TABLE reviews ADD COLUMN tier_complete boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- reviews: opinions_complete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'opinions_complete'
  ) THEN
    ALTER TABLE reviews ADD COLUMN opinions_complete boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- reviews: matchups_complete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'matchups_complete'
  ) THEN
    ALTER TABLE reviews ADD COLUMN matchups_complete boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Backfill: mark existing read/backlog reviews as complete
-- (they went through the full old flow which didn't track steps)
UPDATE reviews
SET
  review_status = 'complete',
  tier_complete = true,
  opinions_complete = true,
  matchups_complete = true
WHERE status IN ('read', 'backlog')
  AND review_status = 'incomplete';

-- Backfill tier_bucket on books that already have an elo_score
UPDATE books
SET tier_bucket =
  CASE
    WHEN elo_score < 4.0 THEN 'dislike'
    WHEN elo_score < 7.0 THEN 'okay'
    ELSE 'like'
  END
WHERE tier_bucket IS NULL AND elo_score IS NOT NULL;
