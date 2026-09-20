const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
  });
}

function normalizeText(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (typeof c?.text === "string") chunks.push(c.text);
    }
  }
  return chunks.join("\n").trim();
}

async function searchSources(db, question) {
  // First MVP: simple keyword/phrase search in the curated sources table.
  // We will replace/augment this with Arabic full-text/vector retrieval later.
  const terms = normalizeText(question)
    .replace(/[^\u0600-\u06FF\u0750-\u077F0-9a-zA-Z ]/g, " ")
    .split(" ")
    .filter(t => t.length >= 3)
    .slice(0, 10);

  if (!terms.length) return [];

const conditions = terms.map(() =>
  "(title LIKE ? OR summary LIKE ? OR content LIKE ? OR question_text LIKE ? OR answer_text LIKE ? OR category LIKE ?)"
);
  const params = [];
for (const term of terms) {
  const like = `%${term}%`;
  params.push(like, like, like, like, like, like);
}

  const sql = `
    SELECT id, authority, title, fatwa_number, issued_at, url, summary
    FROM sources
    WHERE ${conditions.join(" OR ")}
    ORDER BY issued_at DESC
    LIMIT 8
  `;

  const result = await db.prepare(sql).bind(...params).all();
  return result.results || [];
}

function buildInstructions() {
  return `
أنت مساعد داخل تطبيق «فتوى».
وظيفتك مساعدة المستخدم على فهم المسائل الشرعية بالاعتماد على المصادر التي يرسلها لك النظام.
قواعد إلزامية:
1) لا تخترع فتوى أو مصدرًا أو رقم فتوى أو رابطًا.
2) لا تنسب قولًا لجهة شرعية إلا إذا كان موجودًا في المصادر المرفقة.
3) إذا كانت المصادر غير كافية أو السؤال يحتاج تفاصيل مؤثرة، صرّح بذلك واطلب التفاصيل أو أوصِ بالرجوع إلى مختص.
4) فرّق بوضوح بين نص المصدر وبين الشرح التوضيحي.
5) لا تدّع أنك مفتٍ بشري؛ أنت أداة مساعدة للمعلومات والبحث.
6) أجب بالعربية وبأسلوب واضح ومحترم.
7) أعد JSON صالحًا فقط بالشكل:
{
  "ruling": "خلاصة الحكم أو حالة عدم كفاية المصادر",
  "explanation": "شرح مختصر",
  "needs_clarification": true/false,
  "clarifying_question": "سؤال واحد فقط أو فارغ",
  "source_ids": [1,2]
}
`;
}

async function askOpenAI(env, question, sources) {
  const sourceText = sources.length
    ? sources.map(s =>
        `SOURCE_ID=${s.id}\nالجهة=${s.authority}\nالعنوان=${s.title}\nرقم الفتوى=${s.fatwa_number || ""}\nالتاريخ=${s.issued_at || ""}\nالرابط=${s.url}\nالملخص=${s.summary || ""}`
      ).join("\n\n")
    : "لا توجد مصادر مطابقة في قاعدة المصادر الحالية.";

  const payload = {
    model: env.OPENAI_MODEL || "gpt-5.6-luna",
    instructions: buildInstructions(),
    input: `سؤال المستخدم:\n${question}\n\nالمصادر المسترجعة:\n${sourceText}`,
    max_output_tokens: 1200
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${detail.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = extractOutputText(data);

  try {
    return JSON.parse(text);
  } catch {
    return {
      ruling: "تعذر تحويل إجابة النظام إلى صيغة موثقة. لم يتم اعتمادها كفتوى.",
      explanation: "يرجى المحاولة مرة أخرى.",
      needs_clarification: true,
      clarifying_question: "",
      source_ids: []
    };
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, app: "فتوى", version: "2.0" });
    }

    if (url.pathname === "/api/sources" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT id, authority, title, fatwa_number, issued_at, url, summary FROM sources ORDER BY issued_at DESC LIMIT 50"
      ).all();
      return json({ sources: rows.results || [] });
    }

    if (url.pathname === "/api/ask" && request.method === "POST") {
      if (!env.DB || !env.OPENAI_API_KEY) {
        return json({
          error: "backend_not_configured",
          message: "قاعدة البيانات أو مفتاح الذكاء الاصطناعي لم يتم ربطهما بعد."
        }, 503);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ error: "invalid_json" }, 400); }

      const question = normalizeText(body?.question);
      if (question.length < 5) {
        return json({ error: "question_too_short", message: "اكتب الموقف بتفصيل أكبر." }, 400);
      }

      const sources = await searchSources(env.DB, question);
      const answer = await askOpenAI(env, question, sources);

      // Store the interaction for later audit/history.
      await env.DB.prepare(`
        INSERT INTO questions (question, answer_json, created_at)
        VALUES (?, ?, datetime('now'))
      `).bind(question, JSON.stringify(answer)).run();

      const selectedIds = new Set(answer.source_ids || []);
      const citedSources = sources.filter(s => selectedIds.has(s.id));

      return json({
        ok: true,
        answer,
        sources: citedSources,
        source_candidates: sources
      });
    }

    // Static assets are served by the Assets binding in the next deployment step.
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
