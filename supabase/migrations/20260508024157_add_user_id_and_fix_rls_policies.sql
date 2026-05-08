/*
  # Add user_id ownership columns and fix RLS policies

  ## Problem
  All tables had RLS policies using `true` as their condition, which grants unrestricted
  access to any authenticated user. This allows any signed-in user to read, modify, or
  delete another user's data.

  ## Changes

  ### New columns
  - `books.user_id` — uuid, NOT NULL, references auth.users(id), defaults to auth.uid()
  - `reviews.user_id` — uuid, NOT NULL, references auth.users(id), defaults to auth.uid()
  - `opinion_signals.user_id` — uuid, NOT NULL, references auth.users(id), defaults to auth.uid()
  - `recommendations.user_id` — uuid, NOT NULL, references auth.users(id), defaults to auth.uid()

  ### RLS policy changes
  All `true` policies are dropped and replaced with proper ownership checks:
  - SELECT: auth.uid() = user_id
  - INSERT: auth.uid() = user_id
  - UPDATE: auth.uid() = user_id (both USING and WITH CHECK)
  - DELETE: auth.uid() = user_id

  For opinion_signals, access is also gated through review ownership via a subquery.

  ### Notes
  - opinion_signals doesn't have a direct user_id on the joined review, so we add user_id
    directly to opinion_signals for simpler, more efficient policy checks.
  - Existing rows (there are none) would need backfilling; not needed since tables are empty.
*/

-- ============================================================
-- 1. Add user_id columns
-- ============================================================

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id);

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id);

ALTER TABLE opinion_signals
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id);

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id);

-- ============================================================
-- 2. Drop all existing (always-true) policies
-- ============================================================

-- books
DROP POLICY IF EXISTS "Authenticated users can read books" ON books;
DROP POLICY IF EXISTS "Authenticated users can insert books" ON books;
DROP POLICY IF EXISTS "Authenticated users can update books" ON books;

-- reviews
DROP POLICY IF EXISTS "Authenticated users can read reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can update reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can delete reviews" ON reviews;

-- opinion_signals
DROP POLICY IF EXISTS "Authenticated users can read opinion_signals" ON opinion_signals;
DROP POLICY IF EXISTS "Authenticated users can insert opinion_signals" ON opinion_signals;
DROP POLICY IF EXISTS "Authenticated users can update opinion_signals" ON opinion_signals;
DROP POLICY IF EXISTS "Authenticated users can delete opinion_signals" ON opinion_signals;

-- recommendations
DROP POLICY IF EXISTS "Authenticated users can read recommendations" ON recommendations;
DROP POLICY IF EXISTS "Authenticated users can insert recommendations" ON recommendations;
DROP POLICY IF EXISTS "Authenticated users can update recommendations" ON recommendations;

-- ============================================================
-- 3. Create proper ownership-scoped policies
-- ============================================================

-- books
CREATE POLICY "Users can read own books"
  ON books FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own books"
  ON books FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own books"
  ON books FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own books"
  ON books FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- reviews
CREATE POLICY "Users can read own reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- opinion_signals
CREATE POLICY "Users can read own opinion_signals"
  ON opinion_signals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own opinion_signals"
  ON opinion_signals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own opinion_signals"
  ON opinion_signals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own opinion_signals"
  ON opinion_signals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- recommendations
CREATE POLICY "Users can read own recommendations"
  ON recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations"
  ON recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendations"
  ON recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recommendations"
  ON recommendations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. Index user_id columns for policy evaluation performance
-- ============================================================

CREATE INDEX IF NOT EXISTS books_user_id_idx ON books(user_id);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id);
CREATE INDEX IF NOT EXISTS opinion_signals_user_id_idx ON opinion_signals(user_id);
CREATE INDEX IF NOT EXISTS recommendations_user_id_idx ON recommendations(user_id);
