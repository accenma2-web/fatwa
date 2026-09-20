const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  const chunks = [];

  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

/*
========================================================
البحث الذكي البسيط
========================================================

الفكرة:
لا نرسل طلبًا إضافيًا إلى OpenAI لفهم السؤال.

نحوّل بعض التعبيرات العامية إلى كلمات بحث شرعية،
ثم نبحث في D1.

بعد ذلك فقط نستخدم OpenAI مرة واحدة لصياغة الإجابة
اعتمادًا على المصادر التي تم العثور عليها.
*/

function buildSearchTerms(question) {
  const text = normalizeText(question).toLowerCase();

  const terms = new Set();

  // الكلمات الموجودة فعليًا في السؤال
  const words = text
    .replace(/[^\u0600-\u06FF0-9a-zA-Z ]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 3);

  for (const word of words.slice(0, 12)) {
    terms.add(word);
  }

  // ----------------------------------------------------
  // البنوك والفوائد
  // ----------------------------------------------------

  if (
    text.includes("بنك") ||
    text.includes("البنك") ||
    text.includes("بنوك") ||
    text.includes("البنوك") ||
    text.includes("فايده") ||
    text.includes("فائدة") ||
    text.includes("فوائد") ||
    text.includes("عائد") ||
    text.includes("عوائد") ||
    text.includes("عوايد")
  ) {
    terms.add("فوائد البنوك");
    terms.add("البنوك");
    terms.add("فوائد");
    terms.add("العوائد");
    terms.add("التعامل مع البنوك");
    terms.add("التمويل");
  }

  // ----------------------------------------------------
  // التقسيط
  // ----------------------------------------------------

  if (
    text.includes("تقسيط") ||
    text.includes("بالتقسيط") ||
    text.includes("قسط") ||
    text.includes("اقساط") ||
    text.includes("بالقسط")
  ) {
    terms.add("التقسيط");
    terms.add("البيع بالتقسيط");
    terms.add("الربح");
    terms.add("الثمن");
    terms.add("البيع");
  }

  // ----------------------------------------------------
  // زيادة سعر التقسيط عن الكاش
  // ----------------------------------------------------

  if (
    text.includes("كاش") ||
    text.includes("نقد") ||
    text.includes("نقدا") ||
    text.includes("زيادة") ||
    text.includes("زياده") ||
    text.includes("اغلى") ||
    text.includes("أغلى") ||
    text.includes("اكتر من سعر") ||
    text.includes("أكثر من سعر")
  ) {
    terms.add("البيع بالتقسيط");
    terms.add("مقدار الربح");
    terms.add("الربح المباح");
    terms.add("الثمن");
    terms.add("البيع الفوري");
  }

  // ----------------------------------------------------
  // التطبيقات الإلكترونية
  // ----------------------------------------------------

  if (
    text.includes("تطبيق") ||
    text.includes("ابلكيشن") ||
    text.includes("الكتروني") ||
    text.includes("إلكتروني") ||
    text.includes("اونلاين") ||
    text.includes("أونلاين")
  ) {
    terms.add("تطبيق إلكتروني");
    terms.add("الشراء بالتقسيط عن طريق تطبيق");
    terms.add("المعاملات الحديثة");
  }

  // ----------------------------------------------------
  // الزكاة
  // ----------------------------------------------------

  if (
    text.includes("زكاة") ||
    text.includes("زكاه") ||
    text.includes("زكوت")
  ) {
    terms.add("الزكاة");
    terms.add("إخراج الزكاة");
  }

  // ----------------------------------------------------
  // الصيام
  // ----------------------------------------------------

  if (
    text.includes("صيام") ||
    text.includes("صايم") ||
    text.includes("رمضان") ||
    text.includes("افطر") ||
    text.includes("أفطر") ||
    text.includes("افطرت") ||
    text.includes("أفطرت")
  ) {
    terms.add("الصيام");
    terms.add("الإفطار");
    terms.add("نية الإفطار");
  }

  // ----------------------------------------------------
  // الصلاة
  // ----------------------------------------------------

  if (
    text.includes("صلاة") ||
    text.includes("صلاه") ||
    text.includes("استهزاء") ||
    text.includes("يسخر")
  ) {
    terms.add("الصلاة");
    terms.add("الاستهزاء بالصلاة");
    terms.add("مكانة الصلاة");
  }

  // ----------------------------------------------------
  // الزواج والعدة
  // ----------------------------------------------------

  if (
    text.includes("زواج") ||
    text.includes("جواز") ||
    text.includes("ارملة") ||
    text.includes("أرملة") ||
    text.includes("عدة") ||
    text.includes("العدة")
  ) {
    terms.add("الزواج");
    terms.add("الأرملة");
    terms.add("العدة");
    terms.add("أحكام الزوجية");
  }

  // ----------------------------------------------------
  // الطلاق
  // ----------------------------------------------------

  if (
    text.includes("طلاق") ||
    text.includes("طلق") ||
    text.includes("رجعي") ||
    text.includes("رجعة")
  ) {
    terms.add("الطلاق");
    terms.add("الطلاق الرجعي");
    terms.add("أحكام الزوجية");
  }

  return Array.from(terms)
    .filter(term => term.length >= 2)
    .slice(0, 25);
}


/*
========================================================
البحث في قاعدة البيانات
========================================================
*/

async function searchSources(db, question) {
  const terms = buildSearchTerms(question);

  if (!terms.length) {
    return [];
  }

  /*
  نستخدم عددًا محدودًا من المتغيرات حتى لا نقترب
  من حدود SQLite / D1.
  */

  const conditions = terms.map(() => `
    (
      title LIKE ?
      OR summary LIKE ?
      OR question_text LIKE ?
      OR answer_text LIKE ?
      OR category LIKE ?
    )
  `);

  const params = [];

  for (const term of terms) {
    const like = `%${term}%`;

    params.push(
      like,
      like,
      like,
      like,
      like
    );
  }

  const sql = `
    SELECT
      id,
      authority,
      title,
      fatwa_number,
      issued_at,
      url,
      summary,
      content,
      question_text,
      answer_text,
      category
    FROM sources
    WHERE ${conditions.join(" OR ")}
    ORDER BY issued_at DESC
    LIMIT 12
  `;

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all();

  return result.results || [];
}


/*
========================================================
تعليمات OpenAI
========================================================
*/

function buildInstructions() {
  return `
أنت مساعد داخل تطبيق «فتوى».

مهمتك مساعدة المستخدم على فهم المسائل الشرعية
بالاعتماد فقط على المصادر التي يرسلها لك النظام.

المستخدم قد يكتب:
- بالعامية المصرية.
- بالفصحى.
- بطريقة غير مرتبة.
- في صورة قصة.
- أو باستخدام كلمات مختلفة عن المصطلحات الموجودة في الفتوى.

افهم معنى السؤال، ثم طابقه مع المصادر المرفقة.

القواعد الإلزامية:

1) لا تخترع فتوى أو مصدرًا أو رقم فتوى أو رابطًا.

2) لا تنسب قولًا إلى جهة شرعية إلا إذا كان موجودًا
بوضوح في المصادر المرفقة.

3) عند وجود السؤال الأصلي والإجابة الأصلية للمصدر،
اعتمد عليهما قبل العنوان أو الملخص.

4) إذا كان المصدر يجيب عن سؤال المستخدم مباشرة،
اذكر الحكم المنقول عنه بوضوح.

5) إذا كان المستخدم يتحدث بالعامية،
أجب بالعربية الواضحة مع الحفاظ على معنى كلامه.

6) إذا كان السؤال يحتاج تفاصيل مؤثرة في الحكم،
اذكر أن الحكم قد يتغير بحسب التفاصيل ولا تخترع تفاصيل.

7) إذا كانت المصادر غير كافية،
قل بوضوح إن المصادر الحالية لا تكفي للإجابة.

8) لا تستخدم معلومات خارج المصادر المرفقة باعتبارها فتوى.

9) لا تدّع أنك مفتٍ بشري.

10) فرّق بين الحكم المنقول من المصدر وبين الشرح التوضيحي.

11) source_ids يجب أن تحتوي فقط على أرقام SOURCE_ID
الموجودة فعلًا في المصادر المرفقة.

12) أعد JSON صالحًا فقط بالشكل التالي:

{
  "ruling": "خلاصة الحكم المنقول من المصادر أو بيان عدم كفاية المصادر",
  "explanation": "شرح مختصر وواضح",
  "needs_clarification": true,
  "clarifying_question": "سؤال واحد فقط أو فارغ",
  "source_ids": [1,2]
}
`;
}


/*
========================================================
طلب OpenAI
========================================================
*/

async function askOpenAI(env, question, sources) {
  const sourceText = sources.length
    ? sources.map(source => `
SOURCE_ID=${source.id}
الجهة=${source.authority}
العنوان=${source.title}
رقم الفتوى=${source.fatwa_number || ""}
التاريخ=${source.issued_at || ""}
التصنيف=${source.category || ""}
الرابط=${source.url || ""}
السؤال الأصلي=${source.question_text || ""}
الإجابة=${source.answer_text || ""}
الملخص=${source.summary || ""}
المحتوى=${source.content || ""}
`).join("\n")
    : "لا توجد مصادر مطابقة في قاعدة المصادر الحالية.";

  const payload = {
    model: env.OPENAI_MODEL || "gpt-5.6-luna",

    instructions: buildInstructions(),

    input: `
سؤال المستخدم:
${question}

المصادر المسترجعة:
${sourceText}
`,

    max_output_tokens: 1200
  };

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },

      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    console.error(
      "OpenAI API ERROR:",
      response.status,
      detail
    );

    throw new Error(
      `OpenAI API error ${response.status}`
    );
  }

  const data = await response.json();

  const text = extractOutputText(data);

  try {
    const answer = JSON.parse(text);

    const validIds = new Set(
      sources.map(source => source.id)
    );

    answer.source_ids =
      Array.isArray(answer.source_ids)
        ? answer.source_ids.filter(
            id => validIds.has(id)
          )
        : [];

    return answer;

  } catch (error) {

    console.error(
      "OPENAI JSON PARSE ERROR:",
      text
    );

    return {
      ruling:
        "تعذر تحويل إجابة النظام إلى صيغة موثقة. لم يتم اعتمادها كفتوى.",

      explanation:
        "يرجى المحاولة مرة أخرى.",

      needs_clarification: true,

      clarifying_question: "",

      source_ids: []
    };
  }
}


/*
========================================================
Worker
========================================================
*/

export default {

  async fetch(request, env) {

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);


    // ================================================
    // Health
    // ================================================

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        app: "فتوى",
        version: "2.0"
      });
    }


    // ================================================
    // Sources
    // ================================================

    if (
      url.pathname === "/api/sources" &&
      request.method === "GET"
    ) {

      try {

        const rows = await env.DB
          .prepare(`
            SELECT
              id,
              authority,
              title,
              fatwa_number,
              issued_at,
              url,
              summary
            FROM sources
            ORDER BY issued_at DESC
            LIMIT 50
          `)
          .all();

        return json({
          sources: rows.results || []
        });

      } catch (error) {

        console.error(
          "SOURCES ERROR:",
          error
        );

        return json({
          error: "database_error",
          message: "تعذر تحميل المصادر."
        }, 500);
      }
    }


    // ================================================
    // Ask
    // ================================================

    if (
      url.pathname === "/api/ask" &&
      request.method === "POST"
    ) {

      try {

        // التأكد من الخدمات
        if (
          !env.DB ||
          !env.OPENAI_API_KEY
        ) {

          return json({
            error: "backend_not_configured",
            message:
              "قاعدة البيانات أو مفتاح الذكاء الاصطناعي لم يتم ربطهما بعد."
          }, 503);
        }


        // قراءة JSON
        let body;

        try {
          body = await request.json();
        } catch {

          return json({
            error: "invalid_json",
            message: "بيانات الطلب غير صحيحة."
          }, 400);
        }


        // السؤال
        const question =
          normalizeText(body?.question);


        if (question.length < 5) {

          return json({
            error: "question_too_short",
            message:
              "اكتب الموقف بتفصيل أكبر."
          }, 400);
        }


        // البحث في المصادر
        const sources =
          await searchSources(
            env.DB,
            question
          );


        // إجابة OpenAI
        const answer =
          await askOpenAI(
            env,
            question,
            sources
          );


        // حفظ السؤال
        await env.DB
          .prepare(`
            INSERT INTO questions (
              question,
              answer_json,
              created_at
            )
            VALUES (?, ?, datetime('now'))
          `)
          .bind(
            question,
            JSON.stringify(answer)
          )
          .run();


        // تحديد المصادر التي اعتمد عليها النموذج
        const selectedIds =
          new Set(
            Array.isArray(answer.source_ids)
              ? answer.source_ids
              : []
          );


        const citedSources =
          sources.filter(
            source =>
              selectedIds.has(source.id)
          );


        return json({
          ok: true,
          answer,
          sources: citedSources,
          source_candidates: sources
        });

      } catch (error) {

        /*
        مهم جدًا:
        بدل ما الواجهة تعرف فقط أن الاتصال فشل،
        نسجل الخطأ الحقيقي في Cloudflare Logs.
        */

        console.error(
          "API ASK ERROR:",
          error?.stack || error?.message || error
        );

        return json({
          error: "server_error",
          message:
            "حدث خطأ داخلي أثناء معالجة السؤال."
        }, 500);
      }
    }


    // ================================================
    // Not Found
    // ================================================

    return new Response(
      "Not Found",
      {
        status: 404,
        headers: corsHeaders
      }
    );
  }
};
