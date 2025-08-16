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

// Simple heuristic to classify request; can be replaced with a model-based classifier later
function pickTier(userText = "", currentTier = "mini") {
  // Map currentTier to numeric rank to prevent downgrade
  const curRank = currentTier === "41" ? 6 : currentTier === "4o" ? 3 : 0;

  let score = 0;

  // Lower score for dataset search/general questions
  const datasetKeywords = /\b(find|list|show|summarize|search|lookup)\b/i;
  if (datasetKeywords.test(userText)) {
    score += 0; // baseline low score
  }

  // Medium score for sentiment/discussion-level
  const sentimentKeywords = /\b(feel|think|opinion|support|oppose|tone|sentiment|argue|stance|position)\b/i;
  if (sentimentKeywords.test(userText)) {
    score += 3;
  }

  // High score for complex multi-issue analysis
  const multiIssuePattern = /(and|,).*?(and|,)/i;
  if (multiIssuePattern.test(userText) && userText.split(/\s+/).length > 40) {
    score += 6;
  }

  // Ensure score is at least current tier rank to avoid downgrade mid-thread
  score = Math.max(score, curRank);

  let tier;
  if (score >= 8) {
    tier = "41";
  } else if (score >= 3) {
    tier = "4o";
  } else {
    tier = "mini";
  }
  console.log(`[pickTier] Input: "${userText}", Score: ${score}, Chosen Tier: ${tier}`);
  return tier;
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

    // If the client explicitly forces a tier, use it as-is for this turn
    if (forced) {
      var nextTier = forced;
    } else {
      // Otherwise, pick purely from the latest message content (allowing downgrade)
      // Use complexity hint as a nudge; fall back to heuristic
      const proposedFromHeuristic = pickTier(latestUserText, 'mini');
      const proposedFromHint = hintedByComplexity; // 'mini' or '4o'

      // Simple policy: if heuristic says '41', take it. Otherwise prefer the hint if it suggests '4o'.
      let chosen = proposedFromHeuristic;
      if (proposedFromHeuristic !== '41' && proposedFromHint === '4o') {
        chosen = '4o';
      }
      var nextTier = chosen; // may be 'mini', '4o', or '41'
    }

    console.log(`[handler] Latest User Text: "${latestUserText}", Proposed Heuristic: "${proposedFromHeuristic}", Proposed Hint: "${hintedByComplexity}", Final Chosen Tier: "${nextTier}"`);

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