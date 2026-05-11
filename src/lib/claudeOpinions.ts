export interface BookOpinions {
  popular_opinions: string[];
  unpopular_opinions: string[];
}

export async function fetchBookOpinions(
  bookTitle: string,
  bookAuthor: string
): Promise<BookOpinions> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No Anthropic API key configured');

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
          content: `Search Reddit, Goodreads, and book review sites for opinions on "${bookTitle}" by ${bookAuthor}. Then synthesize what you find into exactly this JSON format and nothing else, no markdown backticks:\n{\n  "popular_opinions": [\n    "Statement one as a declarative first-person opinion",\n    "Statement two",\n    "Statement three",\n    "Statement four"\n  ],\n  "unpopular_opinions": [\n    "Contrarian statement one",\n    "Contrarian statement two"\n  ]\n}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error ${response.status}`);
  }

  const data = await response.json();

  // Find the last text content block
  const content: Array<{ type: string; text?: string }> = data.content ?? [];
  const lastText = [...content].reverse().find(b => b.type === 'text');
  if (!lastText?.text) throw new Error('No text in Claude response');

  const parsed = JSON.parse(lastText.text) as BookOpinions;
  if (!Array.isArray(parsed.popular_opinions) || !Array.isArray(parsed.unpopular_opinions)) {
    throw new Error('Unexpected response shape');
  }
  return parsed;
}
