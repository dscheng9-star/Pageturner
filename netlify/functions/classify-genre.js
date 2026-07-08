const { createClient } = require('@supabase/supabase-js');

async function verifyToken(event) {
  const token = event.headers['authorization']?.replace('Bearer ', '');
  if (!token) return null;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

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
  'Media Tie-In Fiction','Star Wars Expanded Universe',
]);

const GENRE_LIST = [...ALLOWED_GENRES].join(', ');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const user = await verifyToken(event);
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { bookTitle, bookAuthor, bookDescription } = JSON.parse(event.body ?? '{}');

    if (!process.env.GEMINI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Given the book "${bookTitle}" by ${bookAuthor} with this description: "${bookDescription}", assign between 1 and 3 genres from this exact list only. Return only a JSON array of genre strings with no other text, no markdown, no backticks. Only use genres from the provided list exactly as written. Example response: ["High Fantasy", "Romantasy"]\n\nGenre list: ${GENRE_LIST}`,
            }],
          }],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Gemini API error: ${JSON.stringify(data)}` }),
      };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'No text in Gemini response', data }),
      };
    }

    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let genres;
    try {
      genres = JSON.parse(cleaned);
    } catch (parseErr) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `JSON parse failed: ${parseErr.message}`, raw: cleaned }),
      };
    }

    if (!Array.isArray(genres)) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Gemini response was not a JSON array', raw: cleaned }),
      };
    }

    const valid = genres.filter(g => typeof g === 'string' && ALLOWED_GENRES.has(g)).slice(0, 3);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valid.length > 0 ? valid : ['Fiction']),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, stack: error.stack }),
    };
  }
};
