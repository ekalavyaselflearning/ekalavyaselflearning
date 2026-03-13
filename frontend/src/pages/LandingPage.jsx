import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./LandingPage.css";

gsap.registerPlugin(ScrollTrigger);

/* ── Content ─────────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: "🤖", title: "AI Note Recognition",  desc: "Computer vision converts handwritten notes into searchable digital format with 95% accuracy." },
  { icon: "🤝", title: "Community Sharing",    desc: "Share notes with permission-based access. Build a strong community of UPSC aspirants." },
  { icon: "🗺️", title: "Smart Mind Maps",      desc: "Auto-generate interactive mind maps to visualise complex topics at a glance." },
  { icon: "👨‍🎓", title: "Expert Mentorship",   desc: "Get personalised guidance from successful UPSC candidates with proven strategies." },
  { icon: "🔍", title: "Smart Suggestions",    desc: "AI surfaces related notes based on your current topics — ensuring full coverage." },
  { icon: "📱", title: "Mobile-First",          desc: "Access your notes anywhere, anytime. Seamless across all devices." },
];
const STATS = [
  { value: "10K+", label: "Active Aspirants" },
  { value: "50K+", label: "Notes Digitized"  },
  { value: "95%",  label: "AI Accuracy"      },
  { value: "500+", label: "Success Stories"  },
];
const STEPS = [
  { n: "01", title: "Upload Your Notes",  desc: "Photograph or scan your handwritten notes via mobile or web." },
  { n: "02", title: "AI Processing",      desc: "Computer vision converts your handwriting into searchable digital text." },
  { n: "03", title: "Organise & Share",   desc: "Build mind maps, tag by subject, share with your community." },
  { n: "04", title: "Learn & Succeed",    desc: "Mentor advice, smart suggestions — accelerate your preparation." },
];
const TITLE_LETTERS = "EKALAVYA".split("");

/* ── Fire-burn canvas ────────────────────────────────────────────────────── */
function runFireBurn(canvas, onDone) {
  const ctx = canvas.getContext("2d");
  const W   = canvas.width;
  const H   = canvas.height;

  ctx.fillStyle = "#0b0f1a";
  ctx.fillRect(0, 0, W, H);

  const imageData = ctx.getImageData(0, 0, W, H);
  const data      = imageData.data;

  // distance from nearest edge
  const dist = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      dist[y * W + x] = Math.min(x, y, W - 1 - x, H - 1 - y);

  const maxDist  = Math.min(W, H) / 2 + 10;
  const DURATION = 750; // ms
  let   start    = null;

  function frame(ts) {
    if (!start) start = ts;
    const progress  = Math.min((ts - start) / DURATION, 1);
    const burnFront = progress * (maxDist + 40);
    const ZONE      = 28;

    for (let i = 0; i < W * H; i++) {
      const d   = dist[i];
      const idx = i * 4;
      if (d > burnFront + ZONE) {
        // solid dark
        data[idx]   = 11; data[idx+1] = 15; data[idx+2] = 26; data[idx+3] = 255;
      } else if (d > burnFront) {
        // flame zone — blue-white glow fading
        const t = 1 - (d - burnFront) / ZONE; // 0→1 as we approach burn front
        const r = Math.round(48  + (207) * Math.pow(t, 2));
        const g = Math.round(103 + (152) * Math.pow(t, 2));
        const b = 205;
        const a = Math.round(255 * (1 - t));
        data[idx]   = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = a;
      } else {
        // burned — transparent
        data[idx+3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    if (progress < 1) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, W, H); onDone && onDone(); }
  }

  requestAnimationFrame(frame);
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [introOver,   setIntroOver]   = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);

  const overlayRef    = useRef(null);
  const fireCanvas    = useRef(null);
  const dropArrowRef  = useRef(null);
  const sweepArrowRef = useRef(null);
  const letterRefs    = useRef([]);

  const featRef  = useRef(null);
  const statsRef = useRef(null);
  const hiwRef   = useRef(null);
  const loreRef  = useRef(null);
  const ctaRef   = useRef(null);

  /* ── Intro ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas  = fireCanvas.current;
    const overlay = overlayRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    canvas.width  = vw;
    canvas.height = vh;

    // Draw initial black
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0, 0, vw, vh);

    const tl = gsap.timeline({ defaults: { ease: "none" } });

    // 0.0s — arrow drops
    tl.set(dropArrowRef.current, { x: vw / 2 - 14, y: -80, opacity: 1 });
    tl.to(dropArrowRef.current,
      { y: vh - 40, duration: 0.36, ease: "power3.in" }
    );

    // 0.36s — impact flash & hide arrow
    tl.to(dropArrowRef.current, { opacity: 0, scale: 2.5, duration: 0.1, ease: "power2.out" });

    // 0.40s — fire burn starts
    tl.add(() => {
      runFireBurn(canvas, () => {});
    }, "-=0.06");

    // 0.40s+0.75s = 1.15s — fade out overlay wrapper
    tl.to(overlay, { opacity: 0, duration: 0.15 }, "+=0.72");
    tl.add(() => {
      overlay.style.pointerEvents = "none";
      setIntroOver(true);
    });

    // 1.3s — sweep arrow enters from left across title
    const sweepY = vh / 2 - 14; // vertically centred on screen
    tl.set(sweepArrowRef.current, { x: -120, y: sweepY, opacity: 1 });
    tl.to(sweepArrowRef.current,
      { x: vw + 120, duration: 0.52, ease: "power2.inOut" },
      "+=0.0"
    );

    // Letters unmask in sync with sweep (stagger matches sweep duration)
    tl.fromTo(
      letterRefs.current,
      { clipPath: "inset(0 100% 0 0)" },
      { clipPath: "inset(0 0% 0 0)", duration: 0.065, stagger: 0.058, ease: "none" },
      "<"
    );

    // Hide sweep arrow
    tl.set(sweepArrowRef.current, { opacity: 0 });

    // Hero sub-content slides in
    tl.fromTo(".hero-sub-anim",
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.48, stagger: 0.1, ease: "power3.out" },
      "+=0.06"
    );

    return () => tl.kill();
  // eslint-disable-next-line
  }, []);

  /* ── Scroll surprises ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!introOver) return;

    // NAV slides down
    gsap.fromTo(".ek-nav",
      { y: -60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, ease: "power3.out", delay: 0.1 }
    );

    // FEATURES — rotateX flip-in like cards flipping off a table
    gsap.from(".ek-feat-card", {
      scrollTrigger: { trigger: featRef.current, start: "top 80%" },
      y: 70, rotateX: 30, opacity: 0,
      duration: 0.58, stagger: { amount: 0.45, from: "start" },
      ease: "back.out(1.5)", transformOrigin: "top center",
    });

    // STAT numbers — slam in from 4 different directions
    const statDirs = [
      { x: -90, y: 0 }, { x: 0, y: -80 },
      { x: 0,  y: 80 }, { x: 90, y: 0  },
    ];
    document.querySelectorAll(".ek-stat-item").forEach((el, i) => {
      gsap.from(el, {
        scrollTrigger: { trigger: statsRef.current, start: "top 82%" },
        ...statDirs[i], opacity: 0,
        duration: 0.52, delay: i * 0.09, ease: "power4.out",
      });
    });

    // STEP CONNECTOR draws left→right, then steps scale up
    gsap.from(".ek-step-connector", {
      scrollTrigger: { trigger: hiwRef.current, start: "top 78%" },
      scaleX: 0, duration: 0.85, ease: "power2.inOut", transformOrigin: "left",
    });
    gsap.from(".ek-step", {
      scrollTrigger: { trigger: hiwRef.current, start: "top 78%" },
      scale: 0.65, opacity: 0, duration: 0.48,
      stagger: 0.12, ease: "back.out(2.2)", delay: 0.28,
    });

    // LORE — text from left, card from right + slight rotate
    gsap.from(".lore-text-side > *", {
      scrollTrigger: { trigger: loreRef.current, start: "top 80%" },
      x: -55, opacity: 0, duration: 0.6, stagger: 0.1, ease: "power3.out",
    });
    gsap.from(".lore-visual-side", {
      scrollTrigger: { trigger: loreRef.current, start: "top 80%" },
      x: 70, rotate: 5, opacity: 0, duration: 0.75, ease: "power3.out", delay: 0.15,
    });

    // CTA — whole block scales up with bounce
    gsap.from(".ek-cta-inner > *", {
      scrollTrigger: { trigger: ctaRef.current, start: "top 84%" },
      scale: 0.78, opacity: 0, duration: 0.58,
      stagger: 0.1, ease: "back.out(1.9)",
    });

    return () => ScrollTrigger.getAll().forEach(t => t.kill());
  }, [introOver]);

  /* ── Nav scroll ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const fn = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="landing-page-root">
      {/* ══ INTRO ══ */}
      <div ref={overlayRef} className="intro-overlay">
        <canvas ref={fireCanvas} className="fire-canvas" />
        <div ref={dropArrowRef} className="drop-arrow" style={{ position:"fixed", top:0, left:0 }}>
          <svg width="28" height="80" viewBox="0 0 28 80" fill="none">
            <defs>
              <linearGradient id="dt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5590ff" stopOpacity="0"/>
                <stop offset="100%" stopColor="#5590ff" stopOpacity="0.9"/>
              </linearGradient>
            </defs>
            <line x1="14" y1="0" x2="14" y2="36" stroke="url(#dt)" strokeWidth="7" strokeLinecap="round"/>
            <line x1="14" y1="4" x2="14" y2="60" stroke="#5590ff" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M5 52 L14 70 L23 52" stroke="#5590ff" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
            <path d="M10 4 L14 14 L18 4" stroke="#a0bfff" strokeWidth="2" fill="none"/>
          </svg>
        </div>
      </div>

      {/* Sweep arrow — fixed, sits above everything during sweep */}
      <div ref={sweepArrowRef} className="sweep-arrow" style={{ opacity:0, position:"fixed", top:0, left:0 }}>
        <svg width="100" height="28" viewBox="0 0 100 28" fill="none">
          <defs>
            <linearGradient id="st" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5590ff" stopOpacity="0"/>
              <stop offset="100%" stopColor="#5590ff" stopOpacity="0.9"/>
            </linearGradient>
          </defs>
          <line x1="0" y1="14" x2="58" y2="14" stroke="url(#st)" strokeWidth="7" strokeLinecap="round"/>
          <line x1="4" y1="14" x2="80" y2="14" stroke="#5590ff" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M68 5 L88 14 L68 23" stroke="#5590ff" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
          <path d="M4 10 L14 14 L4 18" stroke="#a0bfff" strokeWidth="2" fill="none"/>
        </svg>
      </div>

      {/* ══ PAGE ══ */}
      <div className="page-root">

        {/* NAV */}
        <nav className={`ek-nav${navScrolled ? " scrolled" : ""}`}>
          <div className="nav-inner">
            <a href="#" className="nav-logo">Ekalavya</a>
            <ul className="nav-links">
              {[["features","Features"],["how-it-works","How It Works"],["story","Our Story"],["contact","Contact"]].map(([id,lbl])=>(
                <li key={id}><a href={`#${id}`} onClick={e=>{e.preventDefault();scrollTo(id)}}>{lbl}</a></li>
              ))}
            </ul>
            <a className="nav-cta" href="#features" onClick={e=>{e.preventDefault();scrollTo("features")}}>Start Free →</a>
            <button className={`hamburger${menuOpen?" open":""}`} onClick={()=>setMenuOpen(m=>!m)} aria-label="Toggle menu">
              <span/><span/><span/>
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <div className={`mobile-menu${menuOpen?" open":""}`}>
          {[["features","Features"],["how-it-works","How It Works"],["story","Our Story"],["contact","Contact"]].map(([id,lbl])=>(
            <a key={id} href={`#${id}`} onClick={e=>{e.preventDefault();scrollTo(id)}}>{lbl}</a>
          ))}
        </div>

        {/* ── HERO ── */}
        <section className="hero-section" id="home">
          <div className="hero-grid-bg"/>
          <div className="hero-glow"/>

          <div className="hero-center">
            {/* EKALAVYA letter-by-letter reveal */}
            <div className="hero-title-row">
              {TITLE_LETTERS.map((ch, i) => (
                <span key={i} className="title-letter-wrap"
                  ref={el => { letterRefs.current[i] = el; }}
                  style={{ clipPath: "inset(0 100% 0 0)" }}>
                  <span className="title-letter">{ch}</span>
                </span>
              ))}
            </div>

            <p className="hero-tagline hero-sub-anim">
              Learn alone. Rise <em>together.</em>
            </p>

            <p className="hero-sub hero-sub-anim">
              Like Ekalavya, who mastered archery through sheer devotion — we give every aspirant
              the AI tools, community, and mentorship to conquer UPSC on their own terms.
            </p>

            <div className="hero-ctas hero-sub-anim">
              <a href="#features" className="btn btn-primary" onClick={e=>{e.preventDefault();scrollTo("features")}}>
                Explore Platform →
              </a>
              <a href="#story" className="btn btn-ghost" onClick={e=>{e.preventDefault();scrollTo("story")}}>
                Our Story
              </a>
            </div>

            <div className="hero-trust hero-sub-anim">
              <span><strong>10,000+</strong> aspirants</span>
              <span className="trust-sep"/>
              <span><strong>50K+</strong> notes digitized</span>
              <span className="trust-sep"/>
              <span><strong>95%</strong> AI accuracy</span>
            </div>
          </div>

          <div className="scroll-hint">
            <div className="scroll-line"/>
            <span>scroll</span>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="section bg-mid" id="features" ref={featRef}>
          <div className="landing-page-container">
            <div className="section-head">
              <span className="section-tag">What We Offer</span>
              <h2 className="section-title">Built for the <em>dedicated</em></h2>
            </div>
            <div className="feat-grid">
              {FEATURES.map((f,i)=>(
                <div className="ek-feat-card" key={i}>
                  <div className="feat-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="stats-section" ref={statsRef}>
          <div className="landing-page-container">
            <div className="stats-grid">
              {STATS.map((s,i)=>(
                <div className="ek-stat-item" key={i}>
                  <div className="stat-num">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="section bg-mid" id="how-it-works" ref={hiwRef}>
          <div className="landing-page-container">
            <div className="section-head">
              <span className="section-tag">Simple Process</span>
              <h2 className="section-title">Four steps to <em>mastery</em></h2>
            </div>
            <div className="steps-wrap">
              <div className="ek-step-connector"/>
              {STEPS.map((s,i)=>(
                <div className="ek-step" key={i}>
                  <div className="step-num">{s.n}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LORE ── */}
        <section className="section bg-dark" id="story" ref={loreRef}>
          <div className="landing-page-container">
            <div className="lore-inner">
              <div className="lore-text-side">
                <span className="section-tag">Our Namesake</span>
                <h2 className="section-title" style={{marginTop:"0.8rem"}}>The legend of<br/><em>Ekalavya</em></h2>
                <p className="lore-body">
                  In the Mahabharata, Ekalavya — denied formal training — fashioned a clay statue
                  of Dronacharya and taught himself archery through devotion alone, becoming one of
                  history's greatest archers.
                </p>
                <p className="lore-body">
                  We built this platform for every aspirant who refuses to let circumstance define
                  their ceiling. The tools are here. The community is here. The devotion? That's yours.
                </p>
                <a href="#features" className="btn btn-primary" style={{marginTop:"0.5rem"}}
                  onClick={e=>{e.preventDefault();scrollTo("features")}}>
                  Begin Your Journey →
                </a>
              </div>
              <div className="lore-visual-side">
                <div className="lore-thumb-ghost">
                  <svg width="260" height="290" viewBox="0 0 300 320" opacity="0.07">
                    {Array.from({length:14},(_,i)=>{
                      const r=28+i*9,cx=150,cy=160,rx=r*0.72,ry=r;
                      return <path key={i} fill="none" stroke="#3067cd" strokeWidth="2"
                        d={`M${cx-rx} ${cy} A${rx} ${ry} 0 1 1 ${cx+rx} ${cy} A${rx} ${ry} 0 1 1 ${cx-rx} ${cy}`}/>;
                    })}
                  </svg>
                </div>
                <div className="lore-quote-card">
                  <span className="quote-mark">"</span>
                  <p className="quote-text">
                    He had no guru physically present — yet he mastered what even the finest
                    students couldn't. That is the power of devotion over privilege.
                  </p>
                  <span className="quote-attr">— Inspired by the Mahabharata</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="cta-section" ref={ctaRef}>
          <div className="landing-page-container">
            <div className="ek-cta-inner">
              <span className="section-tag">Start Today</span>
              <h2 className="cta-title">Your devotion.<br/>Our <em>platform.</em></h2>
              <p className="cta-sub">
                Join thousands already using Ekalavya to turn relentless dedication into results.
              </p>
              <div className="cta-btns">
                <a href="#" className="btn btn-primary">Get Started Free →</a>
                <a href="#features" className="btn btn-ghost"
                  onClick={e=>{e.preventDefault();scrollTo("features")}}>Explore Features</a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="ek-footer" id="contact">
          <div className="landing-page-container">
            <div className="footer-grid">
              <div className="footer-brand">
                <span className="footer-logo">Ekalavya</span>
                <p>Empowering UPSC aspirants with AI-powered note sharing and collaborative learning.</p>
              </div>
              <div className="footer-col">
                <h4>Product</h4>
                {["Features","How It Works","Community","Pricing"].map(l=><a href="#" key={l}>{l}</a>)}
              </div>
              <div className="footer-col">
                <h4>Support</h4>
                {["Help Center","Contact","Privacy Policy","Terms"].map(l=><a href="#" key={l}>{l}</a>)}
              </div>
              <div className="footer-col">
                <h4>Connect</h4>
                <a href="#">hello@ekalavya.in</a>
                <a href="#">+91 97893 92106</a>
              </div>
            </div>
            <div className="footer-bottom">
              <span>© 2025 Ekalavya. All rights reserved.</span>
              <span>Built with devotion for every aspirant.</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
