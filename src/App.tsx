import { useEffect, useState } from "react";
import { activateDemoPlan, completeExercise, completeLesson, completeMonthlyChallenge, createCoachConversation, deleteAccount, deleteCoachConversation, getActivePlan, getCoachConversation, getCoachMessages, getCoachQuota, getLatestAssessment, getLessonProgress, getMonthlyChallengeProgress, getPublishedLessons, getPurchaseHistory, getStoredSession, getUserProfile, requestCoachReply, requestOtp, restoreSession, saveAssessment, saveCoachMessage, saveSession, signOut, updateUserProfile, verifyOtp, type AuthSession, type ActivePlan, type CoachMessage, type CoachQuota, type PublishedLesson, type PurchaseRecord, type UserProfile } from "./lib/supabase-auth";

type Page = "home" | "about" | "auth" | "dashboard" | "library" | "lesson" | "coach" | "pricing" | "checkout" | "profile";

const pages: Page[] = ["home", "about", "auth", "dashboard", "library", "lesson", "coach", "pricing", "checkout", "profile"];

function pageFromHash() {
  const page = window.location.hash.slice(1) as Page;
  return pages.includes(page) ? page : null;
}

function learningStreak(dates: Array<string | null>) {
  const activeDays = new Set(dates.filter((date): date is string => Boolean(date)).map(date => {
    const value = new Date(date);
    return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
  }));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0,0,0,0);
  while(activeDays.has(`${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`)) {
    streak += 1;
    cursor.setDate(cursor.getDate()-1);
  }
  return streak;
}

const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    arrow: <path d="m15 18-6-6 6-6" />,
    play: <path d="m10 8 6 4-6 4V8Z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    book: <><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Z" /><path d="M7 17h11" /></>,
    chat: <path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.7-4A8 8 0 1 1 21 12Z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    send: <path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    reset: <><path d="M20 11a8 8 0 1 0 2 5" /><path d="M20 4v7h-7" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
};

const Button = ({ children, onClick, ghost = false, block = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; ghost?: boolean; block?: boolean; disabled?: boolean }) => (
  <button className={`btn ${ghost ? "btn-ghost" : ""} ${block ? "btn-block" : ""}`} onClick={onClick} disabled={disabled}>{children}</button>
);

type HeaderProps = { authenticated?: boolean; displayName?: string; onLogout?: () => void };

const Header = ({ go, simple = false, authenticated = false, displayName, onLogout }: { go: (p: Page) => void; simple?: boolean } & HeaderProps) => {
  const [menuOpen,setMenuOpen]=useState(false);
  const navigate=(page:Page)=>{setMenuOpen(false);go(page)};
  const openSupport=()=>{setMenuOpen(false);window.dispatchEvent(new Event("open-support"))};
  return <header className="header">
    <button className="brand" onClick={() => navigate("home")}><span>TAROKH</span><small>CHARISMA LAB</small></button>
    {!simple && <nav><button onClick={() => navigate("home")}>خانه</button><button onClick={() => navigate("dashboard")}>آکادمی</button><button onClick={() => navigate("coach")}>مربی AI</button><button onClick={() => navigate("pricing")}>پلن‌ها</button><button onClick={() => navigate("about")}>درباره ما</button><button onClick={openSupport}>پشتیبانی</button></nav>}
    {!simple && <button className="menu-toggle" aria-label="باز کردن منو" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}><span/><span/><span/></button>}
    {!simple&&menuOpen&&<div className="mobile-menu"><button onClick={()=>navigate("home")}>خانه</button><button onClick={()=>navigate("dashboard")}>آکادمی</button><button onClick={()=>navigate("coach")}>مربی AI</button><button onClick={()=>navigate("pricing")}>پلن‌ها</button><button onClick={()=>navigate("about")}>درباره ما</button><button onClick={openSupport}>پشتیبانی</button>{authenticated?<><button onClick={()=>navigate("profile")}>حساب من{displayName?` · ${displayName}`:""}</button>{onLogout&&<button onClick={()=>{setMenuOpen(false);onLogout()}}>خروج</button>}</>:<button onClick={()=>navigate("auth")}>ورود / ثبت‌نام</button>}</div>}
    {authenticated ? <div className="account-actions"><button className="header-user" onClick={() => navigate("profile")}>{displayName || "حساب من"}</button><Button onClick={onLogout} ghost>خروج</Button></div> : <Button onClick={() => navigate("auth")} ghost>ورود / ثبت‌نام</Button>}
  </header>;
};

const BottomNav = ({ page, go }: { page: Page; go: (p: Page) => void }) => (
  <nav className="bottom-nav">
    {[["dashboard","home","خانه"],["library","book","آموزش"],["coach","chat","مربی AI"],["profile","user","حساب من"]].map(([p,i,l]) => (
      <button className={page === p ? "active" : ""} onClick={() => go(p as Page)} key={p}><Icon name={i}/><span>{l}</span></button>
    ))}
  </nav>
);

const Footer = ({ go }: { go: (p: Page) => void }) => (
  <footer className="footer"><button className="brand" onClick={() => go("home")}><span>TAROKH</span><small>CHARISMA LAB</small></button><div><button onClick={() => go("about")}>درباره ما</button><button onClick={() => window.dispatchEvent(new Event("open-support"))}>پشتیبانی</button></div><small>تمام حقوق برای آزمایشگاه کاریزما محفوظ است.</small></footer>
);

function SupportWidget({ showButton }: { showButton: boolean }) {
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState<string|null>(null);
  const [category,setCategory]=useState("شروع و حساب");
  useEffect(()=>{
    const handle=()=>setOpen(true);
    window.addEventListener("open-support",handle);
    return ()=>window.removeEventListener("open-support",handle);
  },[]);
  const faqCategories={
    "شروع و حساب":[
      ["چطور مسیرم را شروع کنم؟","پس از ساخت حساب، ارزیابی کوتاه CLEAR را کامل کن تا دو مهارت پیشنهادی و نقطهٔ شروع مسیرت مشخص شود."],
      ["چطور نام کاربری یا اطلاعات حسابم را تغییر دهم؟","از بخش «حساب من» می‌توانی نام کاربری‌ات را ویرایش کنی. همان‌جا وضعیت پلن و سوابق خرید را هم می‌بینی."],
      ["اگر بخواهم حسابم را حذف کنم چه می‌شود؟","از بخش «حساب من» گزینهٔ حذف حساب را انتخاب کن. پس از تأیید، داده‌های حساب و پیشرفت‌های وابسته حذف می‌شوند."],
    ],
    "دوره و یادگیری":[
      ["درس‌ها با چه ترتیبی باز می‌شوند؟","درس نخست از ابتدا باز است و هر درس بعدی پس از تکمیل درس قبلی در دسترس قرار می‌گیرد."],
      ["تکمیل مطالعه و انجام تمرین چه تفاوتی دارند؟","مطالعهٔ درس و انجام تمرین دو ثبت جداگانه هستند. برای پیشرفت واقعی، هر دو را پس از انجام ثبت کن."],
      ["چالش ماهانه چیست؟","یک تمرین عملی متناسب با ارزیابی و پیشرفت توست که برای پلن‌های نقره، طلا و الماس در آکادمی نمایش داده می‌شود."],
    ],
    "مربی و مشاور AI":[
      ["مربی AI چه کاری انجام می‌دهد؟","در سناریوهای گفت‌وگو با تو نقش‌آفرینی می‌کند و نکتهٔ مثبت، پیشنهاد اصلاح و پاسخ جایگزین می‌دهد."],
      ["مشاور شخصی AI چه کمکی می‌کند؟","دربارهٔ استفاده از سایت، مسیر درس‌ها، تمرین، چالش ماهانه و برنامهٔ مناسب سطح فعلی‌ات راهنمایی می‌کند."],
      ["سهمیهٔ AI چگونه محاسبه می‌شود؟","سهمیه به‌صورت روزانه و بر اساس پلن فعال محاسبه می‌شود. نقره روزانه ۳۰ پیام، طلا ۱۵۰ پیام و الماس سهمیهٔ نامحدود دارد."],
    ],
    "پلن و پرداخت":[
      ["کدام پلن برای من مناسب است؟","برنز برای یادگیری مستقل است. نقره دسترسی به AI و چالش ماهانه می‌دهد؛ طلا و الماس برای تمرین عمیق‌تر، سهمیهٔ بیشتر و برنامهٔ شخصی‌سازی‌شده مناسب‌اند."],
      ["مدت اعتبار پلن چقدر است؟","هر پلن از زمان فعال‌سازی یک ماه اعتبار دارد و روزهای باقی‌مانده در بخش «حساب من» و صفحهٔ پلن‌ها نمایش داده می‌شود."],
      ["پرداخت چگونه انجام می‌شود؟","فعلاً فعال‌سازی پلن در محیط آزمایشی انجام می‌شود و هیچ تراکنش بانکی واقعی ثبت نمی‌شود."],
      ["آیا جلسات یا منتورینگ انسانی فعال است؟","خیر. در وضعیت فعلی، بازخورد و برنامهٔ تمرینی از طریق مربی و مشاور AI ارائه می‌شود."],
    ],
    "پشتیبانی":[
      ["اگر پاسخ سؤالم را اینجا پیدا نکردم چه کنم؟","از طریق تلگرام یا ایمیل با پشتیبانی ارتباط بگیر و در صورت امکان نام کاربری و شرح کوتاه مسئله را بفرست."],
      ["چرا یک بخش از سایت برایم باز نمی‌شود؟","ابتدا مطمئن شو وارد حساب شده‌ای و پلن فعالت منقضی نشده است. سپس صفحه را تازه‌سازی کن؛ اگر مشکل باقی ماند با پشتیبانی تماس بگیر."],
    ],
  } as Record<string, Array<[string,string]>>;
  const faqs=faqCategories[category];
  return <div className={`support-widget ${showButton?"visible":""}`}>
    {open&&<section className="support-panel"><div className="support-head"><div><span>مرکز راهنما</span><b>چطور کمکت کنیم؟</b></div><button aria-label="بستن" onClick={()=>setOpen(false)}><Icon name="close"/></button></div>
      <div className="support-body"><h3>دسته‌بندی راهنما</h3><div className="support-categories">{Object.keys(faqCategories).map(item=><button className={category===item?"active":""} onClick={()=>{setCategory(item);setActive(null)}} key={item}>{item}</button>)}</div><h3>{category}</h3><div className="faq-list">{faqs.map(([question,answer])=><div className={active===question?"active":""} key={question}><button onClick={()=>setActive(active===question?null:question)}><span>{question}</span><b>{active===question?"−":"+"}</b></button>{active===question&&<p>{answer}</p>}</div>)}</div>
      <h3>ارتباط با پشتیبان</h3><div className="support-links"><a href="https://t.me/TAROKH_OWNER" target="_blank" rel="noreferrer">تلگرام</a><a href="tel:+989162422026" dir="ltr">۰۹۱۶۲۴۲۲۰۲۶</a></div></div>
    </section>}
    {showButton&&<button className="support-fab" aria-label="پشتیبانی" onClick={()=>setOpen(!open)}><Icon name={open?"close":"chat"}/></button>}
  </div>;
}

function Home({ go, ...auth }: { go: (p: Page) => void } & HeaderProps) {
  return <><Header go={go} {...auth}/><main>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">آزمایشگاه کاریزمای مردانه</span>
        <h1>کاریزما اتفاقی نیست.<br/><em>ساختنی‌ست.</em></h1>
        <p>گام‌به‌گام یاد بگیر چطور با اعتماد‌به‌نفس صحبت کنی، زبان بدنت را کنترل کنی و حضوری ماندگار بسازی.</p>
        <div className="actions"><Button onClick={() => go("auth")}>شروع مسیر کاریزما <Icon name="arrow"/></Button><button className="text-link" onClick={() => go("pricing")}>مشاهده پلن‌ها</button></div>
        <div className="proof"><strong>+۲٬۴۰۰</strong><span>مرد در مسیر ساختن<br/>نسخه قدرتمندتر خود</span></div>
      </div>
      <div className="portrait"><div className="portrait-label"><span>اصل اول</span><strong>حضور، قبل از کلام آغاز می‌شود.</strong></div></div>
    </section>
    <section className="clear">
      <div className="section-title"><span>متود اختصاصی Charisma Lab</span><h2>مسیر <b dir="ltr">CLEAR</b></h2></div>
      <div className="clear-grid">
        {[["C","اعتمادبه‌نفس","Confidence"],["L","گوش دادن","Listening"],["E","بیان","Expression"],["A","آگاهی اجتماعی","Awareness"],["R","ایجاد ارتباط","Rapport"]].map(([a,b,c],i)=><div className={i===0?"current":""} key={a}><b dir="ltr">{a}</b><strong>{b}</strong><small dir="ltr">{c}</small></div>)}
      </div>
    </section>
    <section className="testimonials"><div className="section-title"><span>تجربه اعضا</span><h2>نتیجه‌ی کسانی که مسیر را رفته‌اند</h2></div><div className="testimonial-row">
      {[["امیر ر.","نقره","«هنوز در شروع گفت‌وگو کمی مکث دارم، اما حالا می‌دانم چه سؤالی بپرسم و چطور ادامه بدهم.»","۸ هفته","Listening"],["سامان ک.","طلا","«تمرین‌های کوتاه کمکم کرد در جلسه‌ها آرام‌تر حرف بزنم و برای بیان نظرم عجله نکنم.»","۱۲ هفته","Expression"],["نیما ش.","برنز","«تغییر یک‌شبه نبود؛ ولی حالا زبان بدنم را بیشتر می‌شناسم و موقع صحبت کمتر خودم را جمع می‌کنم.»","۶ هفته","Confidence"]].map(([name,plan,quote,time,focus])=><article key={name}><div><strong>{name}</strong><span>{plan}</span></div><blockquote>{quote}</blockquote><small>{time} · تمرکز روی <b dir="ltr">{focus}</b></small></article>)}
    </div></section>
  </main><Footer go={go}/><button className="sticky-cta" onClick={() => go("auth")}>شروع رایگان</button></>;
}

function About({ go, ...auth }: { go: (p: Page) => void } & HeaderProps) {
  return <><Header go={go} {...auth}/><main className="about-page">
    <section className="about-hero"><span className="eyebrow">درباره Charisma Lab</span><h1>کاریزما ساختنی است.</h1><p>ما کمک می‌کنیم حضور مؤثر را با تمرین‌های کوچک، واقعی و پیوسته بسازی.</p></section>
    <section className="brand-story"><span>داستان ما</span><h2>از دانستن تا توانستن</h2><p>Charisma Lab با یک باور ساده شکل گرفت: ارتباط مؤثر یک استعداد ذاتی نیست. بیشتر آموزش‌ها فقط درباره اعتمادبه‌نفس حرف می‌زنند؛ ما آن را به رفتارهای کوچک و قابل تمرین تبدیل کرده‌ایم. اینجا هر درس با یک اقدام واقعی تمام می‌شود تا تغییر، بیرون از صفحه و در زندگی روزمره اتفاق بیفتد.</p></section>
    <section className="values"><div className="about-heading"><span>چیزی که به آن پایبندیم</span><h2>ارزش‌های ما</h2></div><div className="value-grid">{[["۰۱","عمل مهم‌تر از تئوری","هر مفهوم باید به یک تمرین روشن و قابل اجرا تبدیل شود."],["۰۲","جدی و محترمانه","بدون شعار و قضاوت، با احترام به مسیر منحصربه‌فرد هر فرد."],["۰۳","مسیر مرحله‌ای","تغییر پایدار از قدم‌های کوچک، منظم و قابل اندازه‌گیری ساخته می‌شود."]].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></section>
    <section className="founder"><div className="founder-photo"><span>تصویر بنیان‌گذار</span></div><div><span className="eyebrow">بنیان‌گذار Charisma Lab</span><h2>تارخ دشتبانی</h2><p>پژوهشگر و مربی مهارت‌های ارتباطی با تمرکز بر رشد عملی مردان جوان. هدف او ساختن مسیری روشن برای تبدیل آگاهی به رفتار مؤثر و ماندگار است.</p></div></section>
    <section className="about-cta"><span>قدم بعدی با توست</span><h2>حضورت را ماندگار کن.</h2><Button onClick={()=>go("auth")}>شروع مسیر <Icon name="arrow"/></Button></section>
  </main><Footer go={go}/></>;
}

function Auth({ go, onAuthenticated }: { go: (p: Page) => void; onAuthenticated: (session: AuthSession) => void }) {
  const [view,setView]=useState<"login"|"quiz"|"result"|"create"|"verify">("login");
  const [step,setStep]=useState(1);
  const [answers,setAnswers]=useState<string[][]>([[],[],[]]);
  const [accountTab,setAccountTab]=useState<"mobile"|"email">("mobile");
  const [identifier,setIdentifier]=useState("");
  const [username,setUsername]=useState("");
  const [otp,setOtp]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [cooldown,setCooldown]=useState(0);
  const [isSignup,setIsSignup]=useState(false);
  useEffect(()=>{
    if(cooldown===0) return;
    const timer=window.setInterval(()=>setCooldown(value=>Math.max(0,value-1)),1000);
    return ()=>window.clearInterval(timer);
  },[cooldown]);
  const questions = [
    {title:"بیشتر در چه موقعیتی اذیت می‌شوی؟",hint:"حداکثر ۲ مورد را انتخاب کن",max:2,options:["شروع مکالمه با آدم جدید","ادامه‌ی مکالمه و پیدا کردن موضوع","حرف زدن در جمع یا جلسه","ارتباط با جنس مخالف","گفتن «نه» و مرزگذاری"]},
    {title:"چه چیزی را بیشتر در خودت می‌بینی؟",hint:"حداکثر ۲ مورد را انتخاب کن",max:2,options:["حرفی برای گفتن پیدا نمی‌کنم","زیاد توضیح می‌دهم و تأیید می‌خواهم","زبان بدنم مضطرب به‌نظر می‌رسد","طرف مقابل را خوب نمی‌خوانم","مکالمه‌ها زود تمام می‌شوند"]},
    {title:"روزی چقدر وقت داری؟",hint:"یک گزینه را انتخاب کن",max:1,options:["۵ دقیقه","۱۰ دقیقه","۲۰ دقیقه"]},
  ];
  const selectAnswer=(value:string)=>{
    setAnswers(current=>current.map((items,index)=>{
      if(index!==step-1) return items;
      if(items.includes(value)) return items.filter(item=>item!==value);
      return items.length<questions[index].max?[...items,value]:items;
    }));
  };
  const recommendation=()=>{
    const scores:Record<string,number>={C:0,L:0,E:0,A:0,R:0};
    const map:Record<string,string>={
      "شروع مکالمه با آدم جدید":"R","ادامه‌ی مکالمه و پیدا کردن موضوع":"L","حرف زدن در جمع یا جلسه":"E","ارتباط با جنس مخالف":"A","گفتن «نه» و مرزگذاری":"C",
      "حرفی برای گفتن پیدا نمی‌کنم":"E","زیاد توضیح می‌دهم و تأیید می‌خواهم":"C","زبان بدنم مضطرب به‌نظر می‌رسد":"C","طرف مقابل را خوب نمی‌خوانم":"A","مکالمه‌ها زود تمام می‌شوند":"L",
    };
    answers.flat().forEach(answer=>{if(map[answer]) scores[map[answer]]++});
    return Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([letter])=>letter);
  };
  const paths:Record<string,[string,string]>={
    C:["اعتمادبه‌نفس","حضور آرام و مرزهای روشن را در خودت تقویت می‌کنی."],
    L:["گوش دادن","یاد می‌گیری گفت‌وگو را با شنیدن دقیق پیش ببری."],
    E:["بیان","فکرت را کوتاه، روشن و اثرگذار بیان می‌کنی."],
    A:["آگاهی اجتماعی","نشانه‌های رفتاری طرف مقابل را بهتر می‌خوانی."],
    R:["ایجاد ارتباط","شروع و ادامه‌دادن ارتباط برایت طبیعی‌تر می‌شود."],
  };
  const submitOtp=async(signup=false)=>{
    if(!identifier.trim() || !username.trim() || cooldown>0) return;
    setBusy(true); setMessage("");
    try {
      await requestOtp(identifier.trim(), accountTab, signup ? username : undefined);
      setIsSignup(signup);
      setCooldown(60);
      setView("verify");
    } catch (error) {
      const details=error instanceof Error ? error.message : "ارسال کد انجام نشد.";
      setMessage(details.toLowerCase().includes("rate limit") ? "درخواست‌های ایمیل بیش از حد مجاز شده است؛ لطفاً چند دقیقه صبر کن و دوباره تلاش کن." : details);
    } finally { setBusy(false); }
  };
  const confirmOtp=async()=>{
    if(!otp.trim()) return;
    setBusy(true); setMessage("");
    try {
      const session=await verifyOtp(identifier.trim(), otp.trim(), accountTab);
      const savedUsername=session.user.user_metadata?.username || session.user.user_metadata?.display_name;
      if(savedUsername && savedUsername.trim().toLowerCase()!==username.trim().toLowerCase()) throw new Error("نام کاربری با این حساب مطابقت ندارد.");
      const nextSession={...session,user:{...session.user,user_metadata:{...session.user.user_metadata,username:username.trim(),display_name:username.trim()}}};
      saveSession(nextSession);
      onAuthenticated(nextSession);
      go("home");
      void (async()=>{
        try {
          await updateUserProfile(session, username);
          if(isSignup) await saveAssessment(session, answers, recommendation());
        } catch {
          // Authentication is complete even if optional profile data cannot be stored yet.
        }
      })();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "کد واردشده معتبر نیست.");
    } finally { setBusy(false); }
  };
  const AccountForm=({login=false}:{login?:boolean})=><>
    {login&&<button className="auth-switch" onClick={()=>{setView("quiz");setStep(1)}}>حساب نداری؟ <b>ثبت‌نام</b></button>}
    <span className="eyebrow">{login?"ورود امن با کد یک‌بارمصرف":"آخرین قدم"}</span>
    <h2>{login?"ورود به حساب":"ساخت حساب"}</h2>
    <div className="auth-tabs"><button className={accountTab==="mobile"?"active":""} onClick={()=>setAccountTab("mobile")}>شماره موبایل</button><button className={accountTab==="email"?"active":""} onClick={()=>setAccountTab("email")}>ایمیل</button></div>
    <label>نام کاربری<input value={username} onChange={event=>setUsername(event.target.value)} dir="ltr" autoComplete="username" placeholder="مثلاً arman"/></label>
    {accountTab==="mobile"?<label>شماره موبایل<input value={identifier} onChange={event=>setIdentifier(event.target.value)} dir="ltr" inputMode="tel" autoComplete="tel" placeholder="0912 000 0000"/> </label>:<label>ایمیل<input value={identifier} onChange={event=>setIdentifier(event.target.value)} dir="ltr" type="email" autoComplete="email" placeholder="name@example.com"/></label>}
    <Button block onClick={()=>submitOtp(!login)} disabled={busy||cooldown>0||!identifier.trim()||!username.trim()}>{busy?"در حال ارسال…":cooldown>0?`ارسال دوباره تا ${cooldown} ثانیه`:login?"دریافت کد ورود":"دریافت کد"} <Icon name="arrow"/></Button>
    {message&&<p className="auth-message">{message}</p>}
    {!login&&<small>پاسخ‌های تو فقط برای شخصی‌سازی مسیرت استفاده می‌شود.</small>}
  </>;
  return <><Header go={go} simple/><main className="center-page auth-page">
    {view==="login"&&<div className="auth-card">{AccountForm({login:true})}</div>}
    {view==="verify"&&<div className="auth-card"><button className="auth-switch" onClick={()=>setView("login")}>ویرایش اطلاعات</button><span className="eyebrow">کد تأیید ارسال شد</span><h2>کدت را وارد کن</h2><p>کد یک‌بارمصرف برای {identifier} ارسال شد.</p><label>کد تأیید<input value={otp} onChange={event=>setOtp(event.target.value)} dir="ltr" inputMode="numeric" maxLength={8} placeholder="--------"/></label><Button block onClick={confirmOtp} disabled={busy||otp.trim().length<8}>{busy?"در حال بررسی…":"تأیید و ورود"} <Icon name="arrow"/></Button>{message&&<p className="auth-message">{message}</p>}<button className="text-link resend" onClick={()=>submitOtp(isSignup)} disabled={busy||cooldown>0}>{cooldown>0?`ارسال دوباره تا ${cooldown} ثانیه`:"ارسال دوباره کد"}</button></div>}
    {view==="quiz"&&<div className="auth-card quiz-card">
      <div className="quiz-progress"><div><i style={{width:`${step/3*100}%`}}/></div><span>مرحله {step} از ۳</span></div>
      <span className="eyebrow">شناخت مسیر تو</span><h2>{questions[step-1].title}</h2><p>{questions[step-1].hint}</p>
      <div className="choices">{questions[step-1].options.map(option=><button className={answers[step-1].includes(option)?"selected":""} onClick={()=>selectAnswer(option)} key={option}><span>{option}</span><i>{answers[step-1].includes(option)?<Icon name="check"/>:""}</i></button>)}</div>
      <div className="quiz-actions"><Button ghost onClick={()=>step===1?setView("login"):setStep(step-1)}>قبلی</Button><Button disabled={!answers[step-1].length} onClick={()=>step===3?setView("result"):setStep(step+1)}>بعدی <Icon name="arrow"/></Button></div>
    </div>}
    {view==="result"&&<div className="auth-card result-card"><span className="eyebrow">بر اساس پاسخ‌های تو</span><h2>مسیر پیشنهادی تو</h2><p>تمرکز اصلی تو از این دو مهارت شروع می‌شود.</p><div className="recommended">{recommendation().map(letter=><div key={letter}><b dir="ltr">{letter}</b><span><strong>{paths[letter][0]}</strong><small>{paths[letter][1]}</small></span></div>)}</div><Button block onClick={()=>setView("create")}>ساخت حساب <Icon name="arrow"/></Button></div>}
    {view==="create"&&<div className="auth-card"><button className="auth-switch" onClick={()=>setView("login")}>حساب داری؟ <b>ورود</b></button>{AccountForm({})}</div>}
  </main></>;
}

function Dashboard({ go, onLogout, displayName, session, onOpenLesson, activePlan }: { go: (p: Page) => void; onLogout: () => void; displayName?: string; session: AuthSession; onOpenLesson: (lesson: PublishedLesson) => void; activePlan: ActivePlan | null }) {
  const [showLeaders,setShowLeaders]=useState(false);
  const [showMe,setShowMe]=useState(true);
  const [lessons,setLessons]=useState<PublishedLesson[]>([]);
  const [completedIds,setCompletedIds]=useState<Set<string>>(new Set());
  const [streak,setStreak]=useState(0);
  const [history,setHistory]=useState<Array<{ title: string; type: string; at: string }>>([]);
  const [recommendedDimensions,setRecommendedDimensions]=useState<string[]>([]);
  const [monthlyChallengeCompleted,setMonthlyChallengeCompleted]=useState(false);
  const [monthlyChallengeSaving,setMonthlyChallengeSaving]=useState(false);
  const [monthlyChallengeMessage,setMonthlyChallengeMessage]=useState("");
  const challenges: Record<string,{ title: string; description: string; steps: string[]; success: string }>={
    confidence:{title:"سه مکث محکم",description:"در سه گفت‌وگوی واقعی، ریتم و پایان جمله‌هایت را آگاهانه کنترل کن.",steps:["پیش از پاسخ، یک مکث کوتاه داشته باش.","یک جمله را آرام و بدون عجله کامل کن.","پایان جمله را محکم و بدون عذرخواهی اضافه بگو."],success:"سه مکالمه را با یادداشت یک نکته از هرکدام تمام کن."},
    listening:{title:"نقشهٔ شنیدن",description:"یک گفت‌وگو را با شنیدن فعال و پیگیری دقیق جلو ببر.",steps:["یک نکتهٔ مشخص از حرف طرف مقابل را تکرار کن.","یک سؤال باز و مرتبط بپرس.","تا پیش از پاسخ خودت، اجازه بده او جمله‌اش را کامل کند."],success:"در پایان، دو نکته‌ای را که واقعاً از طرف مقابل فهمیدی یادداشت کن."},
    expression:{title:"پاسخ ۳۰ ثانیه‌ای",description:"نظرت را کوتاه، روشن و محترمانه در یک موقعیت واقعی بیان کن.",steps:["نظر اصلی‌ات را در یک جمله بگو.","فقط یک دلیل روشن به آن اضافه کن.","با یک پیشنهاد یا سؤال کوتاه جمع‌بندی کن."],success:"پاسخت را بعد از گفت‌وگو در سه جمله یا کمتر بنویس."},
    awareness:{title:"سه نشانه، یک تنظیم",description:"در دو گفت‌وگو نشانه‌های توجه و انرژی را ببین و رفتارت را تنظیم کن.",steps:["سه نشانهٔ رفتاری مانند تماس چشمی، مکث یا کوتاهی پاسخ‌ها را ببین.","به‌جای نتیجه‌گیری قطعی، یک احتمال بنویس.","اگر نشانهٔ بی‌حوصلگی دیدی، موضوع را کوتاه کن یا محترمانه بپرس."],success:"یک نمونه از تنظیم محترمانهٔ گفت‌وگو را یادداشت کن."},
    rapport:{title:"توجه دقیق",description:"با یک تعریف واقعی و بازگشت به حرف قبلی، ارتباطی طبیعی بساز.",steps:["یک جزئیات واقعی را که دیده‌ای نام ببر.","تعریفت را کوتاه و بدون اغراق بگو.","به یک حرف قبلیِ طرف مقابل برگرد و درباره‌اش بپرس."],success:"واکنش طرف مقابل و چیزی را که دربارهٔ او فهمیدی ثبت کن."},
  };
  const dimensions:Record<string,[string,string]>={
    confidence:["اعتمادبه‌نفس","حضور آرام و مرزهای روشن را در خودت تقویت کن."],
    listening:["گوش دادن","گفت‌وگو را با شنیدن دقیق پیش ببر."],
    expression:["بیان","فکرت را کوتاه، روشن و اثرگذار بیان کن."],
    awareness:["آگاهی اجتماعی","نشانه‌های رفتاری طرف مقابل را بهتر بخوان."],
    rapport:["ایجاد ارتباط","شروع و ادامه‌دادن ارتباط را تمرین کن."],
  };
  useEffect(()=>{
    Promise.all([getPublishedLessons(),getLessonProgress(session),getLatestAssessment(session)]).then(([published,progress,recommendations])=>{
      setLessons(published);
      setCompletedIds(new Set(progress.filter(item=>item.completed_at).map(item=>item.lesson_id)));
      setStreak(learningStreak(progress.flatMap(item=>[item.completed_at,item.exercise_completed_at])));
      setRecommendedDimensions(recommendations);
      setHistory(progress.flatMap(item=>{
        const lesson=published.find(candidate=>candidate.id===item.lesson_id);
        if(!lesson) return [];
        return [
          ...(item.completed_at?[{title:lesson.title,type:"مطالعهٔ درس",at:item.completed_at}]:[]),
          ...(item.exercise_completed_at?[{title:lesson.title,type:"انجام تمرین",at:item.exercise_completed_at}]:[]),
        ];
      }).sort((first,second)=>new Date(second.at).getTime()-new Date(first.at).getTime()));
      const challengeKey=recommendations[0] || published[0]?.course_modules.learning_paths.dimension;
      if(challengeKey) getMonthlyChallengeProgress(session,new Date().toISOString().slice(0,7)+"-01").then(items=>setMonthlyChallengeCompleted(items.some(item=>item.challenge_key===challengeKey&&Boolean(item.completed_at)))).catch(()=>{});
    }).catch(()=>{});
  },[session]);
  const completedCount=completedIds.size;
  const unlockedLessons=lessons.filter((lesson,index)=>index===0||completedIds.has(lessons[index-1].id));
  const nextLesson=unlockedLessons.find(lesson=>!completedIds.has(lesson.id));
  const percentage=lessons.length?Math.round(completedCount/lessons.length*100):0;
  const monthlyChallengeKey=recommendedDimensions[0] || nextLesson?.course_modules.learning_paths.dimension || "confidence";
  const monthlyChallenge=challenges[monthlyChallengeKey] || challenges.confidence;
  const monthlyChallengeAvailable=["نقره","طلا","الماس"].includes(activePlan?.name || "");
  const completeChallenge=async()=>{
    if(!monthlyChallengeAvailable||monthlyChallengeSaving) return;
    setMonthlyChallengeSaving(true); setMonthlyChallengeMessage("");
    try {
      await completeMonthlyChallenge(session,monthlyChallengeKey,new Date().toISOString().slice(0,7)+"-01");
      setMonthlyChallengeCompleted(true);
    } catch(error) {
      setMonthlyChallengeMessage(error instanceof Error?error.message:"ثبت چالش ماهانه انجام نشد.");
    } finally { setMonthlyChallengeSaving(false); }
  };
  const leaders=[["ش","شاهین آرام","۱۴"],["ک","کاوشگر شب","۱۲"],["م","مرد مسیر","۱۱"],["ذ","ذهن روشن","۱۰"],["س","سرو استوار","۹"],["ر","رهرو آرام","۹"],["ن","نقطه شروع","۸"],["پ","پلنگ صبور","۷"],["ق","قاب طلایی","۷"],["گ","گام بعدی","۶"]];
  return <><Header go={go} authenticated displayName={displayName} onLogout={onLogout}/><main className="app-page">
    <div className="welcome"><div><span className="eyebrow">سلام، {displayName || "دوست کاریزما"}</span><h2>امروز یک قدم جلوتر برو.</h2></div><div className="level"><span>سطح فعلی:</span><b>کاوشگر</b></div></div>
    <div className="dashboard-grid">
      <section className="today-card"><span className="pill">{nextLesson?`درس بعدی · ${nextLesson.duration_minutes} دقیقه`:"مسیر را کامل کردی"}</span><h3>{nextLesson?.title || "همهٔ درس‌ها تکمیل شدند"}</h3><p>{nextLesson?.summary || "برای مرور نکته‌ها و تمرین‌ها به کتابخانه برگرد."}</p><div className="card-row"><Button onClick={() => nextLesson?onOpenLesson(nextLesson):go("library")}>{nextLesson?"شروع مطالعه":"مشاهده درس‌ها"} <Icon name="arrow"/></Button><div className="day-count"><b>{streak}</b><span>روز پیوسته</span></div></div></section>
      <section className="progress-card"><div className="ring" style={{background:`conic-gradient(var(--gold) ${percentage}%,#292824 0)`}}><div><b>{percentage}٪</b><span>پیشرفت کل</span></div></div><div><span>مسیر یادگیری</span><h3>{nextLesson?.course_modules.learning_paths.title || "CLEAR"}</h3><p>{completedCount} از {lessons.length} درس کامل شده</p><div className="progress"><i style={{width:`${percentage}%`}}/></div></div></section>
    </div>
    {recommendedDimensions.length>0&&<section className="recommended-focus"><span className="eyebrow">بر اساس ارزیابی اولیه</span><h3>تمرکز مسیر تو</h3><p>دو مهارتی که بیشترین اثر را در شروع مسیرت دارند.</p><div>{recommendedDimensions.slice(0,2).filter(dimension=>dimensions[dimension]).map(dimension=><article key={dimension}><b>{dimensions[dimension][0]}</b><span>{dimensions[dimension][1]}</span></article>)}</div></section>}
    <section className={`monthly-challenge ${monthlyChallengeAvailable?"":"locked"}`}><div><span className="eyebrow">چالش ماهانهٔ پیشنهادی</span><h3>{monthlyChallenge.title}</h3><p>{monthlyChallenge.description}</p><ol>{monthlyChallenge.steps.map(step=><li key={step}>{step}</li>)}</ol><small>معیار انجام: {monthlyChallenge.success}</small></div>{monthlyChallengeAvailable?<div className="challenge-action">{monthlyChallengeCompleted?<span>چالش این ماه انجام شد.</span>:<Button onClick={completeChallenge} disabled={monthlyChallengeSaving}>{monthlyChallengeSaving?"در حال ثبت…":"چالش را انجام دادم"}</Button>}{monthlyChallengeMessage&&<small>{monthlyChallengeMessage}</small>}</div>:<div className="challenge-action"><span>چالش ماهانه در پلن نقره و بالاتر فعال است.</span><Button ghost onClick={()=>go("pricing")}>مشاهدهٔ پلن‌ها <Icon name="arrow"/></Button></div>}</section>
    <div className="section-head"><h3>ادامه مسیر</h3><button onClick={() => go("library")}>مشاهده همه</button></div>
    {nextLesson?<div className="lesson-row"><span>{String(lessons.indexOf(nextLesson)+1).padStart(2,"0")}</span><div><small>{nextLesson.course_modules.learning_paths.title}</small><h3>{nextLesson.title}</h3><p>{nextLesson.summary}</p></div><Button onClick={() => onOpenLesson(nextLesson)} ghost><Icon name="play"/> ادامه درس</Button></div>:<p className="library-state">همهٔ درس‌های موجود را تکمیل کرده‌ای.</p>}
    <section className="learning-history"><div className="section-head"><h3>تاریخچهٔ یادگیری</h3></div>{history.length?<div>{history.slice(0,5).map(activity=><div className="history-row" key={`${activity.type}-${activity.at}`}><div><strong>{activity.type}</strong><span>{activity.title}</span></div><time>{new Intl.DateTimeFormat("fa-IR",{month:"long",day:"numeric"}).format(new Date(activity.at))}</time></div>)}</div>:<p>هنوز فعالیتی ثبت نشده است.</p>}</section>
    <section className="leaderboard"><div className="leader-head"><div><span className="eyebrow">تمرین‌های انجام‌شده در هفته</span><h3>برترین‌های این هفته</h3></div><button className={`privacy-toggle ${showMe?"on":""}`} role="switch" aria-checked={showMe} onClick={()=>setShowMe(!showMe)}><i/><span>نمایش من در جدول</span></button></div>
      <div className="leader-list">{leaders.slice(0,showLeaders?10:3).map(([initial,name,count],index)=><div className="leader-row" key={name}><b className="rank">{index+1}</b><span className="leader-avatar">{initial}</span><strong>{name}</strong><span className="practice-count"><b>{count}</b> تمرین</span></div>)}</div>
      <button className="show-leaders" onClick={()=>setShowLeaders(!showLeaders)}>{showLeaders?"نمایش سه نفر اول":"مشاهده‌ی همه"}</button>
      <div className="my-rank"><span className="leader-avatar">آ</span><div><strong>رتبه‌ی تو: ۱۸</strong><small>{showMe?"نام مستعار تو در جدول نمایش داده می‌شود":"تو در جدول دیگران نمایش داده نمی‌شوی"}</small></div><span className="practice-count"><b>۴</b> تمرین</span></div>
      <p className="leader-note">رتبه‌بندی ابتدای هر هفته از صفر شروع می‌شود.</p>
    </section>
  </main><BottomNav page="dashboard" go={go}/></>;
}

function Library({ go, onOpenLesson, session, ...auth }: { go: (p: Page) => void; onOpenLesson: (lesson: PublishedLesson) => void; session: AuthSession } & HeaderProps) {
  const [lessons,setLessons]=useState<PublishedLesson[]>([]);
  const [completedIds,setCompletedIds]=useState<Set<string>>(new Set());
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    let active=true;
    Promise.all([getPublishedLessons(),getLessonProgress(session)]).then(([result,progress])=>{
      if(active) { setLessons(result); setCompletedIds(new Set(progress.filter(item=>item.completed_at).map(item=>item.lesson_id))); }
    }).catch(error=>{
      if(active) setMessage(error instanceof Error ? error.message : "دریافت درس‌ها انجام نشد.");
    }).finally(()=>{
      if(active) setLoading(false);
    });
    return ()=>{active=false};
  },[session]);
  return <><Header go={go} {...auth}/><main className="app-page library-page">
    <div className="library-heading"><span className="eyebrow">آکادمی کاریزما</span><h1>مسیرهای یادگیری</h1><p>پنج درس آغازین CLEAR را با تمرین‌های واقعی دنبال کن.</p></div>
    {loading?<p className="library-state">در حال دریافت درس‌ها…</p>:message?<p className="library-state library-error">{message}</p>:<div className="lesson-library">{lessons.map((lesson,index)=>{const locked=index>0&&!completedIds.has(lessons[index-1].id); return <article key={lesson.id} className={`lesson-library-card ${locked?"locked":""}`}><span className="lesson-number">{String(index+1).padStart(2,"0")}</span><div><small>{lesson.course_modules.learning_paths.title} · {lesson.duration_minutes} دقیقه</small><h2>{lesson.title}</h2><p>{lesson.summary}</p><button className="lesson-available" onClick={()=>onOpenLesson(lesson)} disabled={locked}>{locked?"با تکمیل درس قبلی باز می‌شود":completedIds.has(lesson.id)?"درس تکمیل شده":"مطالعهٔ درس متنی"} {!locked&&<Icon name="arrow"/>}</button></div></article>})}</div>}
  </main><BottomNav page="library" go={go}/></>;
}

function Profile({ go, session, profile, activePlan, onUpdateUsername, onDeleteAccount, onLogout, ...auth }: { go: (p: Page) => void; session: AuthSession; profile: UserProfile | null; activePlan: ActivePlan | null; onUpdateUsername: (username: string) => Promise<void>; onDeleteAccount: () => Promise<void>; onLogout?: () => void } & HeaderProps) {
  const roleLabels={learner:"یادگیرنده",mentor:"منتور",admin:"مدیر"};
  const contact=session.user.email || session.user.phone || "ثبت نشده";
  const displayName=profile?.username || profile?.display_name || session.user.user_metadata?.username || "ثبت نشده";
  const [editing,setEditing]=useState(false);
  const [username,setUsername]=useState(displayName==="ثبت نشده"?"":displayName);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [purchases,setPurchases]=useState<PurchaseRecord[]>([]);
  useEffect(()=>{ getPurchaseHistory(session).then(setPurchases).catch(()=>setPurchases([])); },[session]);
  const saveUsername=async()=>{
    if(!username.trim()) return;
    setSaving(true); setMessage("");
    try {
      await onUpdateUsername(username);
      setEditing(false);
      setMessage("نام کاربری ذخیره شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیرهٔ نام کاربری انجام نشد.");
    } finally { setSaving(false); }
  };
  return <><Header go={go} {...auth}/><main className="app-page profile-page">
    <button className="back" onClick={()=>go("dashboard")}><Icon name="arrow"/> بازگشت به داشبورد</button>
    <div className="profile-heading"><span className="eyebrow">حساب کاربری</span><h1>پروفایل من</h1><p>اطلاعات حساب و وضعیت عضویت تو</p></div>
    <section className="profile-card"><div className="profile-avatar">{displayName.slice(0,1)}</div><div className="profile-details"><div className="username-field"><span>نام کاربری</span>{editing?<div className="username-editor"><input value={username} onChange={event=>setUsername(event.target.value)} dir="auto" autoComplete="username" aria-label="نام کاربری"/><Button onClick={saveUsername} disabled={saving||!username.trim()}>{saving?"در حال ذخیره…":"ذخیره"}</Button><button className="cancel-edit" onClick={()=>{setEditing(false);setUsername(displayName);setMessage("")}}>انصراف</button></div>:<div className="username-value"><strong>{displayName}</strong><button className="edit-username" aria-label="ویرایش نام کاربری" onClick={()=>{setUsername(displayName==="ثبت نشده"?"":displayName);setEditing(true);setMessage("")}}><Icon name="edit"/></button></div>}{message&&<small className="profile-message">{message}</small>}</div><div><span>ایمیل یا شماره موبایل</span><strong dir="ltr">{contact}</strong></div><div><span>نقش حساب</span><strong>{roleLabels[profile?.role || "learner"]}</strong></div><div><span>پلن فعال</span><strong>{activePlan?.name || "بدون پلن فعال"}</strong></div><div>{activePlan&&<><span>روزهای باقی‌مانده</span><strong>{Math.max(0,Math.ceil((new Date(activePlan.ends_at).getTime()-Date.now())/86400000))} روز</strong></>}</div><div><span>وضعیت نشست</span><strong className="profile-status">فعال</strong></div></div></section><section className="purchase-history"><div className="section-head"><h3>سوابق خرید</h3></div>{purchases.length===0?<p>هنوز سفارشی ثبت نشده است.</p>:purchases.map(purchase=><div className="purchase-row" key={purchase.id}><div><strong>پلن {purchase.plans?.name || "نامشخص"}</strong><span>خرید موفق</span></div><time>{new Date(purchase.created_at).toLocaleDateString("fa-IR")}</time></div>)}</section><div className="account-actions-mobile"><button className="logout-account" onClick={onLogout}>خروج</button><button className="delete-account" onClick={async()=>{if(!window.confirm("حساب و تمام داده‌های آن برای همیشه حذف می‌شوند. ادامه می‌دهی؟")) return; try { await onDeleteAccount(); } catch(error) { setMessage(error instanceof Error ? error.message : "حذف حساب انجام نشد."); }}}>حذف حساب</button></div>
  </main><BottomNav page="profile" go={go}/></>;
}

function Lesson({ go, lesson, session, onOpenCoach, ...auth }: { go: (p: Page) => void; lesson: PublishedLesson | null; session: AuthSession; onOpenCoach: (scenario: string) => void } & HeaderProps) {
  const [completed,setCompleted]=useState(false);
  const [exerciseCompleted,setExerciseCompleted]=useState(false);
  const [saving,setSaving]=useState(false);
  const [exerciseSaving,setExerciseSaving]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    if(!lesson) return;
    getLessonProgress(session).then(progress=>{
      const current=progress.find(item=>item.lesson_id===lesson.id);
      setCompleted(Boolean(current?.completed_at));
      setExerciseCompleted(Boolean(current?.exercise_completed_at));
    }).catch(()=>{});
  },[lesson,session]);
  if(!lesson) return <><Header go={go} {...auth}/><main className="app-page lesson-page"><button className="back" onClick={() => go("library")}><Icon name="arrow"/> بازگشت به کتابخانه</button><p className="library-state">برای مطالعه، یک درس را از کتابخانه انتخاب کن.</p></main><BottomNav page="lesson" go={go}/></>;
  const { body }=lesson;
  const openCoach=()=>{
    if(body.ai) onOpenCoach(body.ai.scenario);
  };
  const markCompleted=async()=>{
    setSaving(true); setMessage("");
    try { await completeLesson(session,lesson.id); setCompleted(true); } catch(error) { setMessage(error instanceof Error ? error.message : "ثبت تکمیل مطالعه انجام نشد."); } finally { setSaving(false); }
  };
  const markExerciseCompleted=async()=>{
    setExerciseSaving(true); setMessage("");
    try { await completeExercise(session,lesson.id); setExerciseCompleted(true); } catch(error) { setMessage(error instanceof Error ? error.message : "ثبت انجام تمرین انجام نشد."); } finally { setExerciseSaving(false); }
  };
  return <><Header go={go} {...auth}/><main className="app-page lesson-page text-lesson-page">
    <button className="back" onClick={() => go("library")}><Icon name="arrow"/> بازگشت به کتابخانه</button>
    <article className="text-lesson"><span className="eyebrow">{lesson.course_modules.learning_paths.title} · {lesson.duration_minutes} دقیقه مطالعه</span><h1>{lesson.title}</h1><p className="lesson-lead">{lesson.summary}</p><div className="quote">«{body.quote}»</div><section><h2>هدف درس</h2><p>{body.goal}</p></section><section><h2>ایدهٔ اصلی</h2>{body.idea.map(item=><p key={item}>{item}</p>)}</section><section><h2>مثال</h2><p>{body.example}</p></section><section><h2>{body.exercise.title}</h2><ol>{body.exercise.steps.map(step=><li key={step}>{step}</li>)}</ol><div className="exercise-completion">{exerciseCompleted?<span>تمرین انجام‌شده ثبت شد.</span>:<Button ghost onClick={markExerciseCompleted} disabled={exerciseSaving}>{exerciseSaving?"در حال ثبت…":"تمرین را انجام دادم"}</Button>}</div>{body.ai&&<div className="exercise-completion ai-practice"><Button ghost onClick={openCoach}>تمرین با مربی AI <Icon name="arrow"/></Button><small>{body.ai.goal}</small></div>}</section><section><h2>نکتهٔ مهم</h2><p>{body.mistake}</p></section><section><h2>خلاصه</h2><ul>{body.summary.map(item=><li key={item}>{item}</li>)}</ul></section><div className="lesson-completion">{completed?<span>مطالعهٔ این درس ثبت شد.</span>:<Button onClick={markCompleted} disabled={saving}>{saving?"در حال ثبت…":"مطالعه را تمام کردم"}</Button>}{message&&<small>{message}</small>}<Button ghost onClick={()=>go("library")}>بازگشت به کتابخانه <Icon name="arrow"/></Button></div></article>
  </main><BottomNav page="lesson" go={go}/></>;
}

function Coach({ go, session, initialScenario, activePlan, ...auth }: { go: (p: Page) => void; session: AuthSession; initialScenario: string | null; activePlan: ActivePlan | null } & HeaderProps) {
  const scenarioData = {
    "آشنایی در جمع": {
      context:"در یک دورهمی، فرد جدیدی کنار تو ایستاده است.",
      prompt:"فرض کن من آن فرد هستم. چطور گفتگو را شروع می‌کنی؟",
    },
    "قرار اول": {
      context:"برای اولین بار با کسی در یک کافه قرار داری و او تازه رسیده است.",
      prompt:"سلام، ببخشید کمی دیر رسیدم. چطوری؟ از کجا شروع کنیم؟",
    },
    "گفتگوی کاری": {
      context:"در جلسه‌ی تیمی، همکارت پیشنهادی می‌دهد که با آن موافق نیستی.",
      prompt:"به نظر من بهتر است کل کار را به هفته‌ی بعد موکول کنیم. نظر تو چیست؟",
    },
    "شروع مکالمه": {
      context:"در آسانسور با همکاری که کم می‌شناسی تنها شده‌ای.",
      prompt:"سلام! امروز خیلی شلوغ بود، نه؟",
    },
    "مکث در جلسه": {
      context:"در جلسهٔ کاری، همکارت پیشنهادی داده و منتظر پاسخ روشن توست.",
      prompt:"به نظر من بهتر است این کار را همین امروز تمام کنیم. نظر تو چیست؟",
    },
    "شنیدن در گفت‌وگو": {
      context:"فردی تازه دربارهٔ تجربه‌ای مهم برایش صحبت کرده و منتظر است ببینید واقعاً شنیده‌اید.",
      prompt:"این هفته بالاخره پروژه‌ام تمام شد و واقعاً خسته‌ام.",
    },
    "نه گفتن محترمانه": {
      context:"همکارت از تو می‌خواهد آخر هفته مسئولیتی را بپذیری، اما زمان کافی نداری.",
      prompt:"می‌توانی این کار را تا فردا تحویل بدهی؟",
    },
    "تنظیم گفت‌وگو": {
      context:"در گفت‌وگو متوجه شده‌ای طرف مقابل چند بار حواسش به اطراف پرت شده است.",
      prompt:"ببخشید، کمی ذهنم درگیر است. داشتی چه می‌گفتی؟",
    },
    "تعریف دقیق": {
      context:"در یک دیدار، طرف مقابل دربارهٔ ارائه‌ای که اخیراً داشته صحبت می‌کند.",
      prompt:"ارائه‌ام خوب پیش رفت، ولی برای بخش آخر خیلی وقت کم آوردم.",
    },
    "مشاورهٔ شخصی": {
      context:"مشاوره دربارهٔ استفاده از سایت، مسیر یادگیری، تمرین و رشد مهارت ارتباطی.",
      prompt:"سلام، من مشاور شخصی تو هستم. دربارهٔ مسیر درس‌ها، تمرین، چالش ماهانه یا رشد مهارت ارتباطی هر سؤالی داری بپرس.",
    },
  };
  const alwaysAvailableScenarios: Array<keyof typeof scenarioData>=["مشاورهٔ شخصی","آشنایی در جمع","قرار اول","گفتگوی کاری","شروع مکالمه"];
  const lessonScenario=initialScenario && initialScenario in scenarioData ? initialScenario as keyof typeof scenarioData : null;
  const [scenario,setScenario]=useState<keyof typeof scenarioData>(()=>lessonScenario || "آشنایی در جمع");
  const [draft,setDraft]=useState("");
  const [messages,setMessages]=useState<CoachMessage[]>([]);
  const [quota,setQuota]=useState<CoachQuota|null>(null);
  const [conversationId,setConversationId]=useState<string|null>(null);
  const [loadingHistory,setLoadingHistory]=useState(true);
  const [sending,setSending]=useState(false);
  const [resetting,setResetting]=useState(false);
  const [message,setMessage]=useState("");
  const [learnerContext,setLearnerContext]=useState({ plan: activePlan?.name || "برنز", recommendedDimensions: [] as string[], completedLessons: 0, totalLessons: 0 });
  useEffect(()=>{
    let active=true;
    Promise.all([getLatestAssessment(session), getLessonProgress(session), getPublishedLessons()]).then(([recommendedDimensions, progress, lessons])=>{
      if(!active) return;
      setLearnerContext({ plan: activePlan?.name || "برنز", recommendedDimensions, completedLessons: progress.filter(item=>item.completed_at).length, totalLessons: lessons.length });
    }).catch(()=>{});
    return ()=>{active=false};
  },[session,activePlan]);
  useEffect(()=>{
    if(lessonScenario && lessonScenario!==scenario) setScenario(lessonScenario);
  },[lessonScenario,scenario]);
  useEffect(()=>{
    let active=true;
    setDraft("");
    setMessages([]);
    setConversationId(null);
    setMessage("");
    setLoadingHistory(true);
    getCoachQuota(session).then(setQuota).catch(()=>setQuota(null));
    getCoachConversation(session,scenario).then(async conversation=>{
      if(!active) return;
      if(!conversation) return;
      const history=await getCoachMessages(session,conversation.id);
      if(!active) return;
      setConversationId(conversation.id);
      setMessages(history);
    }).catch(()=>{
      if(active) setMessage("بازیابی گفت‌وگو انجام نشد. دوباره تلاش کن.");
    }).finally(()=>{
      if(active) setLoadingHistory(false);
    });
    return ()=>{active=false;};
  },[scenario,session]);
  const changeScenario=(next:keyof typeof scenarioData)=>{
    if(sending||resetting||loadingHistory) return;
    setScenario(next);
  };
  const resetChat=async()=>{
    if(!conversationId||sending||resetting||!window.confirm("گفت‌وگوی این سناریو پاک می‌شود. ادامه می‌دهی؟")) return;
    setResetting(true);
    setMessage("");
    try {
      await deleteCoachConversation(session,conversationId);
      setMessages([]);
      setConversationId(null);
      setDraft("");
    } catch(error) {
      setMessage(error instanceof Error ? error.message : "ریست گفت‌وگو انجام نشد.");
    } finally { setResetting(false); }
  };
  const send=async()=>{
    const content=draft.trim();
    if(!content||sending||resetting||loadingHistory||Boolean(quota&&!quota.allowed)) return;
    setSending(true);
    setMessage("");
    try {
      const id=conversationId || (await createCoachConversation(session,scenario)).id;
      if(!conversationId) setConversationId(id);
      const userMessage={role:"user" as const,content};
      await saveCoachMessage(session,id,userMessage);
      const nextMessages=[...messages,userMessage];
      setMessages(nextMessages);
      setDraft("");
      const reply=await requestCoachReply(session,{title:scenario,context:scenarioData[scenario].context},nextMessages,learnerContext,scenario==="مشاورهٔ شخصی"?"advisor":"practice");
      if(reply.quota) setQuota(reply.quota);
      const coachMessage={role:"model" as const,content:reply.content,feedback:reply.feedback};
      await saveCoachMessage(session,id,coachMessage);
      setMessages(current=>[...current,coachMessage]);
    } catch(error) {
      setMessage(error instanceof Error?error.message:"پاسخ مربی دریافت نشد. دوباره تلاش کن.");
    } finally { setSending(false); }
  };
  const current=scenarioData[scenario];
  const isAdvisor=scenario==="مشاورهٔ شخصی";
  const focusLabels: Record<string,string>={confidence:"اعتمادبه‌نفس",listening:"گوش دادن",expression:"بیان",awareness:"آگاهی اجتماعی",rapport:"ایجاد ارتباط"};
  const practiceLevel=learnerContext.completedLessons===0?"شروع مسیر":learnerContext.completedLessons<Math.max(2,learnerContext.totalLessons/2)?"در حال پیشرفت":"پیشرفته‌تر";
  const planGuidance: Record<string,string>={برنز:"تمرین‌های کوتاه و پایه برای ساخت عادت",نقره:"چالش‌های بیشتر با بازخورد دقیق‌تر",طلا:"برنامهٔ چندمرحله‌ای و سناریوهای دشوارتر",الماس:"پیگیری منظم، تنوع بیشتر و معیار سنجش مشخص"};
  return <><Header go={go} {...auth}/><main className="coach-page">
    <aside className="scenarios"><span className="eyebrow">هوش مصنوعی TAROKH</span><h2>{isAdvisor?"مشاورهٔ شخصی":"تمرین مکالمه"}</h2><p>{isAdvisor?"دربارهٔ سایت، مسیر یادگیری یا تمرین مناسب خودت سؤال بپرس.":"یک موقعیت را انتخاب کن و بدون قضاوت تمرین کن."}</p><section className="recommended-focus"><small>برنامهٔ فعلی تو</small><h3>سطح تمرینی: {practiceLevel}</h3><p>{learnerContext.recommendedDimensions.length?`تمرکز پیشنهادی: ${learnerContext.recommendedDimensions.map(dimension=>focusLabels[dimension]||dimension).join(" و ")}`:"با تمرین‌های پایه شروع می‌کنیم."}</p><p>{learnerContext.completedLessons} از {learnerContext.totalLessons||"—"} درس تکمیل شده</p><p>{planGuidance[learnerContext.plan]||planGuidance["برنز"]}</p></section>{alwaysAvailableScenarios.map(s=><button className={scenario===s?"active":""} disabled={sending||resetting||loadingHistory} onClick={()=>changeScenario(s)} key={s}><span>{s}</span><Icon name="arrow"/></button>)}</aside>
    <section className="chat"><div className="chat-head"><div className="ai-dot">AI</div><div><b>{scenario}</b><span>{isAdvisor?"مشاور آمادهٔ پاسخ‌گویی است":"مربی آماده تمرین است"}</span><small className="quota-label">{quota?.daily_limit===null?"سهمیهٔ روزانه: نامحدود":quota?`سهمیهٔ باقی‌ماندهٔ امروز: ${quota.remaining}`:"در حال دریافت سهمیه…"}</small></div><i/><button className="chat-reset" onClick={resetChat} disabled={!conversationId||sending||resetting||loadingHistory}><Icon name="reset"/>{resetting?"در حال ریست…":"ریست گفتگو"}</button></div>
      <div className="messages"><div className="context">{isAdvisor?"موضوع مشاوره":"سناریو"}: {current.context}</div><div className="message ai"><span>{isAdvisor?"مشاور":"مربی"}</span><p>{current.prompt}</p></div>{loadingHistory?<div className="message ai"><span>{isAdvisor?"مشاور":"مربی"}</span><p>در حال بازیابی گفت‌وگو…</p></div>:messages.map((item,index)=><div className={`message ${item.role==="user"?"me":"ai"}`} key={`${item.role}-${index}`}><span>{item.role==="model"?(isAdvisor?"مشاور":"مربی"):""}</span><p>{item.content}</p>{item.role==="model"&&item.feedback&&<div className="feedback"><strong>بازخورد مربی</strong><p><b>نکتهٔ مثبت:</b> {item.feedback.positive}</p><p><b>پیشنهاد اصلاح:</b> {item.feedback.improvement}</p><p><b>پاسخ جایگزین:</b> {item.feedback.alternative}</p></div>}</div>)}{sending&&<div className="message ai"><span>مربی</span><p>در حال فکرکردن…</p></div>}{message&&<p className="coach-error">{message}</p>}</div>
      <div className="composer"><input value={draft} disabled={sending||resetting||loadingHistory||Boolean(quota&&!quota.allowed)} onChange={e=>setDraft(e.target.value)} placeholder={quota&&!quota.allowed?"سهمیهٔ امروز تمام شده است":"پاسخت را بنویس..."} onKeyDown={e=>e.key==="Enter"&&send()}/><button aria-label="ارسال پاسخ" disabled={sending||resetting||loadingHistory||Boolean(quota&&!quota.allowed)} onClick={send}><Icon name="send"/></button></div>
    </section>
  </main><BottomNav page="coach" go={go}/></>;
}

const plans = [
  {name:"برنز",slug:"bronze",price:"۲٫۵",desc:"شروع اصولی و مستقل",items:["ورود امن با OTP و حساب پایدار","ارزیابی اولیهٔ CLEAR و پیشنهاد مسیر شروع","دسترسی کامل به دوره","کتابخانهٔ درس‌های مرحله‌ای","تمرین‌های عملی هر درس","داشبورد پیشرفت، streak و تاریخچه"]},
  {name:"نقره",slug:"silver",price:"۳٫۵",desc:"تمرین با همراهی بیشتر",items:["تمام امکانات برنز","مربی AI سناریومحور، روزانه ۳۰ پیام","تاریخچهٔ گفتگو و بازخورد ساختاریافته","برنامهٔ تمرینی AI متناسب با پیشرفت","چالش تمرینی ماهانه","تحلیل دقیق‌تر پاسخ‌ها"]},
  {name:"طلا",slug:"gold",price:"۶٫۵",desc:"انتخاب جدی برای تغییر",popular:true,items:["تمام امکانات نقره","مربی AI سناریومحور، روزانه ۱۵۰ پیام","تاریخچه و ریست گفتگوهای مربی","برنامهٔ چندمرحله‌ای متناسب با پیشرفت","چالش‌های سناریومحور دشوارتر","بازخورد عمیق‌تر و پاسخ جایگزین"]},
  {name:"الماس",slug:"diamond",price:"۱۰",desc:"مسیر کاملاً اختصاصی",items:["تمام امکانات طلا","مربی AI نامحدود با بازخورد ساختاریافته","فعال‌سازی و تمدید یک‌ماهه","برنامهٔ کاملاً شخصی‌سازی‌شدهٔ ماهانه","پیگیری هفتگی تمرین‌ها","تنوع سناریو و معیار سنجش مشخص","ارزیابی پایان ماه"]},
];
const planComparison = [
  ["ورود امن با OTP و حساب پایدار", "دارد", "دارد", "دارد"],
  ["ارزیابی اولیهٔ CLEAR و پیشنهاد مسیر", "دارد", "دارد", "دارد"],
  ["کتابخانهٔ درس‌های مرحله‌ای", "دارد", "دارد", "دارد"],
  ["تمرین و ثبت تکمیل درس", "دارد", "دارد", "دارد"],
  ["داشبورد پیشرفت، streak و تاریخچه", "دارد", "دارد", "دارد"],
  ["مربی AI سناریومحور", "۳۰ پیام روزانه", "۱۵۰ پیام روزانه", "نامحدود"],
  ["بازخورد ساختاریافتهٔ مربی", "دارد", "دارد", "دارد"],
  ["تاریخچه و ریست گفت‌وگو", "دارد", "دارد", "دارد"],
  ["فعال‌سازی و تمدید یک‌ماهه", "دارد", "دارد", "دارد"],
  ["پلن فعال و سوابق خرید در حساب", "دارد", "دارد", "دارد"],
  ["گروه خصوصی اعضا", "دارد", "دارد", "دارد"],
  ["جلسهٔ گروهی ماهانه", "پرسش‌وپاسخ", "تخصصی", "تخصصی و اولویت‌دار"],
  ["چالش تمرینی ماهانه", "دارد", "دارد", "دارد"],
  ["بررسی تمرین توسط منتور", "—", "محدود", "هفتگی"],
  ["برنامهٔ شخصی‌سازی‌شده", "—", "پیشنهادی", "کامل و ماهانه"],
  ["چالش‌های سناریومحور", "پایه", "پیشرفته", "متنوع و قابل سنجش"],
  ["پیگیری تمرین‌ها", "—", "—", "هفتگی با مربی AI"],
  ["ارزیابی پایان ماه", "—", "—", "دارد"],
];
function Pricing({ go, choose, activePlan, ...auth }: { go: (p: Page) => void; choose: (p: string) => void; activePlan: ActivePlan | null } & HeaderProps) {
  const remainingDays=activePlan?Math.max(0,Math.ceil((new Date(activePlan.ends_at).getTime()-Date.now())/86400000)):0;
  return <><Header go={go} {...auth}/><main className="pricing-page"><div className="section-title"><span>سرمایه‌گذاری روی خودت</span><h2>پلن مناسب مسیرت را انتخاب کن</h2><p>همهٔ پلن‌ها یک ماه اعتبار دارند و پس از پایان ماه نیاز به تمدید دارند.</p></div>{activePlan&&<section className="renewal-card"><div><span className="eyebrow">پلن فعلی تو</span><h3>پلن {activePlan.name}</h3><p>{remainingDays} روز از اعتبار پلنت باقی مانده است.</p></div><Button onClick={()=>{choose(activePlan.name);go("checkout")}}>تمدید پلن</Button></section>}<div className="plans">{plans.map(p=><div className={`plan ${p.popular?"gold":""}`} key={p.name}>{p.popular&&<span className="popular">محبوب‌ترین</span>}<span>{p.name}</span><h3>{p.price}<small> میلیون تومان</small></h3><p>{p.desc}</p><Button block ghost={!p.popular} onClick={()=>{choose(p.name);go("checkout")}}>انتخاب {p.name}</Button><ul>{p.items.map(x=><li key={x}><Icon name="check"/>{x}</li>)}</ul></div>)}</div><section className="plan-comparison"><div className="section-title"><span>مقایسهٔ امکانات</span><h2>کدام پلن برای تو مناسب‌تر است؟</h2><p>تفاوت خدمات نقره، طلا و الماس را کنار هم ببین.</p></div><div className="comparison-scroll"><table><thead><tr><th>امکانات</th><th>نقره</th><th>طلا</th><th>الماس</th></tr></thead><tbody>{planComparison.map(row=><tr key={row[0]}>{row.map((value,index)=>index===0?<th scope="row" key={value}>{value}</th>:<td key={`${row[0]}-${value}`}>{value}</td>)}</tr>)}</tbody></table></div></section></main></>;
}

function Checkout({ go, plan, session, onActivated, ...auth }: { go:(p:Page)=>void; plan:string; session: AuthSession; onActivated: () => Promise<void> } & HeaderProps) {
  const data=plans.find(p=>p.name===plan) || plans[2];
  const [fullName,setFullName]=useState("");
  const [activated,setActivated]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const activate=async()=>{
    if(!fullName.trim()) { setMessage("نام و نام خانوادگی را وارد کن."); return; }
    setBusy(true); setMessage("");
    try {
      await activateDemoPlan(session,data.slug,fullName);
      await onActivated();
      setActivated(true);
    } catch(error) {
      setMessage(error instanceof Error ? error.message : "خرید انجام نشد. دوباره تلاش کن.");
    } finally { setBusy(false); }
  };
  return <><Header go={go} simple {...auth}/><main className="center-page">{activated?<div className="success"><div><Icon name="check"/></div><span className="eyebrow">خرید موفق</span><h2>پلن {data.name} با موفقیت فعال شد.</h2><p>حالا می‌توانی مسیرت را ادامه بدهی.</p><Button onClick={()=>go("dashboard")}>ادامه مسیر <Icon name="arrow"/></Button></div>:<div className="checkout"><div><button className="back" onClick={()=>go("pricing")}><Icon name="arrow"/> بازگشت</button><span className="eyebrow">تکمیل خرید</span><h2>اطلاعات خریدار</h2><label>نام و نام خانوادگی<input value={fullName} onChange={event=>setFullName(event.target.value)} placeholder="مثلاً علی رضایی" autoComplete="name"/></label><div className="secure"><Icon name="check"/> خرید امن و سریع</div></div><aside><span>خلاصه سفارش</span><h3>پلن {data.name}</h3><p>{data.desc}</p><p className="plan-period">اعتبار: یک ماه</p><ul>{data.items.map(x=><li key={x}><Icon name="check"/>{x}</li>)}</ul><div className="total"><span>مبلغ نهایی</span><b>{data.price} میلیون تومان</b></div><Button block onClick={activate} disabled={busy}>{busy?"در حال ثبت…":"خرید پلن"}</Button>{message&&<p className="auth-message">{message}</p>}</aside></div>}</main></>;
}

export default function App() {
  const [session,setSession]=useState<AuthSession|null>(()=>getStoredSession());
  const [profile,setProfile]=useState<UserProfile|null>(null);
  const [page,setPage]=useState<Page>(()=>pageFromHash() || (getStoredSession()?"dashboard":"home"));
  const [activeLesson,setActiveLesson]=useState<PublishedLesson|null>(null);
  const [activeCoachScenario,setActiveCoachScenario]=useState<string|null>(null);
  const [activePlan,setActivePlan]=useState<ActivePlan|null>(null);
  const [planResolved,setPlanResolved]=useState(false);
  const [plan,setPlan]=useState("طلا");
  const protectedPages:Page[]=["dashboard","library","lesson","coach","checkout","profile"];
  const planRequiredPages:Page[]=["dashboard","library","lesson","coach"];
  useEffect(()=>{
    let active=true;
    restoreSession().then(async restored=>{
      if(!active) return;
      setSession(restored);
      if(restored) {
        setProfile(await getUserProfile(restored).catch(()=>null));
        const restoredPlan=await getActivePlan(restored).catch(()=>null);
        setActivePlan(restoredPlan);
        setPlanResolved(true);
      } else {
        setPlanResolved(true);
      }
      if(!restored && page!=="home" && page!=="about" && page!=="pricing") { setPage("home"); window.location.hash="home"; }
    });
    return ()=>{active=false};
  },[]);
  useEffect(()=>{
    const syncSession=(event:StorageEvent)=>{
      if(event.key!=="tarokh-auth-session") return;
      const nextSession=getStoredSession();
      setSession(nextSession);
      if(nextSession) {
        setPlanResolved(false);
        getUserProfile(nextSession).then(setProfile).catch(()=>setProfile(null));
        getActivePlan(nextSession).then(planName=>{ setActivePlan(planName); setPlanResolved(true); }).catch(()=>{ setActivePlan(null); setPlanResolved(true); });
      } else { setProfile(null); setActivePlan(null); setPlanResolved(true); setPage("home"); window.location.hash="home"; }
    };
    window.addEventListener("storage",syncSession);
    return ()=>window.removeEventListener("storage",syncSession);
  },[]);
  useEffect(()=>{
    const syncHash=()=>{
      const nextPage=pageFromHash() || "home";
      if(protectedPages.includes(nextPage) && !getStoredSession()) { window.location.hash="auth"; return; }
      setPage(nextPage);
      window.scrollTo({top:0,behavior:"smooth"});
    };
    window.addEventListener("hashchange",syncHash);
    return ()=>window.removeEventListener("hashchange",syncHash);
  },[]);
  const go=(nextPage:Page)=>{
    if(protectedPages.includes(nextPage) && !session && !getStoredSession()){
      window.location.hash="auth";
      setPage("auth");
      return;
    }
    if(planRequiredPages.includes(nextPage) && planResolved && !activePlan){
      window.location.hash="pricing";
      setPage("pricing");
      return;
    }
    window.location.hash=nextPage;
    setPage(nextPage);
    window.scrollTo({top:0,behavior:"smooth"});
  };
  useEffect(()=>{
    if(session && planResolved && planRequiredPages.includes(page) && !activePlan){
      window.location.hash="pricing";
      setPage("pricing");
    }
  },[session,planResolved,activePlan,page]);
  const openLesson=(lesson:PublishedLesson)=>{
    setActiveLesson(lesson);
    go("lesson");
  };
  const openCoach=(scenario:string)=>{
    setActiveCoachScenario(scenario);
    go("coach");
  };
  const authenticated=(nextSession:AuthSession)=>{
    setSession(nextSession);
    setPlanResolved(false);
    getUserProfile(nextSession).then(setProfile).catch(()=>setProfile(null));
    getActivePlan(nextSession).then(planName=>{ setActivePlan(planName); setPlanResolved(true); }).catch(()=>{ setActivePlan(null); setPlanResolved(true); });
  };
  const activatePlan=async()=>{
    const refreshedPlan=await getActivePlan(session!);
    setActivePlan(refreshedPlan);
    setPlanResolved(true);
  };
  const updateUsername=async(username:string)=>{
    if(!session) return;
    const updatedProfiles=await updateUserProfile(session, username);
    const nextSession={...session,user:{...session.user,user_metadata:{...session.user.user_metadata,username:username.trim(),display_name:username.trim()}}};
    saveSession(nextSession);
    setSession(nextSession);
    setProfile(current=>updatedProfiles[0] || current);
  };
  const logout=async()=>{
    await signOut(session);
    setSession(null);
    setProfile(null);
    setActivePlan(null);
    setPlanResolved(true);
    go("home");
  };
  const removeAccount=async()=>{
    if(!session) return;
    await deleteAccount(session);
    setSession(null);
    setProfile(null);
    setActivePlan(null);
    setPlanResolved(true);
    go("home");
  };
  const displayName=profile?.username || profile?.display_name || session?.user.user_metadata?.username || session?.user.user_metadata?.display_name;
  const visiblePage=!session && protectedPages.includes(page)?"auth":page;
  const headerAuth={authenticated:Boolean(session),displayName,onLogout:logout};
  return <div dir="rtl">{visiblePage==="home"?<Home go={go} {...headerAuth}/>:visiblePage==="about"?<About go={go} {...headerAuth}/>:visiblePage==="auth"?<Auth go={go} onAuthenticated={authenticated}/>:visiblePage==="dashboard"?<Dashboard go={go} displayName={displayName} onLogout={logout} session={session!} onOpenLesson={openLesson} activePlan={activePlan}/>:visiblePage==="library"?<Library go={go} onOpenLesson={openLesson} session={session!} {...headerAuth}/>:visiblePage==="profile"?<Profile go={go} session={session!} profile={profile} activePlan={activePlan} onUpdateUsername={updateUsername} onDeleteAccount={removeAccount} {...headerAuth}/>:visiblePage==="lesson"?<Lesson go={go} lesson={activeLesson} session={session!} onOpenCoach={openCoach} {...headerAuth}/>:visiblePage==="coach"?<Coach go={go} session={session!} initialScenario={activeCoachScenario} activePlan={activePlan} {...headerAuth}/>:visiblePage==="pricing"?<Pricing go={go} choose={setPlan} activePlan={activePlan} {...headerAuth}/>:<Checkout go={go} plan={plan} session={session!} onActivated={activatePlan} {...headerAuth}/>}<SupportWidget showButton={visiblePage==="home"||visiblePage==="dashboard"}/></div>;
}
