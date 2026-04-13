import React, { useState } from 'react';
import './pricing.css';

const TIERS = [
  {
    id: 'free', name: 'FREE', monthlyPrice: 0, annualPrice: 0, highlight: false, badge: null,
    desc: 'Start exploring multi-agent AI conversations at no cost.',
    cta: 'START FREE',
    models: { gemini: 'Flash 8B', groq: 'Llama 3.1 8B' },
    agents: '2', sessions: '3 active', messages: '50 / session', tools: 'Basic (4)',
    roles: '5 roles', rag: '✗', workspace: '1 doc', storage: '100 MB', support: 'Community',
  },
  {
    id: 'pro', name: 'PRO', monthlyPrice: 19, annualPrice: 15, highlight: true, badge: 'MOST POPULAR',
    desc: 'Full power for serious AI-assisted work and research.',
    cta: 'START PRO TRIAL',
    models: { gemini: 'Flash / Flash 8B', groq: 'Llama 3.1 8B + 70B, Mixtral' },
    agents: '5', sessions: 'Unlimited', messages: 'Unlimited', tools: 'All tools (11)',
    roles: 'All 15', rag: '✓', workspace: 'Unlimited', storage: '10 GB', support: 'Priority email',
  },
  {
    id: 'ultra', name: 'ULTRA', monthlyPrice: 49, annualPrice: 39, highlight: false, badge: 'BEST VALUE',
    desc: 'Maximum capability with the most powerful models available.',
    cta: 'GO ULTRA',
    models: { gemini: 'Pro 1.5 / 2.0 Flash Exp', groq: 'Llama 3.3 70B, Gemma2 9B, Mixtral' },
    agents: '15', sessions: 'Unlimited', messages: 'Unlimited', tools: 'All + custom APIs',
    roles: 'All 15', rag: '✓', workspace: 'Unlimited', storage: 'Unlimited', support: '24/7 dedicated',
  },
  {
    id: 'student', name: 'STUDENT', monthlyPrice: 9, annualPrice: 7, highlight: false, badge: null,
    desc: 'Pro-level features at a student-friendly price. Requires .edu email.',
    cta: 'VERIFY & JOIN',
    models: { gemini: 'Flash / Flash 8B', groq: 'Llama 3.1 8B + 70B' },
    agents: '4', sessions: '10 active', messages: '200 / session', tools: 'Most tools (10)',
    roles: 'All 15', rag: '✓', workspace: '5 docs', storage: '2 GB', support: 'Email',
  },
];

const COMPARISON_ROWS = [
  { label: 'Gemini Model',            keys: ['models.gemini'] },
  { label: 'Groq Model',              keys: ['models.groq'] },
  { label: 'Max Agents / Session',    keys: ['agents'] },
  { label: 'Sessions',                keys: ['sessions'] },
  { label: 'Messages / Session',      keys: ['messages'] },
  { label: 'Tools Access',            keys: ['tools'] },
  { label: 'Agent Roles',             keys: ['roles'] },
  { label: 'RAG Knowledge Base',      keys: ['rag'] },
  { label: 'Workspace Documents',     keys: ['workspace'] },
  { label: 'File Storage',            keys: ['storage'] },
  { label: 'Support',                 keys: ['support'] },
];

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, k) => acc?.[k], obj) ?? '';
}

function CheckVal({ v }) {
  if (v === '✓') return <span style={{ color: 'var(--green-dark)', fontWeight: 700, fontSize: 16 }}>✓</span>;
  if (v === '✗') return <span style={{ color: 'var(--gray-400)', fontSize: 16 }}>—</span>;
  return <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--gray-600)' }}>{v}</span>;
}

export default function Pricing({ user, navigate }) {
  const [annual,     setAnnual]     = useState(false);
  const [activeTier, setActiveTier] = useState(user?.tier || null);

  const handleSelect = (id) => {
    if (id === 'student') {
      navigate('contact');
      return;
    }
    if (!user) {
      navigate('login');
      return;
    }
    setActiveTier(id);
  };

  return (
    <div className="pricing">
      {/* Header */}
      <div className="pricing__header">
        <button className="pricing__back" onClick={() => navigate(user ? 'chat' : 'main')}>← BACK</button>
        <div className="pricing__header-center">
          <span className="pricing__eyebrow">SIMPLE PRICING</span>
          <h1 className="pricing__title">CHOOSE YOUR PLAN</h1>
          <p className="pricing__sub">All plans include Gemini + Groq. Upgrade or downgrade anytime.</p>
        </div>
        <div className="pricing__billing-toggle">
          <span className={`pricing__billing-label ${!annual ? 'pricing__billing-label--active' : ''}`}>MONTHLY</span>
          <button className={`pricing__toggle ${annual ? 'pricing__toggle--annual' : ''}`} onClick={() => setAnnual(a => !a)}>
            <span className="pricing__toggle-knob" />
          </button>
          <span className={`pricing__billing-label ${annual ? 'pricing__billing-label--active' : ''}`}>
            ANNUAL <span className="pricing__save-badge">SAVE 20%</span>
          </span>
        </div>
      </div>

      {/* Tier cards */}
      <div className="pricing__cards">
        {TIERS.map(tier => {
          const price = annual ? tier.annualPrice : tier.monthlyPrice;
          const isCurrent = activeTier === tier.id;
          return (
            <div key={tier.id} className={`pricing__card ${tier.highlight ? 'pricing__card--highlight' : ''} ${isCurrent ? 'pricing__card--current' : ''}`}>
              {tier.badge && <span className="pricing__card-badge">{tier.badge}</span>}
              {isCurrent && <span className="pricing__card-current-badge">CURRENT PLAN</span>}
              <div className="pricing__card-top">
                <span className="pricing__plan-name">{tier.name}</span>
                <div className="pricing__plan-price">
                  {price === 0 ? (
                    <span className="pricing__price-free">FREE</span>
                  ) : (
                    <><span className="pricing__price-num">${price}</span><span className="pricing__price-period">/ mo</span></>
                  )}
                </div>
                {annual && price > 0 && <span className="pricing__billed-note">Billed ${price * 12}/yr</span>}
                <p className="pricing__plan-desc">{tier.desc}</p>

                {/* AI Models */}
                <div className="pricing__model-badges">
                  <div className="pricing__model-badge pricing__model-badge--gemini">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" fill="#4285F4"/></svg>
                    Gemini {tier.models.gemini}
                  </div>
                  <div className="pricing__model-badge pricing__model-badge--groq">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" fill="#F55036"/></svg>
                    {tier.models.groq}
                  </div>
                </div>
              </div>

              <button
                className={`pricing__cta-btn ${tier.highlight ? 'pricing__cta-btn--highlight' : ''} ${isCurrent ? 'pricing__cta-btn--current' : ''}`}
                onClick={() => !isCurrent && handleSelect(tier.id)}
                disabled={isCurrent}>
                {isCurrent ? 'CURRENT PLAN' : tier.cta}
              </button>
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="pricing__comparison">
        <h2 className="pricing__comparison-title">FULL FEATURE COMPARISON</h2>
        <div className="pricing__table-wrap">
          <table className="pricing__table">
            <thead>
              <tr className="pricing__table-head">
                <th className="pricing__table-th pricing__table-th--feature">FEATURE</th>
                {TIERS.map(t => (
                  <th key={t.id} className={`pricing__table-th ${t.highlight ? 'pricing__table-th--highlight' : ''}`}>{t.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={i} className={`pricing__table-row ${i % 2 === 0 ? 'pricing__table-row--even' : ''}`}>
                  <td className="pricing__table-td pricing__table-td--label">{row.label}</td>
                  {TIERS.map(t => (
                    <td key={t.id} className={`pricing__table-td ${t.highlight ? 'pricing__table-td--highlight' : ''}`}>
                      <CheckVal v={getNestedValue(t, row.keys[0])} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="pricing__faq">
        <h2 className="pricing__faq-title">FREQUENTLY ASKED</h2>
        <div className="pricing__faq-grid">
          {[
            { q: 'Can I switch between Gemini and Groq?', a: 'Yes — you can choose the provider per session or let the system select automatically based on your tier.' },
            { q: 'What is a "true parallel" multi-agent session?', a: 'Each AI agent runs as a completely independent API call with isolated memory. This prevents hallucination from cross-role contamination.' },
            { q: 'How does RAG work?', a: 'Upload documents to your knowledge base. The system embeds them via Gemini text-embedding-004, then injects relevant context into each agent\'s prompt during chat.' },
            { q: 'Can I upgrade anytime?', a: 'Yes. Changes take effect immediately. Downgrade at the next billing cycle.' },
          ].map((item, i) => (
            <div key={i} className="pricing__faq-item">
              <h4 className="pricing__faq-q">{item.q}</h4>
              <p className="pricing__faq-a">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pricing__footer-cta">
        <span className="pricing__footer-text">Still have questions about the right plan?</span>
        <button className="pricing__footer-btn" onClick={() => navigate('contact')}>CONTACT US →</button>
      </div>
    </div>
  );
}