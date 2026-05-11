exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let bookTitle, bookAuthor;
  try {
    const body = JSON.parse(event.body ?? '{}');
    bookTitle = body.bookTitle;
    bookAuthor = body.bookAuthor;
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  if (!bookTitle || !bookAuthor) {
    return { statusCode: 400, body: 'bookTitle and bookAuthor are required' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: 'ANTHROPIC_API_KEY is not configured' };
  }

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
    const text = await response.text();
    return {
      statusCode: response.status,
      body: `Claude API error: ${text}`,
    };
  }

  const data = await response.json();
  const content = data.content ?? [];
  const lastText = [...content].reverse().find(b => b.type === 'text');
  if (!lastText?.text) {
    return { statusCode: 502, body: 'No text block in Claude response' };
  }

  let parsed;
  try {
    parsed = JSON.parse(lastText.text);
  } catch {
    return { statusCode: 502, body: 'Claude response was not valid JSON' };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  };
};
