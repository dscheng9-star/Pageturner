import { createClient } from '@supabase/supabase-js';

async function verifyToken(req) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return null;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { bookTitle, bookAuthor } = req.body;

  if (!bookTitle || !bookAuthor) {
    return res.status(400).json({ error: 'bookTitle and bookAuthor are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [
          {
            role: 'user',
            content: `Search Reddit, Goodreads, and book review sites for opinions on "${bookTitle}" by ${bookAuthor}. Then synthesize what you find into exactly this JSON format and nothing else, no markdown backticks:\n{\n  "popular_opinions": [\n    "Statement one as a declarative first-person opinion",\n    "Statement two",\n    "Statement three",\n    "Statement four"\n  ],\n  "unpopular_opinions": [\n    "Contrarian statement one",\n    "Contrarian statement two"\n  ]\n}\nYour entire response must be only the JSON object with no text before or after it, no markdown formatting, and no backticks.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Claude API error: ${text}` });
    }

    const data = await response.json();

    if (data.error) {
      return res.status(502).json({ error: `Claude API error: ${data.error.message}` });
    }

    const textBlocks = (data.content ?? []).filter(b => b.type === 'text');
    let opinions = null;

    for (const block of textBlocks) {
      try {
        const cleaned = block.text
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*"popular_opinions"[\s\S]*\}/);
        if (jsonMatch) {
          opinions = JSON.parse(jsonMatch[0]);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!opinions || !opinions.popular_opinions || !opinions.unpopular_opinions) {
      return res.status(502).json({ error: 'Could not extract valid opinions from Claude response' });
    }

    return res.status(200).json(opinions);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
