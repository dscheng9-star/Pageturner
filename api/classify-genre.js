export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bookTitle, bookAuthor, bookDescription } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Given the book "${bookTitle}" by ${bookAuthor} with this description: "${bookDescription}", assign between 1 and 3 genres from this exact list only. Return only a JSON array of genre strings with no other text, no markdown, no backticks. Only use genres from the provided list exactly as written. Example response: ["High Fantasy", "Romantasy"]

Genre list: High Fantasy, Epic Fantasy, Dark Fantasy, Urban Fantasy, Grimdark, Fairy Tale Retelling, Mythic Fantasy, Hard Sci-Fi, Space Opera, Cyberpunk, Dystopian, Military Sci-Fi, Biopunk, Time Travel, Psychological Thriller, Crime Thriller, Legal Thriller, Cozy Mystery, Detective Fiction, Espionage, Supernatural Horror, Psychological Horror, Gothic Horror, Cosmic Horror, Literary Fiction, Historical Fiction, Magical Realism, Satire, Short Stories, Contemporary Romance, Historical Romance, Paranormal Romance, Romantasy, Memoir, Biography, History, Popular Science, Philosophy, Self-Help, True Crime, Essay Collection, Bible, Biblical Commentary, Christian Living, Christian Theology, Devotional, Church History, Apologetics, Spiritual Memoir, Religious History, Graphic Novel, Young Adult, Middle Grade, Children's, Media Tie-In Fiction, Star Wars Expanded Universe

Return only the JSON array, nothing else.`
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: `Claude API error: ${JSON.stringify(data)}` });
    }

    const text = data.content?.[0]?.text;

    if (!text) {
      return res.status(500).json({ error: 'No text in Claude response' });
    }

    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const genres = JSON.parse(cleaned);

    return res.status(200).json(genres);
  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
