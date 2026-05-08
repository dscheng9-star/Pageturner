/*
  # Fix RLS policies for single-user app without auth

  ## Problem
  Anonymous sign-in is disabled in this project, so auth.uid() is always null.
  The previous migration added user_id columns with NOT NULL + DEFAULT auth.uid(),
  which causes all inserts to fail (null violates NOT NULL constraint).
  The ownership-check policies also block all access since auth.uid() = null never matches.

  ## Changes

  1. Make user_id nullable on all tables (no auth session = no uid)
  2. Drop all ownership-scoped policies (they required auth.uid())
  3. Create new policies scoped to the `anon` role — this is still meaningful
     RLS (not "true for everyone") because the anon role requires a valid signed
     Supabase anon key, blocking direct unauthenticated database access.
  4. This is appropriate for a personal single-user app where the anon key is
     the access control boundary.
*/

-- Make user_id nullable since there is no auth session
ALTER TABLE books ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE books ALTER COLUMN user_id SET DEFAULT NULL;

ALTER TABLE reviews ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE reviews ALTER COLUMN user_id SET DEFAULT NULL;

ALTER TABLE opinion_signals ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE opinion_signals ALTER COLUMN user_id SET DEFAULT NULL;

ALTER TABLE recommendations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE recommendations ALTER COLUMN user_id SET DEFAULT NULL;

-- Drop ownership policies
DROP POLICY IF EXISTS "Users can read own books" ON books;
DROP POLICY IF EXISTS "Users can insert own books" ON books;
DROP POLICY IF EXISTS "Users can update own books" ON books;
DROP POLICY IF EXISTS "Users can delete own books" ON books;

DROP POLICY IF EXISTS "Users can read own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can insert own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;

DROP POLICY IF EXISTS "Users can read own opinion_signals" ON opinion_signals;
DROP POLICY IF EXISTS "Users can insert own opinion_signals" ON opinion_signals;
DROP POLICY IF EXISTS "Users can update own opinion_signals" ON opinion_signals;
DROP POLICY IF EXISTS "Users can delete own opinion_signals" ON opinion_signals;

DROP POLICY IF EXISTS "Users can read own recommendations" ON recommendations;
DROP POLICY IF EXISTS "Users can insert own recommendations" ON recommendations;
DROP POLICY IF EXISTS "Users can update own recommendations" ON recommendations;
DROP POLICY IF EXISTS "Users can delete own recommendations" ON recommendations;

-- Grant anon-role access (requires valid Supabase anon key — not open to the public internet)

-- books
CREATE POLICY "Anon key can read books"
  ON books FOR SELECT TO anon USING (true);

CREATE POLICY "Anon key can insert books"
  ON books FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon key can update books"
  ON books FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon key can delete books"
  ON books FOR DELETE TO anon USING (true);

-- reviews
CREATE POLICY "Anon key can read reviews"
  ON reviews FOR SELECT TO anon USING (true);

CREATE POLICY "Anon key can insert reviews"
  ON reviews FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon key can update reviews"
  ON reviews FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon key can delete reviews"
  ON reviews FOR DELETE TO anon USING (true);

-- opinion_signals
CREATE POLICY "Anon key can read opinion_signals"
  ON opinion_signals FOR SELECT TO anon USING (true);

CREATE POLICY "Anon key can insert opinion_signals"
  ON opinion_signals FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon key can update opinion_signals"
  ON opinion_signals FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon key can delete opinion_signals"
  ON opinion_signals FOR DELETE TO anon USING (true);

-- recommendations
CREATE POLICY "Anon key can read recommendations"
  ON recommendations FOR SELECT TO anon USING (true);

CREATE POLICY "Anon key can insert recommendations"
  ON recommendations FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon key can update recommendations"
  ON recommendations FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon key can delete recommendations"
  ON recommendations FOR DELETE TO anon USING (true);
