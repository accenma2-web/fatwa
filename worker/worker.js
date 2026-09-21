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

/*
  V2.1
  --------------------------------------------------
  محرك فهم ومطابقة المصادر.

  الفكرة:
  1) نفهم موضوع السؤال.
  2) نحدد الكلمات المفتاحية المهمة.
  3) نبحث عن المصادر المتعلقة بالموضوع.
  4) نعطي أولوية للسؤال الأصلي والإجابة الأصلية.
  5) نقلل عدد المصادر المرسلة للـAI.
  6) لا نغير قاعدة البيانات أو الواجهة.
*/

function normalizeArabic(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  تحديد المجال الرئيسي للسؤال.
*/
function detectTopics(question) {
  const text = normalizeArabic(question);

  const topics = [];

  const bankWords = [
    "بنك",
    "بنوك",
    "فوائد",
    "فائده",
    "عائد",
    "عوائد",
    "عوايد",
    "شهادات",
    "حساب توفير",
    "وديعه",
    "ودائع"
  ];

  const installmentWords = [
    "تقسيط",
    "قسط",
    "اقساط",
    "كاش",
    "نقد",
    "نقدا",
    "زياده",
    "زيادة",
    "اغلى",
    "أغلى",
    "سعر اعلى",
    "سعر أعلى",
    "اجمالي",
    "إجمالي",
    "مؤجل",
    "مؤجل"
  ];

  const appWords = [
    "تطبيق",
    "ابلكيشن",
    "الكتروني",
    "إلكتروني",
    "اونلاين",
    "أونلاين",
    "منصه",
    "منصة"
  ];

  const zakatWords = [
    "زكاه",
    "زكاة",
    "زكوت",
    "زكاه المال",
    "زكاة المال"
  ];

  const fastingWords = [
    "صيام",
    "صايم",
    "رمضان",
    "افطار",
    "إفطار",
    "افطر",
    "أفطر",
    "افطرت",
    "أفطرت",
    "نيه الافطار",
    "نية الإفطار"
  ];

  const prayerWords = [
    "صلاه",
    "صلاة",
    "استهزاء",
    "يسخر",
    "سخريه",
    "سخرية"
  ];

  const marriageWords = [
    "زواج",
    "جواز",
    "ارمله",
    "أرملة",
    "عده",
    "عدة",
    "زوجيه",
    "الزوجية"
  ];

  const divorceWords = [
    "طلاق",
    "طلق",
    "رجعي",
    "رجعه",
    "رجعة"
  ];

  if (bankWords.some(word => text.includes(normalizeArabic(word)))) {
    topics.push("banks");
  }

  if (installmentWords.some(word => text.includes(normalizeArabic(word)))) {
    topics.push("installments");
  }

  if (appWords.some(word => text.includes(normalizeArabic(word)))) {
    topics.push("electronic");
  }

  if (zakatWords.some(word => text.includes(normalizeArabic(word)))) {
    topics.push("zakat");
  }

  if (fastingWords.some(word => text.includes(normalizeArabic(word)))) {
    topics.push("fasting");
  }

  if (prayerWords.some(word => text.includes(normalizeArabic(word)))) {
    topics.push("prayer");
  }

  if (marriageWords.some(word => text.includes(normalizeArabic(word)))) {
    topics.push("marriage");
  }

  if (divorceWords.some(word => text.includes(normalizeArabic(word)))) {
    topics.push("divorce");
  }

  return topics;
}

/*
  مصطلحات البحث الأساسية لكل موضوع.

  لا نرسل عشرات الكلمات إلى D1.
  نستخدم مجموعة صغيرة ذات معنى.
*/
function buildTopicTerms(topics) {
  const terms = new Set();

  for (const topic of topics) {

    if (topic === "banks") {
      terms.add("فوائد البنوك");
      terms.add("التعامل مع البنوك");
      terms.add("البنوك");
      terms.add("التمويل");
    }

    if (topic === "installments") {
      terms.add("البيع بالتقسيط");
      terms.add("مقدار الربح");
      terms.add("الربح المباح");
      terms.add("الثمن");
      terms.add("البيع الفوري");
      terms.add("البيع");
    }

    if (topic === "electronic") {
      terms.add("تطبيق إلكتروني");
      terms.add("الشراء بالتقسيط عن طريق تطبيق");
      terms.add("المعاملات الحديثة");
    }

    if (topic === "zakat") {
      terms.add("الزكاة");
      terms.add("إخراج الزكاة");
    }

    if (topic === "fasting") {
      terms.add("الصيام");
      terms.add("الإفطار");
      terms.add("نية الإفطار");
    }

    if (topic === "prayer") {
      terms.add("الصلاة");
      terms.add("الاستهزاء بالصلاة");
      terms.add("مكانة الصلاة");
    }

    if (topic === "marriage") {
      terms.add("الزواج");
      terms.add("الأرملة");
      terms.add("العدة");
      terms.add("أحكام الزوجية");
    }

    if (topic === "divorce") {
      terms.add("الطلاق");
      terms.add("الطلاق الرجعي");
      terms.add("أحكام الزوجية");
    }
  }

  return Array.from(terms);
}

/*
  نضيف بعض الكلمات المهمة من السؤال نفسه،
  لكن بعدد محدود حتى لا نخلق استعلامًا ضخمًا.
*/
function buildQuestionTerms(question) {
  const text = normalizeText(question);

  const words = text
    .replace(/[^\u0600-\u06FF0-9a-zA-Z ]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 3);

  return words.slice(0, 8);
}

/*
  حساب درجة الصلة بين السؤال والمصدر.

  كلما تطابقت الكلمات مع:
  - السؤال الأصلي
  - الإجابة
  - العنوان
  - التصنيف

  ترتفع الأولوية.
*/
function scoreSource(source, question, topics) {
  const q = normalizeArabic(question);

  const title = normalizeArabic(source.title);
  const summary = normalizeArabic(source.summary);
  const sourceQuestion = normalizeArabic(source.question_text);
  const answer = normalizeArabic(source.answer_text);
  const category = normalizeArabic(source.category);

  let score = 0;

  const questionWords = q
    .split(/\s+/)
    .filter(word => word.length >= 3)
    .slice(0, 15);

  for (const word of questionWords) {

    if (sourceQuestion.includes(word)) {
      score += 8;
    }

    if (title.includes(word)) {
      score += 6;
    }

    if (answer.includes(word)) {
      score += 4;
    }

    if (summary.includes(word)) {
      score += 3;
    }

    if (category.includes(word)) {
      score += 2;
    }
  }

  for (const topic of topics) {

    if (topic === "installments") {
      if (
        title.includes("تقسيط") ||
        sourceQuestion.includes("تقسيط")
      ) {
        score += 15;
      }

      if (
        title.includes("ربح") ||
        sourceQuestion.includes("ربح")
      ) {
        score += 5;
      }
    }

    if (topic === "banks") {
      if (
        title.includes("بنوك") ||
        title.includes("فوائد")
      ) {
        score += 15;
      }
    }

    if (topic === "electronic") {
      if (
        title.includes("تطبيق") ||
        sourceQuestion.includes("تطبيق")
      ) {
        score += 12;
      }
    }
  }

  return score;
}

async function searchSources(db, question) {

  const topics = detectTopics(question);

  const topicTerms = buildTopicTerms(topics);
  const questionTerms = buildQuestionTerms(question);

  const terms = Array.from(
    new Set([
      ...topicTerms,
      ...questionTerms
    ])
  ).slice(0, 18);

  if (!terms.length) {
    return [];
  }

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
    LIMIT 10
  `;

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all();

  const rows = result.results || [];

  /*
    ترتيب المصادر حسب الصلة بالسؤال
  */
  return rows
    .map(source => ({
      ...source,
      _score: scoreSource(
        source,
        question,
        topics
      )
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 6);
}

function buildInstructions() {
  return `
أنت مساعد داخل تطبيق «فتوى».

مهمتك مساعدة المستخدم على فهم المسائل الشرعية
بالاعتماد فقط على المصادر التي يرسلها لك النظام.

المستخدم قد يكتب:
- بالفصحى.
- بالعامية المصرية.
- بطريقة مختصرة.
- في صورة قصة.
- باستخدام كلمات مختلفة عن الكلمات الموجودة في المصدر.

يجب أن تفهم المعنى العام للسؤال ثم تقارنه
بالمصادر المرفقة.

القواعد الإلزامية:

1) لا تخترع فتوى أو مصدرًا أو رقم فتوى أو رابطًا.

2) لا تنسب قولًا إلى جهة شرعية إلا إذا كان موجودًا
في المصادر المرفقة.

3) السؤال الأصلي والإجابة الأصلية للمصدر
أهم من العنوان وحده.

4) إذا كان المصدر يجيب عن السؤال مباشرة،
اعتمد عليه بوضوح.

5) إذا كانت صياغة المستخدم عامية،
حوّل المعنى إلى لغة واضحة في الإجابة.

6) إذا كانت المسألة تعتمد على تفاصيل غير موجودة،
لا تخترع التفاصيل.
اذكر أن الحكم قد يختلف بحسب تفاصيل المعاملة.

7) إذا لم تكن المصادر كافية،
قل صراحة:
"المصادر الحالية لا تكفي للإجابة."

8) لا تستخدم معلومات خارج المصادر باعتبارها فتوى.

9) لا تدّع أنك مفتٍ بشري.

10) فرّق بين الحكم المنقول من المصدر
وبين الشرح التوضيحي.

11) source_ids يجب أن تحتوي فقط على أرقام
SOURCE_ID الموجودة فعلًا في المصادر المرفقة.

12) لا تذكر رقم فتوى إلا إذا كان موجودًا في المصدر.

13) لا تجعل وجود كلمة مشتركة وحدها سببًا
لإسناد الحكم إلى مصدر.
يجب أن تكون هناك صلة حقيقية بموضوع السؤال.

14) إذا كانت المصادر تتحدث عن موضوع قريب
لكنها لا تجيب عن سؤال المستخدم،
اعتبر المصادر غير كافية.

15) أعد JSON صالحًا فقط بهذا الشكل:

{
  "ruling": "خلاصة الحكم المنقول من المصادر أو بيان عدم كفاية المصادر",
  "explanation": "شرح مختصر وواضح",
  "needs_clarification": true,
  "clarifying_question": "سؤال واحد فقط أو فارغ",
  "source_ids": [1,2]
}
`;
}

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

export default {

  async fetch(request, env) {

    if (request.method === "OPTIONS") {

      return new Response(null, {
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    /*
      Health
    */

    if (url.pathname === "/api/health") {

      return json({
        ok: true,
        app: "فتوى",
        version: "2.1"
      });
    }

    /*
      Sources
    */

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

    /*
      Ask
    */

    if (
      url.pathname === "/api/ask" &&
      request.method === "POST"
    ) {

      try {

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

        let body;

        try {

          body = await request.json();

        } catch {

          return json({
            error: "invalid_json",
            message: "بيانات الطلب غير صحيحة."
          }, 400);
        }

        const question =
          normalizeText(body?.question);

        if (question.length < 5) {

          return json({
            error: "question_too_short",
            message:
              "اكتب الموقف بتفصيل أكبر."
          }, 400);
        }

        const sources =
          await searchSources(
            env.DB,
            question
          );

        const answer =
          await askOpenAI(
            env,
            question,
            sources
          );

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

        /*
          لا نرسل _score للواجهة.
        */

        const cleanSources =
          citedSources.map(
            ({
              _score,
              content,
              question_text,
              answer_text,
              category,
              ...source
            }) => source
          );

        return json({

          ok: true,

          answer,

          sources: cleanSources,

          source_candidates:
            sources.map(
              ({
                _score,
                content,
                question_text,
                answer_text,
                category,
                ...source
              }) => source
            )
        });

      } catch (error) {

        console.error(
          "API ASK ERROR:",
          error?.stack ||
          error?.message ||
          error
        );

        return json({

          error: "server_error",

          message:
            "حدث خطأ داخلي أثناء معالجة السؤال."

        }, 500);
      }
    }

    return new Response(
      "Not Found",
      {
        status: 404,
        headers: corsHeaders
      }
    );
  }
};
