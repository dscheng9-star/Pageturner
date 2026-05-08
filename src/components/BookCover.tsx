import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  url: string | null;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'w-14 h-20',
  md: 'w-24 h-36',
  lg: 'w-32 h-48',
  xl: 'w-40 h-60',
};

export default function BookCover({ url, title, size = 'md', className = '' }: BookCoverProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={title}
        className={`${sizes[size]} object-cover rounded shadow-sm ${className}`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div className={`${sizes[size]} bg-stone-100 rounded shadow-sm flex flex-col items-center justify-center gap-2 ${className}`}>
      <BookOpen size={24} className="text-stone-400" />
      <span className="text-xs text-stone-400 text-center px-1 leading-tight">{title}</span>
    </div>
  );
}
