exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method not allowed' };
    }

    const { bookTitle, bookAuthor, bookDescription } = JSON.parse(event.body);

    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' })
      };
    }

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
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Claude API error: ${JSON.stringify(data)}` })
      };
    }

    const text = data.content?.[0]?.text;

    if (!text) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'No text in Claude response' })
      };
    }

    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const genres = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genres)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  }
};
