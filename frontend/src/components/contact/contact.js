import React, { useState, useEffect, useRef } from 'react';
import './contact.css';
import { contact as contactAPI } from '../../api';

const TOPICS = ['BUG REPORT', 'FEATURE REQUEST', 'FEEDBACK', 'PARTNERSHIP', 'BILLING', 'OTHER'];

// ── Seoul realtime clock ─────────────────────────────────────────────
function SeoulClock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const seoulTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      const h = seoulTime.getHours();
      setTime(seoulTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }));
      setDate(seoulTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Seoul' }));
      if (h >= 22 || h < 7)        setGreeting('🌙 Late night in Seoul');
      else if (h >= 7  && h < 12)  setGreeting('☀️ Morning in Seoul');
      else if (h >= 12 && h < 18)  setGreeting('🌤 Afternoon in Seoul');
      else                          setGreeting('🌆 Evening in Seoul');
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="contact__clock">
      <div className="contact__clock-time">{time}</div>
      <div className="contact__clock-date">{date}</div>
      <div className="contact__clock-greeting">{greeting}</div>
    </div>
  );
}

// ── Copyable info item ────────────────────────────────────────────────
function CopyItem({ icon, label, value, href }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="contact__info-item">
      <div className="contact__info-icon">{icon}</div>
      <div className="contact__info-content">
        <span className="contact__info-label">{label}</span>
        <div className="contact__info-value-row">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="contact__info-link">{value}</a>
          ) : (
            <span className="contact__info-value">{value}</span>
          )}
          <button className={`contact__copy-btn ${copied ? 'contact__copy-btn--done' : ''}`} onClick={handleClick} title="Click to copy">
            {copied ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="3.5" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 3.5V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H8" stroke="currentColor" strokeWidth="1.2"/></svg>
            )}
            {copied ? 'COPIED' : 'COPY'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Contact Component ────────────────────────────────────────────
export default function Contact({ user }) {
  const [form,          setForm]          = useState({ name: user?.name || '', email: user?.email || '', topic: 'FEEDBACK', message: '' });
  const [submitted,     setSubmitted]     = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [errors,        setErrors]        = useState({});
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  
  const dropdownRef = useRef(null);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const errs = {};
    if (!form.name.trim())           errs.name    = 'Name required.';
    if (!form.email.includes('@'))   errs.email   = 'Valid email required.';
    if (!form.message.trim())        errs.message = 'Message required.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await contactAPI.submit(form);
      setSubmitted(true);
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to send. Please try email directly.' });
    } finally { setLoading(false); }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (submitted) {
    return (
      <div className="contact">
        <div className="contact__success">
          <div className="contact__success-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 14l8 8 12-12" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h2 className="contact__success-title">MESSAGE SENT</h2>
          <p>We'll get back to you at <strong>{form.email}</strong> within 24 hours.</p>
          <button className="contact__success-back" onClick={() => setSubmitted(false)}>← SEND ANOTHER</button>
        </div>
      </div>
    );
  }

  return (
    <div className="contact">
      <div className="contact__layout">
        {/* Left */}
        <div className="contact__left">
          <span className="contact__eyebrow">GET IN TOUCH</span>
          <h1 className="contact__title">CONTACT</h1>
          <p className="contact__desc">
            Questions, bugs, feature ideas, or partnership inquiries — send a message
            and we'll respond personally.
          </p>

          {/* Seoul clock */}
          <SeoulClock />

          {/* Copyable contact info */}
          <div className="contact__info-list">
            <CopyItem
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="var(--green)" strokeWidth="1.3"/><path d="M2 4l6 5 6-5" stroke="var(--green)" strokeWidth="1.3" strokeLinejoin="round"/></svg>}
              label="EMAIL" value="hello@secreai.com" href="mailto:hello@secreai.com" />
            <CopyItem
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.34c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.88-1.17-.88-1.17-.72-.49.05-.48.05-.48.8.06 1.22.82 1.22.82.71 1.22 1.87.87 2.32.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.67 7.67 0 018 3.8c.68 0 1.36.09 2 .27 1.52-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" fill="var(--green)"/></svg>}
              label="GITHUB" value="github.com/secreai" href="https://github.com/secreai" />
            <CopyItem
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="var(--green)" strokeWidth="1.3"/><path d="M8 5v3l2 2" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              label="RESPONSE TIME" value="Within 24 hours (Seoul KST)" />
          </div>
        </div>

        {/* Right: form */}
        <form className="contact__form" onSubmit={handleSubmit}>
          <div className="contact__field-row">
            <div className="contact__field">
              <label className="contact__label">NAME</label>
              <input className={`contact__input ${errors.name ? 'contact__input--error' : ''}`} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" />
              {errors.name && <span className="contact__error">{errors.name}</span>}
            </div>
            <div className="contact__field">
              <label className="contact__label">EMAIL</label>
              <input className={`contact__input ${errors.email ? 'contact__input--error' : ''}`} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" />
              {errors.email && <span className="contact__error">{errors.email}</span>}
            </div>
          </div>
          
          <div className="contact__field" ref={dropdownRef}>
            <label className="contact__label">TOPIC</label>
            <div className="contact__custom-select">
              <button 
                type="button" 
                className={`contact__select-trigger ${dropdownOpen ? 'contact__select-trigger--open' : ''}`}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span>{form.topic}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              <div className={`contact__select-dropdown ${dropdownOpen ? 'contact__select-dropdown--open' : ''}`}>
                {TOPICS.map(t => (
                  <div 
                    key={t} 
                    className={`contact__select-option ${form.topic === t ? 'contact__select-option--selected' : ''}`}
                    onClick={() => {
                      set('topic', t);
                      setDropdownOpen(false);
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="contact__field">
            <label className="contact__label">MESSAGE</label>
            <textarea className={`contact__textarea ${errors.message ? 'contact__input--error' : ''}`}
              value={form.message} onChange={e => set('message', e.target.value)}
              placeholder="Describe your issue, idea, or question..." rows={6} />
            {errors.message && <span className="contact__error">{errors.message}</span>}
          </div>
          {errors.submit && <div className="contact__submit-error">{errors.submit}</div>}
          <button type="submit" className="contact__submit" disabled={loading}>
            {loading ? 'SENDING...' : 'SEND MESSAGE →'}
          </button>
        </form>
      </div>
    </div>
  );
}