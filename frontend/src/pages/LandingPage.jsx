import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import "./LandingPage.css";

gsap.registerPlugin(ScrollTrigger);

/* ── Content data ────────────────────────────────────────────────────────── */
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
const LETTERS = "EKALAVYA".split("");

/* ── Fire-burn canvas helper ─────────────────────────────────────────────── */
function runFireBurn(canvas, onDone) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = "#0b0f1a";
  ctx.fillRect(0, 0, W, H);

  const imgData = ctx.getImageData(0, 0, W, H);
  const data    = imgData.data;
  const dist    = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      dist[y * W + x] = Math.min(x, y, W - 1 - x, H - 1 - y);

  const maxDist  = Math.min(W, H) / 2 + 10;
  const DURATION = 750;
  const ZONE     = 28;
  let   start    = null;

  function frame(ts) {
    if (!start) start = ts;
    const prog      = Math.min((ts - start) / DURATION, 1);
    const burnFront = prog * (maxDist + 40);

    for (let i = 0; i < W * H; i++) {
      const d = dist[i], idx = i * 4;
      if (d > burnFront + ZONE) {
        data[idx] = 11; data[idx+1] = 15; data[idx+2] = 26; data[idx+3] = 255;
      } else if (d > burnFront) {
        const t = 1 - (d - burnFront) / ZONE;
        data[idx]   = Math.round(48  + 207 * t * t);
        data[idx+1] = Math.round(103 + 152 * t * t);
        data[idx+2] = 205;
        data[idx+3] = Math.round(255 * (1 - t));
      } else {
        data[idx+3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    if (prog < 1) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, W, H); onDone && onDone(); }
  }
  requestAnimationFrame(frame);
}

/* ── Three.js scene builder ──────────────────────────────────────────────── */
function buildThreeScene(canvas) {
  const W = window.innerWidth, H = window.innerHeight;

  /* Renderer */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);

  /* Scene + camera */
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 2000);
  camera.position.set(0, 0, 80);

  /* ── Constellation particle field ── */
  const PARTICLE_COUNT = 10000;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors    = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Spread deeply in Z — camera will fly through
    positions[i * 3]     = (Math.random() - 0.5) * 280;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 180;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1600 - 200;

    // Blue-white colour variation
    const tone = 0.4 + Math.random() * 0.6;
    colors[i * 3]     = tone * 0.55;  // R
    colors[i * 3 + 1] = tone * 0.72;  // G
    colors[i * 3 + 2] = tone * 1.0;   // B
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));

  const pMat = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ── Bow string ── */
  // A graceful arc in front of camera — QuadraticBezierCurve3
  const bowCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-55, -18, 30),   // left end
    new THREE.Vector3(0,   42, 30),    // apex (top)
    new THREE.Vector3( 55, -18, 30),   // right end
  );
  const bowPoints   = bowCurve.getPoints(120);
  const bowGeo      = new THREE.BufferGeometry().setFromPoints(bowPoints);
  const bowMat      = new THREE.LineBasicMaterial({
    color: 0x5590ff,
    transparent: true,
    opacity: 0.0, // fades in after intro
    linewidth: 1,
  });
  const bow = new THREE.Line(bowGeo, bowMat);
  scene.add(bow);

  /* Bow glow — a second slightly thicker line, lower opacity */
  const glowMat = new THREE.LineBasicMaterial({
    color: 0x3067cd,
    transparent: true,
    opacity: 0.0,
    linewidth: 2,
  });
  const bowGlow = new THREE.Line(bowGeo, glowMat);
  bowGlow.scale.set(1.008, 1.008, 1);
  scene.add(bowGlow);

  /* ── String (vertical line pulled taut) ── */
  // Taut string from left end to right end through the bow's "notch"
  const strCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-55, -18, 30),
    new THREE.Vector3(0,  -20, 30),   // slight sag — physics feel
    new THREE.Vector3( 55, -18, 30),
  );
  const strPoints = strCurve.getPoints(80);
  const strGeo    = new THREE.BufferGeometry().setFromPoints(strPoints);
  const strMat    = new THREE.LineBasicMaterial({
    color: 0xa0c4ff,
    transparent: true,
    opacity: 0.0,
    linewidth: 1,
  });
  const string = new THREE.Line(strGeo, strMat);
  scene.add(string);

  /* ── Handle bow vibration ── */
  let vibTime = 0;
  let vibrating = false;
  let vibAmp = 0;

  function triggerVibrate() {
    vibrating = true;
    vibAmp    = 1;
    vibTime   = 0;
  }

  /* ── Camera dolly state ── */
  const camTarget = { z: 80, x: 0, y: 0 };

  /* ── Render loop ── */
  let rafId;
  let clock = new THREE.Clock();

  function animate() {
    rafId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Slow camera drift forward (constant gentle pull)
    camera.position.z += (camTarget.z - camera.position.z) * 0.04;
    camera.position.x += (camTarget.x - camera.position.x) * 0.04;
    camera.position.y += (camTarget.y - camera.position.y) * 0.04;

    // Gentle particle rotation
    particles.rotation.y = elapsed * 0.012;
    particles.rotation.x = elapsed * 0.005;

    // Bow vibration
    if (vibrating) {
      vibTime += 0.18;
      vibAmp  *= 0.88;
      const sag = -20 + Math.sin(vibTime * 12) * 4 * vibAmp;
      const pts = strCurve.getPoints(80);
      // Modulate mid-point Y
      for (let i = 20; i < 60; i++) {
        pts[i].y += Math.sin((i - 20) / 40 * Math.PI) * Math.sin(vibTime * 14) * 2.5 * vibAmp;
      }
      strGeo.setFromPoints(pts);
      if (vibAmp < 0.02) { vibrating = false; vibAmp = 0; }
    }

    renderer.render(scene, camera);
  }
  animate();

  /* ── Resize handler ── */
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize, { passive: true });

  /* ── Mouse parallax ── */
  function onMouseMove(e) {
    const nx = (e.clientX / window.innerWidth  - 0.5);
    const ny = (e.clientY / window.innerHeight - 0.5);
    camTarget.x = nx * 12;
    camTarget.y = -ny * 8;
  }
  window.addEventListener("mousemove", onMouseMove, { passive: true });

  /* ── Public API ── */
  return {
    renderer,
    camera,
    bow,
    bowGlow,
    string,
    bowMat,
    glowMat,
    strMat,
    camTarget,
    triggerVibrate,
    dispose() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
      pGeo.dispose(); pMat.dispose();
      bowGeo.dispose(); bowMat.dispose();
      glowMat.dispose(); strMat.dispose();
    },
  };
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [introOver,    setIntroOver]    = useState(false);
  const [navScrolled,  setNavScrolled]  = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [threeReady,   setThreeReady]   = useState(false);

  /* intro refs */
  const overlayRef    = useRef(null);
  const fireCanvas    = useRef(null);
  const dropArrowRef  = useRef(null);
  const sweepArrowRef = useRef(null);
  const letterRefs    = useRef([]);

  /* three.js refs */
  const threeCanvas   = useRef(null);
  const threeScene    = useRef(null);

  /* section refs */
  const featRef  = useRef(null);
  const statsRef = useRef(null);
  const hiwRef   = useRef(null);
  const loreRef  = useRef(null);
  const ctaRef   = useRef(null);
  const heroRef  = useRef(null);

  /* ── Build Three.js scene immediately (before intro ends) ── */
  useEffect(() => {
    if (!threeCanvas.current) return;
    const scene = buildThreeScene(threeCanvas.current);
    threeScene.current = scene;
    setThreeReady(true);
    return () => scene.dispose();
  }, []);

  /* ── Intro sequence ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!threeReady) return;

    const canvas  = fireCanvas.current;
    const overlay = overlayRef.current;
    const vw = window.innerWidth, vh = window.innerHeight;

    canvas.width  = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0, 0, vw, vh);

    const tl = gsap.timeline({ defaults: { ease: "none" } });

    /* 0.0s — arrow drops */
    tl.set(dropArrowRef.current, { x: vw / 2 - 14, y: -80, opacity: 1 });
    tl.to(dropArrowRef.current, { y: vh - 40, duration: 0.36, ease: "power3.in" });

    /* 0.36s — impact flash */
    tl.to(dropArrowRef.current, { opacity: 0, scale: 2.5, duration: 0.1, ease: "power2.out" });

    /* 0.40s — fire burns */
    tl.add(() => { runFireBurn(canvas, () => {}); }, "-=0.06");

    /* 1.15s — overlay fades, Three.js scene beneath is revealed */
    tl.to(overlay, { opacity: 0, duration: 0.15 }, "+=0.72");
    tl.add(() => {
      overlay.style.pointerEvents = "none";
      setIntroOver(true);

      /* Fade in bow + string */
      const { bowMat, glowMat, strMat, triggerVibrate } = threeScene.current;
      gsap.to(bowMat,  { opacity: 0.75, duration: 0.6, ease: "power2.out" });
      gsap.to(glowMat, { opacity: 0.3,  duration: 0.8, ease: "power2.out" });
      gsap.to(strMat,  { opacity: 0.55, duration: 0.7, ease: "power2.out",
        onComplete: () => triggerVibrate() // string vibrates as it snaps into view
      });
    });

    /* 1.3s — sweep arrow + title reveal */
    tl.set(sweepArrowRef.current, { x: -120, y: vh / 2 - 14, opacity: 1 });
    tl.to(sweepArrowRef.current, { x: vw + 120, duration: 0.52, ease: "power2.inOut" }, "+=0.05");
    tl.fromTo(
      letterRefs.current,
      { clipPath: "inset(0 100% 0 0)" },
      { clipPath: "inset(0 0% 0 0)", duration: 0.065, stagger: 0.058, ease: "none" },
      "<"
    );
    tl.set(sweepArrowRef.current, { opacity: 0 });

    /* Hero sub-content */
    tl.fromTo(".lp-hero-sub-anim",
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.48, stagger: 0.1, ease: "power3.out" },
      "+=0.06"
    );

    return () => tl.kill();
  // eslint-disable-next-line
  }, [threeReady]);

  /* ── Scroll: camera flies forward through constellation ──────────────── */
  useEffect(() => {
    if (!introOver || !threeScene.current) return;
    const { camera, bowMat, glowMat, strMat } = threeScene.current;

    // As user scrolls, camera accelerates forward (z goes from 80 → -600)
    ScrollTrigger.create({
      trigger: ".lp-root",
      start: "top top",
      end: "bottom bottom",
      scrub: 2,
      onUpdate: (self) => {
        const prog = self.progress;
        threeScene.current.camTarget.z = 80 - prog * 680;

        // Bow fades out as user scrolls past hero
        const bowOpacity = Math.max(0, 1 - prog * 6);
        bowMat.opacity  = 0.75 * bowOpacity;
        glowMat.opacity = 0.3  * bowOpacity;
        strMat.opacity  = 0.55 * bowOpacity;
      },
    });

    return () => ScrollTrigger.getAll().forEach(t => t.kill());
  }, [introOver]);

  /* ── Section scroll animations ───────────────────────────────────────── */
  useEffect(() => {
    if (!introOver) return;

    /* NAV */
    gsap.fromTo(".lp-nav",
      { y: -60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, ease: "power3.out", delay: 0.1 }
    );

    /* Features — flip in like dominoes */
    gsap.from(".lp-feat-card", {
      scrollTrigger: { trigger: featRef.current, start: "top 80%" },
      y: 70, rotateX: 30, opacity: 0,
      duration: 0.58, stagger: { amount: 0.45 },
      ease: "back.out(1.5)", transformOrigin: "top center",
    });

    /* Stats — slam from 4 directions */
    const dirs = [{ x:-90,y:0 },{ x:0,y:-80 },{ x:0,y:80 },{ x:90,y:0 }];
    document.querySelectorAll(".lp-stat-item").forEach((el, i) => {
      gsap.from(el, {
        scrollTrigger: { trigger: statsRef.current, start: "top 82%" },
        ...dirs[i], opacity: 0,
        duration: 0.52, delay: i * 0.09, ease: "power4.out",
      });
    });

    /* Steps — connector draws, then items pop up */
    gsap.from(".lp-step-connector", {
      scrollTrigger: { trigger: hiwRef.current, start: "top 78%" },
      scaleX: 0, duration: 0.85, ease: "power2.inOut", transformOrigin: "left",
    });
    gsap.from(".lp-step", {
      scrollTrigger: { trigger: hiwRef.current, start: "top 78%" },
      scale: 0.65, opacity: 0, duration: 0.48,
      stagger: 0.12, ease: "back.out(2.2)", delay: 0.28,
    });

    /* Lore — slide from opposite sides */
    gsap.from(".lp-lore-text-side > *", {
      scrollTrigger: { trigger: loreRef.current, start: "top 80%" },
      x: -55, opacity: 0, duration: 0.6, stagger: 0.1, ease: "power3.out",
    });
    gsap.from(".lp-lore-visual-side", {
      scrollTrigger: { trigger: loreRef.current, start: "top 80%" },
      x: 70, rotate: 5, opacity: 0, duration: 0.75, ease: "power3.out", delay: 0.15,
    });

    /* CTA — scale bounce */
    gsap.from(".lp-cta-inner > *", {
      scrollTrigger: { trigger: ctaRef.current, start: "top 84%" },
      scale: 0.78, opacity: 0, duration: 0.58,
      stagger: 0.1, ease: "back.out(1.9)",
    });

    return () => ScrollTrigger.getAll().forEach(t => t.kill());
  }, [introOver]);

  /* ── Nav scroll listener ─────────────────────────────────────────────── */
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
    <>
      {/* ══ THREE.JS CANVAS (fixed behind everything) ══ */}
      <canvas ref={threeCanvas} className="lp-three-canvas" />

      {/* ══ INTRO OVERLAY ══ */}
      <div ref={overlayRef} className="lp-overlay">
        <canvas ref={fireCanvas} className="lp-fire-canvas" />
      </div>

      {/* Drop arrow */}
      <div ref={dropArrowRef} className="lp-drop-arrow" style={{ opacity: 0 }}>
        <svg width="28" height="80" viewBox="0 0 28 80" fill="none">
          <defs>
            <linearGradient id="lp-dt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#5590ff" stopOpacity="0"/>
              <stop offset="100%" stopColor="#5590ff" stopOpacity="0.9"/>
            </linearGradient>
          </defs>
          <line x1="14" y1="0"  x2="14" y2="36" stroke="url(#lp-dt)" strokeWidth="7" strokeLinecap="round"/>
          <line x1="14" y1="4"  x2="14" y2="60" stroke="#5590ff" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M5 52 L14 70 L23 52"          stroke="#5590ff" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
          <path d="M10 4 L14 14 L18 4"           stroke="#a0bfff" strokeWidth="2"   fill="none"/>
        </svg>
      </div>

      {/* Sweep arrow */}
      <div ref={sweepArrowRef} className="lp-sweep-arrow" style={{ opacity: 0 }}>
        <svg width="100" height="28" viewBox="0 0 100 28" fill="none">
          <defs>
            <linearGradient id="lp-st" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#5590ff" stopOpacity="0"/>
              <stop offset="100%" stopColor="#5590ff" stopOpacity="0.9"/>
            </linearGradient>
          </defs>
          <line x1="0" y1="14" x2="58" y2="14" stroke="url(#lp-st)" strokeWidth="7" strokeLinecap="round"/>
          <line x1="4" y1="14" x2="80" y2="14" stroke="#5590ff"      strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M68 5 L88 14 L68 23"          stroke="#5590ff"     strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
          <path d="M4 10 L14 14 L4 18"           stroke="#a0bfff"     strokeWidth="2"   fill="none"/>
        </svg>
      </div>

      {/* ══ PAGE ══ */}
      <div className="lp-root">

        {/* NAV */}
        <nav className={`lp-nav${navScrolled ? " lp-scrolled" : ""}`}>
          <div className="lp-nav-inner">
            <a href="#" className="lp-nav-logo">Ekalavya</a>
            <ul className="lp-nav-links">
              {[["features","Features"],["how-it-works","How It Works"],["story","Our Story"],["contact","Contact"]].map(([id,lbl]) => (
                <li key={id}><a href={`#${id}`} onClick={e => { e.preventDefault(); scrollTo(id); }}>{lbl}</a></li>
              ))}
            </ul>
            <a className="lp-nav-cta" href="#features" onClick={e => { e.preventDefault(); scrollTo("features"); }}>
              Start Free →
            </a>
            <button
              className={`lp-hamburger${menuOpen ? " lp-open" : ""}`}
              onClick={() => setMenuOpen(m => !m)}
              aria-label="Toggle menu"
            >
              <span/><span/><span/>
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <div className={`lp-mobile-menu${menuOpen ? " lp-open" : ""}`}>
          {[["features","Features"],["how-it-works","How It Works"],["story","Our Story"],["contact","Contact"]].map(([id,lbl]) => (
            <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); scrollTo(id); }}>{lbl}</a>
          ))}
        </div>

        {/* ── HERO ── */}
        <section className="lp-hero" id="home" ref={heroRef}>
          <div className="lp-hero-center">

            {/* EKALAVYA — letter clip-reveal */}
            <div className="lp-hero-title-row">
              {LETTERS.map((ch, i) => (
                <span
                  key={i}
                  className="lp-title-letter-wrap"
                  ref={el => { letterRefs.current[i] = el; }}
                  style={{ clipPath: "inset(0 100% 0 0)" }}
                >
                  <span className="lp-title-letter">{ch}</span>
                </span>
              ))}
            </div>

            <p className="lp-hero-tagline lp-hero-sub-anim">
              Learn alone. Rise <em>together.</em>
            </p>

            <p className="lp-hero-sub lp-hero-sub-anim">
              Like Ekalavya, who mastered archery through sheer devotion — we give every aspirant
              the AI tools, community, and mentorship to conquer UPSC on their own terms.
            </p>

            <div className="lp-hero-ctas lp-hero-sub-anim">
              <a href="#features" className="lp-btn lp-btn-primary"
                onClick={e => { e.preventDefault(); scrollTo("features"); }}>
                Explore Platform →
              </a>
              <a href="#story" className="lp-btn lp-btn-ghost"
                onClick={e => { e.preventDefault(); scrollTo("story"); }}>
                Our Story
              </a>
            </div>

            <div className="lp-hero-trust lp-hero-sub-anim">
              <span><strong>10,000+</strong> aspirants</span>
              <span className="lp-trust-sep"/>
              <span><strong>50K+</strong> notes digitized</span>
              <span className="lp-trust-sep"/>
              <span><strong>95%</strong> AI accuracy</span>
            </div>
          </div>

          <div className="lp-scroll-hint">
            <div className="lp-scroll-line"/>
            <span>scroll</span>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="lp-section lp-bg-mid" id="features" ref={featRef}>
          <div className="lp-container">
            <div className="lp-section-head">
              <div className="lp-section-tag">What We Offer</div>
              <h2 className="lp-section-title">Built for the <em>dedicated</em></h2>
            </div>
            <div className="lp-feat-grid">
              {FEATURES.map((f, i) => (
                <div className="lp-feat-card" key={i}>
                  <div className="lp-feat-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="lp-stats-section" ref={statsRef}>
          <div className="lp-container">
            <div className="lp-stats-grid">
              {STATS.map((s, i) => (
                <div className="lp-stat-item" key={i}>
                  <div className="lp-stat-num">{s.value}</div>
                  <div className="lp-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="lp-section lp-bg-mid" id="how-it-works" ref={hiwRef}>
          <div className="lp-container">
            <div className="lp-section-head">
              <div className="lp-section-tag">Simple Process</div>
              <h2 className="lp-section-title">Four steps to <em>mastery</em></h2>
            </div>
            <div className="lp-steps-wrap">
              <div className="lp-step-connector"/>
              {STEPS.map((s, i) => (
                <div className="lp-step" key={i}>
                  <div className="lp-step-num">{s.n}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LORE / STORY ── */}
        <section className="lp-section lp-bg-dark" id="story" ref={loreRef}>
          <div className="lp-container">
            <div className="lp-lore-inner">
              <div className="lp-lore-text-side">
                <div className="lp-section-tag">Our Namesake</div>
                <h2 className="lp-section-title" style={{ marginTop: "0.8rem" }}>
                  The legend of<br/><em>Ekalavya</em>
                </h2>
                <p className="lp-lore-body">
                  In the Mahabharata, Ekalavya — denied formal training — fashioned a clay statue
                  of Dronacharya and taught himself archery through devotion alone, becoming one of
                  history's greatest archers.
                </p>
                <p className="lp-lore-body">
                  We built this platform for every aspirant who refuses to let circumstance define
                  their ceiling. The tools are here. The community is here. The devotion? That's yours.
                </p>
                <a href="#features" className="lp-btn lp-btn-primary" style={{ marginTop: "0.5rem" }}
                  onClick={e => { e.preventDefault(); scrollTo("features"); }}>
                  Begin Your Journey →
                </a>
              </div>
              <div className="lp-lore-visual-side">
                <div className="lp-lore-thumb-ghost">
                  <svg width="260" height="290" viewBox="0 0 300 320" opacity="0.07">
                    {Array.from({ length: 14 }, (_, i) => {
                      const r = 28 + i * 9, cx = 150, cy = 160, rx = r * 0.72;
                      return (
                        <path key={i} fill="none" stroke="#3067cd" strokeWidth="2"
                          d={`M${cx-rx} ${cy} A${rx} ${r} 0 1 1 ${cx+rx} ${cy} A${rx} ${r} 0 1 1 ${cx-rx} ${cy}`}
                        />
                      );
                    })}
                  </svg>
                </div>
                <div className="lp-lore-quote-card">
                  <span className="lp-quote-mark">"</span>
                  <p className="lp-quote-text">
                    He had no guru physically present — yet he mastered what even the finest
                    students couldn't. That is the power of devotion over privilege.
                  </p>
                  <span className="lp-quote-attr">— Inspired by the Mahabharata</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lp-cta-section" ref={ctaRef}>
          <div className="lp-container">
            <div className="lp-cta-inner">
              <div className="lp-section-tag">Start Today</div>
              <h2 className="lp-cta-title">Your devotion.<br/>Our <em>platform.</em></h2>
              <p className="lp-cta-sub">
                Join thousands already using Ekalavya to turn relentless dedication into results.
              </p>
              <div className="lp-cta-btns">
                <a href="#" className="lp-btn lp-btn-primary">Get Started Free →</a>
                <a href="#features" className="lp-btn lp-btn-ghost"
                  onClick={e => { e.preventDefault(); scrollTo("features"); }}>
                  Explore Features
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="lp-footer" id="contact">
          <div className="lp-container">
            <div className="lp-footer-grid">
              <div className="lp-footer-brand">
                <span className="lp-footer-logo">Ekalavya</span>
                <p>Empowering UPSC aspirants with AI-powered note sharing and collaborative learning.</p>
              </div>
              <div className="lp-footer-col">
                <h4>Product</h4>
                {["Features","How It Works","Community","Pricing"].map(l => <a href="#" key={l}>{l}</a>)}
              </div>
              <div className="lp-footer-col">
                <h4>Support</h4>
                {["Help Center","Contact","Privacy Policy","Terms"].map(l => <a href="#" key={l}>{l}</a>)}
              </div>
              <div className="lp-footer-col">
                <h4>Connect</h4>
                <a href="#">hello@ekalavya.in</a>
                <a href="#">+91 97893 92106</a>
              </div>
            </div>
            <div className="lp-footer-bottom">
              <span>© 2025 Ekalavya. All rights reserved.</span>
              <span>Built with devotion for every aspirant.</span>
            </div>
          </div>
        </footer>

      </div>{/* end .lp-root */}
    </>
  );
}
