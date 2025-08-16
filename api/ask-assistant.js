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
  // Remove patterns like {12:16†Press_Releases.txt} or  
  s = s.replace(/(\{|\【)\d+:\d+†[^}\】]+(\}|\】)/g, "");
  // Remove bare filenames with common doc extensions
  s = s.replace(/\b[\w.-]+\.(txt|pdf|docx?|pptx?|xlsx?)\b/gi, "");
  // Collapse excessive whitespace
  s = s.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

async function classifyTier(userText) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a classifier. Classify the following user message into one of these tiers:
- mini: dataset query, fact lookup, summary, simple.
- 4o: opinion, stance, tone, sentiment, mid-level reasoning.
- 41: multi-issue analysis, complex synthesis, long-term implications.
Respond with only one of: mini, 4o, 41.`
        },
        {
          role: "user",
          content: userText
        }
      ],
      temperature: 0
    });
    const tierRaw = response.choices?.[0]?.message?.content || "";
    const tier = tierRaw.trim();
    if (tier === "mini" || tier === "4o" || tier === "41") {
      return tier;
    }
    return "mini";
  } catch (error) {
    console.error("[classifyTier] Error classifying tier:", error);
    return "mini";
  }
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
    const { messages = [], threadId: existingThreadId, message, modelTier, complexity, forceTier } = req.body || {};

    // Normalize: if a single `message` was provided, convert it to messages[]
    const normalizedMessages = messages.length
      ? messages
      : (message ? [{ role: "user", content: message }] : []);

    // Normalize forceTier and complexity hints from the frontend
    const validTier = (t) => (t === 'mini' || t === '4o' || t === '41') ? t : null;
    const forced = validTier(forceTier);
    const hintedByComplexity = (complexity === 'complex') ? '4o' : 'mini';

    const latestUserText = [...normalizedMessages].reverse().find(m => m?.role === 'user')?.content || '';

    let proposedFromHeuristic = null;
    let proposedFromHint = null;

    // If the client explicitly forces a tier, use it as-is for this turn
    if (forced) {
      var nextTier = forced;
    } else {
      // Otherwise, pick purely from the latest message content (allowing downgrade)
      // Use complexity hint as a nudge; fall back to heuristic
      proposedFromHeuristic = await classifyTier(latestUserText);
      proposedFromHint = hintedByComplexity; // 'mini' or '4o'

      console.log(`[classifyTier] Input: "${latestUserText}", Classified Tier: "${proposedFromHeuristic}"`);

      // Simple policy: if heuristic says '41', take it. Otherwise prefer the hint if it suggests '4o'.
      let chosen = proposedFromHeuristic;
      if (proposedFromHeuristic !== '41' && proposedFromHint === '4o') {
        chosen = '4o';
      }
      var nextTier = chosen; // may be 'mini', '4o', or '41'
    }

    console.log(`[handler] Latest User Text: "${latestUserText}", Proposed Heuristic: "${proposedFromHeuristic}", Proposed Hint: "${proposedFromHint}", Final Chosen Tier: "${nextTier}"`);

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