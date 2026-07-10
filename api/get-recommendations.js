export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tasteProfile } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
    }

    if (!tasteProfile) {
      return res.status(400).json({ error: 'No taste profile provided' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `You are a sophisticated book recommendation engine. Based on this reader's taste profile, recommend exactly 5 books they haven't read yet.

READER'S TASTE PROFILE:
${tasteProfile}

INSTRUCTIONS:
- Recommend books the reader is likely to love based on their highest-rated books and genre preferences
- Consider their opinion signals — if they consistently agree with certain themes or disagree with others, factor that in
- Avoid recommending books already in their library
- Include a mix of well-known and lesser-known titles
- For series, recommend the first book only
- Weight recommendations heavily toward genres they rate highest

Return ONLY a JSON array with exactly 5 objects, no markdown, no backticks, no other text:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "genre": "Primary Genre",
    "reason": "2-3 sentence explanation of why this reader specifically would enjoy this book based on their taste profile",
    "confidence": "high" or "medium"
  }
]`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: `Claude API error: ${JSON.stringify(data)}`,
      });
    }

    const text = data.content?.[0]?.text;

    if (!text) {
      return res.status(500).json({ error: 'No response from Claude' });
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
