import React, { useState, useEffect } from 'react';
import './report.css';
import { sharing } from '../../api';

const AGENT_COLORS = {
  DATA_ANALYSIS: '#00FF66', RESEARCH: '#74C0FC', STRATEGY: '#FFD166',
  FINANCE: '#FDCB6E', MARKETING: '#FD79A8', OPERATIONS: '#55EFC4',
  LEGAL: '#A29BFE', HUMAN_RESOURCES: '#E17055', ENGINEERING: '#0984E3',
  PRODUCT: '#6C5CE7', SALES: '#00B894', RISK: '#FF6B6B',
  COMMUNICATIONS: '#E84393', DESIGN: '#B197FC', QUALITY: '#F8C291',
  // Legacy
  ANALYST: '#00FF66', CRITIC: '#FF6B6B', STRATEGIST: '#FFD166',
};

const SECTIONS = [
  { id: 'summary',     label: 'SUMMARY',      num: '01' },
  { id: 'keyPoints',   label: 'KEY POINTS',   num: '02' },
  { id: 'decisions',   label: 'DECISIONS',    num: '03' },
  { id: 'conflicts',   label: 'CONFLICTS',    num: '04' },
  { id: 'actionItems', label: 'ACTION ITEMS', num: '05' },
];

// ✅ 개발자용 에러 로그를 사용자 친화적인 영어 메시지로 변환하는 헬퍼 함수
function getFriendlyErrorMessage(rawMsg) {
  if (!rawMsg) return "Oops! We couldn't generate the link. Please try again.";
  const msg = rawMsg.toLowerCase();

  if (msg.includes('fetch') || msg.includes('network') || msg.includes('offline') || msg.includes('failed to connect')) {
    return "We're having trouble connecting to the server. Please check your internet connection and try again.";
  }
  if (msg.includes('unauthorized') || msg.includes('token') || msg.includes('login')) {
    return "Your session seems to have expired. Please log in again to share this report.";
  }
  if (msg.includes('rate limit') || msg.includes('429')) {
    return "You're creating links too quickly. Please wait a moment before trying again.";
  }

  console.error("[Dev Log] Share Error:", rawMsg);
  return "Oops! Something went wrong while creating your link. Please try again later.";
}

// ── Share Modal ───────────────────────────────────────────────────────
function ShareModal({ session, onClose, user }) {
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const createLink = async () => {
    if (!user) { 
      setError('Please log in to create shareable links.'); 
      return; 
    }
    setLoading(true); setError('');
    try {
      const result = await sharing.create({
        resourceType: 'session',
        resourceId: session.id,
        title: session.title,
        data: session,
      });
      setShareUrl(result.url);
    } catch (err) {
      setError(getFriendlyErrorMessage(err.message));
    } finally { 
      setLoading(false); 
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareByEmail = () => {
    const subject = encodeURIComponent(`secreai Session: ${session.title}`);
    const body = encodeURIComponent(`Hi,\n\nI'd like to share this AI session with you:\n\n${session.title}\n${shareUrl}\n\nPowered by secreai.`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <div className="report__share-overlay" onClick={onClose}>
      <div className="report__share-modal" onClick={e => e.stopPropagation()}>
        <div className="report__share-header">
          <h3>SHARE SESSION</h3>
          <button onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="report__share-body">
          <p className="report__share-title">{session.title}</p>
          <p className="report__share-desc">Create a read-only public link anyone can view.</p>

          {error && <div className="report__share-error">{error}</div>}

          {!shareUrl ? (
            <button className="report__share-create" onClick={createLink} disabled={loading}>
              {loading ? '⟳ CREATING LINK...' : '⬡ CREATE SHARE LINK'}
            </button>
          ) : (
            <>
              <div className="report__share-url-row">
                <input className="report__share-url-input" value={shareUrl} readOnly />
                <button className={`report__share-copy ${copied ? 'report__share-copy--done' : ''}`} onClick={copyToClipboard}>
                  {copied ? '✓ COPIED' : 'COPY'}
                </button>
              </div>

              <div className="report__share-methods">
                <button className="report__share-method" onClick={copyToClipboard}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="4" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M4 4V3a1 1 0 011-1h6a1 1 0 011 1v8a1 1 0 01-1 1H9" stroke="currentColor" strokeWidth="1.2"/></svg>
                  COPY URL
                </button>
                <button className="report__share-method" onClick={shareByEmail}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h10v8H2z" stroke="currentColor" strokeWidth="1.2"/><path d="M2 3l5 5 5-5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                  SEND BY EMAIL
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Report Component ─────────────────────────────────────────────
export default function Report({ sessions, activeSessionId, setActiveSessionId, user }) {
  const [activeSection, setActiveSection] = useState('summary');
  const [shareModal, setShareModal] = useState(null); // session to share

  const sessionsWithReports = sessions.filter(s => s.report && !s._deleted);
  const selectedSession = sessions.find(s => s.id === activeSessionId) || sessionsWithReports[0];
  const report = selectedSession?.report;

  useEffect(() => { setActiveSection('summary'); }, [activeSessionId]);

  const downloadReport = () => {
    if (!report || !selectedSession) return;
    
    // Generate Markdown file for download
    let content = `# ${selectedSession.title}\n`;
    content += `Date: ${selectedSession.date || '—'} | Duration: ${selectedSession.duration || '—'} | Messages: ${selectedSession.messageCount || 0}\n`;
    content += `Agents: ${(selectedSession.agents || []).join(', ')}\n\n`;
    
    content += `## Summary\n${report.summary || 'No summary available.'}\n\n`;
    
    if (report.keyPoints && report.keyPoints.length > 0) {
      content += `## Key Points\n`;
      report.keyPoints.forEach((p, i) => { content += `${i + 1}. ${p}\n`; });
      content += '\n';
    }
    
    if (report.decisions && report.decisions.length > 0) {
      content += `## Decisions\n`;
      report.decisions.forEach(d => { content += `- ${d}\n`; });
      content += '\n';
    }
    
    if (report.conflicts && report.conflicts.length > 0) {
      content += `## Conflicts & Debates\n`;
      report.conflicts.forEach(c => {
        content += `**${c.topic}**\n`;
        (c.positions || []).forEach(p => { content += `  - ${p}\n`; });
      });
      content += '\n';
    }
    
    if (report.actionItems && report.actionItems.length > 0) {
      content += `## Action Items\n`;
      report.actionItems.forEach(a => {
        content += `- [ ] ${a.task} (Owner: ${a.owner}, Due: ${a.due})\n`;
      });
      content += '\n';
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSession.title.toLowerCase().replace(/\s+/g, '_')}_report.md`;
    document.body.appendChild(a); // required for Firefox
    a.click(); 
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report">
      {/* Sidebar */}
      <aside className="report__sidebar">
        <div className="report__sidebar-header">
          <span className="report__sidebar-title">REPORTS</span>
          <span className="report__sidebar-count">{sessionsWithReports.length}</span>
        </div>
        <div className="report__sidebar-list">
          {sessionsWithReports.length === 0 && (
            <p className="report__sidebar-empty">No reports yet. Complete a session to generate one.</p>
          )}
          {sessionsWithReports.map(s => (
            <button key={s.id}
              className={`report__sidebar-item ${activeSessionId === s.id ? 'report__sidebar-item--active' : ''}`}
              onClick={() => setActiveSessionId(s.id)}>
              <span className="report__sidebar-item-title">{s.title}</span>
              <span className="report__sidebar-item-date">{s.date}</span>
            </button>
          ))}
        </div>
      </aside>

      {selectedSession && report ? (
        <div className="report__main">
          <div className="report__header">
            <div className="report__header-top">
              <div>
                <span className="report__eyebrow">SESSION REPORT</span>
                <h1 className="report__title">{selectedSession.title}</h1>
              </div>
              <div className="report__header-actions">
                <button className="report__action-btn" onClick={downloadReport}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v8M3 6l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  EXPORT .MD
                </button>
                <button className="report__action-btn report__action-btn--share" onClick={() => setShareModal(selectedSession)}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="9" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="9" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="2" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7.5 2.7L3.5 5.3M3.5 6.7l4 2.6" stroke="currentColor" strokeWidth="1.2"/></svg>
                  SHARE
                </button>
              </div>
            </div>
            <div className="report__meta">
              {[{ label: 'DATE', value: selectedSession.date }, { label: 'DURATION', value: selectedSession.duration || '—' }, { label: 'MESSAGES', value: String(selectedSession.messageCount || 0) }].map(m => (
                <div key={m.label} className="report__meta-item">
                  <span className="report__meta-label">{m.label}</span>
                  <span className="report__meta-value">{m.value}</span>
                </div>
              ))}
              <div className="report__meta-item">
                <span className="report__meta-label">AGENTS</span>
                <div className="report__meta-agents">
                  {(selectedSession.agents || []).map(a => (
                    <span key={a} className="report__meta-agent"
                      style={{ color: AGENT_COLORS[a] || '#888', borderColor: AGENT_COLORS[a] || '#888' }}>
                      {a.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="report__section-nav">
            {SECTIONS.map(s => (
              <button key={s.id}
                className={`report__section-tab ${activeSection === s.id ? 'report__section-tab--active' : ''}`}
                onClick={() => setActiveSection(s.id)}>{s.label}
              </button>
            ))}
          </div>

          <div className="report__content">
            {activeSection === 'summary' && (
              <div className="report__section">
                <div className="report__section-header"><span className="report__section-num">01</span><h2>SUMMARY</h2></div>
                <p className="report__summary-text">{report.summary}</p>
                <div className="report__summary-stats">
                  {[['keyPoints','KEY POINTS'],['decisions','DECISIONS'],['conflicts','DEBATES'],['actionItems','ACTION ITEMS']].map(([k,l]) => (
                    <div key={k} className="report__summary-stat">
                      <span>{(report[k] || []).length}</span><span>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeSection === 'keyPoints' && (
              <div className="report__section">
                <div className="report__section-header"><span className="report__section-num">02</span><h2>KEY POINTS</h2></div>
                <div className="report__key-points">
                  {(report.keyPoints || []).map((p, i) => (
                    <div key={i} className="report__key-point">
                      <span className="report__kp-num">{String(i + 1).padStart(2, '0')}</span><p>{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeSection === 'decisions' && (
              <div className="report__section">
                <div className="report__section-header"><span className="report__section-num">03</span><h2>DECISIONS</h2></div>
                <div className="report__decisions">
                  {(report.decisions || []).map((d, i) => (
                    <div key={i} className="report__decision"><span className="report__decision-check">✓</span><p>{d}</p></div>
                  ))}
                </div>
              </div>
            )}
            {activeSection === 'conflicts' && (
              <div className="report__section">
                <div className="report__section-header"><span className="report__section-num">04</span><h2>CONFLICTS & DEBATES</h2></div>
                {(report.conflicts || []).length === 0 ? <p className="report__empty-section">No recorded conflicts.</p> : (
                  <div className="report__conflicts">
                    {(report.conflicts || []).map((c, i) => (
                      <div key={i} className="report__conflict-card">
                        <div className="report__conflict-topic">{c.topic}</div>
                        <div className="report__conflict-positions">
                          {(c.positions || []).map((p, j) => (
                            <div key={j} className="report__conflict-pos">
                              <span className="report__conflict-pos-dot" style={{ background: j === 0 ? '#00FF66' : '#FF6B6B' }} />
                              <p>{p}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeSection === 'actionItems' && (
              <div className="report__section">
                <div className="report__section-header"><span className="report__section-num">05</span><h2>ACTION ITEMS</h2></div>
                <div className="report__actions-table">
                  <div className="report__table-head"><span>TASK</span><span>OWNER</span><span>DUE</span></div>
                  {(report.actionItems || []).map((a, i) => (
                    <div key={i} className="report__table-row">
                      <span className="report__table-task">{a.task}</span>
                      <span className="report__table-owner">{a.owner}</span>
                      <span className="report__table-due">{a.due}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="report__empty-state">
          <p>SELECT A SESSION REPORT FROM THE LEFT</p>
          <span>Reports are generated automatically after each session.</span>
        </div>
      )}

      {/* Share modal */}
      {shareModal && <ShareModal session={shareModal} user={user} onClose={() => setShareModal(null)} />}
    </div>
  );
}