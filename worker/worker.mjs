```javascript
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
  فتوى
  V2.3.1
  --------------------------------------------------
  - ES Module Worker لدعم D1 binding
  - إصلاح D1 too many SQL variables
  - فهم نية السؤال
  - مرادفات وصياغات عامية
  - إعطاء أولوية للفتوى المتخصصة
  - الاعتماد على المصادر المخزنة في D1
  - عدم اختراع المصادر أو الأحكام
*/

function normalizeArabic(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\u0600-\u06FF0-9a-zA-Z\s]/g, " ")
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
  --------------------------------------------------
  الكلمات والمرادفات
  --------------------------------------------------
*/

const TOPIC_DICTIONARY = {
  banks: [
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
  ],

  installments: [
    "تقسيط",
    "قسط",
    "اقساط",
    "قسطه",
    "كاش",
    "نقد",
    "نقدا",
    "زياده",
    "زياده السعر",
    "اغلى",
    "سعر اعلى",
    "اجمالي",
    "مؤجل"
  ],

  electronic: [
    "تطبيق",
    "ابلكيشن",
    "الكتروني",
    "اونلاين",
    "منصه",
    "منصة"
  ],

  zakat: [
    "زكاه",
    "زكوت",
    "زكاة",
    "زكاه المال",
    "زكاة المال"
  ],

  fasting: [
    "صيام",
    "صايم",
    "رمضان",
    "افطار",
    "افطر",
    "افطرت",
    "نيه الافطار",
    "نية الافطار"
  ],

  prayer: [
    "صلاه",
    "صلاة",
    "امام",
    "راكع",
    "ركوع",
    "تكبيره",
    "تكبيرة",
    "استهزاء",
    "يسخر",
    "سخريه",
    "سخرية",
    "قصر"
  ],

  marriage: [
    "زواج",
    "جواز",
    "ارمله",
    "ارمل",
    "عده",
    "عدة",
    "زوجيه",
    "الزوجية"
  ],

  divorce: [
    "طلاق",
    "طلق",
    "رجعي",
    "رجعه",
    "رجعة",
    "ضرر",
    "متعه",
    "متعة",
    "نفقه",
    "نفقة"
  ],

  gold: [
    "ذهب",
    "ذهبي",
    "الذهب",
    "مصوغات",
    "مصوغ"
  ]
};

function detectTopics(question) {
  const text = normalizeArabic(question);
  const topics = [];

  for (const [topic, words] of Object.entries(TOPIC_DICTIONARY)) {
    if (words.some(word => text.includes(normalizeArabic(word)))) {
      topics.push(topic);
    }
  }

  return topics;
}

/*
  --------------------------------------------------
  تحديد نية السؤال
  --------------------------------------------------
*/

function detectIntents(question) {
  const text = normalizeArabic(question);
  const intents = [];

  const has = words =>
    words.some(word =>
      text.includes(normalizeArabic(word))
    );

  if (
    has(["ذهب", "الذهب", "مصوغ", "مصوغات"]) &&
    has(["تقسيط", "قسط", "اقساط", "بالتقسيط"])
  ) {
    intents.push("gold_installment");
  }

  if (
    has(["ذهب", "الذهب"]) &&
    has([
      "رجال",
      "رجل",
      "للرجال",
      "لبس",
      "لبس الذهب",
      "يلبس"
    ])
  ) {
    intents.push("gold_men");
  }

  if (
    has(["زكاه", "زكاة"]) &&
    has([
      "مال",
      "حساب",
      "احسب",
      "نصاب",
      "مقدار",
      "كام",
      "كم"
    ])
  ) {
    intents.push("zakat_calculation");
  }

  if (
    has(["زكاه", "زكاة"]) &&
    has([
      "اقساط",
      "تقسيط",
      "شهري",
      "شهريا",
      "دفعات",
      "دفعات شهرية"
    ])
  ) {
    intents.push("zakat_installment");
  }

  if (
    has(["صيام", "صايم", "رمضان"]) &&
    has([
      "طبيب",
      "دكتور",
      "الدكتور",
      "منعني",
      "منع",
      "مرض",
      "مريض",
      "صحتي"
    ])
  ) {
    intents.push("fasting_doctor");
  }

  if (
    has(["صلاه", "صلاة", "امام", "مسجد"]) &&
    has([
      "راكع",
      "ركوع",
      "كبر",
      "تكبيره",
      "تكبيرة"
    ])
  ) {
    intents.push("prayer_ruku");
  }

  if (
    has(["ارمله", "ارمل", "أرملة"]) &&
    has(["زواج", "جواز", "عده", "عدة"])
  ) {
    intents.push("widow_marriage");
  }

  if (
    has(["طلاق", "طلق"]) &&
    has(["ضرر", "متعه", "متعة", "نفقه", "نفقة"])
  ) {
    intents.push("divorce_maintenance");
  }

  if (
    has(["قصر", "الصلاة", "صلاه"]) &&
    has([
      "سفر",
      "مسافر",
      "اقامه",
      "إقامة",
      "مكان الاقامه",
      "مكان الإقامة",
      "غيرت مكان"
    ])
  ) {
    intents.push("travel_qasr");
  }

  return intents;
}

/*
  --------------------------------------------------
  مصطلحات البحث حسب الموضوع
  --------------------------------------------------
*/

function buildTopicTerms(topics) {
  const terms = new Set();

  for (const topic of topics) {
    if (topic === "banks") {
      terms.add("فوائد البنوك");
      terms.add("التعامل مع البنوك");
      terms.add("البنوك");
      terms.add("التمويل");
      terms.add("فوائد");
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
      terms.add("زكاة المال");
      terms.add("إخراج الزكاة");
      terms.add("نصاب زكاة المال");
    }

    if (topic === "fasting") {
      terms.add("الصيام");
      terms.add("الإفطار");
      terms.add("صوم");
    }

    if (topic === "prayer") {
      terms.add("الصلاة");
      terms.add("صلاة");
      terms.add("الإمام");
      terms.add("الركوع");
      terms.add("قصر الصلاة");
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
      terms.add("الضرر");
      terms.add("نفقة المتعة");
    }

    if (topic === "gold") {
      terms.add("الذهب");
      terms.add("بيع الذهب");
      terms.add("الذهب المصوغ");
    }
  }

  return Array.from(terms);
}

/*
  --------------------------------------------------
  مصطلحات البحث حسب النية
  --------------------------------------------------
*/

function buildIntentTerms(intents) {
  const terms = new Set();

  for (const intent of intents) {
    if (intent === "gold_installment") {
      terms.add("بيع الذهب بالتقسيط");
      terms.add("الذهب المصوغ بالتقسيط");
      terms.add("بيع الذهب");
      terms.add("الذهب");
      terms.add("تقسيط");
    }

    if (intent === "gold_men") {
      terms.add("لبس الذهب للرجال");
      terms.add("الذهب للرجال");
      terms.add("لبس الذهب");
      terms.add("الرجال");
    }

    if (intent === "zakat_calculation") {
      terms.add("نصاب زكاة المال");
      terms.add("المقدار الواجب");
      terms.add("زكاة المال");
      terms.add("حساب الزكاة");
      terms.add("مقدار الزكاة");
    }

    if (intent === "zakat_installment") {
      terms.add("دفع زكاة المال على أقساط شهرية");
      terms.add("زكاة المال بالتقسيط");
      terms.add("أقساط شهرية");
      terms.add("إخراج الزكاة بالتقسيط");
    }

    if (intent === "fasting_doctor") {
      terms.add("صوم من نهاه الطبيب");
      terms.add("الطبيب عن الصوم");
      terms.add("منعه الطبيب من الصيام");
      terms.add("الصيام");
      terms.add("الطبيب");
    }

    if (intent === "prayer_ruku") {
      terms.add("أدرك الإمام وهو راكع");
      terms.add("الإمام وهو راكع");
      terms.add("تكبيرة واحدة");
      terms.add("صلاة من أدرك الإمام");
      terms.add("الركوع");
    }

    if (intent === "widow_marriage") {
      terms.add("زواج الأرملة بعد انتهاء العدة");
      terms.add("زواج الأرملة");
      terms.add("انتهاء العدة");
      terms.add("الأرملة");
    }

    if (intent === "divorce_maintenance") {
      terms.add("نفقة المتعة");
      terms.add("طلبت الطلاق للضرر");
      terms.add("الطلاق للضرر");
      terms.add("نفقة المتعة لمن طلبت الطلاق");
      terms.add("الضرر");
    }

    if (intent === "travel_qasr") {
      terms.add("قصر الصلاة");
      terms.add("تغيير محل الإقامة");
      terms.add("حال سفره");
      terms.add("سفره إلى بيته");
      terms.add("قصر الصلاة للمسافر");
    }
  }

  return Array.from(terms);
}

/*
  --------------------------------------------------
  كلمات السؤال نفسه
  --------------------------------------------------
*/

function buildQuestionTerms(question) {
  const text = normalizeArabic(question);

  const stopWords = new Set([
    "هل",
    "ما",
    "ايه",
    "اي",
    "هل يجوز",
    "يجوز",
    "ينفع",
    "ممكن",
    "لو",
    "انا",
    "أنا",
    "هو",
    "هي",
    "ده",
    "دي",
    "في",
    "من",
    "عن",
    "على",
    "الى",
    "إلى",
    "مع",
    "ولا"
  ]);

  const words = text
    .split(/\s+/)
    .filter(word =>
      word.length >= 3 &&
      !stopWords.has(word)
    );

  return words.slice(0, 12);
}

/*
  --------------------------------------------------
  حساب الصلة
  --------------------------------------------------
*/

function scoreSource(source, question, topics, intents) {
  const q = normalizeArabic(question);

  const title = normalizeArabic(source.title);
  const summary = normalizeArabic(source.summary);
  const sourceQuestion = normalizeArabic(source.question_text);
  const answer = normalizeArabic(source.answer_text);
  const content = normalizeArabic(source.content);
  const category = normalizeArabic(source.category);

  let score = 0;

  const questionWords = q
    .split(/\s+/)
    .filter(word => word.length >= 3)
    .slice(0, 20);

  for (const word of questionWords) {
    if (sourceQuestion.includes(word)) score += 10;
    if (title.includes(word)) score += 8;
    if (answer.includes(word)) score += 5;
    if (summary.includes(word)) score += 4;
    if (content.includes(word)) score += 2;
    if (category.includes(word)) score += 2;
  }

  for (const topic of topics) {
    if (topic === "installments") {
      if (
        title.includes("تقسيط") ||
        sourceQuestion.includes("تقسيط")
      ) {
        score += 18;
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
        score += 20;
      }
    }

    if (topic === "electronic") {
      if (
        title.includes("تطبيق") ||
        sourceQuestion.includes("تطبيق")
      ) {
        score += 18;
      }
    }

    if (topic === "zakat") {
      if (
        title.includes("زكاه") ||
        title.includes("زكاة") ||
        sourceQuestion.includes("زكاه") ||
        sourceQuestion.includes("زكاة")
      ) {
        score += 15;
      }
    }

    if (topic === "fasting") {
      if (
        title.includes("صوم") ||
        title.includes("صيام")
      ) {
        score += 15;
      }
    }

    if (topic === "prayer") {
      if (
        title.includes("صلاه") ||
        title.includes("صلاة")
      ) {
        score += 10;
      }
    }

    if (topic === "marriage") {
      if (
        title.includes("زواج") ||
        title.includes("ارمله") ||
        title.includes("عدة")
      ) {
        score += 15;
      }
    }

    if (topic === "divorce") {
      if (
        title.includes("طلاق") ||
        title.includes("نفقة") ||
        title.includes("متعة")
      ) {
        score += 15;
      }
    }

    if (topic === "gold") {
      if (
        title.includes("ذهب") ||
        sourceQuestion.includes("ذهب")
      ) {
        score += 18;
      }
    }
  }

  for (const intent of intents) {
    if (intent === "gold_installment") {
      if (
        title.includes("ذهب") &&
        title.includes("تقسيط")
      ) {
        score += 80;
      }

      if (
        sourceQuestion.includes("ذهب") &&
        sourceQuestion.includes("تقسيط")
      ) {
        score += 60;
      }
    }

    if (intent === "gold_men") {
      if (
        title.includes("ذهب") &&
        title.includes("رجال")
      ) {
        score += 100;
      }

      if (
        sourceQuestion.includes("ذهب") &&
        sourceQuestion.includes("رجال")
      ) {
        score += 70;
      }
    }

    if (intent === "zakat_calculation") {
      if (
        title.includes("نصاب") &&
        (
          title.includes("زكاه") ||
          title.includes("زكاة")
        )
      ) {
        score += 100;
      }

      if (
        title.includes("المقدار") &&
        (
          title.includes("زكاه") ||
          title.includes("زكاة")
        )
      ) {
        score += 80;
      }

      if (
        sourceQuestion.includes("نصاب") ||
        sourceQuestion.includes("المقدار")
      ) {
        score += 50;
      }
    }

    if (intent === "zakat_installment") {
      if (
        (
          title.includes("زكاه") ||
          title.includes("زكاة")
        ) &&
        (
          title.includes("اقساط") ||
          title.includes("أقساط")
        )
      ) {
        score += 100;
      }

      if (title.includes("شهري")) {
        score += 70;
      }

      if (
        sourceQuestion.includes("تقسيط") ||
        sourceQuestion.includes("أقساط") ||
        sourceQuestion.includes("اقساط")
      ) {
        score += 80;
      }
    }

    if (intent === "fasting_doctor") {
      if (
        title.includes("طبيب") &&
        (
          title.includes("صوم") ||
          title.includes("صيام")
        )
      ) {
        score += 110;
      }

      if (
        sourceQuestion.includes("طبيب") &&
        (
          sourceQuestion.includes("صوم") ||
          sourceQuestion.includes("صيام")
        )
      ) {
        score += 80;
      }
    }

    if (intent === "prayer_ruku") {
      if (title.includes("راكع")) {
        score += 120;
      }

      if (title.includes("تكبيره")) {
        score += 90;
      }

      if (sourceQuestion.includes("راكع")) {
        score += 80;
      }
    }

    if (intent === "widow_marriage") {
      if (
        title.includes("ارمله") &&
        (
          title.includes("عده") ||
          title.includes("زواج")
        )
      ) {
        score += 120;
      }

      if (
        sourceQuestion.includes("ارمله") &&
        sourceQuestion.includes("عده")
      ) {
        score += 90;
      }
    }

    if (intent === "divorce_maintenance") {
      if (
        title.includes("نفقة") &&
        title.includes("متعة")
      ) {
        score += 120;
      }

      if (
        title.includes("طلاق") &&
        title.includes("ضرر")
      ) {
        score += 100;
      }

      if (
        sourceQuestion.includes("ضرر") &&
        (
          sourceQuestion.includes("متعة") ||
          sourceQuestion.includes("نفقة")
        )
      ) {
        score += 80;
      }
    }

    if (intent === "travel_qasr") {
      if (
        title.includes("قصر") &&
        title.includes("صلاة")
      ) {
        score += 120;
      }

      if (
        title.includes("إقامة") ||
        title.includes("اقامة")
      ) {
        score += 60;
      }

      if (sourceQuestion.includes("سفر")) {
        score += 50;
      }
    }
  }

  return score;
}

/*
  --------------------------------------------------
  البحث في المصادر
  --------------------------------------------------
  مهم:
  كل term يستخدم SQL variable واحد فقط.
  هذا يمنع D1 too many SQL variables.
*/

async function searchSources(db, question) {
  const topics = detectTopics(question);
  const intents = detectIntents(question);

  const topicTerms = buildTopicTerms(topics);
  const intentTerms = buildIntentTerms(intents);
  const questionTerms = buildQuestionTerms(question);

  const terms = Array.from(
    new Set([
      ...intentTerms,
      ...topicTerms,
      ...questionTerms
    ])
  ).slice(0, 35);

  if (!terms.length) {
    return [];
  }

  const conditions = terms.map(() => `
    (
      COALESCE(title, '') || ' ' ||
      COALESCE(summary, '') || ' ' ||
      COALESCE(question_text, '') || ' ' ||
      COALESCE(answer_text, '') || ' ' ||
      COALESCE(content, '') || ' ' ||
      COALESCE(category, '')
    ) LIKE ?
  `);

  const params = terms.map(term => `%${term}%`);

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
    LIMIT 100
  `;

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all();

  const rows = result?.results || [];

  const scored = rows.map(source => ({
    ...source,
    relevance_score: scoreSource(
      source,
      question,
      topics,
      intents
    )
  }));

  scored.sort((a, b) => {
    if (b.relevance_score !== a.relevance_score) {
      return b.relevance_score - a.relevance_score;
    }

    return String(b.issued_at || "")
      .localeCompare(String(a.issued_at || ""));
  });

  return scored.slice(0, 8);
}

/*
  --------------------------------------------------
  تعليمات النموذج
  --------------------------------------------------
*/

function buildInstructions() {
  return `
أنت مساعد الفتاوى في تطبيق «فتوى».

مهمتك تقديم إجابة شرعية مبنية على المصادر الموجودة في قاعدة البيانات فقط.

القواعد:

1. لا تخترع فتوى أو حكمًا شرعيًا.
2. لا تنسب حكمًا إلى دار الإفتاء إلا إذا كان المصدر موجودًا في المصادر المرسلة لك.
3. لا تخترع روابط أو أرقام فتاوى.
4. إذا لم يوجد مصدر مناسب بدرجة كافية، قل بوضوح إن المصادر المتاحة لا تكفي للحكم على الحالة.
5. فرّق بين النص المنقول من المصدر وبين الشرح المبسط.
6. لا تجعل وجود مصدر قريب موضوعيًا يعني أنه يجيب عن السؤال نفسه.
7. عند وجود فتوى متخصصة مباشرة، قدمها على المصادر العامة.
8. اذكر اسم الجهة ورقم الفتوى والرابط عندما تكون البيانات متاحة.
9. لا تضف مصادر من معرفتك الخارجية.
10. لا تدّعي أنك شيخ أو مفتٍ بشري.
11. في المسائل التي تعتمد على تفاصيل شخصية، وضّح أن الحكم قد يتغير بتغير التفاصيل.
12. استخدم العربية الواضحة والبسيطة.
13. لا تذكر معلومات تقنية عن قاعدة البيانات أو الـ API للمستخدم.

صيغة الإجابة المفضلة:

- الحكم المختصر
- التوضيح
- المصدر

إذا كان المصدر الرسمي يجيب عن السؤال بصورة مباشرة، اجعل الإجابة واضحة ولا تشتت المستخدم بمصادر غير مرتبطة.
`;
}

/*
  --------------------------------------------------
  استدعاء OpenAI
  --------------------------------------------------
*/

async function askOpenAI(env, question, sources) {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = env.OPENAI_MODEL || "gpt-5.6-luna";

  const sourceText = sources.length
    ? sources.map((source, index) => {
        return `
المصدر ${index + 1}:
الجهة: ${source.authority || ""}
العنوان: ${source.title || ""}
رقم الفتوى: ${source.fatwa_number || ""}
التاريخ: ${source.issued_at || ""}
التصنيف: ${source.category || ""}
السؤال الأصلي للمصدر: ${source.question_text || ""}
الإجابة: ${source.answer_text || source.content || source.summary || ""}
الرابط الرسمي: ${source.url || ""}
`;
      }).join("\n")
    : "لا توجد مصادر مناسبة في قاعدة البيانات.";

  const input = `
${buildInstructions()}

السؤال:
${question}

المصادر المتاحة:
${sourceText}
`;

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `OpenAI API error: ${response.status}`
    );
  }

  const outputText = extractOutputText(data);

  if (!outputText) {
    throw new Error("OpenAI returned an empty response");
  }

  return outputText;
}

/*
  --------------------------------------------------
  Worker
  --------------------------------------------------
  Module Worker format.
  هذا هو الشكل المطلوب مع D1.
*/

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/health"
      ) {
        return json({
          ok: true,
          app: "فتوى",
          version: "2.3.1"
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/sources"
      ) {
        if (!env.DB) {
          return json(
            {
              ok: false,
              error: "D1 binding DB is not configured"
            },
            500
          );
        }

        const result = await env.DB
          .prepare(`
            SELECT
              id,
              authority,
              title,
              fatwa_number,
              issued_at,
              url,
              summary,
              question_text,
              answer_text,
              category
            FROM sources
            ORDER BY issued_at DESC, id DESC
            LIMIT 100
          `)
          .all();

        return json({
          ok: true,
          sources: result?.results || []
        });
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/ask"
      ) {
        if (!env.DB) {
          return json(
            {
              ok: false,
              error: "D1 binding DB is not configured"
            },
            500
          );
        }

        const body = await request.json().catch(() => null);

        const question = normalizeText(
          body?.question
        );

        if (!question) {
          return json(
            {
              ok: false,
              error: "السؤال مطلوب"
            },
            400
          );
        }

        if (question.length > 5000) {
          return json(
            {
              ok: false,
              error: "السؤال طويل جدًا"
            },
            400
          );
        }

        const sources = await searchSources(
          env.DB,
          question
        );

        const answer = await askOpenAI(
          env,
          question,
          sources
        );

        let questionId = null;

        try {
          const saved = await env.DB
            .prepare(`
              INSERT INTO questions
              (question, answer_json)
              VALUES (?, ?)
              RETURNING id
            `)
            .bind(
              question,
              JSON.stringify({
                answer,
                sources: sources.map(source => ({
                  id: source.id,
                  authority: source.authority,
                  title: source.title,
                  fatwa_number: source.fatwa_number,
                  issued_at: source.issued_at,
                  url: source.url,
                  category: source.category,
                  relevance_score: source.relevance_score
                }))
              })
            )
            .first();

          questionId = saved?.id ?? null;
        } catch (saveError) {
          console.error(
            "QUESTION SAVE ERROR:",
            saveError
          );
        }

        return json({
          ok: true,
          questionId,
          answer,
          sources: sources.map(source => ({
            id: source.id,
            authority: source.authority,
            title: source.title,
            fatwa_number: source.fatwa_number,
            issued_at: source.issued_at,
            url: source.url,
            summary: source.summary,
            question_text: source.question_text,
            answer_text: source.answer_text,
            category: source.category,
            relevance_score: source.relevance_score
          }))
        });
      }

      return json(
        {
          ok: false,
          error: "Not found"
        },
        404
      );

    } catch (error) {
      console.error(
        "API ERROR:",
        error
      );

      return json(
        {
          ok: false,
          error:
            error?.message ||
            "حدث خطأ غير متوقع"
        },
        500
      );
    }
  }
};
```
