import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.BillBot });
const ASSISTANT_ID = process.env.ASSISTANT_ID; // set in Vercel
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID; // optional: if not attached to assistant

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages = [], threadId: existingThreadId } = req.body || {};

    // 1) Create or reuse a thread
    const thread = existingThreadId
      ? { id: existingThreadId }
      : await client.beta.threads.create();

    // 2) Push all prior messages into the thread (preserves chat history)
    // Expecting items like { role: 'user' | 'assistant' | 'system', content: string }
    // The Assistants API supports 'user' and 'assistant'. We'll skip 'system'.
    for (const m of messages) {
      if (!m || !m.role || !m.content) continue;
      if (m.role === "system") continue; // system prompts should live on the Assistant, not per-message
      await client.beta.threads.messages.create(thread.id, {
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }

    if (!ASSISTANT_ID) {
      return res.status(400).json({ error: "ASSISTANT_ID env var is not set" });
    }

    // 3) Run the Assistant (attach vector store per-run if you didn't attach it on the Assistant)
    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: ASSISTANT_ID,
      ...(VECTOR_STORE_ID
        ? { tool_resources: { file_search: { vector_store_ids: [VECTOR_STORE_ID] } } }
        : {}),
    });

    // 4) Get the latest assistant message text
    const list = await client.beta.threads.messages.list(thread.id, { limit: 50 });
    const lastAssistant = list.data.find((m) => m.role === "assistant");

    // Messages can contain multiple content parts; stitch any text parts together
    const text = lastAssistant
      ? (lastAssistant.content || [])
          .map((c) => (c.type === "text" && c.text?.value ? c.text.value : ""))
          .join("\n")
      : "";

    return res.status(200).json({ threadId: thread.id, text });
  } catch (err) {
    console.error("Assistants API Error:", err);
    const status = err?.status || 500;
    return res.status(status).json({ error: "Assistants API Error", details: String(err?.message || err) });
  }
}