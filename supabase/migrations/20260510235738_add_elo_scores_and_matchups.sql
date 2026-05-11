/*
  # Add ELO scoring system

  1. Changes to `books` table
     - `elo_score` (float, default 5.0) — current ELO score normalized to 0–10 scale

  2. New table `matchups`
     - `id` (uuid, primary key)
     - `winner_book_id` (uuid, FK to books) — book that won, or left book for 'too_close'/'skip'
     - `loser_book_id` (uuid, FK to books) — book that lost, or right book for 'too_close'/'skip'
     - `result_type` (enum: 'win', 'too_close', 'skip') — outcome of the matchup
     - `created_at` (timestamptz)

  3. Security
     - RLS enabled on matchups with anon-role access (matching existing app pattern)
*/

-- Add elo_score column to books
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'elo_score'
  ) THEN
    ALTER TABLE books ADD COLUMN elo_score float DEFAULT 5.0 NOT NULL;
  END IF;
END $$;

-- Create matchup result type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'matchup_result_type') THEN
    CREATE TYPE matchup_result_type AS ENUM ('win', 'too_close', 'skip');
  END IF;
END $$;

-- Create matchups table
CREATE TABLE IF NOT EXISTS matchups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  loser_book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  result_type matchup_result_type NOT NULL DEFAULT 'win',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for fast lookups by book
CREATE INDEX IF NOT EXISTS matchups_winner_book_id_idx ON matchups(winner_book_id);
CREATE INDEX IF NOT EXISTS matchups_loser_book_id_idx ON matchups(loser_book_id);
CREATE INDEX IF NOT EXISTS matchups_created_at_idx ON matchups(created_at);

-- Enable RLS
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;

-- Anon-role policies (matching existing app pattern for single-user no-auth app)
CREATE POLICY "anon can select matchups"
  ON matchups FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert matchups"
  ON matchups FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update matchups"
  ON matchups FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete matchups"
  ON matchups FOR DELETE TO anon USING (true);
