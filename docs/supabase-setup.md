# راه‌اندازی Supabase

## متغیرهای محیطی

مقادیر پروژهٔ Supabase را فقط در فایل محلی `.env` قرار دهید و هرگز آن را commit نکنید.

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

مقدار `VITE_SUPABASE_URL` را بهتر است به‌صورت URL کامل وارد کنید؛ کد Project Ref تنها را هم به‌صورت خودکار به URL استاندارد تبدیل می‌کند.

## تنظیم در محیط توسعه

در ریشهٔ پروژه یک فایل `.env.local` بسازید و این دو مقدار را در آن قرار دهید:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

فایل `.env.local` نباید commit شود. بعد از تغییر آن، dev server را دوباره اجرا کنید.

## تنظیم در GitHub Actions

1. در داشبورد Supabase از مسیر **Project Settings → API**، مقدار **Project URL** و کلید **Publishable key** را بردارید. اگر پروژهٔ شما رابط قدیمی دارد، مقدار **anon / public key** همان مقداری است که باید استفاده شود.
2. در GitHub ریپو را باز کنید و به **Settings → Secrets and variables → Actions** بروید.
3. در تب **Secrets** روی **New repository secret** بزنید و این دو secret را جداگانه بسازید:
   - نام: `VITE_SUPABASE_URL`، مقدار: Project URL
   - نام: `VITE_SUPABASE_ANON_KEY`، مقدار: Publishable key یا anon/public key
4. لازم نیست secret را داخل کد یا فایل `.env.example` بنویسید. workflow انتشار، این secretها را هنگام build به متغیرهای Vite تبدیل می‌کند.
5. از مسیر **Actions → Deploy to GitHub Pages**، اجرای workflow را با **Run workflow** دوباره شروع کنید.

کلید publishable/anon برای استفادهٔ مرورگر طراحی شده است؛ هرگز **service_role key** را در این متغیر یا در کد فرانت‌اند قرار ندهید.


پس از ساخت پروژهٔ Supabase، migration زیر را از طریق ابزار CLI یا SQL Editor همان پروژه اعمال کنید:

`supabase/migrations/20261020201500_initial_mvp_schema.sql`

بعد از آن، migration نام کاربری را نیز اجرا کنید:

`supabase/migrations/20261021150000_add_usernames.sql`

این migration نقش‌های کاربری، پلن‌ها، محتوا، ارزیابی CLEAR، پیشرفت آموزشی، سفارش‌ها، دسترسی‌ها، گفتگوهای مربی، سهمیهٔ ماهانه و منتورینگ را ایجاد می‌کند. همچنین RLS فعال است؛ دادهٔ کاربر فقط برای همان کاربر قابل دسترسی است.

## گام بعدی

پس از اعمال migration و تنظیم متغیرهای محیطی، لایهٔ احراز هویت OTP در `src/lib/supabase-auth.ts` از API رسمی Auth استفاده می‌کند. اتصال داده‌های داشبورد و مدیریت نشست در مرحلهٔ بعد تکمیل می‌شود.
