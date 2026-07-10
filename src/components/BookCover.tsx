import { useState } from 'react';

interface BookCoverProps {
  url: string | null;
  title: string;
  author?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'w-14 h-20',
  md: 'w-24 h-36',
  lg: 'w-32 h-48',
  xl: 'w-40 h-60',
};

const SPINE_COLORS = [
  '#4E6B5E',
  '#5B6B84',
  '#7A6355',
  '#6B5470',
  '#5B7A6B',
  '#7A5B5B',
  '#5E6B4E',
  '#4E5B6B',
];

function getSpineColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  return SPINE_COLORS[Math.abs(hash) % SPINE_COLORS.length];
}

const TITLE_FONT = { sm: '9px', md: '11px', lg: '12px', xl: '14px' } as const;
const AUTHOR_FONT = { sm: '8px', md: '9px', lg: '10px', xl: '11px' } as const;

export default function BookCover({ url, title, author, size = 'md', className = '' }: BookCoverProps) {
  const [imgError, setImgError] = useState(false);

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={title}
        className={`${sizes[size]} object-cover rounded shadow-sm ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  const showAuthor = !!author && size !== 'sm';
  const verticalStyle: React.CSSProperties = {
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    overflow: 'hidden',
    display: 'block',
  };

  return (
    <div
      className={`${sizes[size]} rounded shadow-sm overflow-hidden flex items-center justify-center gap-2 px-1.5 ${className}`}
      style={{ backgroundColor: getSpineColor(title) }}
    >
      <span
        className="text-white font-semibold leading-tight"
        style={{
          ...verticalStyle,
          fontSize: TITLE_FONT[size],
          maxHeight: showAuthor ? '62%' : '85%',
        }}
      >
        {title}
      </span>
      {showAuthor && (
        <span
          className="text-white/60 leading-tight"
          style={{
            ...verticalStyle,
            fontSize: AUTHOR_FONT[size],
            maxHeight: '50%',
          }}
        >
          {author}
        </span>
      )}
    </div>
  );
}
