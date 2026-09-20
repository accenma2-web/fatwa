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

function normalizeText(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function normalizeArabic(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .trim();
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  const chunks = [];

  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (typeof c?.text === "string") {
        chunks.push(c.text);
      }
    }
  }

  return chunks.join("\n").trim();
}


// ======================================================
// تحويل التعبيرات العامية إلى مفاهيم بحث
// ======================================================

function expandCommonTerms(question) {

  const text = normalizeArabic(question);

  const groups = [

    // البنوك والفوائد
    {
      words: [
        "بنك",
        "البنك",
        "بنوك",
        "البنوك",
        "فايده",
        "فائده",
        "فوائد",
        "عائد",
        "عوائد",
        "عوايد",
        "فلوس البنك",
        "شهاده",
        "شهادات",
        "حساب بنكي",
        "حساب البنك"
      ],
      terms: [
        "فوائد البنوك",
        "حكم فوائد البنوك",
        "الانتفاع بالفوائد",
        "التعامل مع البنوك",
        "العوائد",
        "تمويل"
      ]
    },

    // التقسيط
    {
      words: [
        "قسط",
        "اقساط",
        "تقسيط",
        "بالتقسيط",
        "قسطها",
        "قسطت",
        "بالقسط",
        "على قسط",
        "على اقساط"
      ],
      terms: [
        "البيع بالتقسيط",
        "حكم البيع بالتقسيط",
        "التقسيط",
        "الثمن المؤجل",
        "الزيادة في الثمن",
        "الربح"
      ]
    },

    // الكاش والنقد
    {
      words: [
        "كاش",
        "نقدي",
        "نقدا",
        "فلوس كاش",
        "سعر الكاش",
        "سعر نقدي"
      ],
      terms: [
        "البيع النقدي",
        "الثمن النقدي",
        "سعر البيع",
        "البيع بالتقسيط"
      ]
    },

    // الربح والمكسب
    {
      words: [
        "ربح",
        "مكسب",
        "المكسب",
        "اكسب",
        "يكسب",
        "مكسبه",
        "نسبه الربح",
        "نسبة الربح"
      ],
      terms: [
        "الربح",
        "مقدار الربح",
        "الربح المباح",
        "الزيادة في الثمن"
      ]
    },

    // التطبيقات الإلكترونية
    {
      words: [
        "تطبيق",
        "ابلكيشن",
        "اب",
        "اونلاين",
        "الكتروني",
        "إلكتروني",
        "من الموبايل",
        "من التطبيق"
      ],
      terms: [
        "تطبيق إلكتروني",
        "الشراء بالتقسيط عن طريق تطبيق",
        "البيع الإلكتروني",
        "المعاملات الحديثة"
      ]
    },

    // الزكاة
    {
      words: [
        "زكاه",
        "زكاة",
        "الزكاه",
        "زكوتي",
        "فلوس الزكاة"
      ],
      terms: [
        "الزكاة",
        "إخراج الزكاة",
        "زكاة المال"
      ]
    },

    // الصيام
    {
      words: [
        "صيام",
        "صايم",
        "صايمه",
        "صايمين",
        "رمضان",
        "افطر",
        "افطرت",
        "الفطار"
      ],
      terms: [
        "الصيام",
        "الإفطار",
        "نية الإفطار"
      ]
    },

    // الزواج والعدة
    {
      words: [
        "جواز",
        "جوازها",
        "يتجوز",
        "اتجوز",
        "زواج",
        "زوج",
        "زوجه",
        "ارمله",
        "أرملة",
        "عدة",
        "العده"
      ],
      terms: [
        "الزواج",
        "الأرملة",
        "العدة",
        "أحكام الزوجية"
      ]
    },

    // الطلاق
    {
      words: [
        "طلاق",
        "طلق",
        "اتطلق",
        "مطلقه",
        "مطلقة",
        "رجعي",
        "رجعيه",
        "الرجعة"
      ],
      terms: [
        "الطلاق",
        "الطلاق الرجعي",
        "أحكام الزوجية",
        "الزوجية بعد الطلاق"
      ]
    },

    // الصلاة
    {
      words: [
        "صلاه",
        "صلاة",
        "يصلي",
        "الصلاه",
        "استهزاء",
        "بيستهزأ",
        "يسخر من الصلاة"
      ],
      terms: [
        "الصلاة",
        "الاستهزاء بالصلاة",
        "مكانة الصلاة"
      ]
    }
  ];

  const result = [];

  for (const group of groups) {

    for (const word of group.words) {

      if (text.includes(normalizeArabic(word))) {

        result.push(...group.terms);

        break;
      }
    }
  }

  return result;
}


// ======================================================
// استخراج كلمات مهمة من السؤال
// ======================================================

function extractQuestionTerms(question) {

  const cleaned = normalizeArabic(question)
    .replace(
      /[^\u0600-\u06FF\u0750-\u077F0-9a-zA-Z ]/g,
      " "
    );

  const stopWords = new Set([
    "انا",
    "انت",
    "انتي",
    "هو",
    "هي",
    "احنا",
    "هم",
    "هل",
    "ايه",
    "اي",
    "ما",
    "ماذا",
    "كيف",
    "ليه",
    "لماذا",
    "لو",
    "اذا",
    "من",
    "في",
    "على",
    "عن",
    "مع",
    "الى",
    "الي",
    "ده",
    "دي",
    "دا",
    "ذلك",
    "هذه",
    "هذا",
    "الذي",
    "التي",
    "لي",
    "عندي",
    "عندنا",
    "كان",
    "كانت",
    "يكون",
    "تكون",
    "تم",
    "قد",
    "انه",
    "ان",
    "او",
    "ولا",
    "بس",
    "يعني",
    "طيب",
    "عايز",
    "عاوزه",
    "اريد",
    "محتاج",
    "ممكن",
    "ينفع",
    "ينفعش",
    "يجوز",
    "حرام",
    "حلال",
    "شرعا",
    "شرعي",
    "حكم",
    "حكمه"
  ]);

  return cleaned
    .split(/\s+/)
    .filter(word => word.length >= 3)
    .filter(word => !stopWords.has(word))
    .slice(0, 18);
}


// ======================================================
// تجهيز كلمات البحث
// ======================================================

function buildSearchTerms(question) {

  const originalTerms =
    extractQuestionTerms(question);

  const expandedTerms =
    expandCommonTerms(question);

  return [
    ...new Set([
      ...originalTerms,
      ...expandedTerms
    ].map(normalizeArabic))
  ]
    .filter(term => term.length >= 2)
    .slice(0, 35);
}


// ======================================================
// البحث في D1
// ======================================================

async function searchSources(db, question) {
  const text = normalizeArabic(question);

  // تحديد موضوع السؤال أولًا
  const topicTerms = [];

  // التقسيط / زيادة السعر / الكاش
  if (
    text.includes("تقسيط") ||
    text.includes("قسط") ||
    text.includes("اقساط") ||
    text.includes("كاش") ||
    text.includes("نقد") ||
    text.includes("زياده") ||
    text.includes("اغلى") ||
    text.includes("اكتر من سعر")
  ) {
    topicTerms.push(
      "التقسيط",
      "البيع بالتقسيط",
      "الزيادة في الثمن",
      "الربح",
      "الثمن",
      "البيع"
    );
  }

  // البنوك / العوائد
  if (
    text.includes("بنك") ||
    text.includes("بنوك") ||
    text.includes("فايده") ||
    text.includes("فوائد") ||
    text.includes("عائد") ||
    text.includes("عوائد") ||
    text.includes("عوايد")
  ) {
    topicTerms.push(
      "فوائد البنوك",
      "البنوك",
      "العوائد",
      "التمويل",
      "التعامل مع البنوك"
    );
  }

  // التطبيقات الإلكترونية
  if (
    text.includes("تطبيق") ||
    text.includes("ابلكيشن") ||
    text.includes("الكتروني") ||
    text.includes("اونلاين")
  ) {
    topicTerms.push(
      "تطبيق إلكتروني",
      "الشراء بالتقسيط عن طريق تطبيق",
      "المعاملات الحديثة"
    );
  }

  // الزكاة
  if (
    text.includes("زكاه") ||
    text.includes("زكاة") ||
    text.includes("زكوت")
  ) {
    topicTerms.push(
      "الزكاة",
      "إخراج الزكاة"
    );
  }

  // الصيام
  if (
    text.includes("صيام") ||
    text.includes("صايم") ||
    text.includes("رمضان") ||
    text.includes("افطر") ||
    text.includes("افطرت")
  ) {
    topicTerms.push(
      "الصيام",
      "الإفطار",
      "نية الإفطار"
    );
  }

  // الطلاق
  if (
    text.includes("طلاق") ||
    text.includes("طلق") ||
    text.includes("رجعي")
  ) {
    topicTerms.push(
      "الطلاق",
      "الطلاق الرجعي",
      "أحكام الزوجية"
    );
  }

  // الزواج والعدة
  if (
    text.includes("زواج") ||
    text.includes("جواز") ||
    text.includes("ارمله") ||
    text.includes("عده")
  ) {
    topicTerms.push(
      "الزواج",
      "الأرملة",
      "العدة",
      "أحكام الزوجية"
    );
  }

  // الصلاة
  if (
    text.includes("صلاه") ||
    text.includes("صلاة") ||
    text.includes("استهزاء") ||
    text.includes("يسخر")
  ) {
    topicTerms.push(
      "الصلاة",
      "الاستهزاء بالصلاة",
      "مكانة الصلاة"
    );
  }

  // كلمات السؤال الأصلية
  const questionTerms = text
    .replace(
      /[^\u0600-\u06FF\u0750-\u077F0-9a-zA-Z ]/g,
      " "
    )
    .split(/\s+/)
    .filter(word => word.length >= 3)
    .slice(0, 15);

  const terms = [
    ...new Set([
      ...topicTerms,
      ...questionTerms
    ])
  ];

  if (!terms.length) {
    return [];
  }

  const conditions = terms.map(() =>
    `(
      title LIKE ?
      OR summary LIKE ?
      OR content LIKE ?
      OR question_text LIKE ?
      OR answer_text LIKE ?
      OR category LIKE ?
      OR authority LIKE ?
    )`
  );

  const params = [];

  for (const term of terms) {
    const like = `%${term}%`;

    params.push(
      like,
      like,
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

  const conditions =
    terms.map(() =>
      `(
        title LIKE ?
        OR summary LIKE ?
        OR content LIKE ?
        OR question_text LIKE ?
        OR answer_text LIKE ?
        OR category LIKE ?
        OR authority LIKE ?
      )`
    );

  const params = [];

  for (const term of terms) {

    const like =
      `%${term}%`;

    params.push(
      like,
      like,
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

  const result =
    await db
      .prepare(sql)
      .bind(...params)
      .all();

  return result.results || [];
}


// ======================================================
// تعليمات الذكاء الاصطناعي
// ======================================================

function buildInstructions() {

  return `
أنت مساعد داخل تطبيق «فتوى».

وظيفتك مساعدة المستخدم على فهم المسائل الشرعية بالاعتماد على المصادر التي يرسلها لك النظام.

المستخدم قد يكتب:
- بالعامية المصرية.
- بالفصحى.
- بصياغة غير مرتبة.
- بأخطاء إملائية.
- أو على شكل قصة وموقف.
- وقد لا يستخدم المصطلح الشرعي الصحيح.

افهم المقصود من كلام المستخدم، ثم قارنه بالمصادر المرفقة.

قواعد إلزامية:

1) لا تخترع فتوى أو مصدرًا أو رقم فتوى أو رابطًا.

2) لا تنسب قولًا لجهة شرعية إلا إذا كان موجودًا بوضوح في المصادر المرفقة.

3) استخدم حقل "الإجابة" و"السؤال الأصلي" عند توفرهما.

4) لا تعتمد على عنوان الفتوى وحده إذا كانت الإجابة الأصلية متوفرة.

5) إذا كان السؤال مكتوبًا بالعامية، افهم معناه وأجب بالعربية الواضحة.

6) إذا كان السؤال عبارة عن قصة، استخرج المسألة الشرعية من تفاصيل القصة وقارنها بالمصادر.

7) إذا كان المصدر مناسبًا للمسألة، انقل الحكم الموجود فيه بوضوح.

8) إذا كانت تفاصيل الحالة قد تؤثر في الحكم، وضح ذلك ولا تتجاوز ما ورد في المصادر.

9) إذا كانت المصادر الحالية لا تكفي، صرح بذلك ولا تخترع حكمًا.

10) لا تعتبر مجرد وجود كلمة مشتركة دليلًا على أن المصدر مناسب.

11) فرّق بين الحكم المنقول من المصدر وبين الشرح التوضيحي.

12) لا تدّع أنك مفتٍ بشري.

13) عند وجود أكثر من مصدر مناسب، يمكنك الاستناد إليها جميعًا.

14) source_ids يجب أن تحتوي فقط على أرقام SOURCE_ID الموجودة فعلًا في المصادر.

15) إذا لم توجد مصادر مناسبة، اجعل source_ids مصفوفة فارغة.

16) أعد JSON صالحًا فقط بالشكل التالي:

{
  "ruling": "خلاصة الحكم المنقول من المصادر أو بيان عدم كفاية المصادر",
  "explanation": "شرح مختصر وواضح",
  "needs_clarification": true/false,
  "clarifying_question": "سؤال واحد فقط أو فارغ",
  "source_ids": [1,2]
}
`;
}


// ======================================================
// توليد الإجابة
// ======================================================

async function askOpenAI(env, question, sources) {

  const sourceText = sources.length

    ? sources.map(s =>
        `SOURCE_ID=${s.id}
الجهة=${s.authority}
العنوان=${s.title}
رقم الفتوى=${s.fatwa_number || ""}
التاريخ=${s.issued_at || ""}
التصنيف=${s.category || ""}
الرابط=${s.url || ""}
السؤال الأصلي=${s.question_text || ""}
الإجابة=${s.answer_text || ""}
الملخص=${s.summary || ""}
المحتوى=${s.content || ""}`
      ).join("\n\n")

    : "لا توجد مصادر مطابقة في قاعدة المصادر الحالية.";

  const payload = {

    model:
      env.OPENAI_MODEL ||
      "gpt-5.6-luna",

    instructions:
      buildInstructions(),

    input:
      `سؤال المستخدم:
${question}

المصادر المسترجعة:
${sourceText}`,

    max_output_tokens:1200
  };

  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method:"POST",

        headers:{
          "Content-Type":"application/json",
          "Authorization":
            `Bearer ${env.OPENAI_API_KEY}`
        },

        body:
          JSON.stringify(payload)
      }
    );

  if (!response.ok) {

    const detail =
      await response.text();

    throw new Error(
      `OpenAI API error ${response.status}: ${detail.slice(0,500)}`
    );
  }

  const data =
    await response.json();

  const text =
    extractOutputText(data);

  try {

    const parsed =
      JSON.parse(text);

    const validIds =
      new Set(
        sources.map(
          source => source.id
        )
      );

    parsed.source_ids =
      Array.isArray(
        parsed.source_ids
      )
        ? parsed.source_ids.filter(
            id => validIds.has(id)
          )
        : [];

    return parsed;

  } catch {

    return {

      ruling:
        "تعذر تحويل إجابة النظام إلى صيغة موثقة. لم يتم اعتمادها كفتوى.",

      explanation:
        "يرجى المحاولة مرة أخرى.",

      needs_clarification:true,

      clarifying_question:"",

      source_ids:[]
    };
  }
}


// ======================================================
// Worker
// ======================================================

export default {

  async fetch(request, env) {

    if (request.method === "OPTIONS") {

      return new Response(null, {
        headers:corsHeaders
      });
    }

    const url =
      new URL(request.url);


    // ==================================================
    // Health
    // ==================================================

    if (
      url.pathname === "/api/health"
    ) {

      return json({

        ok:true,

        app:"فتوى",

        version:"2.0"

      });
    }


    // ==================================================
    // Sources
    // ==================================================

    if (
      url.pathname === "/api/sources" &&
      request.method === "GET"
    ) {

      const rows =
        await env.DB.prepare(`
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
        `).all();

      return json({

        sources:
          rows.results || []

      });
    }


    // ==================================================
    // Ask
    // ==================================================

    if (
      url.pathname === "/api/ask" &&
      request.method === "POST"
    ) {

      if (
        !env.DB ||
        !env.OPENAI_API_KEY
      ) {

        return json({

          error:
            "backend_not_configured",

          message:
            "قاعدة البيانات أو مفتاح الذكاء الاصطناعي لم يتم ربطهما بعد."

        },503);
      }


      let body;

      try {

        body =
          await request.json();

      } catch {

        return json({
          error:"invalid_json"
        },400);
      }


      const question =
        normalizeText(
          body?.question
        );


      if (
        question.length < 5
      ) {

        return json({

          error:
            "question_too_short",

          message:
            "اكتب الموقف بتفصيل أكبر."

        },400);
      }


      // البحث المحسن
      const sources =
        await searchSources(
          env.DB,
          question
        );


      // الإجابة من المصادر
      const answer =
        await askOpenAI(
          env,
          question,
          sources
        );


      // حفظ السؤال والإجابة
      await env.DB.prepare(`
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
          Array.isArray(
            answer.source_ids
          )
            ? answer.source_ids
            : []
        );


      const citedSources =
        sources.filter(
          source =>
            selectedIds.has(
              source.id
            )
        );


      return json({

        ok:true,

        answer,

        sources:
          citedSources,

        source_candidates:
          sources

      });
    }


    return new Response(
      "Not Found",
      {
        status:404,
        headers:corsHeaders
      }
    );
  }
};
