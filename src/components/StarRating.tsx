import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number | null;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
}

const sizes = { sm: 14, md: 18, lg: 24 };

export default function StarRating({ value, onChange, size = 'md', readonly = false }: StarRatingProps) {
  const px = sizes[size];
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          className={readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}
        >
          <Star
            size={px}
            className={n <= (value ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-stone-300'}
          />
        </button>
      ))}
    </div>
  );
}
