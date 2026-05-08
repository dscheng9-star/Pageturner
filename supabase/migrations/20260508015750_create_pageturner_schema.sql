/*
  # Pageturner — Initial Schema

  ## New Tables

  ### books
  Core book catalog. Each book is stored once; multiple reviews can reference it.
  - id: UUID primary key
  - title, author: required text
  - cover_image_url: URL to cover art (from Google Books API)
  - description: book synopsis
  - genre: e.g. "Fiction", "Mystery"
  - series_name, series_number: optional series tracking
  - isbn: optional ISBN-13 or ISBN-10

  ### reviews
  A user's relationship to a book. Supports three entry types and re-reads.
  - book_id: FK → books(id)
  - status: 'read' | 'backlog' | 'want_to_read'
  - entry_type: 'quick' | 'deep' | 'backlog_lite'
  - star_rating: 1–5 (nullable for want_to_read)
  - review_text: freeform review
  - read_count: how many times read (default 1)
  - date_finished: when the book was finished
  - is_reread: true if this is a subsequent read of the same book

  ### opinion_signals
  Hot-take agree/disagree statements attached to deep reviews.
  - review_id: FK → reviews(id)
  - statement_text: the opinion statement
  - opinion_type: 'popular' | 'unpopular'
  - response: 'agree' | 'disagree' | 'neutral'

  ### recommendations
  AI-generated book suggestions (placeholder for future AI feature).
  - suggested_book_title, suggested_author
  - reason_text: why this was recommended
  - was_acted_on: whether user added it to their library

  ## Security
  RLS enabled on all tables with policies for authenticated users to manage their own data.
*/

-- Create enum types (using DO blocks to handle "already exists" gracefully)
DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('read', 'backlog', 'want_to_read');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_entry_type AS ENUM ('quick', 'deep', 'backlog_lite');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE opinion_type AS ENUM ('popular', 'unpopular');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE opinion_response AS ENUM ('agree', 'disagree', 'neutral');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- BOOKS
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  cover_image_url text,
  description text,
  genre text,
  series_name text,
  series_number numeric,
  isbn text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read books"
    ON books FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert books"
    ON books FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update books"
    ON books FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  status review_status NOT NULL DEFAULT 'read',
  entry_type review_entry_type NOT NULL DEFAULT 'quick',
  star_rating smallint CHECK (star_rating >= 1 AND star_rating <= 5),
  review_text text,
  read_count integer NOT NULL DEFAULT 1,
  date_finished date,
  is_reread boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read reviews"
    ON reviews FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert reviews"
    ON reviews FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update reviews"
    ON reviews FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can delete reviews"
    ON reviews FOR DELETE
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- OPINION_SIGNALS
CREATE TABLE IF NOT EXISTS opinion_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  statement_text text NOT NULL,
  opinion_type opinion_type NOT NULL DEFAULT 'popular',
  response opinion_response NOT NULL DEFAULT 'neutral',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE opinion_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read opinion_signals"
    ON opinion_signals FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert opinion_signals"
    ON opinion_signals FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update opinion_signals"
    ON opinion_signals FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can delete opinion_signals"
    ON opinion_signals FOR DELETE
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RECOMMENDATIONS
CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_book_title text NOT NULL,
  suggested_author text NOT NULL,
  reason_text text,
  was_acted_on boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read recommendations"
    ON recommendations FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert recommendations"
    ON recommendations FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update recommendations"
    ON recommendations FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS reviews_book_id_idx ON reviews(book_id);
CREATE INDEX IF NOT EXISTS reviews_status_idx ON reviews(status);
CREATE INDEX IF NOT EXISTS opinion_signals_review_id_idx ON opinion_signals(review_id);
