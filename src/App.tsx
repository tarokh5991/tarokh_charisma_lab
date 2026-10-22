import { useEffect, useState } from "react";
import { completeExercise, completeLesson, deleteAccount, getActivePlan, getLessonProgress, getPublishedLessons, getStoredSession, getUserProfile, requestOtp, restoreSession, saveAssessment, saveSession, signOut, updateUserProfile, verifyOtp, type AuthSession, type PublishedLesson, type UserProfile } from "./lib/supabase-auth";

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
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
};

const Button = ({ children, onClick, ghost = false, block = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; ghost?: boolean; block?: boolean; disabled?: boolean }) => (
  <button className={`btn ${ghost ? "btn-ghost" : ""} ${block ? "btn-block" : ""}`} onClick={onClick} disabled={disabled}>{children}</button>
);

type HeaderProps = { authenticated?: boolean; displayName?: string; onLogout?: () => void };

const Header = ({ go, simple = false, authenticated = false, displayName, onLogout }: { go: (p: Page) => void; simple?: boolean } & HeaderProps) => (
  <header className="header">
    <button className="brand" onClick={() => go("home")}><span>TAROKH</span><small>CHARISMA LAB</small></button>
    {!simple && <nav><button onClick={() => go("home")}>خانه</button><button onClick={() => go("dashboard")}>آکادمی</button><button onClick={() => go("pricing")}>پلن‌ها</button><button onClick={() => go("about")}>درباره ما</button><button onClick={() => window.dispatchEvent(new Event("open-support"))}>پشتیبانی</button></nav>}
    {authenticated ? <div className="account-actions"><button className="header-user" onClick={() => go("profile")}>{displayName || "حساب من"}</button><Button onClick={onLogout} ghost>خروج</Button></div> : <Button onClick={() => go("auth")} ghost>ورود / ثبت‌نام</Button>}
  </header>
);

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
  const [active,setActive]=useState<number|null>(null);
  useEffect(()=>{
    const handle=()=>setOpen(true);
    window.addEventListener("open-support",handle);
    return ()=>window.removeEventListener("open-support",handle);
  },[]);
  const faqs=[
    ["کدام پلن برای من مناسب است؟","برای شروع مستقل، برنز و برای دریافت بازخورد و منتورینگ، طلا پیشنهاد می‌شود."],
    ["پرداخت به چه صورت است؟","پرداخت یک‌جا و از طریق درگاه امن بانکی انجام می‌شود."],
    ["مربی هوش مصنوعی چگونه کار می‌کند؟","یک موقعیت را انتخاب می‌کنی، مکالمه را تمرین می‌کنی و بازخورد فوری می‌گیری."],
    ["تا چه زمانی به دوره دسترسی دارم؟","دسترسی به محتوای آموزشی دوره دائمی است."],
  ];
  return <div className={`support-widget ${showButton?"visible":""}`}>
    {open&&<section className="support-panel"><div className="support-head"><div><span>مرکز راهنما</span><b>چطور کمکت کنیم؟</b></div><button aria-label="بستن" onClick={()=>setOpen(false)}><Icon name="close"/></button></div>
      <div className="support-body"><h3>سؤال‌های متداول</h3><div className="faq-list">{faqs.map(([q,a],i)=><div className={active===i?"active":""} key={q}><button onClick={()=>setActive(active===i?null:i)}><span>{q}</span><b>{active===i?"−":"+"}</b></button>{active===i&&<p>{a}</p>}</div>)}</div>
      <h3>ارتباط با پشتیبان</h3><div className="support-links"><a href="https://t.me/tarokhsupport" target="_blank" rel="noreferrer">تلگرام</a><a href="mailto:support@tarokh.ir">ایمیل</a></div></div>
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

function Dashboard({ go, onLogout, displayName, session, onOpenLesson }: { go: (p: Page) => void; onLogout: () => void; displayName?: string; session: AuthSession; onOpenLesson: (lesson: PublishedLesson) => void }) {
  const [showLeaders,setShowLeaders]=useState(false);
  const [showMe,setShowMe]=useState(true);
  const [lessons,setLessons]=useState<PublishedLesson[]>([]);
  const [completedIds,setCompletedIds]=useState<Set<string>>(new Set());
  const [streak,setStreak]=useState(0);
  useEffect(()=>{
    Promise.all([getPublishedLessons(),getLessonProgress(session)]).then(([published,progress])=>{
      setLessons(published);
      setCompletedIds(new Set(progress.filter(item=>item.completed_at).map(item=>item.lesson_id)));
      setStreak(learningStreak(progress.flatMap(item=>[item.completed_at,item.exercise_completed_at])));
    }).catch(()=>{});
  },[session]);
  const completedCount=completedIds.size;
  const unlockedLessons=lessons.filter((lesson,index)=>index===0||completedIds.has(lessons[index-1].id));
  const nextLesson=unlockedLessons.find(lesson=>!completedIds.has(lesson.id));
  const percentage=lessons.length?Math.round(completedCount/lessons.length*100):0;
  const leaders=[["ش","شاهین آرام","۱۴"],["ک","کاوشگر شب","۱۲"],["م","مرد مسیر","۱۱"],["ذ","ذهن روشن","۱۰"],["س","سرو استوار","۹"],["ر","رهرو آرام","۹"],["ن","نقطه شروع","۸"],["پ","پلنگ صبور","۷"],["ق","قاب طلایی","۷"],["گ","گام بعدی","۶"]];
  return <><Header go={go} authenticated displayName={displayName} onLogout={onLogout}/><main className="app-page">
    <div className="welcome"><div><span className="eyebrow">سلام، {displayName || "دوست کاریزما"}</span><h2>امروز یک قدم جلوتر برو.</h2></div><div className="level"><span>سطح فعلی:</span><b>کاوشگر</b></div></div>
    <div className="dashboard-grid">
      <section className="today-card"><span className="pill">{nextLesson?`درس بعدی · ${nextLesson.duration_minutes} دقیقه`:"مسیر را کامل کردی"}</span><h3>{nextLesson?.title || "همهٔ درس‌ها تکمیل شدند"}</h3><p>{nextLesson?.summary || "برای مرور نکته‌ها و تمرین‌ها به کتابخانه برگرد."}</p><div className="card-row"><Button onClick={() => nextLesson?onOpenLesson(nextLesson):go("library")}>{nextLesson?"شروع مطالعه":"مشاهده درس‌ها"} <Icon name="arrow"/></Button><div className="day-count"><b>{streak}</b><span>روز پیوسته</span></div></div></section>
      <section className="progress-card"><div className="ring" style={{background:`conic-gradient(var(--gold) ${percentage}%,#292824 0)`}}><div><b>{percentage}٪</b><span>پیشرفت کل</span></div></div><div><span>مسیر یادگیری</span><h3>{nextLesson?.course_modules.learning_paths.title || "CLEAR"}</h3><p>{completedCount} از {lessons.length} درس کامل شده</p><div className="progress"><i style={{width:`${percentage}%`}}/></div></div></section>
    </div>
    <div className="section-head"><h3>ادامه مسیر</h3><button onClick={() => go("library")}>مشاهده همه</button></div>
    {nextLesson?<div className="lesson-row"><span>{String(lessons.indexOf(nextLesson)+1).padStart(2,"0")}</span><div><small>{nextLesson.course_modules.learning_paths.title}</small><h3>{nextLesson.title}</h3><p>{nextLesson.summary}</p></div><Button onClick={() => onOpenLesson(nextLesson)} ghost><Icon name="play"/> ادامه درس</Button></div>:<p className="library-state">همهٔ درس‌های موجود را تکمیل کرده‌ای.</p>}
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

function Profile({ go, session, profile, activePlan, onUpdateUsername, onDeleteAccount, ...auth }: { go: (p: Page) => void; session: AuthSession; profile: UserProfile | null; activePlan: string | null; onUpdateUsername: (username: string) => Promise<void>; onDeleteAccount: () => Promise<void> } & HeaderProps) {
  const roleLabels={learner:"یادگیرنده",mentor:"منتور",admin:"مدیر"};
  const contact=session.user.email || session.user.phone || "ثبت نشده";
  const displayName=profile?.username || profile?.display_name || session.user.user_metadata?.username || "ثبت نشده";
  const [editing,setEditing]=useState(false);
  const [username,setUsername]=useState(displayName==="ثبت نشده"?"":displayName);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
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
    <section className="profile-card"><div className="profile-avatar">{displayName.slice(0,1)}</div><div className="profile-details"><div className="username-field"><span>نام کاربری</span>{editing?<div className="username-editor"><input value={username} onChange={event=>setUsername(event.target.value)} dir="auto" autoComplete="username" aria-label="نام کاربری"/><Button onClick={saveUsername} disabled={saving||!username.trim()}>{saving?"در حال ذخیره…":"ذخیره"}</Button><button className="cancel-edit" onClick={()=>{setEditing(false);setUsername(displayName);setMessage("")}}>انصراف</button></div>:<div className="username-value"><strong>{displayName}</strong><button className="edit-username" aria-label="ویرایش نام کاربری" onClick={()=>{setUsername(displayName==="ثبت نشده"?"":displayName);setEditing(true);setMessage("")}}><Icon name="edit"/></button></div>}{message&&<small className="profile-message">{message}</small>}</div><div><span>ایمیل یا شماره موبایل</span><strong dir="ltr">{contact}</strong></div><div><span>نقش حساب</span><strong>{roleLabels[profile?.role || "learner"]}</strong></div><div><span>پلن فعال</span><strong>{activePlan || "بدون پلن فعال"}</strong></div><div><span>وضعیت نشست</span><strong className="profile-status">فعال</strong></div></div></section><button className="delete-account" onClick={async()=>{if(!window.confirm("حساب و تمام داده‌های آن برای همیشه حذف می‌شوند. ادامه می‌دهی؟")) return; try { await onDeleteAccount(); } catch(error) { setMessage(error instanceof Error ? error.message : "حذف حساب انجام نشد."); }}}>حذف حساب</button>
  </main><BottomNav page="profile" go={go}/></>;
}

function Lesson({ go, lesson, session, ...auth }: { go: (p: Page) => void; lesson: PublishedLesson | null; session: AuthSession } & HeaderProps) {
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
    <article className="text-lesson"><span className="eyebrow">{lesson.course_modules.learning_paths.title} · {lesson.duration_minutes} دقیقه مطالعه</span><h1>{lesson.title}</h1><p className="lesson-lead">{lesson.summary}</p><div className="quote">«{body.quote}»</div><section><h2>هدف درس</h2><p>{body.goal}</p></section><section><h2>ایدهٔ اصلی</h2>{body.idea.map(item=><p key={item}>{item}</p>)}</section><section><h2>مثال</h2><p>{body.example}</p></section><section><h2>{body.exercise.title}</h2><ol>{body.exercise.steps.map(step=><li key={step}>{step}</li>)}</ol><div className="exercise-completion">{exerciseCompleted?<span>تمرین انجام‌شده ثبت شد.</span>:<Button ghost onClick={markExerciseCompleted} disabled={exerciseSaving}>{exerciseSaving?"در حال ثبت…":"تمرین را انجام دادم"}</Button>}</div></section><section><h2>نکتهٔ مهم</h2><p>{body.mistake}</p></section><section><h2>خلاصه</h2><ul>{body.summary.map(item=><li key={item}>{item}</li>)}</ul></section><div className="lesson-completion">{completed?<span>مطالعهٔ این درس ثبت شد.</span>:<Button onClick={markCompleted} disabled={saving}>{saving?"در حال ثبت…":"مطالعه را تمام کردم"}</Button>}{message&&<small>{message}</small>}<Button ghost onClick={()=>go("library")}>بازگشت به کتابخانه <Icon name="arrow"/></Button></div></article>
  </main><BottomNav page="lesson" go={go}/></>;
}

function Coach({ go, ...auth }: { go: (p: Page) => void } & HeaderProps) {
  const scenarioData = {
    "آشنایی در جمع": {
      context:"در یک دورهمی، فرد جدیدی کنار تو ایستاده است.",
      prompt:"فرض کن من آن فرد هستم. چطور گفتگو را شروع می‌کنی؟",
      reply:"سلام، خوشبختم. من هم اینجا آدم‌های زیادی را نمی‌شناسم؛ تو چطور با این جمع آشنا شدی؟",
    },
    "قرار اول": {
      context:"برای اولین بار با کسی در یک کافه قرار داری و او تازه رسیده است.",
      prompt:"سلام، ببخشید کمی دیر رسیدم. چطوری؟ از کجا شروع کنیم؟",
      reply:"ممنون که راحت برخورد کردی. مسیر کمی شلوغ بود؛ تو مدت زیادی منتظر ماندی؟",
    },
    "گفتگوی کاری": {
      context:"در جلسه‌ی تیمی، همکارت پیشنهادی می‌دهد که با آن موافق نیستی.",
      prompt:"به نظر من بهتر است کل کار را به هفته‌ی بعد موکول کنیم. نظر تو چیست؟",
      reply:"نکته‌ات را متوجه شدم. فکر می‌کنی کدام بخش را می‌توانیم همین هفته جلو ببریم؟",
    },
    "شروع مکالمه": {
      context:"در آسانسور با همکاری که کم می‌شناسی تنها شده‌ای.",
      prompt:"سلام! امروز خیلی شلوغ بود، نه؟",
      reply:"دقیقاً، مخصوصاً بعدازظهر. برای تو هم جلسه‌ها پشت سر هم بود؟",
    },
  };
  const [scenario,setScenario]=useState<keyof typeof scenarioData>("آشنایی در جمع");
  const [draft,setDraft]=useState("");
  const [submitted,setSubmitted]=useState("");
  const changeScenario=(next:keyof typeof scenarioData)=>{
    setScenario(next);
    setDraft("");
    setSubmitted("");
  };
  const send=()=>{
    if(!draft.trim()) return;
    setSubmitted(draft.trim());
    setDraft("");
  };
  const current=scenarioData[scenario];
  return <><Header go={go} {...auth}/><main className="coach-page">
    <aside className="scenarios"><span className="eyebrow">مربی هوش مصنوعی</span><h2>تمرین مکالمه</h2><p>یک موقعیت را انتخاب کن و بدون قضاوت تمرین کن.</p>{(Object.keys(scenarioData) as Array<keyof typeof scenarioData>).map(s=><button className={scenario===s?"active":""} onClick={()=>changeScenario(s)} key={s}><span>{s}</span><Icon name="arrow"/></button>)}</aside>
    <section className="chat"><div className="chat-head"><div className="ai-dot">AI</div><div><b>{scenario}</b><span>مربی آماده تمرین است</span></div><i/></div>
      <div className="messages"><div className="context">سناریو: {current.context}</div><div className="message ai"><span>مربی</span><p>{current.prompt}</p></div>{submitted&&<><div className="message me"><p>{submitted}</p></div><div className="message ai"><span>طرف مقابل</span><p>{current.reply}</p></div></>}</div>
      <div className="composer"><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="پاسخت را بنویس..." onKeyDown={e=>e.key==="Enter"&&send()}/><button aria-label="ارسال پاسخ" onClick={send}><Icon name="send"/></button></div>
    </section>
  </main><BottomNav page="coach" go={go}/></>;
}

const plans = [
  {name:"برنز",price:"۱٫۲",desc:"شروع اصولی و مستقل",items:["دسترسی کامل به دوره","تمرین‌های عملی هر درس"]},
  {name:"نقره",price:"۱٫۹",desc:"تمرین با همراهی بیشتر",items:["تمام امکانات برنز","گروه خصوصی اعضا","مربی هوش مصنوعی محدود"]},
  {name:"طلا",price:"۳",desc:"انتخاب جدی برای تغییر",popular:true,items:["تمام امکانات نقره","هوش مصنوعی گسترده","منتورینگ ماهانه نیمه‌خصوصی","بازخورد ویدیوی تمرین"]},
  {name:"الماس",price:"۸",desc:"مسیر کاملاً اختصاصی",items:["تمام امکانات طلا","هوش مصنوعی نامحدود","منتورینگ ماهانه خصوصی"]},
];
function Pricing({ go, choose, ...auth }: { go: (p: Page) => void; choose: (p: string) => void } & HeaderProps) {
  return <><Header go={go} {...auth}/><main className="pricing-page"><div className="section-title"><span>سرمایه‌گذاری روی خودت</span><h2>پلن مناسب مسیرت را انتخاب کن</h2><p>همه پلن‌ها دسترسی دائمی به محتوای آموزشی دارند.</p></div><div className="plans">{plans.map(p=><div className={`plan ${p.popular?"gold":""}`} key={p.name}>{p.popular&&<span className="popular">محبوب‌ترین</span>}<span>{p.name}</span><h3>{p.price}<small> میلیون تومان</small></h3><p>{p.desc}</p><Button block ghost={!p.popular} onClick={()=>{choose(p.name);go("checkout")}}>انتخاب {p.name}</Button><ul>{p.items.map(x=><li key={x}><Icon name="check"/>{x}</li>)}</ul></div>)}</div></main></>;
}

function Checkout({ go, plan, ...auth }: { go:(p:Page)=>void; plan:string } & HeaderProps) {
  const data=plans.find(p=>p.name===plan) || plans[2];
  const [paid,setPaid]=useState(false);
  return <><Header go={go} simple {...auth}/><main className="center-page">{paid?<div className="success"><div><Icon name="check"/></div><span className="eyebrow">پرداخت موفق</span><h2>به آزمایشگاه کاریزما خوش آمدی.</h2><p>پلن {data.name} برای تو فعال شد. اولین قدم مسیرت آماده است.</p><Button onClick={()=>go("dashboard")}>ورود به داشبورد <Icon name="arrow"/></Button></div>:<div className="checkout"><div><button className="back" onClick={()=>go("pricing")}><Icon name="arrow"/> بازگشت</button><span className="eyebrow">تکمیل ثبت‌نام</span><h2>اطلاعات پرداخت</h2><label>نام و نام خانوادگی<input placeholder="نام کامل"/></label><label>شماره موبایل<input dir="ltr" placeholder="09 — — — — — — — — —"/></label><div className="secure"><Icon name="lock"/> پرداخت امن از طریق درگاه بانکی</div></div><aside><span>خلاصه سفارش</span><h3>پلن {data.name}</h3><ul>{data.items.map(x=><li key={x}><Icon name="check"/>{x}</li>)}</ul><div className="total"><span>مبلغ نهایی</span><b>{data.price} میلیون تومان</b></div><Button block onClick={()=>setPaid(true)}>پرداخت و شروع مسیر</Button></aside></div>}</main></>;
}

export default function App() {
  const [session,setSession]=useState<AuthSession|null>(()=>getStoredSession());
  const [profile,setProfile]=useState<UserProfile|null>(null);
  const [page,setPage]=useState<Page>(()=>pageFromHash() || (getStoredSession()?"dashboard":"home"));
  const [activeLesson,setActiveLesson]=useState<PublishedLesson|null>(null);
  const [activePlan,setActivePlan]=useState<string|null>(null);
  const [plan,setPlan]=useState("طلا");
  const protectedPages:Page[]=["dashboard","library","lesson","coach","checkout","profile"];
  useEffect(()=>{
    let active=true;
    restoreSession().then(async restored=>{
      if(!active) return;
      setSession(restored);
      if(restored) {
        setProfile(await getUserProfile(restored).catch(()=>null));
        setActivePlan(await getActivePlan(restored).catch(()=>null));
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
        getUserProfile(nextSession).then(setProfile).catch(()=>setProfile(null));
        getActivePlan(nextSession).then(setActivePlan).catch(()=>setActivePlan(null));
      } else { setProfile(null); setActivePlan(null); setPage("home"); window.location.hash="home"; }
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
    window.location.hash=nextPage;
    setPage(nextPage);
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const openLesson=(lesson:PublishedLesson)=>{
    setActiveLesson(lesson);
    go("lesson");
  };
  const authenticated=(nextSession:AuthSession)=>{
    setSession(nextSession);
    getUserProfile(nextSession).then(setProfile).catch(()=>setProfile(null));
    getActivePlan(nextSession).then(setActivePlan).catch(()=>setActivePlan(null));
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
    go("home");
  };
  const removeAccount=async()=>{
    if(!session) return;
    await deleteAccount(session);
    setSession(null);
    setProfile(null);
    setActivePlan(null);
    go("home");
  };
  const displayName=profile?.username || profile?.display_name || session?.user.user_metadata?.username || session?.user.user_metadata?.display_name;
  const visiblePage=!session && protectedPages.includes(page)?"auth":page;
  const headerAuth={authenticated:Boolean(session),displayName,onLogout:logout};
  return <div dir="rtl">{visiblePage==="home"?<Home go={go} {...headerAuth}/>:visiblePage==="about"?<About go={go} {...headerAuth}/>:visiblePage==="auth"?<Auth go={go} onAuthenticated={authenticated}/>:visiblePage==="dashboard"?<Dashboard go={go} displayName={displayName} onLogout={logout} session={session!} onOpenLesson={openLesson}/>:visiblePage==="library"?<Library go={go} onOpenLesson={openLesson} session={session!} {...headerAuth}/>:visiblePage==="profile"?<Profile go={go} session={session!} profile={profile} activePlan={activePlan} onUpdateUsername={updateUsername} onDeleteAccount={removeAccount} {...headerAuth}/>:visiblePage==="lesson"?<Lesson go={go} lesson={activeLesson} session={session!} {...headerAuth}/>:visiblePage==="coach"?<Coach go={go} {...headerAuth}/>:visiblePage==="pricing"?<Pricing go={go} choose={setPlan} {...headerAuth}/>:<Checkout go={go} plan={plan} {...headerAuth}/>}<SupportWidget showButton={visiblePage==="home"||visiblePage==="dashboard"}/></div>;
}
