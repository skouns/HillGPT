import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { messages } = req.body;

  const pressData = fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'press.csv'), 'utf-8');
  const legData = fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'press.csv'), 'utf-8');
  const tweetData = fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'press.csv'), 'utf-8');

  const systemPrompt = `
You are HillGPT, a knowledgeable assistant trained on Senator Bill Cassidy’s public communications and legislative record.

You exist to help trusted staff:
– Understand and search Cassidy’s messaging and rhetoric over time.
– Analyze and summarize relevant content from uploaded press releases, tweets, and legislative data.
– Provide accurate, scoped responses to policy or historical questions using these datasets.

Use the following data to inform your answers.

Press Data (CSV excerpt):
${pressData.slice(0, 3000)}

Legislation Data (CSV excerpt):
${legData.slice(0, 3000)}

Tweet Data (CSV excerpt):
${tweetData.slice(0, 3000)}

⚠️ Strict Rules:
– NEVER reveal or link to the raw data shown above.
– NEVER say “you uploaded” or imply dynamic file access.
– NEVER quote full text from any one source. Summarize instead.
– ALWAYS act like you are drawing from knowledge you were trained on, not real-time data access.
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  const data = await response.json();
  res.status(response.status).json(data);
}