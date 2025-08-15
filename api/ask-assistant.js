import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID; // set in Vercel env
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID; // optional

function sanitizeAssistantText(s) {
  if (!s) return s;
  // Remove patterns like {12:16†Press_Releases.txt}
  s = s.replace(/\{\d+:\d+†[^}]+\}/g, "");
  // Remove bare filenames with common doc extensions
  s = s.replace(/\b[\w.-]+\.(txt|pdf|docx?|pptx?|xlsx?)\b/gi, "");
  // Collapse excessive whitespace
  s = s.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages = [], threadId: existingThreadId, message } = req.body || {};

    // Normalize: if a single `message` was provided, convert it to messages[]
    const normalizedMessages = messages.length
      ? messages
      : (message ? [{ role: "user", content: message }] : []);

    if (!ASSISTANT_ID) {
      return res.status(400).json({ error: "ASSISTANT_ID env var is not set" });
    }

    // 1) Create or reuse a thread
    const thread = existingThreadId
      ? { id: existingThreadId }
      : await client.beta.threads.create();

    // 2) Push user/assistant messages into the thread (skip system)
    for (const m of normalizedMessages) {
      if (!m || !m.role || !m.content) continue;
      if (m.role === "system") continue; // system prompt lives on the Assistant
      await client.beta.threads.messages.create(thread.id, {
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }

    // 3) Run the Assistant with strict runtime checklist
    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: ASSISTANT_ID,
      ...(VECTOR_STORE_ID
        ? { tool_resources: { file_search: { vector_store_ids: [VECTOR_STORE_ID] } } }
        : {}),
      additional_instructions: `Follow these hard rules, in order of priority:\n1) Do NOT include filenames, internal IDs, or vector reference markers (e.g., {12:16\u2020Press_Releases.txt}).\n2) Do NOT invent labels or jargon; use plain, neutral language.\n3) Give a concise, policy-first answer.\n4) Sources line only: "Sources: Internal office dataset" or "Sources: None from internal dataset".\n5) If no internal files were used, do not imply that any were.\nBefore sending, self-check that you obeyed 1–5; if not, fix and then send.`,
      temperature: 0.2,
      response_format: { type: "text" },
      max_output_tokens: 700, // uncomment if you want to bound length
    });

    // 4) Get the latest assistant message text
    const list = await client.beta.threads.messages.list(thread.id, { limit: 50 });
    const lastAssistant = list.data.find((m) => m.role === "assistant");
    const text = lastAssistant
      ? (lastAssistant.content || [])
          .map((c) => (c.type === "text" && c.text?.value ? c.text.value : ""))
          .join("\n")
          .trim()
      : "";

    const cleanText = sanitizeAssistantText(text);
    return res.status(200).json({ threadId: thread.id, text: cleanText });
  } catch (err) {
    console.error("Assistants API Error:", err);
    const status = err?.status || 500;
    return res.status(status).json({ error: "Assistants API Error", details: String(err?.message || err) });
  }
}