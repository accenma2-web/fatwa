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
  V2.3.1
  --------------------------------------------------
  إصلاح D1 too many SQL variables

  1) فهم نية السؤال وليس الكلمات فقط.
  2) إضافة مرادفات وصياغات عامية.
  3) عدم استخدام LIMIT قبل حساب الصلة.
  4) إعطاء أولوية كبيرة للفتوى المتخصصة.
  5) استخدام content كاحتياط إذا كان answer_text ناقصًا.
  6) الحفاظ على قاعدة عدم اختراع الأحكام أو المصادر.
  7) إصلاح عدد SQL variables في بحث D1.
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

function hasAny(text, words) {
  const normalized = normalizeArabic(text);

  return words.some(word =>
    normalized.includes(normalizeArabic(word))
  );
}

/*
  --------------------------------------------------
  تحديد الموضوعات العامة
  --------------------------------------------------
*/

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
  تحديد نية السؤال الدقيقة
  --------------------------------------------------
*/

function detectIntents(question) {
  const text = normalizeArabic(question);
  const intents = [];

  const has = words =>
    words.some(word =>
      text.includes(normalizeArabic(word))
    );

  /*
    الذهب بالتقسيط
  */
  if (
    has(["ذهب", "الذهب", "مصوغ", "مصوغات"]) &&
    has(["تقسيط", "قسط", "اقساط", "بالتقسيط"])
  ) {
    intents.push("gold_installment");
  }

  /*
    لبس الذهب للرجال
  */
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

  /*
    حساب زكاة المال
  */
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

  /*
    الزكاة على أقساط
  */
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

  /*
    الصيام ومنع الطبيب
  */
  if (
    has([
      "صيام",
      "صايم",
      "رمضان"
    ]) &&
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

  /*
    إدراك الإمام وهو راكع
  */
  if (
    has([
      "صلاه",
      "صلاة",
      "امام",
      "مسجد"
    ]) &&
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

  /*
    زواج الأرملة بعد العدة
  */
  if (
    has([
      "ارمله",
      "ارمل",
      "أرملة"
    ]) &&
    has([
      "زواج",
      "جواز",
      "عده",
      "عدة"
    ])
  ) {
    intents.push("widow_marriage");
  }

  /*
    نفقة المتعة والطلاق للضرر
  */
  if (
    has([
      "طلاق",
      "طلق"
    ]) &&
    has([
      "ضرر",
      "متعه",
      "متعة",
      "نفقه",
      "نفقة"
    ])
  ) {
    intents.push("divorce_maintenance");
  }

  /*
    قصر الصلاة أثناء السفر وتغيير الإقامة
  */
  if (
    has([
      "قصر",
      "الصلاة",
      "صلاه"
    ]) &&
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
  مصطلحات البحث حسب النية الدقيقة
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
  درجة الصلة
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

  /*
    الكلمات الموجودة في السؤال الأصلي
  */

  for (const word of questionWords) {

    if (sourceQuestion.includes(word)) {
      score += 10;
    }

    if (title.includes(word)) {
      score += 8;
    }

    if (answer.includes(word)) {
      score += 5;
    }

    if (summary.includes(word)) {
      score += 4;
    }

    if (content.includes(word)) {
      score += 2;
    }

    if (category.includes(word)) {
      score += 2;
    }
  }

  /*
    تعزيز الموضوعات
  */

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

  /*
    --------------------------------------------------
    النية الدقيقة لها الأولوية الأعلى
    --------------------------------------------------
  */

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
        title.includes("زكاه")
      ) {
        score += 100;
      }

      if (
        title.includes("نصاب") &&
        title.includes("زكاة")
      ) {
        score += 100;
      }

      if (
        title.includes("المقدار") &&
        title.includes("زكاه")
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

      if (
        title.includes("شهري")
      ) {
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

      if (
        title.includes("راكع")
      ) {
        score += 120;
      }

      if (
        title.includes("تكبيره")
      ) {
        score += 90;
      }

      if (
        sourceQuestion.includes("راكع")
      ) {
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
        score += 9
```
