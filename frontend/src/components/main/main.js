import React, { useEffect, useRef, useState, useCallback } from 'react';
import './main.css';

// ── 42 Expert Roles (Updated for Cognitive Filtering) ──────────
const AGENT_ROLES = [
  { id: 'DATA_ANALYSIS',   label: 'DATA ANALYSIS',       desc: '데이터 기반 검증, 통계 및 정량적 팩트 체크' },
  { id: 'RESEARCH',        label: 'RESEARCH',             desc: '논문 및 문헌 기반의 학술적 교차 검증' },
  { id: 'STRATEGY',        label: 'STRATEGY',             desc: '비즈니스 전략, 큰 그림과 로드맵 설계' },
  { id: 'FINANCE',         label: 'FINANCE',              desc: '비용, ROI, 수익성 등 냉철한 재무 검증' },
  { id: 'ECONOMIST',       label: 'ECONOMIST',            desc: '거시/미시 경제 및 시장 탄력성 분석' },
  { id: 'INVESTOR',        label: 'INVESTOR',             desc: '벤처 캐피탈 관점의 가치 평가 및 리스크' },
  { id: 'MARKETING',       label: 'MARKETING',            desc: '브랜드 전략 및 고객 관점의 효용성 검토' },
  { id: 'OPERATIONS',      label: 'OPERATIONS',           desc: '프로세스 병목 현상 및 실무 도입 리스크' },
  { id: 'LEGAL',           label: 'LEGAL',                desc: '규제 위반 소지 및 방어적 법리 검토' },
  { id: 'HUMAN_RESOURCES', label: 'HUMAN RESOURCES',      desc: '조직 문화 및 인적 자원에 미치는 영향' },
  { id: 'ENGINEERING',     label: 'ENGINEERING',          desc: '기술 부채, 아키텍처 및 구현 타당성' },
  { id: 'CYBERSECURITY',   label: 'CYBERSECURITY',        desc: '시스템 취약점 및 보안 위협 방어' },
  { id: 'PRODUCT',         label: 'PRODUCT',              desc: '제품 시장 적합성 및 유저 페인포인트' },
  { id: 'SALES',           label: 'SALES',                desc: '시장 진입 및 매출 전환 전략' },
  { id: 'RISK',            label: 'RISK MANAGEMENT',      desc: '최악의 시나리오 가정 및 플랜 B 설계' },
  { id: 'COMMUNICATIONS',  label: 'COMMUNICATIONS',       desc: '대중의 여론 및 평판 리스크 관리' },
  { id: 'DESIGN',          label: 'DESIGN & UX',          desc: '사용성 및 시각적 직관성 평가' },
  { id: 'QUALITY',         label: 'QUALITY ASSURANCE',    desc: '예외 케이스 및 무결성 집중 테스트' },
  { id: 'SUPPLY_CHAIN',    label: 'SUPPLY CHAIN',         desc: '물류, 재고 관리 및 공급망 리스크' },
  { id: 'CRYPTO_EXPERT',   label: 'CRYPTO & WEB3',        desc: '탈중앙화 및 토크노믹스 관점의 분석' },
  { id: 'DOCTOR',          label: 'DOCTOR',               desc: '의학적/임상적 팩트 기반의 과학적 접근' },
  { id: 'THERAPIST',       label: 'THERAPIST',            desc: '심리학적 기제 및 정서적 영향 분석' },
  { id: 'NUTRITIONIST',    label: 'NUTRITIONIST',         desc: '대사 과학 및 영양학적 밸런스 검토' },
  { id: 'FITNESS_COACH',   label: 'FITNESS COACH',        desc: '생체역학 및 신체적 퍼포먼스' },
  { id: 'PROFESSOR',       label: 'PROFESSOR',            desc: '이론적 프레임워크 및 역사적 맥락 제공' },
  { id: 'TEACHER',         label: 'TEACHER',              desc: '복잡한 개념을 가장 직관적으로 해설' },
  { id: 'STUDENT',         label: 'STUDENT',              desc: '기초적인 의문점 제기로 논의의 맹점 환기' },
  { id: 'HISTORIAN',       label: 'HISTORIAN',            desc: '과거 패턴 및 역사적 인과관계 통찰' },
  { id: 'PHILOSOPHER',     label: 'PHILOSOPHER',          desc: '윤리적 가치와 본질적인 의미 탐구' },
  { id: 'SCIENTIST',       label: 'SCIENTIST',            desc: '물리 법칙 및 실험 기반의 귀납적 추론' },
  { id: 'ARTIST',          label: 'ARTIST',               desc: '미학적 비유 및 창의적인 클리셰 파괴' },
  { id: 'MUSICIAN',        label: 'MUSICIAN',             desc: '음향학적 균형 및 조화의 관점' },
  { id: 'FILM_DIRECTOR',   label: 'FILM DIRECTOR',        desc: '내러티브 서사 및 대중의 몰입도 분석' },
  { id: 'CHEF',            label: 'CHEF',                 desc: '재료의 밸런스 및 미식의 기준 적용' },
  { id: 'ARCHITECT',       label: 'ARCHITECT',            desc: '공조직적 구조 및 공간 설계의 안정성' },
  { id: 'JUDGE',           label: 'JUDGE',                desc: '법적 형평성 및 판례 기반의 절차적 정의' },
  { id: 'POLITICIAN',      label: 'POLITICIAN',           desc: '이해관계자 타협 및 정책적 파장 분석' },
  { id: 'ACTIVIST',        label: 'ACTIVIST',             desc: '사회적 정의 및 시스템적 모순 지적' },
  { id: 'JOURNALIST',      label: 'JOURNALIST',           desc: '이면의 의도 파악 및 엄격한 팩트 체크' },
  { id: 'FARMER',          label: 'FARMER',               desc: '자연의 섭리와 1차 산업 현장의 지혜' },
  { id: 'PARENT',          label: 'PARENT',               desc: '가족의 생활밀착형 안위와 경제성 평가' },
  { id: 'WORKER',          label: 'WORKER',               desc: '탁상행정 비판 및 현장의 리얼리티 대변' },
];

const FEATURES = [
  { num: '001', tag: 'FILTER',      title: 'COGNITIVE\nFILTERING', desc: '단일 AI의 편향된 첫 번째 답변을 맹신하지 마세요. 다수의 전문가 AI가 서로의 논리를 비판하고 교차 검증하여 결함 없는 진짜 결론을 도출합니다.' },
  { num: '002', tag: 'LENSES',      title: 'MULTI-FACETED\nPERSPECTIVES',       desc: '하나의 아이디어를 42개의 렌즈로 바라봅니다. 법적 리스크는 @LEGAL에게, 재무 타당성은 @FINANCE에게 맡겨 생각의 사각지대를 없애세요.' },
  { num: '003', tag: 'DEBATE',      title: 'AUTO-ORCHESTRATED\nDEBATES', desc: '해결하고자 하는 문제만 던져주세요. 관련 전문가들이 자동으로 배정되어 치열한 토론을 시작합니다. 당신은 한발 물러서서 관찰하고 지휘하세요.' },
  { num: '004', tag: 'WORKSPACE',   title: 'SYNTHESIS\nWORKSPACE',    desc: '필터링된 토론의 핵심은 실시간으로 A4 문서 워크스페이스에 정리됩니다. 검증이 끝난 안전한 인사이트만 추출하여 당신만의 기획안을 완성하세요.' },
  { num: '005', tag: 'GROUNDING',   title: 'FACT-BASED\nGROUNDING',   desc: '환각(Hallucination)을 원천 차단하기 위해 실시간 웹 검색, 논문, 금융 API 등 강력한 툴을 제공합니다. 전문가들은 팩트에 기반해서만 토론합니다.' },
  { num: '006', tag: 'ANALYTICS',   title: 'DECISION\nREPORTS',       desc: '방대한 논의의 과정은 리포트로 자동 요약됩니다. 찬반 양론, 합의점, 그리고 최종 결론이 구조화되어 당신의 투명한 의사결정을 지원합니다.' },
];

const WORKFLOW = [
  { n: '1', title: 'DEFINE THE PROBLEM',   desc: '해결하고자 하는 아이디어나 질문을 입력하세요. 초기 아이디어가 얼마나 허술하든 상관없습니다.' },
  { n: '2', title: 'ASSEMBLE THE CRITICS', desc: '아이디어를 다각도에서 비판하고 검증할 전문가 팀을 꾸리거나, AI가 자동으로 최적의 팀을 구성하게 둡니다.' },
  { n: '3', title: 'WATCH THEM DEBATE',    desc: '전문가들이 서로의 맹점을 찾아내고 보완하는 과정을 지켜보세요. 필요할 때 방향만 조금씩 수정해주면 됩니다.' },
  { n: '4', title: 'FILTER & DECIDE',      desc: '충분한 검증을 거친 후, 찌꺼기가 걸러진 가장 완벽하고 정제된 결론만을 당신의 결과물로 채택하세요.' },
];

const TICKER_ITEMS = AGENT_ROLES.map(r => r.label);

// ── useScrollReveal hook (IntersectionObserver-based, GSAP-style) ────
function useScrollReveal(options = {}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { threshold: options.threshold || 0.15, rootMargin: options.rootMargin || '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, isVisible];
}

// ── Feature Carousel ─────────────────────────────────────────────────
function FeatureCarousel() {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);
  const intervalRef = useRef(null);
  const [sectionRef, inView] = useScrollReveal();

  const goTo = useCallback((idx) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => { setActive(idx); setAnimating(false); }, 300);
  }, [animating]);

  const next = useCallback(() => goTo((active + 1) % FEATURES.length), [active, goTo]);
  const prev = useCallback(() => goTo((active - 1 + FEATURES.length) % FEATURES.length), [active, goTo]);

  useEffect(() => {
    if (!inView) return;
    intervalRef.current = setInterval(next, 4500);
    return () => clearInterval(intervalRef.current);
  }, [inView, next]);

  const f = FEATURES[active];

  return (
    <section className="main__carousel-section" ref={sectionRef}>
      <div className={`main__section-header ${inView ? 'main__reveal--up' : 'main__reveal--hidden'}`}>
        <span className="main__section-num">01</span>
        <h2 className="main__section-title">WHY SECREAI</h2>
      </div>

      <div className={`main__carousel ${inView ? 'main__reveal--up main__reveal--delay-1' : 'main__reveal--hidden'}`}>
        {/* Slide */}
        <div className={`main__carousel-slide ${animating ? 'main__carousel-slide--out' : 'main__carousel-slide--in'}`}>
          <div className="main__carousel-left">
            <div className="main__carousel-meta">
              <span className="main__carousel-num">{f.num}</span>
              <span className="main__feature-tag">{f.tag}</span>
            </div>
            <h3 className="main__carousel-title">{f.title}</h3>
            <p className="main__carousel-desc">{f.desc}</p>
          </div>
          <div className="main__carousel-right">
            <div className="main__carousel-visual">
              <span className="main__carousel-visual-num">{f.num}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="main__carousel-controls">
          <div className="main__carousel-dots">
            {FEATURES.map((_, i) => (
              <button key={i} className={`main__carousel-dot ${i === active ? 'main__carousel-dot--active' : ''}`}
                onClick={() => goTo(i)} />
            ))}
          </div>
          <div className="main__carousel-arrows">
            <button className="main__carousel-arrow" onClick={prev}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="main__carousel-arrow" onClick={next}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="main__carousel-progress">
          <div className={`main__carousel-progress-bar ${inView ? 'main__carousel-progress-bar--active' : ''}`}
            key={active} />
        </div>
      </div>

      {/* Grid preview */}
      <div className="main__features-grid">
        {FEATURES.map((feat, i) => (
          <button
            key={feat.num}
            className={`main__feature-card ${i === active ? 'main__feature-card--active' : ''} ${inView ? `main__reveal--up main__reveal--delay-${i % 3 + 1}` : 'main__reveal--hidden'}`}
            onClick={() => goTo(i)}
          >
            <div className="main__feature-top">
              <span className="main__feature-num">{feat.num}</span>
              <span className="main__feature-tag">{feat.tag}</span>
            </div>
            <h3 className="main__feature-title">{feat.title}</h3>
            <p className="main__feature-desc">{feat.desc}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Agent Roles Staggered Grid ───────────────────────────────────────
function AgentRolesSection() {
  const [sectionRef, inView] = useScrollReveal();
  const [hoveredRole, setHoveredRole] = useState(null);

  return (
    <section className="main__roles" id="roles" ref={sectionRef}>
      <div className={`main__section-header ${inView ? 'main__reveal--up' : 'main__reveal--hidden'}`}>
        <span className="main__section-num">02</span>
        <h2 className="main__section-title">THE CRITICS</h2>
      </div>
      <p className={`main__roles-intro ${inView ? 'main__reveal--up main__reveal--delay-1' : 'main__reveal--hidden'}`}>
        42명의 각 분야 전문가 AI가 대기 중입니다. 이들은 당신에게 무조건 동의하는 봇이 아닙니다. 비판하고, 팩트를 체크하고, 사각지대를 발견하여 당신의 아이디어를 완벽하게 필터링합니다.
      </p>
      <div className="main__roles-grid">
        {AGENT_ROLES.map((role, i) => (
          <div
            key={role.id}
            className={`main__role-card ${inView ? `main__reveal--up main__reveal--delay-${(i % 5) + 1}` : 'main__reveal--hidden'} ${hoveredRole === role.id ? 'main__role-card--hovered' : ''}`}
            onMouseEnter={() => setHoveredRole(role.id)}
            onMouseLeave={() => setHoveredRole(null)}
          >
            <div className="main__role-card-top">
              <span className="main__role-idx">{String(i + 1).padStart(2, '0')}</span>
              <span className="main__role-label">{role.label}</span>
            </div>
            <p className="main__role-desc">{role.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Workflow Horizontal Steps ────────────────────────────────────────
function WorkflowSection() {
  const [sectionRef, inView] = useScrollReveal();

  return (
    <section className="main__workflow" id="workflow" ref={sectionRef}>
      <div className={`main__section-header ${inView ? 'main__reveal--up' : 'main__reveal--hidden'}`}>
        <span className="main__section-num">03</span>
        <h2 className="main__section-title">HOW TO FILTER</h2>
      </div>
      <div className="main__workflow-steps">
        {WORKFLOW.map((s, i) => (
          <div
            key={s.n}
            className={`main__workflow-step ${inView ? `main__reveal--up main__reveal--delay-${i + 1}` : 'main__reveal--hidden'}`}
          >
            <div className="main__workflow-connector" />
            <div className="main__workflow-num">{s.n}</div>
            <h4 className="main__workflow-title">{s.title}</h4>
            <p className="main__workflow-desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Parallax Hero ────────────────────────────────────────────────────
function HeroSection({ navigate, user }) {
  const bgRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (bgRef.current) {
        bgRef.current.style.transform = `translateY(${window.scrollY * 0.35}px)`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="main__hero">
      <div className="main__hero-bg" ref={bgRef}>
        <div className="main__hero-bg-grid" />
      </div>
      <div className="main__hero-content">
        <div className="main__hero-eyebrow main__hero-animate-1">
          <span className="main__badge">COGNITIVE FILTERING AI</span>
          <span className="main__badge main__badge--outline">v2.0 BETA</span>
        </div>
        <h1 className="main__hero-title">
          <span className="main__hero-line main__hero-animate-2">SECREAI</span>
          <span className="main__hero-line main__hero-line--outline main__hero-animate-3">FILTER</span>
          <span className="main__hero-line main__hero-animate-4">THE NOISE</span>
        </h1>
        <div className="main__hero-bottom main__hero-animate-5">
          <p className="main__hero-desc">
            AI의 첫 번째 답변을 맹신하지 마세요. 42명의 각 분야 전문가가 당신의 아이디어를 교차 검증하고, 비판하고, 토론하여 맹점 없는 가장 완벽한 결론을 도출합니다.
          </p>
          <div className="main__hero-actions">
            <button className="main__btn-primary" onClick={() => navigate(user ? 'chat' : 'login')}>
              {user ? 'OPEN APP' : 'START FILTERING'}
            </button>
            <button className="main__btn-secondary" onClick={() => navigate('pricing')}>SEE PRICING</button>
          </div>
        </div>
        {/* Floating chat preview */}
        <div className="main__hero-chat main__hero-animate-6">
          <div className="main__hero-chat-header">
            <span className="main__hero-chat-dot" />
            <span>LIVE DEBATE — 4 AGENTS ACTIVE</span>
          </div>
          {[
            { role: 'USER', color: '#fff', msg: '신규 타겟을 위해 소셜 미디어 마케팅 예산을 3배로 늘려보려고 합니다.' },
            { role: 'RISK MANAGEMENT', color: '#FF6B6B', msg: '위험합니다. 단일 채널 의존도가 지나치게 높아지면 외부 알고리즘 변화 발생 시 치명적인 타격을 입습니다.' },
            { role: 'FINANCE', color: '#FDCB6E', msg: '재무적으로도 동의합니다. 전환율(CVR)의 확실한 개선 지표 없이 예산만 투입하는 것은 밑빠진 독에 물 붓기입니다. A/B 테스트가 선행되어야 합니다.' },
            { role: 'STRATEGY', color: '#FFD166', msg: '좋은 지적입니다. 예산의 30%는 반드시 실험 채널에 분배하여 리스크를 헷징하는 방향으로 로드맵을 수정하겠습니다.' },
          ].map((m, i) => (
            <div key={i} className="main__hero-chat-msg" style={{ animationDelay: `${i * 0.3 + 0.8}s` }}>
              <span className="main__hero-chat-role" style={{ color: m.color }}>{m.role.replace('_', ' ')}</span>
              <p>{m.msg}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="main__hero-stats main__hero-animate-5">
        {[{ n: '42', l: 'EXPERT ROLES' }, { n: '∞', l: 'PERSPECTIVES' }, { n: 'A4', l: 'WORKSPACE' }, { n: 'RT', l: 'REAL TIME' }].map(s => (
          <div key={s.l} className="main__stat">
            <span className="main__stat-num">{s.n}</span>
            <span className="main__stat-label">{s.l}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Ticker ───────────────────────────────────────────────────────────
function Ticker() {
  const tickerRef = useRef(null);
  useEffect(() => {
    let pos = 0, raf;
    const tick = () => {
      pos -= 0.55;
      if (tickerRef.current) {
        const w = tickerRef.current.scrollWidth / 2;
        if (Math.abs(pos) >= w) pos = 0;
        tickerRef.current.style.transform = `translateX(${pos}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="main__ticker">
      <div className="main__ticker-inner" ref={tickerRef}>
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((r, i) => (
          <span key={i} className="main__ticker-item">
            <svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="3.5" fill="var(--green)"/></svg>
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── CTA Section ──────────────────────────────────────────────────────
function CTASection({ navigate, user }) {
  const [ref, inView] = useScrollReveal();
  return (
    <section className="main__cta-section" ref={ref}>
      <h2 className={`main__cta-title ${inView ? 'main__reveal--up' : 'main__reveal--hidden'}`}>
        STOP BLINDLY<br/>TRUSTING AI
      </h2>
      <button
        className={`main__btn-primary main__btn-primary--lg ${inView ? 'main__reveal--up main__reveal--delay-1' : 'main__reveal--hidden'}`}
        onClick={() => navigate(user ? 'chat' : 'login')}>
        {user ? 'OPEN SECREAI →' : 'START FILTERING →'}
      </button>
      <button
        className={`main__cta-pricing ${inView ? 'main__reveal--up main__reveal--delay-2' : 'main__reveal--hidden'}`}
        onClick={() => navigate('pricing')}>
        VIEW PRICING PLANS
      </button>
    </section>
  );
}

// ── Main export ──────────────────────────────────────────────────────
export default function Main({ navigate, user }) {
  return (
    <div className="main">
      {/* Topbar */}
      <header className="main__topbar">
        <div className="main__topbar-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--green)"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          secreai
        </div>
        <nav className="main__topbar-nav">
          <a href="#roles">THE CRITICS</a>
          <a href="#workflow">HOW TO FILTER</a>
          <button onClick={() => navigate('pricing')} className="main__topbar-link">PRICING</button>
          <button onClick={() => navigate('contact')} className="main__topbar-link">CONTACT</button>
        </nav>
        <div className="main__topbar-right">
          {user ? (
            <button className="main__topbar-cta" onClick={() => navigate('chat')}>OPEN APP →</button>
          ) : (
            <>
              <button className="main__topbar-login" onClick={() => navigate('login')}>LOGIN</button>
              <button className="main__topbar-cta" onClick={() => navigate('login')}>GET STARTED →</button>
            </>
          )}
        </div>
      </header>

      <HeroSection navigate={navigate} user={user} />
      <Ticker />
      <FeatureCarousel />
      <AgentRolesSection />
      <WorkflowSection />
      <CTASection navigate={navigate} user={user} />

      <footer className="main__footer">
        <div className="main__footer-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--green)"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round"/></svg>
          secreai
        </div>
        <span className="main__footer-copy">© 2026 SECREAI. ALL RIGHTS RESERVED.</span>
        <div className="main__footer-links">
          <button onClick={() => navigate('pricing')} className="main__footer-link">PRICING</button>
          <button onClick={() => navigate('contact')} className="main__footer-link">CONTACT</button>
        </div>
      </footer>
    </div>
  );
}