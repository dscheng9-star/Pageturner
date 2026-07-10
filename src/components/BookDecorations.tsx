/* Subtle grayscale book-themed SVG decorations for background watermarks.
   All illustrations are line-art only, use currentColor, and are rendered
   at very low opacity so they never compete with foreground content. */

type DecorationProps = {
  className?: string;
  style?: React.CSSProperties;
};

const baseStyle: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  color: '#44403c',
  opacity: 0.04,
  userSelect: 'none',
};

/* An open book with visible page lines */
function OpenBook({ className, style }: DecorationProps) {
  return (
    <svg
      viewBox="0 0 120 90"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ ...baseStyle, ...style }}
      aria-hidden="true"
    >
      <path d="M60 20 C50 14 35 12 12 14 L12 72 C35 70 50 72 60 78" />
      <path d="M60 20 C70 14 85 12 108 14 L108 72 C85 70 70 72 60 78" />
      <path d="M60 20 L60 78" />
      <path d="M20 26 L50 24 M20 34 L50 32 M20 42 L50 40 M20 50 L45 48" opacity="0.6" />
      <path d="M70 24 L100 26 M70 32 L100 34 M70 40 L100 42 M75 48 L100 50" opacity="0.6" />
    </svg>
  );
}

/* A stack of three books */
function BookStack({ className, style }: DecorationProps) {
  return (
    <svg
      viewBox="0 0 100 90"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ ...baseStyle, ...style }}
      aria-hidden="true"
    >
      <rect x="14" y="62" width="72" height="14" rx="2" />
      <rect x="20" y="44" width="60" height="14" rx="2" />
      <rect x="10" y="26" width="68" height="14" rx="2" />
      <path d="M22 70 L22 68 M30 70 L30 68 M78 52 L78 50 M28 34 L28 32" opacity="0.5" />
    </svg>
  );
}

/* A closed book with a bookmark */
function BookmarkedBook({ className, style }: DecorationProps) {
  return (
    <svg
      viewBox="0 0 70 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ ...baseStyle, ...style }}
      aria-hidden="true"
    >
      <rect x="14" y="10" width="42" height="80" rx="3" />
      <path d="M14 22 L56 22 M14 78 L56 78" opacity="0.5" />
      <path d="M40 10 L40 30 L46 25 L52 30 L52 10" />
    </svg>
  );
}

/* A feather/quill */
function Quill({ className, style }: DecorationProps) {
  return (
    <svg
      viewBox="0 0 80 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ ...baseStyle, ...style }}
      aria-hidden="true"
    >
      <path d="M62 12 C40 20 26 36 22 58 L18 78" />
      <path d="M62 12 C68 20 68 34 60 44 C52 54 42 58 34 60" />
      <path d="M52 28 L60 30 M44 38 L54 40 M36 48 L48 50 M28 56 L42 58" opacity="0.5" />
      <path d="M18 78 L14 88" />
    </svg>
  );
}

/* A small bookshelf with books */
function Bookshelf({ className, style }: DecorationProps) {
  return (
    <svg
      viewBox="0 0 110 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ ...baseStyle, ...style }}
      aria-hidden="true"
    >
      <rect x="6" y="6" width="98" height="68" rx="2" />
      <path d="M6 40 L104 40" />
      <path d="M20 10 L20 36 M30 10 L30 36 M40 10 L40 36 M52 10 L52 36 M64 10 L64 36 M76 10 L76 36 M88 10 L88 36" opacity="0.5" />
      <path d="M18 46 L18 70 M34 46 L34 70 M50 46 L50 70 M66 46 L66 70 M82 46 L82 70 M96 46 L96 70" opacity="0.5" />
    </svg>
  );
}

/* A page with lines of text */
function ManuscriptPage({ className, style }: DecorationProps) {
  return (
    <svg
      viewBox="0 0 90 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ ...baseStyle, ...style }}
      aria-hidden="true"
    >
      <path d="M16 8 C40 4 50 4 74 8 L74 88 C50 84 40 84 16 88 Z" />
      <path d="M16 8 C40 12 50 12 74 8" opacity="0.5" />
      <path d="M24 24 L66 22 M24 34 L66 32 M24 44 L66 42 M24 54 L60 52 M24 64 L66 62 M24 74 L54 72" opacity="0.4" />
    </svg>
  );
}

/* A pair of reading glasses over a book */
function GlassesAndBook({ className, style }: DecorationProps) {
  return (
    <svg
      viewBox="0 0 110 70"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ ...baseStyle, ...style }}
      aria-hidden="true"
    >
      <path d="M10 44 C30 38 40 38 55 44 C70 38 80 38 100 44" />
      <circle cx="24" cy="44" r="12" />
      <circle cx="86" cy="44" r="12" />
      <path d="M55 44 L55 38" opacity="0.5" />
      <path d="M20 60 L90 60 M20 60 L20 64 L90 64 L90 60" opacity="0.4" />
    </svg>
  );
}

type Illustration = React.FC<DecorationProps>;

const illustrations: Illustration[] = [
  OpenBook,
  BookStack,
  BookmarkedBook,
  Quill,
  Bookshelf,
  ManuscriptPage,
  GlassesAndBook,
];

/**
 * Scatters subtle grayscale book illustrations across a container.
 * The parent must be `position: relative` and `overflow: hidden`.
 * Props allow customizing which illustrations show and their placement.
 */
export function BookDecorations() {
  // Fixed placements so they stay consistent across renders
  const placements = [
    { idx: 0, top: '4%',   left: '2%',  w: 180, h: 135, rot: -8 },  // OpenBook top-left
    { idx: 1, top: '38%',  left: '88%', w: 130, h: 117, rot: 12 },  // BookStack right
    { idx: 2, top: '72%',  left: '5%',  w: 90,  h: 128, rot: 6 },   // BookmarkedBook bottom-left
    { idx: 4, top: '8%',   left: '82%', w: 150, h: 109, rot: -5 },  // Bookshelf top-right
    { idx: 5, top: '60%',  left: '78%', w: 100, h: 111, rot: 10 }, // ManuscriptPage mid-right
    { idx: 3, top: '50%',  left: '40%', w: 80,  h: 100, rot: -12 },// Quill center
  ];

  return (
    <>
      {placements.map((p, i) => {
        const Svg = illustrations[p.idx];
        return (
          <Svg
            key={i}
            style={{
              top: p.top,
              left: p.left,
              width: p.w,
              height: p.h,
              transform: `rotate(${p.rot}deg)`,
            }}
          />
        );
      })}
    </>
  );
}

export { OpenBook, BookStack, BookmarkedBook, Quill, Bookshelf, ManuscriptPage, GlassesAndBook };
