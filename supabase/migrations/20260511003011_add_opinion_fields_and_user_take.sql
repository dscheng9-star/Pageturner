/*
  # Add opinion flow fields

  1. Changes to `reviews` table
     - `user_added_opinion` (text, nullable) — user's own take entered after opinion cards

  2. Changes to `opinion_signals` table
     - `book_id` (uuid, FK to books) — direct link to book for easier querying
     - The existing `review_id` FK remains

  3. Notes
     - Both changes are additive; no existing data is affected
     - RLS policies are unchanged (anon access follows existing pattern)
*/

-- Add user_added_opinion to reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'user_added_opinion'
  ) THEN
    ALTER TABLE reviews ADD COLUMN user_added_opinion text DEFAULT NULL;
  END IF;
END $$;

-- Add book_id to opinion_signals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'opinion_signals' AND column_name = 'book_id'
  ) THEN
    ALTER TABLE opinion_signals ADD COLUMN book_id uuid REFERENCES books(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index for fast lookup by book
CREATE INDEX IF NOT EXISTS opinion_signals_book_id_idx ON opinion_signals(book_id);
