import { BookOpen, PlusCircle } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import type { Book } from '../lib/database.types';

interface DuplicateBookDialogProps {
  existingBook: Book;
  onUpdateReview: (book: Book) => void;
  onAddAsNew: () => void;
  onClose: () => void;
}

export default function DuplicateBookDialog({
  existingBook,
  onUpdateReview,
  onAddAsNew,
  onClose,
}: DuplicateBookDialogProps) {
  return (
    <Modal title="Book already in library" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="flex gap-4 pb-4 border-b border-stone-100">
          <BookCover url={existingBook.cover_image_url} title={existingBook.title} size="md" className="flex-shrink-0" />
          <div className="flex-1 min-w-0 pt-1">
            <h3 className="font-semibold text-stone-900 leading-snug">{existingBook.title}</h3>
            <p className="text-sm text-stone-500 mt-0.5">{existingBook.author}</p>
            {existingBook.elo_score !== undefined && (
              <p className="text-xs text-stone-400 mt-1">{existingBook.elo_score.toFixed(1)} / 10</p>
            )}
          </div>
        </div>

        <p className="text-sm text-stone-600">
          This book is already in your library. What would you like to do?
        </p>

        <button
          onClick={() => onUpdateReview(existingBook)}
          className="w-full flex items-start gap-3 p-4 border-2 border-stone-200 rounded-xl hover:border-stone-900 hover:bg-stone-50 transition-all text-left"
        >
          <BookOpen size={20} className="text-stone-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-stone-900 text-sm">Update my review</p>
            <p className="text-xs text-stone-400 mt-0.5">Add a new review entry to the existing book record</p>
          </div>
        </button>

        <button
          onClick={onAddAsNew}
          className="w-full flex items-start gap-3 p-4 border-2 border-stone-200 rounded-xl hover:border-stone-400 hover:bg-stone-50 transition-all text-left"
        >
          <PlusCircle size={20} className="text-stone-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-stone-900 text-sm">Add as new entry</p>
            <p className="text-xs text-stone-400 mt-0.5">Create a separate book record anyway</p>
          </div>
        </button>
      </div>
    </Modal>
  );
}
