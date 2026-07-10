export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tasteProfile } = req.body;

    if (!process.env.GEMINI_API_KEY && !process.env.VITE_GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY;

    if (!tasteProfile) {
      return res.status(400).json({ error: 'No taste profile provided' });
    }

    const requestBody = JSON.stringify({
      contents: [{
        parts: [{
          text: `You are a sophisticated book recommendation engine. Based on this reader's taste profile, recommend exactly 5 books they haven't read yet.

READER'S TASTE PROFILE:
${tasteProfile}

INSTRUCTIONS:
- Recommend books the reader is likely to love based on their highest-rated books and genre preferences
- Consider their opinion signals — if they consistently agree with certain themes or disagree with others, factor that in
- Avoid recommending books already in their library
- Include a mix of well-known and lesser-known titles
- For series, recommend the first book only
- Weight recommendations heavily toward genres they rate highest

Return ONLY a JSON array with exactly 5 objects in this format, no markdown, no backticks, no other text:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "genre": "Primary Genre",
    "reason": "2-3 sentence explanation of why this reader specifically would enjoy this book based on their taste profile",
    "confidence": "high"
  }
]`
        }]
      }]
    });

    const models = ['gemini-2.0-flash-001', 'gemini-2.5-flash'];
    let response, data;

    for (const model of models) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        }
      );
      data = await response.json();
      if (response.ok) break;
      if (data?.error?.code !== 404) break;
    }

    if (!response.ok) {
      return res.status(500).json({
        error: `Gemini API error: ${JSON.stringify(data)}`,
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({ error: 'No response from Gemini' });
    }

    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const recommendations = JSON.parse(cleaned);

    return res.status(200).json({ recommendations });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
}
