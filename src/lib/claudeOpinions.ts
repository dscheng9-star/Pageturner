export interface BookOpinions {
  popular_opinions: string[];
  unpopular_opinions: string[];
}

export async function fetchBookOpinions(
  bookTitle: string,
  bookAuthor: string,
  token: string
): Promise<BookOpinions> {
  const response = await fetch('/.netlify/functions/fetch-opinions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bookTitle, bookAuthor }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`fetch-opinions error ${response.status}: ${text}`);
  }

  const parsed = await response.json() as BookOpinions;
  if (!Array.isArray(parsed.popular_opinions) || !Array.isArray(parsed.unpopular_opinions)) {
    throw new Error('Unexpected response shape from fetch-opinions');
  }
  return parsed;
}
