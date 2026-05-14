const ALLOWED_GENRES = new Set([
  'High Fantasy','Epic Fantasy','Dark Fantasy','Urban Fantasy','Grimdark','Fairy Tale Retelling','Mythic Fantasy',
  'Hard Sci-Fi','Space Opera','Cyberpunk','Dystopian','Military Sci-Fi','Biopunk','Time Travel',
  'Psychological Thriller','Crime Thriller','Legal Thriller','Cozy Mystery','Detective Fiction','Espionage',
  'Supernatural Horror','Psychological Horror','Gothic Horror','Cosmic Horror',
  'Literary Fiction','Historical Fiction','Magical Realism','Satire','Short Stories',
  'Contemporary Romance','Historical Romance','Paranormal Romance','Romantasy',
  'Memoir','Biography','History','Popular Science','Philosophy','Self-Help','True Crime','Essay Collection',
  'Bible','Biblical Commentary','Christian Living','Christian Theology','Devotional','Church History',
  'Apologetics','Spiritual Memoir','Religious History',
  'Graphic Novel','Young Adult','Middle Grade',"Children's",
]);

const GENRE_LIST = [...ALLOWED_GENRES].join(', ');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let bookTitle, bookAuthor, bookDescription;
  try {
    const body = JSON.parse(event.body ?? '{}');
    bookTitle       = body.bookTitle       ?? '';
    bookAuthor      = body.bookAuthor      ?? '';
    bookDescription = body.bookDescription ?? '';
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  if (!bookTitle || !bookAuthor) {
    return { statusCode: 400, body: 'bookTitle and bookAuthor are required' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['Fiction']),
    };
  }

  const prompt = `Given the book "${bookTitle}" by ${bookAuthor} with this description: "${bookDescription}", assign between 1 and 3 genres from this exact list only. Return only a JSON array of genre strings with no other text, no markdown, no backticks. Only use genres from the provided list exactly as written. Example response: ["High Fantasy", "Romantasy"]\n\nGenre list: ${GENRE_LIST}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(['Fiction']),
      };
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    let genres;
    try {
      genres = JSON.parse(cleaned);
    } catch {
      genres = null;
    }

    if (!Array.isArray(genres)) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(['Fiction']),
      };
    }

    // Filter to only allowed genres, cap at 3
    const valid = genres.filter(g => typeof g === 'string' && ALLOWED_GENRES.has(g)).slice(0, 3);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valid.length > 0 ? valid : ['Fiction']),
    };
  } catch {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['Fiction']),
    };
  }
};
