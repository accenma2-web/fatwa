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
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeArabic(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
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
// كلمات عامية شائعة وتحويلها إلى مفاهيم بحثية
// ======================================================

function expandCommonArabicTerms(question) {

  const text = normalizeArabic(question);

  const aliases = [];

  const groups = [
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
        "البنوك",
        "فوائد البنوك",
        "فوائد",
        "العوائد",
        "التعامل مع البنوك",
        "الانتفاع بالفوائد",
        "تمويل"
      ]
    },

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
        "التقسيط",
        "البيع",
        "الثمن المؤجل",
        "الزيادة في الثمن",
        "الربح"
      ]
    },

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
        "الثمن",
        "سعر البيع"
      ]
    },

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

    {
      words: [
        "جواز",
        "جوازها",
        "يتجوز",
        "اتجوز",
        "زواج",
        "زوج",
        "زوجه",
        "أرملة",
        "ارمله",
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

  for (const group of groups) {
    for (const word of group.words) {
      if (text.includes(normalizeArabic(word))) {
        aliases.push(...group.terms);
        break;
      }
    }
  }

  return aliases;
}


// ======================================================
// استخراج الكلمات الأصلية من سؤال المستخدم
// ======================================================

function extractQuestionTerms(question) {

  const cleaned = normalizeArabic(question)
    .replace(/[^\u0600-\u06FF\u0750-\u077F0-9a-zA-Z ]/g, " ");

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
    "انا",
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
// فهم السؤال وتحويله إلى كلمات بحث
// ======================================================

async function understandQuestion(env, question) {

  const localTerms = [
    ...extractQuestionTerms(question),
    ...expandCommonArabicTerms(question)
  ];

  const uniqueLocalTerms = [
    ...new Set(localTerms.map(normalizeArabic))
  ].filter(Boolean);


  // لو لم يوجد مفتاح، نستفيد من البحث المحلي فقط.
  if (!env.OPENAI_API_KEY) {
    return uniqueLocalTerms.slice(0, 30);
  }


  const payload = {
    model: env.OPENAI_MODEL || "gpt-5.6-luna",

    instructions: `
أنت محرك فهم بحث داخل تطبيق «فتوى».

مهمتك ليست إصدار فتوى.

مهمتك فقط فهم سؤال المستخدم وتحويله إلى كلمات ومفاهيم بحث عربية تساعدنا على العثور على الفتاوى المناسبة داخل قاعدة بيانات محدودة.

السؤال قد يكون:
- باللهجة المصرية.
- بالعامية العربية.
- بالفصحى.
- مكتوبًا بأخطاء إملائية.
- سؤالًا مباشرًا.
- أو حكاية لموقف كامل بدون صياغة سؤال شرعي.

استخرج أهم الموضوعات والمصطلحات التي تصف المسألة.

قواعد مهمة:
1) لا تجب عن السؤال.
2) لا تعط حكمًا شرعيًا.
3) لا تخترع أسماء جهات أو أرقام فتاوى.
4) لا تضع مصادر.
5) أخرج كلمات بحث ومفاهيم فقط.
6) استخدم صيغًا عربية فصحى مناسبة للبحث بالإضافة إلى التعبير العامي إذا كان مهمًا.
7) إذا ذكر المستخدم موقفًا، استخرج الموضوع الفقهي الأساسي منه.
8) أعد JSON فقط بهذا الشكل:

{
  "search_terms": ["مصطلح 1", "مصطلح 2", "مصطلح 3"]
}

يفضل ألا تتجاوز 20 مصطلحًا.
`,

    input: `سؤال المستخدم:
${question}`
  };

  try {

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
      return uniqueLocalTerms.slice(0, 30);
    }


    const data = await response.json();

    const text = extractOutputText(data);


    try {

      const parsed = JSON.parse(text);

      const aiTerms =
        Array.isArray(parsed?.search_terms)
          ? parsed.search_terms
          : [];


      return [
        ...new Set([
          ...uniqueLocalTerms,
          ...aiTerms.map(normalizeArabic)
        ])
      ]
        .filter(term => term.length >= 2)
        .slice(0, 35);

    } catch {

      return uniqueLocalTerms.slice(0, 30);
    }

  } catch {

    return uniqueLocalTerms.slice(0, 30);
  }
}


// ======================================================
// البحث في قاعدة المصادر
// ======================================================

async function searchSources(db, terms) {

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


  const result =
    await db
      .prepare(sql)
      .bind(...params)
      .all();


  return result.results || [];
}


// ======================================================
// تعليمات الإجابة
// ======================================================

function buildInstructions() {

  return `
أنت مساعد داخل تطبيق «فتوى».

وظيفتك مساعدة المستخدم على فهم المسائل الشرعية بالاعتماد على المصادر التي يرسلها لك النظام.

قد يكتب المستخدم سؤاله:
- بالعامية المصرية.
- بالعربية الفصحى.
- بصياغة غير مرتبة.
- بأخطاء إملائية.
- أو على شكل قصة أو موقف.

افهم معنى السؤال، ثم قارن مع المصادر المرفقة.

قواعد إلزامية:

1) لا تخترع فتوى أو مصدرًا أو رقم فتوى أو رابطًا.

2) لا تنسب قولًا لجهة شرعية إلا إذا كان موجودًا بوضوح في المصادر المرفقة.

3) يجب استخدام حقل "الإجابة" و"السؤال الأصلي" عند توفرهما.

4) لا تعتمد على عنوان الفتوى وحده إذا كان حقل الإجابة متوفرًا.

5) إذا كان المصدر يجيب عن نفس المسألة أو عن مسألة مرتبطة بها بوضوح، يمكن الاستناد إليه.

6) إذا كانت هناك فروق في تفاصيل الحالة قد تغير الحكم، وضّح ذلك واطلب التفاصيل عند الحاجة.

7) إذا كانت المصادر غير كافية للإجابة، قل بوضوح إن المصادر الحالية لا تكفي.

8) لا تستنتج حكمًا شرعيًا جديدًا غير موجود في المصادر.

9) لا تعتبر مجرد تشابه كلمة واحدة كافيًا لاعتماد المصدر؛ افهم موضوع السؤال والسياق.

10) فرّق بوضوح بين الحكم المنقول عن المصدر وبين الشرح التوضيحي.

11) لا تدّع أنك مفتٍ بشري؛ أنت أداة مساعدة للمعلومات والبحث.

12) أجب بالعربية وبأسلوب واضح ومحترم، ويمكنك فهم العامية والرد بلغة عربية واضحة.

13) عند وجود أكثر من مصدر مناسب، يمكنك الاستناد إليها جميعًا.

14) source_ids يجب أن تحتوي فقط على أرقام SOURCE_ID الموجودة فعلًا في المصادر المرفقة.

15) إذا لم توجد مصادر مناسبة، يجب أن تكون source_ids مصفوفة فارغة.

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
// توليد الإجابة من المصادر
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


    // حماية إضافية:
    // لا نسمح للـAI بإرجاع SOURCE_ID غير موجود.

    const validIds =
      new Set(
        sources.map(source => source.id)
      );


    parsed.source_ids =
      Array.isArray(parsed.source_ids)

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

    if (url.pathname === "/api/health") {

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


      if (question.length < 5) {

        return json({

          error:
            "question_too_short",

          message:
            "اكتب الموقف بتفصيل أكبر."

        },400);
      }


      // =================================================
      // المرحلة الأولى:
      // فهم صياغة المستخدم
      // =================================================

      const searchTerms =
        await understandQuestion(
          env,
          question
        );


      // =================================================
      // المرحلة الثانية:
      // البحث في المصادر
      // =================================================

      const sources =
        await searchSources(
          env.DB,
          searchTerms
        );


      // =================================================
      // المرحلة الثالثة:
      // الإجابة من المصادر فقط
      // =================================================

      const answer =
        await askOpenAI(
          env,
          question,
          sources
        );


      // =================================================
      // حفظ السؤال والإجابة
      // =================================================

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
          sources,

        search_terms:
          searchTerms
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
