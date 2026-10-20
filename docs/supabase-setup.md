# راه‌اندازی Supabase

## متغیرهای محیطی

مقادیر پروژهٔ Supabase را فقط در فایل محلی `.env` قرار دهید و هرگز آن را commit نکنید.

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

`.env.example` فقط نام متغیرهای موردنیاز را نگه می‌دارد.

## اعمال اسکیمای اولیه

پس از ساخت پروژهٔ Supabase، migration زیر را از طریق ابزار CLI یا SQL Editor همان پروژه اعمال کنید:

`supabase/migrations/20261020201500_initial_mvp_schema.sql`

این migration نقش‌های کاربری، پلن‌ها، محتوا، ارزیابی CLEAR، پیشرفت آموزشی، سفارش‌ها، دسترسی‌ها، گفتگوهای مربی، سهمیهٔ ماهانه و منتورینگ را ایجاد می‌کند. همچنین RLS فعال است؛ دادهٔ کاربر فقط برای همان کاربر قابل دسترسی است.

## گام بعدی

پس از اعمال migration و تنظیم متغیرهای محیطی، وابستگی `@supabase/supabase-js` اضافه و لایه‌های ورود OTP و داده‌های داشبورد به آن متصل می‌شوند.
