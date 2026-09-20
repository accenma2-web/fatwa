# فتوى V2

نسخة مستقلة من مشروع «فتوى» مع واجهة V1 + بداية الـBackend.

## البنية
- `public/` الواجهة.
- `worker/worker.js` Cloudflare Worker.
- `migrations/0001_initial.sql` قاعدة D1.
- `wrangler.toml` إعدادات النشر.

## مهم
لا تضع `OPENAI_API_KEY` داخل `public/`.
يُضاف كمفتاح Secret إلى Worker.

## الخطوة التالية
1. إنشاء/اختيار D1 باسم `fatwa-db`.
2. وضع `database_id` الحقيقي في `wrangler.toml`.
3. تطبيق migration.
4. إضافة Secret باسم `OPENAI_API_KEY`.
5. نشر Worker.
6. إدخال مصادر شرعية رسمية ومراجعة طريقة الاسترجاع قبل الإنتاج.

هذه النسخة لا تحتوي على مصادر شرعية مزروعة تلقائيًا؛ لأننا نريد إدخال المصادر بعد التحقق من المصدر الأصلي وحقوق استخدام المحتوى.
