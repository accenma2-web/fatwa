const q = id => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ===============================
// تنظيف السؤال
// ===============================

q('clearBtn').onclick = () => {
  q('question').value = '';
  q('question').focus();
};


// ===============================
// المواضيع الشائعة
// ===============================

document.querySelectorAll('.topic-grid button').forEach(btn => {
  btn.onclick = () => {
    q('question').value =
      `أريد أن أسأل عن موضوع ${btn.dataset.topic}. سأحكي لك الموقف بالتفصيل وأريد معرفة الحكم مع ذكر المصادر الموثوقة.`;

    q('question').focus();
  };
});


// ===============================
// الخلفيات
// ===============================

document.querySelectorAll('[data-bg]').forEach(btn => {
  btn.onclick = () => {

    document.body.classList.remove(
      'mint',
      'nature',
      'night'
    );

    if (btn.dataset.bg !== 'default') {
      document.body.classList.add(btn.dataset.bg);
    }

    localStorage.setItem(
      'fatwa-bg',
      btn.dataset.bg
    );
  };
});


q('bgUpload').onchange = e => {

  const file = e.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {

    const background =
      `linear-gradient(
        rgba(255,255,255,.82),
        rgba(255,255,255,.90)
      ),url(${reader.result})`;

    q('bg-overlay').style.backgroundImage = background;

    document.querySelector('.bg-overlay').style.backgroundImage =
      background;

    document.querySelector('.bg-overlay').style.backgroundSize =
      'cover';

    document.querySelector('.bg-overlay').style.backgroundPosition =
      'center';

    localStorage.setItem(
      'fatwa-custom-bg',
      reader.result
    );
  };

  reader.readAsDataURL(file);
};


const savedBg =
  localStorage.getItem('fatwa-bg');

if (
  savedBg &&
  savedBg !== 'default'
) {
  document.body.classList.add(savedBg);
}


const custom =
  localStorage.getItem('fatwa-custom-bg');

if (custom) {

  document.querySelector('.bg-overlay').style.backgroundImage =
    `linear-gradient(
      rgba(255,255,255,.82),
      rgba(255,255,255,.90)
    ),url(${custom})`;

  document.querySelector('.bg-overlay').style.backgroundSize =
    'cover';

  document.querySelector('.bg-overlay').style.backgroundPosition =
    'center';
}


// ===============================
// الإعدادات
// ===============================

q('settingsBtn').onclick = () => {
  q('settingsModal').hidden = false;
};

q('closeSettings').onclick = () => {
  q('settingsModal').hidden = true;
};

q('settingsModal').addEventListener('click', e => {

  if (e.target === q('settingsModal')) {
    q('settingsModal').hidden = true;
  }

});


// ===============================
// الاتصال بالـ Worker
// ===============================
// مفتاح OpenAI لا يوجد هنا.
// المفتاح محفوظ داخل Cloudflare Worker.
// ===============================

async function askBackend(question) {

  const response = await fetch(
    "https://fatwa.acc-enma2.workers.dev/api/ask",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        question
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
      "تعذر الاتصال بالخادم"
    );
  }

  return data;
}


// ===============================
// عرض المصادر
// ===============================

function renderSources(sources) {

  const sourceContainer =
    q('sourcesList');

  sourceContainer.innerHTML = '';

  if (!sources.length) {

    sourceContainer.innerHTML = `
      <div class="source-card">
        <div class="source-icon">⚠️</div>

        <div>
          <strong>لا توجد مصادر مطابقة</strong>

          <p>
            لم يتم اعتماد إجابة غير موثقة.
            يمكن إضافة مصادر معتمدة إلى قاعدة البيانات
            لتوسيع نطاق الإجابة.
          </p>
        </div>
      </div>
    `;

    return;
  }


  for (const source of sources) {

    const authority =
      escapeHtml(source.authority);

    const title =
      escapeHtml(source.title);

    const number =
      escapeHtml(
        source.fatwa_number ||
        'غير متاح'
      );

    const date =
      escapeHtml(
        source.issued_at ||
        ''
      );

    const url =
      escapeHtml(
        source.url ||
        '#'
      );


    sourceContainer.innerHTML += `

      <div class="source-card">

        <div class="source-icon">
          📖
        </div>

        <div>

          <strong>
            ${authority}
          </strong>

          <p>

            ${title}

            <br>

            رقم الفتوى:
            ${number}

            ${
              date
                ? `<br>تاريخ الفتوى: ${date}`
                : ''
            }

            <br>

            <a
              href="${url}"
              target="_blank"
              rel="noopener noreferrer"
            >
              عرض المصدر الأصلي
            </a>

          </p>

        </div>

      </div>

    `;
  }
}


// ===============================
// سؤال جديد
// ===============================

q('newQuestionBtn').onclick = () => {

  q('question').value = '';

  q('answer').hidden = true;

  q('sources').hidden = true;

  q('ruling').textContent = '';

  q('explanation').textContent = '';

  q('question').focus();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};


// ===============================
// عرض / إخفاء المصادر
// ===============================

q('sourcesBtn').onclick = () => {

  const sources =
    q('sources');

  sources.hidden =
    !sources.hidden;

  if (!sources.hidden) {

    sources.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

  }
};


// ===============================
// السؤال الرئيسي
// ===============================

q('askBtn').onclick = async () => {

  const text =
    q('question').value.trim();


  if (!text) {

    q('question').focus();

    q('question').placeholder =
      'اكتب الموقف أولًا، وسأساعدك في الوصول للمعلومة الشرعية الموثوقة.';

    return;
  }


  // إظهار منطقة الإجابة
  q('answer').hidden = false;

  q('sources').hidden = true;


  // حالة التحميل
  q('ruling').textContent =
    'جاري فهم السؤال والبحث في المصادر...';

  q('explanation').textContent =
    'نبحث في قاعدة المصادر الموثوقة، ثم نطلب من محرك الذكاء الاصطناعي صياغة الإجابة بناءً على النتائج.';


  q('answer').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });


  try {

    const data =
      await askBackend(text);


    // ===========================
    // الإجابة
    // ===========================

    q('ruling').textContent =
      data.answer?.ruling ||
      'لم يتم العثور على حكم موثق كافٍ.';


    q('explanation').textContent =
      data.answer?.explanation ||
      'لم تتوفر تفاصيل إضافية من المصادر الحالية.';


    // ===========================
    // المصادر
    // ===========================

    const sources =
      data.sources || [];

    renderSources(sources);


  } catch (err) {

    console.error(err);


    q('ruling').textContent =
      'تعذر الحصول على الإجابة الآن.';


    q('explanation').textContent =
      'حدث خطأ أثناء الاتصال بالخادم. حاول مرة أخرى بعد قليل.';


    q('sourcesList').innerHTML = `

      <div class="source-card">

        <div class="source-icon">
          ⚠️
        </div>

        <div>

          <strong>
            تعذر تحميل المصادر
          </strong>

          <p>
            لم نتمكن من الاتصال بالخدمة حاليًا.
            لم يتم اعتماد إجابة غير موثقة.
          </p>

        </div>

      </div>

    `;
  }
};
