const q = id => document.getElementById(id);

q('clearBtn').onclick = () => q('question').value = '';

document.querySelectorAll('.topic-grid button').forEach(btn => {
  btn.onclick = () => {
    q('question').value = `أريد أن أسأل عن موضوع ${btn.dataset.topic}. سأحكي لك الموقف بالتفصيل وأريد معرفة الحكم مع ذكر المصادر الموثوقة.`;
    q('question').focus();
  };
});

q('askBtn').onclick = () => {
  const text = q('question').value.trim();
  if (!text) {
    q('question').focus();
    q('question').placeholder = 'اكتب الموقف أولًا، وسأساعدك في الوصول للمعلومة الشرعية الموثوقة.';
    return;
  }
  q('answer').hidden = false;
  q('sources').hidden = true;
  q('answer').scrollIntoView({behavior:'smooth', block:'start'});
  q('ruling').textContent = 'هذه واجهة النسخة الأولى. سيتم هنا عرض الحكم بعد ربط محرك الذكاء الاصطناعي بقاعدة مصادر شرعية موثوقة.';
  q('explanation').textContent = 'لن يعتمد النظام في النسخة النهائية على التخمين وحده؛ سيبحث عن المصادر المرتبطة بالسؤال ويعرض المرجع الأصلي للمستخدم.';
};

q('sourcesBtn').onclick = () => {
  q('sources').hidden = false;
  q('sources').scrollIntoView({behavior:'smooth', block:'start'});
};

q('settingsBtn').onclick = () => q('settingsModal').hidden = false;
q('closeSettings').onclick = () => q('settingsModal').hidden = true;
q('settingsModal').addEventListener('click', e => {
  if (e.target === q('settingsModal')) q('settingsModal').hidden = true;
});

document.querySelectorAll('[data-bg]').forEach(btn => {
  btn.onclick = () => {
    document.body.classList.remove('mint','nature','night');
    if (btn.dataset.bg !== 'default') document.body.classList.add(btn.dataset.bg);
    localStorage.setItem('fatwa-bg', btn.dataset.bg);
  };
});

q('bgUpload').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    q('bg-overlay').style.backgroundImage = `url(${reader.result})`;
    document.querySelector('.bg-overlay').style.backgroundImage =
      `linear-gradient(rgba(255,255,255,.82),rgba(255,255,255,.90)),url(${reader.result})`;
    document.querySelector('.bg-overlay').style.backgroundSize = 'cover';
    document.querySelector('.bg-overlay').style.backgroundPosition = 'center';
    localStorage.setItem('fatwa-custom-bg', reader.result);
  };
  reader.readAsDataURL(file);
};

const savedBg = localStorage.getItem('fatwa-bg');
if (savedBg && savedBg !== 'default') document.body.classList.add(savedBg);
const custom = localStorage.getItem('fatwa-custom-bg');
if (custom) {
  document.querySelector('.bg-overlay').style.backgroundImage =
    `linear-gradient(rgba(255,255,255,.82),rgba(255,255,255,.90)),url(${custom})`;
  document.querySelector('.bg-overlay').style.backgroundSize='cover';
  document.querySelector('.bg-overlay').style.backgroundPosition='center';
}


// Backend integration prepared for V2.
// The API key stays on the Worker; never place it in this browser code.
async function askBackend(question) {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({question})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "تعذر الاتصال بالخادم");
  return data;
}

const originalAskBtn = q('askBtn').onclick;
q('askBtn').onclick = async () => {
  const text = q('question').value.trim();
  if (!text) {
    q('question').focus();
    return;
  }

  q('answer').hidden = false;
  q('sources').hidden = true;
  q('ruling').textContent = 'جاري فهم السؤال والبحث في المصادر...';
  q('explanation').textContent = 'نبحث أولًا في قاعدة المصادر الموثوقة، ثم نطلب من محرك الذكاء الاصطناعي صياغة الإجابة بناءً على النتائج.';
  q('answer').scrollIntoView({behavior:'smooth', block:'start'});

  try {
    const data = await askBackend(text);
    q('ruling').textContent = data.answer?.ruling || 'لم يتم العثور على حكم موثق كافٍ.';
    q('explanation').textContent = data.answer?.explanation || '';
    const sources = data.sources || [];
    const sourceBox = document.querySelector('.source-card');
    const sourceContainer = q('sources');
    sourceContainer.innerHTML = '<div class="section-title">المصادر والمراجع</div>';
    if (!sources.length) {
      sourceContainer.innerHTML += '<div class="source-card"><div class="source-icon">⚠️</div><div><strong>لا توجد مصادر مطابقة</strong><p>لم يتم اعتماد إجابة غير موثقة. يمكن تطوير البحث وإضافة مصادر معتمدة.</p></div></div>';
    } else {
      for (const s of sources) {
        sourceContainer.innerHTML += `<div class="source-card"><div class="source-icon">📖</div><div><strong>${s.authority}</strong><p>${s.title}<br>رقم الفتوى: ${s.fatwa_number || 'غير متاح'}<br><a href="${s.url}" target="_blank" rel="noopener">عرض المصدر الأصلي</a></p></div></div>`;
      }
    }
  } catch (err) {
    q('ruling').textContent = 'الواجهة جاهزة، لكن الخادم لم يتم تفعيله بعد.';
    q('explanation').textContent = 'بعد نشر Worker وربط D1 وإضافة مفتاح الخدمة كـSecret، سيعمل البحث والذكاء الاصطناعي من هنا بدون كشف المفتاح للمستخدم.';
  }
};
