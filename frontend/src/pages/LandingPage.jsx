import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ─── Data ─────────────────────────────────────────────────────────────────────
const SLIDES = [
  { icon: "🤖", title: "AI-Powered Recognition", desc: "Advanced computer vision converts your handwritten notes into searchable digital format with 95% accuracy — portable across every device." },
  { icon: "🤝", title: "Community Collaboration", desc: "Share notes with permission-based access. Build a strong community of UPSC aspirants — learn together, grow together, succeed together." },
  { icon: "🗺️", title: "Smart Mind Maps", desc: "Auto-generate interactive mind maps from your notes to visualize complex topics and understand interconnected UPSC concepts at a glance." },
  { icon: "👨‍🎓", title: "Expert Mentorship", desc: "Get personalized guidance from successful UPSC candidates. Access proven strategies and study plans from those who've achieved success." },
  { icon: "🔍", title: "Intelligent Suggestions", desc: "AI-powered recommendations surface related notes and materials based on your current topics, ensuring comprehensive syllabus coverage." },
];

const FEATURES = [
  { icon: "🤖", title: "AI Note Recognition", desc: "Our computer vision tech converts handwritten notes into digital format — searchable, editable, and accessible on any device." },
  { icon: "🤝", title: "Community Sharing", desc: "Build a collaborative learning environment where knowledge flows freely among dedicated UPSC aspirants." },
  { icon: "🗺️", title: "Interactive Mind Maps", desc: "Auto-generate visual mind maps to enhance understanding and retention of complex, interconnected UPSC topics." },
  { icon: "👨‍🎓", title: "Mentor Guidance", desc: "Connect with those who've walked the path and learn proven strategies from successful UPSC candidates." },
  { icon: "🔍", title: "Smart Recommendations", desc: "AI suggests related notes and study materials, ensuring comprehensive coverage of the entire UPSC syllabus." },
  { icon: "📱", title: "Mobile-First Design", desc: "Access your notes anywhere, anytime. Our platform works seamlessly across all devices for uninterrupted study." },
];

const STATS = [
  { value: "10K+", label: "Active Users" },
  { value: "50K+", label: "Notes Digitized" },
  { value: "95%", label: "Accuracy Rate" },
  { value: "500+", label: "Success Stories" },
];

const STEPS = [
  { n: "01", title: "Upload Your Notes", desc: "Photograph or scan your handwritten notes using our mobile app or web platform." },
  { n: "02", title: "AI Processing", desc: "Our computer vision algorithms analyze and convert your handwriting into searchable digital text." },
  { n: "03", title: "Organize & Share", desc: "Organize by subject, create mind maps, and share with the community for collaborative learning." },
  { n: "04", title: "Learn & Succeed", desc: "Access mentor advice, discover related materials, and accelerate your UPSC preparation journey." },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy:   #0f1f4b;
    --blue:   #1e3a8a;
    --sky:    #3b82f6;
    --amber:  #f59e0b;
    --light:  #f0f4ff;
    --white:  #ffffff;
    --gray:   #64748b;
    --dark:   #0d1117;
    --grad:   linear-gradient(135deg, #0f1f4b 0%, #1e3a8a 50%, #2563eb 100%);
  }

  html { scroll-behavior: smooth; }

  body { font-family: 'DM Sans', sans-serif; color: var(--dark); overflow-x: hidden; background: var(--white); }

  /* ── Loader ── */
  .ek-loader {
    position: fixed; inset: 0; background: var(--navy);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; transition: opacity .5s, visibility .5s;
  }
  .ek-loader.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
  .ek-loader-ring {
    width: 56px; height: 56px; border-radius: 50%;
    border: 3px solid rgba(255,255,255,.15);
    border-top-color: var(--amber);
    animation: spin .9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Navbar ── */
  .ek-nav {
    position: fixed; top: 0; width: 100%; z-index: 1000;
    padding: 1.25rem 0; transition: padding .4s, background .4s, box-shadow .4s;
  }
  .ek-nav.scrolled {
    padding: .75rem 0;
    background: rgba(255,255,255,.9);
    backdrop-filter: blur(18px);
    box-shadow: 0 1px 0 rgba(0,0,0,.08);
  }
  .ek-nav .inner {
    max-width: 1200px; margin: auto; padding: 0 2rem;
    display: flex; align-items: center; justify-content: space-between;
  }
  .ek-logo {
    font-family: 'Syne', sans-serif; font-size: 1.75rem; font-weight: 800;
    color: var(--white); text-decoration: none; letter-spacing: -.02em;
    transition: color .3s;
  }
  .ek-nav.scrolled .ek-logo { color: var(--navy); }
  .ek-nav-links { display: flex; gap: 2rem; list-style: none; }
  .ek-nav-links a {
    font-size: .95rem; font-weight: 500; color: rgba(255,255,255,.85);
    text-decoration: none; position: relative; transition: color .3s;
  }
  .ek-nav.scrolled .ek-nav-links a { color: var(--gray); }
  .ek-nav-links a::after {
    content: ''; position: absolute; bottom: -4px; left: 0; height: 2px;
    width: 0; background: var(--amber); transition: width .3s;
  }
  .ek-nav-links a:hover::after { width: 100%; }
  .ek-nav-links a:hover { color: var(--white); }
  .ek-nav.scrolled .ek-nav-links a:hover { color: var(--navy); }
  .ek-nav-cta {
    padding: .55rem 1.4rem; border-radius: 50px;
    background: var(--amber); color: var(--white);
    font-weight: 600; font-size: .9rem; text-decoration: none;
    transition: transform .3s, box-shadow .3s;
  }
  .ek-nav-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(245,158,11,.4); }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: .5rem;
    padding: .9rem 2.2rem; border-radius: 50px; font-size: 1rem;
    font-weight: 600; text-decoration: none; border: none; cursor: pointer;
    transition: transform .3s, box-shadow .3s;
  }
  .btn-primary { background: var(--amber); color: var(--white); }
  .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(245,158,11,.45); }
  .btn-outline {
    background: transparent; color: var(--white);
    border: 2px solid rgba(255,255,255,.5);
  }
  .btn-outline:hover { background: rgba(255,255,255,.1); transform: translateY(-3px); }

  /* ── Shared layout ── */
  .section { padding: 7rem 0; }
  .container { max-width: 1200px; margin: auto; padding: 0 2rem; }
  .section-label {
    font-size: .8rem; font-weight: 600; letter-spacing: .15em;
    text-transform: uppercase; color: var(--sky); margin-bottom: .75rem;
  }
  .section-title {
    font-family: 'Syne', sans-serif; font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800; color: var(--navy); line-height: 1.15; letter-spacing: -.02em;
  }

  /* ── Hero ── */
  .ek-hero {
    min-height: 100vh; background: var(--grad);
    position: relative; overflow: hidden;
    display: flex; align-items: center;
  }
  .ek-hero-bg {
    position: absolute; inset: 0; overflow: hidden; pointer-events: none;
  }
  .ek-orb {
    position: absolute; border-radius: 50%; filter: blur(80px);
    opacity: .35;
  }
  .ek-orb-1 { width: 600px; height: 600px; background: #2563eb; top: -200px; right: -150px; }
  .ek-orb-2 { width: 400px; height: 400px; background: var(--amber); bottom: -150px; left: -100px; }
  .ek-orb-3 { width: 300px; height: 300px; background: #0ea5e9; top: 50%; left: 40%; }
  .ek-hero-grid {
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
    background-size: 60px 60px;
  }
  .ek-hero .container {
    position: relative; z-index: 2;
    display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center;
    padding-top: 7rem;
  }
  .ek-hero-eyebrow {
    display: inline-flex; align-items: center; gap: .5rem;
    padding: .4rem 1rem; border-radius: 50px;
    background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2);
    color: rgba(255,255,255,.9); font-size: .8rem; font-weight: 500; letter-spacing: .05em;
    margin-bottom: 1.5rem;
  }
  .ek-hero-eyebrow span { width: 6px; height: 6px; border-radius: 50%; background: var(--amber); }
  .ek-hero h1 {
    font-family: 'Syne', sans-serif; font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 800; color: var(--white); line-height: 1.1; letter-spacing: -.025em;
    margin-bottom: 1.5rem;
  }
  .ek-hero h1 em { font-style: normal; color: var(--amber); }
  .ek-hero-sub {
    font-size: 1.1rem; color: rgba(255,255,255,.75); line-height: 1.7;
    margin-bottom: 2.5rem; max-width: 480px;
  }
  .ek-hero-ctas { display: flex; gap: 1rem; flex-wrap: wrap; }
  .ek-hero-trust {
    margin-top: 2.5rem; display: flex; align-items: center; gap: 1rem;
  }
  .ek-avatars { display: flex; }
  .ek-avatar {
    width: 36px; height: 36px; border-radius: 50%; border: 2px solid rgba(255,255,255,.3);
    background: var(--grad); display: flex; align-items: center; justify-content: center;
    font-size: .9rem; margin-left: -10px;
  }
  .ek-avatars .ek-avatar:first-child { margin-left: 0; }
  .ek-trust-text { font-size: .85rem; color: rgba(255,255,255,.7); line-height: 1.4; }
  .ek-trust-text strong { color: var(--white); }

  /* ── Carousel ── */
  .ek-carousel-wrap {
    position: relative;
  }
  .ek-carousel-card {
    background: rgba(255,255,255,.1);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 24px;
    padding: 2.5rem;
    min-height: 340px;
    position: relative;
    overflow: hidden;
  }
  .ek-carousel-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, var(--amber), var(--sky));
  }
  .ek-slide { display: none; }
  .ek-slide.active { display: block; }
  .ek-slide-icon {
    font-size: 2.8rem; margin-bottom: 1.25rem;
    width: 72px; height: 72px; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,.15); border-radius: 18px;
    border: 1px solid rgba(255,255,255,.25);
  }
  .ek-slide-title {
    font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 700;
    color: var(--white); margin-bottom: .75rem;
  }
  .ek-slide-desc { color: rgba(255,255,255,.8); line-height: 1.65; font-size: .95rem; }
  .ek-carousel-nav {
    display: flex; align-items: center; justify-content: space-between; margin-top: 1.5rem;
  }
  .ek-carousel-dots { display: flex; gap: .5rem; }
  .ek-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: rgba(255,255,255,.3); cursor: pointer;
    transition: background .3s, transform .3s;
    border: none;
  }
  .ek-dot.active { background: var(--amber); transform: scale(1.4); }
  .ek-carousel-arrows { display: flex; gap: .5rem; }
  .ek-arrow {
    width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25);
    color: var(--white); font-size: 1.2rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .3s, transform .3s;
  }
  .ek-arrow:hover { background: rgba(255,255,255,.28); transform: scale(1.08); }

  /* ── Features ── */
  .ek-features { background: var(--light); }
  .ek-feat-header { text-align: center; margin-bottom: 4rem; }
  .ek-feat-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;
  }
  .ek-feat-card {
    background: var(--white); border-radius: 20px;
    padding: 2.25rem; border: 1px solid rgba(0,0,0,.06);
    position: relative; overflow: hidden;
    transition: transform .35s, box-shadow .35s;
  }
  .ek-feat-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: var(--grad); transform: scaleX(0); transform-origin: left;
    transition: transform .4s;
  }
  .ek-feat-card:hover::before { transform: scaleX(1); }
  .ek-feat-card:hover { transform: translateY(-8px); box-shadow: 0 24px 48px rgba(30,58,138,.12); }
  .ek-feat-icon {
    font-size: 2rem; width: 60px; height: 60px;
    background: var(--grad); border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 1.25rem;
  }
  .ek-feat-card h3 {
    font-family: 'Syne', sans-serif; font-size: 1.15rem; font-weight: 700;
    color: var(--navy); margin-bottom: .6rem;
  }
  .ek-feat-card p { color: var(--gray); line-height: 1.65; font-size: .92rem; }

  /* ── Stats ── */
  .ek-stats { background: var(--grad); }
  .ek-stats-inner {
    display: grid; grid-template-columns: repeat(4,1fr); gap: 2rem; text-align: center;
  }
  .ek-stat-num {
    font-family: 'Syne', sans-serif; font-size: 3.25rem; font-weight: 800;
    color: var(--white); line-height: 1; margin-bottom: .5rem;
  }
  .ek-stat-num span { color: var(--amber); }
  .ek-stat-label { color: rgba(255,255,255,.7); font-size: .9rem; font-weight: 500; }
  .ek-stat-divider {
    height: 100%; border-right: 1px solid rgba(255,255,255,.15);
  }

  /* ── How It Works ── */
  .ek-hiw { background: var(--white); }
  .ek-hiw-header { text-align: center; margin-bottom: 4rem; }
  .ek-steps {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; position: relative;
  }
  .ek-steps::before {
    content: ''; position: absolute; top: 36px; left: 10%; right: 10%; height: 2px;
    background: linear-gradient(90deg, var(--blue), var(--sky));
  }
  .ek-step { text-align: center; padding: 0 1.5rem; }
  .ek-step-num {
    width: 72px; height: 72px; border-radius: 50%;
    background: var(--grad); color: var(--white);
    font-family: 'Syne', sans-serif; font-size: 1.3rem; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 1.75rem; position: relative; z-index: 1;
    box-shadow: 0 8px 24px rgba(30,58,138,.3);
  }
  .ek-step h3 {
    font-family: 'Syne', sans-serif; font-size: 1.05rem; font-weight: 700;
    color: var(--navy); margin-bottom: .6rem;
  }
  .ek-step p { color: var(--gray); font-size: .9rem; line-height: 1.6; }

  /* ── Demo ── */
  .ek-demo { background: var(--dark); }
  .ek-demo-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; }
  .ek-demo-text .section-label { color: var(--amber); }
  .ek-demo-text .section-title { color: var(--white); }
  .ek-demo-text p { color: rgba(255,255,255,.65); margin-top: 1rem; line-height: 1.7; }
  .ek-demo-features { margin-top: 2rem; display: flex; flex-direction: column; gap: .75rem; }
  .ek-demo-feat {
    display: flex; align-items: center; gap: .75rem;
    color: rgba(255,255,255,.8); font-size: .95rem;
  }
  .ek-demo-feat::before {
    content: ''; flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
    background: var(--amber); display: flex; align-items: center; justify-content: center;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='white' d='M13.5 2.5l-8 8-3-3-1 1 4 4 9-9z'/%3E%3C/svg%3E");
    background-size: 12px; background-repeat: no-repeat; background-position: center;
  }
  .ek-video-box {
    background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
    border-radius: 24px; padding: 1.5rem; aspect-ratio: 16/10;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .ek-video-box::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(30,58,138,.3) 0%, rgba(37,99,235,.1) 100%);
  }
  .ek-play-btn {
    width: 80px; height: 80px; border-radius: 50%;
    background: var(--amber); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    position: relative; z-index: 1;
    transition: transform .3s, box-shadow .3s;
  }
  .ek-play-btn:hover { transform: scale(1.1); box-shadow: 0 0 40px rgba(245,158,11,.5); }
  .ek-play-btn::after { content: '▶'; font-size: 1.6rem; color: var(--white); margin-left: 4px; }
  .ek-play-ring {
    position: absolute; width: 120px; height: 120px; border-radius: 50%;
    border: 2px solid rgba(245,158,11,.3); animation: ring-pulse 2s ease-in-out infinite;
    z-index: 0;
  }
  .ek-play-ring-2 {
    position: absolute; width: 160px; height: 160px; border-radius: 50%;
    border: 2px solid rgba(245,158,11,.15); animation: ring-pulse 2s ease-in-out .5s infinite;
  }
  @keyframes ring-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.15); opacity: 0; }
  }
  .ek-video-label { margin-top: 1.25rem; color: rgba(255,255,255,.55); font-size: .85rem; position: relative; z-index: 1; }

  /* ── CTA ── */
  .ek-cta { background: var(--grad); text-align: center; padding: 6rem 0; }
  .ek-cta-pill {
    display: inline-block; padding: .4rem 1.2rem; border-radius: 50px;
    background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25);
    color: rgba(255,255,255,.85); font-size: .8rem; font-weight: 500; letter-spacing: .1em;
    text-transform: uppercase; margin-bottom: 1.5rem;
  }
  .ek-cta h2 {
    font-family: 'Syne', sans-serif; font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800; color: var(--white); margin-bottom: 1rem; letter-spacing: -.02em;
  }
  .ek-cta p { color: rgba(255,255,255,.7); font-size: 1.1rem; margin-bottom: 2.5rem; }
  .ek-cta-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

  /* ── Footer ── */
  .ek-footer { background: #080d1a; padding: 4rem 0 2rem; }
  .ek-footer-grid {
    display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 3rem;
    padding-bottom: 3rem; border-bottom: 1px solid rgba(255,255,255,.08);
  }
  .ek-footer-brand .ek-logo { color: var(--white); display: inline-block; margin-bottom: 1rem; }
  .ek-footer-brand p { color: rgba(255,255,255,.5); font-size: .9rem; line-height: 1.65; }
  .ek-footer-col h4 {
    font-family: 'Syne', sans-serif; font-size: .9rem; font-weight: 700;
    color: var(--amber); letter-spacing: .05em; margin-bottom: 1.25rem;
  }
  .ek-footer-col a {
    display: block; color: rgba(255,255,255,.5); text-decoration: none;
    font-size: .9rem; margin-bottom: .6rem; transition: color .3s;
  }
  .ek-footer-col a:hover { color: var(--white); }
  .ek-footer-bottom {
    display: flex; justify-content: space-between; align-items: center;
    padding-top: 2rem; color: rgba(255,255,255,.3); font-size: .85rem;
  }
  .ek-socials { display: flex; gap: .75rem; }
  .ek-social {
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1);
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,.6); text-decoration: none; font-size: 1.1rem;
    transition: background .3s, transform .3s;
  }
  .ek-social:hover { background: var(--sky); transform: translateY(-3px); }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .ek-feat-grid { grid-template-columns: repeat(2, 1fr); }
    .ek-footer-grid { grid-template-columns: 1fr 1fr; }
    .ek-demo-inner { grid-template-columns: 1fr; }
  }
  @media (max-width: 768px) {
    .ek-hero .container { grid-template-columns: 1fr; padding-top: 6rem; gap: 3rem; }
    .ek-feat-grid { grid-template-columns: 1fr; }
    .ek-stats-inner { grid-template-columns: 1fr 1fr; }
    .ek-steps { grid-template-columns: 1fr 1fr; gap: 2rem; }
    .ek-steps::before { display: none; }
    .ek-footer-grid { grid-template-columns: 1fr 1fr; }
    .ek-nav-links { display: none; }
  }
`;

// ─── Component ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [loaded, setLoaded] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [slide, setSlide] = useState(0);

  // GSAP refs
  const heroRef    = useRef(null);
  const h1Ref      = useRef(null);
  const heroSubRef = useRef(null);
  const heroCTARef = useRef(null);
  const heroTrustRef = useRef(null);
  const carouselRef = useRef(null);
  const featRef    = useRef(null);
  const statsRef   = useRef(null);
  const hiwRef     = useRef(null);
  const demoRef    = useRef(null);
  const ctaRef     = useRef(null);

  // ── Loader
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1000);
    return () => clearTimeout(t);
  }, []);

  // ── Scroll nav
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── GSAP Animations
  useEffect(() => {
    if (!loaded) return;

    // Hero entrance
    const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
    heroTl
      .from(h1Ref.current, { y: 60, opacity: 0, duration: 1, delay: .1 })
      .from(heroSubRef.current, { y: 40, opacity: 0, duration: .9 }, "-=.7")
      .from(heroCTARef.current, { y: 30, opacity: 0, duration: .8 }, "-=.7")
      .from(heroTrustRef.current, { y: 20, opacity: 0, duration: .7 }, "-=.6")
      .from(carouselRef.current, { x: 60, opacity: 0, duration: 1 }, "-=1.2");

    // Orbs float
    gsap.to(".ek-orb-1", { y: -30, duration: 8, yoyo: true, repeat: -1, ease: "sine.inOut" });
    gsap.to(".ek-orb-2", { y: 20, duration: 10, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 1 });
    gsap.to(".ek-orb-3", { y: -20, x: 20, duration: 7, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 2 });

    // Feature cards
    gsap.from(".ek-feat-card", {
      scrollTrigger: { trigger: featRef.current, start: "top 75%", toggleActions: "play none none none" },
      y: 60, opacity: 0, duration: .7, stagger: .12, ease: "power3.out"
    });
    gsap.from(".ek-feat-header > *", {
      scrollTrigger: { trigger: featRef.current, start: "top 80%" },
      y: 30, opacity: 0, duration: .7, stagger: .12, ease: "power3.out"
    });

    // Stats counter
    gsap.from(".ek-stat-item", {
      scrollTrigger: { trigger: statsRef.current, start: "top 80%" },
      y: 40, opacity: 0, duration: .6, stagger: .15, ease: "power2.out"
    });

    // Steps
    gsap.from(".ek-step", {
      scrollTrigger: { trigger: hiwRef.current, start: "top 80%" },
      y: 50, opacity: 0, duration: .7, stagger: .15, ease: "power3.out"
    });

    // Demo section
    gsap.from(".ek-demo-text > *", {
      scrollTrigger: { trigger: demoRef.current, start: "top 80%" },
      x: -50, opacity: 0, duration: .8, stagger: .12, ease: "power3.out"
    });
    gsap.from(".ek-video-box", {
      scrollTrigger: { trigger: demoRef.current, start: "top 80%" },
      x: 50, opacity: 0, duration: .8, ease: "power3.out"
    });

    // CTA
    gsap.from(".ek-cta > .container > *", {
      scrollTrigger: { trigger: ctaRef.current, start: "top 85%" },
      y: 40, opacity: 0, duration: .7, stagger: .12, ease: "power2.out"
    });

    return () => ScrollTrigger.getAll().forEach(t => t.kill());
  }, [loaded]);

  // ── Carousel
  const nextSlide = () => setSlide(s => (s + 1) % SLIDES.length);
  const prevSlide = () => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length);

  // ── Auto advance
  useEffect(() => {
    const id = setInterval(nextSlide, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Smooth scroll
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <style>{css}</style>

      {/* Loader */}
      <div className={`ek-loader${loaded ? " hidden" : ""}`}>
        <div className="ek-loader-ring" />
      </div>

      {/* Nav */}
      <nav className={`ek-nav${navScrolled ? " scrolled" : ""}`}>
        <div className="inner">
          <a href="#" className="ek-logo">Ekalavya</a>
          <ul className="ek-nav-links">
            {["home","features","how-it-works","demo","contact"].map(id => (
              <li key={id}>
                <a href={`#${id}`} onClick={e => { e.preventDefault(); scrollTo(id); }}>
                  {id.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
                </a>
              </li>
            ))}
          </ul>
          <a href="#features" className="ek-nav-cta" onClick={e=>{ e.preventDefault(); scrollTo("features"); }}>
            Get Started →
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="ek-hero" id="home" ref={heroRef}>
        <div className="ek-hero-bg">
          <div className="ek-orb ek-orb-1" />
          <div className="ek-orb ek-orb-2" />
          <div className="ek-orb ek-orb-3" />
          <div className="ek-hero-grid" />
        </div>

        <div className="container">
          <div className="ek-hero-content">
            <div className="ek-hero-eyebrow"><span />UPSC Preparation Platform</div>
            <h1 ref={h1Ref}>
              Smart Notes for<br /><em>UPSC Success</em>
            </h1>
            <p ref={heroSubRef} className="ek-hero-sub">
              Transform your handwritten notes with AI, share knowledge with fellow aspirants, and build your path to success — together.
            </p>
            <div ref={heroCTARef} className="ek-hero-ctas">
              <a href="#demo" className="btn btn-primary" onClick={e=>{ e.preventDefault(); scrollTo("demo"); }}>
                ▶ Watch Demo
              </a>
              <a href="#features" className="btn btn-outline" onClick={e=>{ e.preventDefault(); scrollTo("features"); }}>
                Explore Features
              </a>
            </div>
            <div ref={heroTrustRef} className="ek-hero-trust">
              <div className="ek-avatars">
                {["👤","🧑‍💻","👩‍🎓","👨‍🏫"].map((a,i) => (
                  <div className="ek-avatar" key={i}>{a}</div>
                ))}
              </div>
              <p className="ek-trust-text">
                <strong>10,000+ aspirants</strong><br />already transforming their prep
              </p>
            </div>
          </div>

          {/* Carousel */}
          <div className="ek-carousel-wrap" ref={carouselRef}>
            <div className="ek-carousel-card">
              {SLIDES.map((s, i) => (
                <div key={i} className={`ek-slide${i === slide ? " active" : ""}`}>
                  <div className="ek-slide-icon">{s.icon}</div>
                  <h3 className="ek-slide-title">{s.title}</h3>
                  <p className="ek-slide-desc">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="ek-carousel-nav">
              <div className="ek-carousel-dots">
                {SLIDES.map((_, i) => (
                  <button key={i} className={`ek-dot${i === slide ? " active" : ""}`} onClick={() => setSlide(i)} />
                ))}
              </div>
              <div className="ek-carousel-arrows">
                <button className="ek-arrow" onClick={prevSlide}>‹</button>
                <button className="ek-arrow" onClick={nextSlide}>›</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section ek-features" id="features" ref={featRef}>
        <div className="container">
          <div className="ek-feat-header">
            <p className="section-label">What We Offer</p>
            <h2 className="section-title">Powerful Features for<br />UPSC Aspirants</h2>
          </div>
          <div className="ek-feat-grid">
            {FEATURES.map((f, i) => (
              <div className="ek-feat-card" key={i}>
                <div className="ek-feat-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="section ek-stats" ref={statsRef}>
        <div className="container">
          <div className="ek-stats-inner">
            {STATS.map((s, i) => (
              <div className="ek-stat-item" key={i}>
                <div className="ek-stat-num">{s.value}</div>
                <div className="ek-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="section ek-hiw" id="how-it-works" ref={hiwRef}>
        <div className="container">
          <div className="ek-hiw-header">
            <p className="section-label">Simple Process</p>
            <h2 className="section-title">How Ekalavya Works</h2>
          </div>
          <div className="ek-steps">
            {STEPS.map((s, i) => (
              <div className="ek-step" key={i}>
                <div className="ek-step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo ── */}
      <section className="section ek-demo" id="demo" ref={demoRef}>
        <div className="container">
          <div className="ek-demo-inner">
            <div className="ek-demo-text">
              <p className="section-label">Live Demo</p>
              <h2 className="section-title">See Ekalavya in Action</h2>
              <p>Watch how our AI transforms handwritten notes into powerful digital resources in seconds.</p>
              <div className="ek-demo-features">
                {["Real-time handwriting recognition", "Instant mind map generation", "One-click community sharing", "AI-powered content suggestions"].map((f, i) => (
                  <div className="ek-demo-feat" key={i}>{f}</div>
                ))}
              </div>
            </div>
            <div className="ek-video-box">
              <div className="ek-play-ring-2" />
              <div className="ek-play-ring" />
              <button className="ek-play-btn" onClick={() => alert("Demo video coming soon!")} />
              <p className="ek-video-label">Click to watch the full demo</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="ek-cta" ref={ctaRef}>
        <div className="container">
          <div className="ek-cta-pill">Start Free Today</div>
          <h2>Ready to Transform Your<br />UPSC Preparation?</h2>
          <p>Join thousands of aspirants already using Ekalavya to accelerate their success.</p>
          <div className="ek-cta-btns">
            <a href="#" className="btn btn-primary">Get Started Free →</a>
            <a href="#features" className="btn btn-outline" onClick={e=>{ e.preventDefault(); scrollTo("features"); }}>
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="ek-footer" id="contact">
        <div className="container">
          <div className="ek-footer-grid">
            <div className="ek-footer-brand">
              <a href="#" className="ek-logo">Ekalavya</a>
              <p>Empowering UPSC aspirants with smart note-sharing technology and collaborative learning tools.</p>
              <div className="ek-socials" style={{ marginTop: "1.25rem" }}>
                {["📘","🐦","💼","📸"].map((s,i) => (
                  <a href="#" className="ek-social" key={i}>{s}</a>
                ))}
              </div>
            </div>
            <div className="ek-footer-col">
              <h4>Product</h4>
              {["Features","How It Works","Demo","Pricing"].map(l => (
                <a href="#" key={l}>{l}</a>
              ))}
            </div>
            <div className="ek-footer-col">
              <h4>Support</h4>
              {["Help Center","Contact Us","Privacy Policy","Terms of Service"].map(l => (
                <a href="#" key={l}>{l}</a>
              ))}
            </div>
            <div className="ek-footer-col">
              <h4>Connect</h4>
              <a href="#">hello@ekalavya.com</a>
              <a href="#">+91 98765 43210</a>
            </div>
          </div>
          <div className="ek-footer-bottom">
            <span>© 2025 Ekalavya. All rights reserved.</span>
            <span>Built with ❤️ for UPSC aspirants</span>
          </div>
        </div>
      </footer>
    </>
  );
}