export type ReviewStatus = 'read' | 'backlog' | 'want_to_read';
export type ReviewEntryType = 'quick' | 'deep' | 'backlog_lite';
export type OpinionType = 'popular' | 'unpopular';
export type OpinionResponse = 'agree' | 'disagree' | 'neutral';

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string;
  cover_image_url: string | null;
  description: string | null;
  genre: string | null;
  series_name: string | null;
  series_number: number | null;
  isbn: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  book_id: string;
  status: ReviewStatus;
  entry_type: ReviewEntryType;
  star_rating: number | null;
  review_text: string | null;
  read_count: number;
  date_finished: string | null;
  is_reread: boolean;
  created_at: string;
}

export interface OpinionSignal {
  id: string;
  user_id: string;
  review_id: string;
  statement_text: string;
  opinion_type: OpinionType;
  response: OpinionResponse;
  created_at: string;
}

export interface Recommendation {
  id: string;
  user_id: string;
  suggested_book_title: string;
  suggested_author: string;
  reason_text: string | null;
  was_acted_on: boolean;
  created_at: string;
}

export interface BookWithReview extends Book {
  reviews: Review[];
  latestReview?: Review;
}

export interface Database {
  public: {
    Tables: {
      books: { Row: Book; Insert: Omit<Book, 'id' | 'created_at'>; Update: Partial<Omit<Book, 'id' | 'created_at'>> };
      reviews: { Row: Review; Insert: Omit<Review, 'id' | 'created_at'>; Update: Partial<Omit<Review, 'id' | 'created_at'>> };
      opinion_signals: { Row: OpinionSignal; Insert: Omit<OpinionSignal, 'id' | 'created_at'>; Update: Partial<Omit<OpinionSignal, 'id' | 'created_at'>> };
      recommendations: { Row: Recommendation; Insert: Omit<Recommendation, 'id' | 'created_at'>; Update: Partial<Omit<Recommendation, 'id' | 'created_at'>> };
    };
  };
}
