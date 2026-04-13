import React, { useState, useEffect } from 'react';
import './login.css';
import { auth } from '../../api';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function validateEmail(email) {
  if (!email) return 'Please enter your email address.';
  if (!EMAIL_REGEX.test(email)) return 'Please enter a valid email (e.g., you@gmail.com).';
  const low = email.toLowerCase();
  if (low.endsWith('@gmail') || low.endsWith('@naver') || low.endsWith('@daum'))
    return 'It looks like the domain is incomplete. Did you mean .com?';
  return '';
}

function validatePassword(pw, isSignup = false) {
  if (!pw) return 'Please enter a password.';
  if (pw.length < 8) return 'Your password must be at least 8 characters long.';
  if (isSignup && !/[a-zA-Z]/.test(pw)) return 'Please include at least one letter in your password.';
  return '';
}

// ✅ 개발자용 에러 로그를 사용자 친화적인 영어 메시지로 변환하는 헬퍼 함수
function getFriendlyErrorMessage(rawMsg) {
  if (!rawMsg) return "Oops! Something went wrong on our end. Please try again.";
  const msg = rawMsg.toLowerCase();

  if (msg.includes('incorrect') || msg.includes('invalid credentials') || msg.includes('wrong') || msg.includes('not found')) {
    return "We couldn't find an account matching that email and password.";
  }
  if (msg.includes('already registered') || msg.includes('already exists')) {
    return "An account with this email already exists. Would you like to log in instead?";
  }
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('quota') || msg.includes('429')) {
    return "You've made too many attempts. Please take a short break and try again in a few minutes.";
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to connect') || msg.includes('offline')) {
    return "We're having trouble connecting to the server. Please check your internet connection.";
  }
  if (msg.includes('manually')) {
    return rawMsg; 
  }
  
  console.error("[Dev Log] Auth Error:", rawMsg);
  return "Oops! Something unexpected happened. Please try again later.";
}

// ── Password field with eye toggle & real-time hints ────────────────
function PasswordInput({ value, onChange, onBlur, label = 'PASSWORD', autoComplete = 'current-password', error, disabled, successHint }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="seclogin__field">
      <label className="seclogin__label">{label}</label>
      <div className="seclogin__pw-wrap">
        <input
          className={`seclogin__input seclogin__input--pw ${error ? 'seclogin__input--error' : ''}`}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="••••••••"
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <button type="button" className="seclogin__eye-btn" onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'} disabled={disabled}>
          {visible ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M1 1l16 16M7.5 7.7A2.5 2.5 0 0010.3 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M5 4.3C3.2 5.4 1.8 7 1 9c1.6 3.4 4.5 5.5 8 5.5 1.4 0 2.7-.3 3.9-.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M13.4 12.2C14.8 11 15.9 9.6 17 9c-1.6-3.4-4.5-5.5-8-5.5-.9 0-1.8.1-2.6.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M1 9C2.6 5.6 5.5 3.5 9 3.5s6.4 2.1 8 5.5c-1.6 3.4-4.5 5.5-8 5.5S2.6 12.4 1 9z" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          )}
        </button>
      </div>
      {error ? (
        <span className="seclogin__error" role="alert">{error}</span>
      ) : successHint ? (
        <span className="seclogin__hint" style={{ color: '#00B894', display: 'block', marginTop: '6px', fontSize: '11px', fontFamily: "'DM Mono', monospace", fontWeight: '600' }}>
          {successHint}
        </span>
      ) : null}
    </div>
  );
}

const PLANS = [
  { id: 'free',    label: 'FREE',    price: 'FREE',   desc: '2 agents · 3 sessions' },
  { id: 'pro',     label: 'PRO',     price: '$19/mo', desc: '5 agents · All tools' },
  { id: 'ultra',   label: 'ULTRA',   price: '$49/mo', desc: '15 agents · All models' },
  { id: 'student', label: 'STUDENT', price: '$9/mo',  desc: '4 agents · .edu verified' },
];

// ── Email confirmation screen ─────────────────────────────────────────
function ConfirmationPending({ email, onBack }) {
  const [resending,   setResending]   = useState(false);
  const [resentMsg,   setResentMsg]   = useState('');
  const [resentError, setResentError] = useState('');

  const resend = async () => {
    setResending(true); setResentMsg(''); setResentError('');
    try {
      const res = await fetch('http://localhost:8000/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResentMsg('We just sent another confirmation email. Please check your inbox.');
      } else {
        setResentError('We couldn’t resend the email right now. Please wait a moment and try again.');
      }
    } catch {
      setResentError("We're having trouble connecting. Please check your internet connection.");
    } finally { setResending(false); }
  };

  return (
    <div className="seclogin__confirm-screen">
      <div className="seclogin__confirm-icon">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path d="M6 10h28v20H6z" stroke="var(--green)" strokeWidth="2" rx="2"/>
          <path d="M6 10l14 12L34 10" stroke="var(--green)" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 className="seclogin__confirm-title">CHECK YOUR EMAIL</h2>
      <p className="seclogin__confirm-body">
        We sent a confirmation link to<br/>
        <strong>{email}</strong>
      </p>
      <p className="seclogin__confirm-hint">
        Click the link in the email to verify your account,<br/>
        then come back here to log in.
      </p>

      {resentMsg   && <div className="seclogin__confirm-success">{resentMsg}</div>}
      {resentError && <div className="seclogin__confirm-error">{resentError}</div>}

      <button className="seclogin__confirm-resend" onClick={resend} disabled={resending}>
        {resending ? 'Sending...' : "Didn't receive it? Resend email"}
      </button>

      <button className="seclogin__confirm-back" onClick={onBack}>
        ← Back to login
      </button>
    </div>
  );
}

// ── Main Login Component ──────────────────────────────────────────────
export default function Login({ onLogin, navigate }) {
  const [mode,          setMode]        = useState('login');
  const [form,          setForm]        = useState({ name: '', email: '', password: '', confirmPassword: '', tier: 'free' });
  const [errors,        setErrors]      = useState({});
  const [loading,       setLoading]     = useState(false);
  const [serverError,   setServerError] = useState('');
  const [pendingEmail,  setPendingEmail]= useState(''); 

  // ✅ 점진적 잠금(Progressive Lockout) 상태 관리
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutStage, setLockoutStage]     = useState(0);
  const [lockoutUntil, setLockoutUntil]     = useState(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); setServerError(''); };
  const switchMode = (next) => { setMode(next); setErrors({}); setServerError(''); setForm(f => ({ ...f, password: '', confirmPassword: '' })); };

  // 타이머 훅 (잠금 상태일 때 1초마다 남은 시간 계산)
  useEffect(() => {
    if (!lockoutUntil) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const remaining = Math.ceil((lockoutUntil - now) / 1000);

      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutRemaining(0);
        setServerError('');
        // 잠금 해제 후 단 1번의 실패만으로도 다음 단계 잠금으로 넘어가도록 실패 횟수를 4로 리셋
        setFailedAttempts(4); 
      } else {
        setLockoutRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const validate = () => {
    const errs = {};
    const emailErr = validateEmail(form.email);
    if (emailErr) errs.email = emailErr;
    const pwErr = validatePassword(form.password, mode === 'signup');
    if (pwErr) errs.password = pwErr;
    if (mode === 'signup') {
      if (!form.name.trim()) errs.name = 'Please tell us your name.';
      if (!form.confirmPassword) errs.confirmPassword = 'Please confirm your password.';
      else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutUntil) return; // 잠금 중에는 요청 무시

    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true); setServerError('');
    
    try {
      if (mode === 'signup') {
        const result = await auth.register({
          name: form.name.trim(), email: form.email.trim(),
          password: form.password, tier: form.tier,
        });
        
        if (result.confirmation_required) {
          setPendingEmail(form.email.trim());
          return;
        }
        
        onLogin({
          id: result.user.id, email: result.user.email,
          name: result.user.name || form.name.trim(),
          tier: result.user.tier || 'free',
          tier_data: result.user.tier_data,
          access_token: result.access_token,
        });
      } else {
        const result = await auth.login({ email: form.email.trim(), password: form.password });
        
        // 로그인 성공 시 잠금 초기화
        setFailedAttempts(0);
        setLockoutStage(0);
        setLockoutUntil(null);

        onLogin({
          id:           result.user.id,
          email:        result.user.email,
          name:         result.user.name || result.user.email.split('@')[0],
          tier:         result.user.tier || 'free',
          tier_data:    result.user.tier_data,
          access_token: result.access_token,
        });
      }
    } catch (err) {
      const rawMsg = err.message || '';
      
      if (rawMsg.includes('EMAIL_NOT_CONFIRMED') || rawMsg.toLowerCase().includes('email not confirmed')) {
        setPendingEmail(form.email.trim());
        setLoading(false);
        return;
      }
      
      // ✅ 점진적 잠금 (Progressive Lockout) 처리
      const msgLower = rawMsg.toLowerCase();
      if (mode === 'login' && (msgLower.includes('incorrect') || msgLower.includes('invalid credentials') || msgLower.includes('wrong') || msgLower.includes('not found'))) {
        const newAttempts = failedAttempts + 1;
        
        if (newAttempts >= 5) {
          // 단계별 잠금 시간: 1분(60초), 3분(180초), 5분(300초)
          const durations = [60 * 1000, 3 * 60 * 1000, 5 * 60 * 1000];
          const currentStage = Math.min(lockoutStage, 2);
          const duration = durations[currentStage];

          setLockoutUntil(new Date().getTime() + duration);
          setLockoutRemaining(duration / 1000);
          setLockoutStage(currentStage + 1);
          setFailedAttempts(newAttempts);
          
          setServerError(`Too many failed attempts. Please try again in ${duration / 60000} minute(s).`);
          setLoading(false);
          return;
        } else {
          setFailedAttempts(newAttempts);
          setServerError(`Incorrect email or password. Attempt ${newAttempts}/5.`);
          setLoading(false);
          return;
        }
      }

      setServerError(getFriendlyErrorMessage(rawMsg));
    } finally { 
      setLoading(false); 
    }
  };

  if (pendingEmail) {
    return (
      <div className="seclogin__root">
        <div className="seclogin__left">
          <button className="seclogin__back" onClick={() => navigate('main')}>← BACK</button>
          <div className="seclogin__brand">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--green)"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <span className="seclogin__brand-name">secreai</span>
          </div>
          <h1 className="seclogin__headline">ONE MORE<br/><span className="seclogin__headline-outline">STEP</span><br/>TO GO</h1>
          <p style={{ color: 'var(--gray-400)', fontSize: '13px', lineHeight: '1.7', marginTop: 16 }}>
            We use email verification to keep your account secure.<br/><br/>
            After clicking the link in your email, you can log in and start using secreai.
          </p>
        </div>
        <div className="seclogin__right">
          <div className="seclogin__card">
            <ConfirmationPending email={pendingEmail} onBack={() => { setPendingEmail(''); switchMode('login'); }} />
          </div>
        </div>
      </div>
    );
  }

  const isLocked = lockoutUntil !== null;

  return (
    <div className="seclogin__root">
      {/* Left panel */}
      <div className="seclogin__left">
        <button className="seclogin__back" onClick={() => navigate('main')}>← BACK</button>
        <div className="seclogin__brand">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--green)"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <span className="seclogin__brand-name">secreai</span>
        </div>
        <h1 className="seclogin__headline">THINK<br/><span className="seclogin__headline-outline">DIFFERENTLY</span><br/>TOGETHER</h1>
        <ul className="seclogin__features">
          {['15+ job-function AI experts','True parallel: Gemini + Groq','A4 workspace & document builder','Session reports & analytics','RAG knowledge base integration'].map((f, i) => (
            <li key={i} className="seclogin__feature"><span className="seclogin__feature-check">✓</span>{f}</li>
          ))}
        </ul>
        <div className="seclogin__left-footer">
          <button className="seclogin__pricing-link" onClick={() => navigate('pricing')}>SEE PRICING PLANS →</button>
        </div>
      </div>

      {/* Right panel */}
      <div className="seclogin__right">
        <div className="seclogin__card">
          <div className="seclogin__toggle">
            <button className={`seclogin__toggle-btn ${mode === 'login'  ? 'seclogin__toggle-btn--active' : ''}`} onClick={() => switchMode('login')}>LOGIN</button>
            <button className={`seclogin__toggle-btn ${mode === 'signup' ? 'seclogin__toggle-btn--active' : ''}`} onClick={() => switchMode('signup')}>SIGN UP</button>
          </div>

          <h2 className="seclogin__title">{mode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}</h2>
          <p className="seclogin__subtitle">
            {mode === 'login' ? 'Log in to your secreai account.' : 'Join secreai and start your first multi-agent session.'}
          </p>

          {serverError && (
            <div className="seclogin__server-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="seclogin__form" noValidate>
            {mode === 'signup' && (
              <div className="seclogin__field">
                <label className="seclogin__label">FULL NAME</label>
                <input className={`seclogin__input ${errors.name ? 'seclogin__input--error' : ''}`}
                  type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Your full name" autoComplete="name" autoFocus={mode === 'signup'} disabled={isLocked} />
                {errors.name && <span className="seclogin__error">{errors.name}</span>}
              </div>
            )}

            <div className="seclogin__field">
              <label className="seclogin__label">EMAIL</label>
              <input className={`seclogin__input ${errors.email ? 'seclogin__input--error' : ''}`}
                type="email" value={form.email}
                onChange={e => set('email', e.target.value)}
                onBlur={() => { const err = validateEmail(form.email); if (err) setErrors(p => ({ ...p, email: err })); }}
                placeholder="you@gmail.com" autoComplete="email" autoFocus={mode === 'login'} disabled={isLocked} />
              {errors.email
                ? <span className="seclogin__error">{errors.email}</span>
                : form.email && !validateEmail(form.email) &&
                  <span className="seclogin__hint" style={{ color: '#00B894', fontWeight: '600' }}>✓ Valid email format</span>
              }
            </div>

            {/* ✅ 메인 비밀번호: 입력 시 하단 확인란도 즉각 재검증하여 일치 여부 동기화 */}
            <PasswordInput 
              value={form.password} 
              onChange={e => {
                const val = e.target.value;
                setForm(f => ({ ...f, password: val }));
                setErrors(e => ({ ...e, password: '' }));
                
                if (mode === 'signup' && form.confirmPassword) {
                  if (val !== form.confirmPassword) {
                    setErrors(e => ({ ...e, confirmPassword: 'Passwords do not match.' }));
                  } else {
                    setErrors(e => ({ ...e, confirmPassword: '' }));
                  }
                }
              }}
              onBlur={() => {
                const err = validatePassword(form.password, mode === 'signup');
                if(err) setErrors(p => ({ ...p, password: err }));
              }}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} 
              error={errors.password} 
              disabled={isLocked} 
            />

            {/* ✅ 확인 비밀번호: 타이핑 즉시(onChange) 비밀번호와 실시간으로 비교 */}
            {mode === 'signup' && (
              <PasswordInput 
                value={form.confirmPassword} 
                onChange={e => {
                  const val = e.target.value;
                  setForm(f => ({ ...f, confirmPassword: val }));
                  
                  if (val && form.password !== val) {
                    setErrors(e => ({ ...e, confirmPassword: 'Passwords do not match.' }));
                  } else {
                    setErrors(e => ({ ...e, confirmPassword: '' }));
                  }
                }}
                label="CONFIRM PASSWORD" 
                autoComplete="new-password" 
                error={errors.confirmPassword} 
                disabled={isLocked} 
                successHint={form.confirmPassword && form.password === form.confirmPassword ? '✓ Passwords match' : ''}
              />
            )}

            {mode === 'signup' && (
              <div className="seclogin__field">
                <label className="seclogin__label">PLAN</label>
                <div className="seclogin__plans">
                  {PLANS.map(p => (
                    <button type="button" key={p.id}
                      className={`seclogin__plan ${form.tier === p.id ? 'seclogin__plan--active' : ''}`}
                      onClick={() => !isLocked && set('tier', p.id)} disabled={isLocked}>
                      <span className="seclogin__plan-name">{p.label}</span>
                      <span className="seclogin__plan-price">{p.price}</span>
                      <span className="seclogin__plan-desc">{p.desc}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="seclogin__compare-plans" onClick={() => navigate('pricing')} disabled={isLocked}>
                  Compare all plans →
                </button>
              </div>
            )}

            {mode === 'login' && (
              <div className="seclogin__forgot">
                <button type="button" className="seclogin__forgot-btn" disabled={isLocked}>Forgot password?</button>
              </div>
            )}

            <button type="submit"
              className={`seclogin__submit ${loading || isLocked ? 'seclogin__submit--loading' : ''}`}
              disabled={loading || isLocked}>
              {isLocked 
                ? `Try again in ${lockoutRemaining}s`
                : loading
                  ? <><span className="seclogin__spinner" /> {mode === 'login' ? 'Logging in...' : 'Creating account...'}</>
                  : mode === 'login' ? 'LOG IN →' : 'CREATE ACCOUNT →'}
            </button>
          </form>

          <p className="seclogin__switch">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')} disabled={isLocked}>
              {mode === 'login' ? 'Sign up free' : 'Log in'}
            </button>
          </p>
          <p className="seclogin__auth-note">
            Secured by <strong>Supabase Auth</strong> · Passwords are never stored in plaintext
          </p>
        </div>
      </div>
    </div>
  );
}