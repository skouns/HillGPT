import OpenAI from "openai";

if (!process.env.BillBot) {
  console.error('[ask-assistant] Missing OPENAI_API_KEY');
}
if (!process.env.ASSISTANT_ID) {
  console.error('[ask-assistant] Missing ASSISTANT_ID');
}
const client = new OpenAI({ apiKey: process.env.BillBot || process.env.OPENAI_API_KEY });

const ASSISTANT_ID_MINI = process.env.ASSISTANT_ID_MINI || process.env.ASSISTANT_ID; // fallback to single assistant
const ASSISTANT_ID_4O   = process.env.ASSISTANT_ID_4O || null;
const ASSISTANT_ID_41   = process.env.ASSISTANT_ID_41 || null;

function configuredTiers() {
  return {
    mini: !!ASSISTANT_ID_MINI,
    o4:   !!ASSISTANT_ID_4O,
    g41:  !!ASSISTANT_ID_41,
  };
}

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

// Simple heuristic to classify request; can be replaced with a model-based classifier later
function pickTier(userText = "", currentTier = "mini") {
  // escalate-only; never downgrade from a higher tier
  const cur = currentTier === "41" ? 2 : currentTier === "4o" ? 1 : 0;

  const hasCompare = /\b(compare|contrast|versus|vs\.|trade[- ]offs?)\b/i.test(userText);
  const longQ = userText.length > 600;
  const sensitive = /(social security|medicare|appropriations|immigration|border|abortion|gun|foreign policy|defense)/i.test(userText);
  const multiPart = /\?|\.|;/.test(userText) && (userText.match(/\?|\.|;/g) || []).length > 2;

  let tierScore = 0;
  if (hasCompare) tierScore++;
  if (longQ) tierScore++;
  if (sensitive) tierScore++;
  if (multiPart) tierScore++;

  let proposed = tierScore >= 2 ? "4o" : "mini"; // default path
  if (tierScore >= 3) proposed = "41"; // most complex

  // enforce escalate-only relative to currentTier
  const propRank = proposed === "41" ? 2 : proposed === "4o" ? 1 : 0;
  const rank = Math.max(cur, propRank);
  return rank === 2 ? "41" : rank === 1 ? "4o" : "mini";
}

function idForTier(tier) {
  if (tier === "41" && ASSISTANT_ID_41) return ASSISTANT_ID_41;
  if (tier === "4o"  && ASSISTANT_ID_4O) return ASSISTANT_ID_4O;
  return ASSISTANT_ID_MINI; // fallback
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages = [], threadId: existingThreadId, message, modelTier } = req.body || {};

    // Normalize: if a single `message` was provided, convert it to messages[]
    const normalizedMessages = messages.length
      ? messages
      : (message ? [{ role: "user", content: message }] : []);

    const latestUserText = [...normalizedMessages].reverse().find(m => m?.role === 'user')?.content || '';
    // Choose tier using escalate-only policy; default to provided modelTier if any
    const currentTier = (modelTier === '41' || modelTier === '4o' || modelTier === 'mini') ? modelTier : 'mini';
    const nextTier = pickTier(latestUserText, currentTier);
    const assistantIdForRun = idForTier(nextTier);

    if (!assistantIdForRun) {
      return res.status(400).json({
        error: "No assistant configured for selected tier",
        details: {
          nextTier,
          expected_envs: [
            'ASSISTANT_ID_MINI (or ASSISTANT_ID as fallback)',
            'ASSISTANT_ID_4O (optional, for 4o tier)',
            'ASSISTANT_ID_41 (optional, for 4.1 tier)'
          ]
        }
      });
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
      assistant_id: assistantIdForRun,
      ...(VECTOR_STORE_ID
        ? { tool_resources: { file_search: { vector_store_ids: [VECTOR_STORE_ID] } } }
        : {}),
      additional_instructions: `Follow these hard rules, in order of priority:\n1) Do NOT include filenames, internal IDs, or vector reference markers (e.g., {12:16\u2020Press_Releases.txt}).\n2) Do NOT invent labels or jargon; use plain, neutral language.\n3) Give a concise, policy-first answer.\n4) Sources line only: "Sources: Internal office dataset" or "Sources: None from internal dataset".\n5) If no internal files were used, do not imply that any were.\nBefore sending, self-check that you obeyed 1–5; if not, fix and then send.`,
      temperature: 0.2,
      response_format: { type: "text" },
      // max_output_tokens: 700, // uncomment if you want to bound length
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
    return res.status(200).json({ threadId: thread.id, text: cleanText, modelTier: nextTier });
  } catch (err) {
    // Surface as much structured info as possible for debugging
    const status = err?.status || err?.response?.status || 500;
    const payload = {
      error: "Assistants API Error",
      message: err?.message || null,
      code: err?.code || null,
      status,
      openai: err?.response?.data || null,
      stack: (process.env.NODE_ENV !== 'production' && (err?.stack || null)) || undefined,
    };
    console.error("Assistants API Error:", payload);
    return res.status(status).json(payload);
  }
}