import React, { useState } from 'react';
import './storage.css';

const FILE_ICONS = {
  pdf:   { icon: 'PDF',  color: '#FF6B6B' },
  docx:  { icon: 'DOC',  color: '#74C0FC' },
  image: { icon: 'IMG',  color: '#FFD166' },
  md:    { icon: 'MD',   color: '#00FF66' },
  code:  { icon: 'CODE', color: '#B197FC' },
};

const AGENT_COLORS = {
  // Job-function agents
  DATA_ANALYSIS: '#00FF66', RESEARCH: '#74C0FC', STRATEGY: '#FFD166',
  FINANCE: '#FDCB6E', MARKETING: '#FD79A8', OPERATIONS: '#55EFC4',
  LEGAL: '#A29BFE', HUMAN_RESOURCES: '#E17055', ENGINEERING: '#0984E3',
  PRODUCT: '#6C5CE7', SALES: '#00B894', RISK: '#FF6B6B',
  COMMUNICATIONS: '#E84393', DESIGN: '#B197FC', QUALITY: '#F8C291',
};

export default function Storage({ sessions, files, openSession, openReport, navigate }) {
  const [activeTab, setActiveTab] = useState('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  // Filter out soft-deleted sessions
  const activeSessions = sessions.filter(s => !s._deleted);

  const filteredSessions = activeSessions.filter(s =>
    !searchQuery ||
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.tags || []).some(t => t.includes(searchQuery.toLowerCase()))
  ).sort((a, b) => {
    if (sortBy === 'date') return 0;
    if (sortBy === 'messages') return (b.messageCount || 0) - (a.messageCount || 0);
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    return 0;
  });

  const filteredFiles = files.filter(f =>
    !searchQuery ||
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (sessions.find(s => s.id === f.sessionId)?.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSize = files.length * 0.8; // mock

  return (
    <div className="storage">
      <div className="storage__header">
        <div>
          <span className="storage__eyebrow">YOUR DATA</span>
          <h1 className="storage__title">STORAGE</h1>
          <p className="storage__subtitle">Browse past sessions, generated files, and workspace documents.</p>
        </div>
        <div className="storage__meta-stats">
          <div className="storage__meta-stat">
            <span>{activeSessions.length}</span><span>SESSIONS</span>
          </div>
          <div className="storage__meta-stat">
            <span>{files.length}</span><span>FILES</span>
          </div>
          <div className="storage__meta-stat">
            <span>{totalSize.toFixed(1)} MB</span><span>USED</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="storage__toolbar">
        <div className="storage__tabs">
          <button className={`storage__tab ${activeTab === 'sessions' ? 'storage__tab--active' : ''}`}
            onClick={() => setActiveTab('sessions')}>
            SESSIONS <span>{activeSessions.length}</span>
          </button>
          <button className={`storage__tab ${activeTab === 'files' ? 'storage__tab--active' : ''}`}
            onClick={() => setActiveTab('files')}>
            FILES <span>{files.length}</span>
          </button>
        </div>
        <div className="storage__toolbar-right">
          {activeTab === 'sessions' && (
            <select className="storage__sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="date">SORT: DATE</option>
              <option value="messages">SORT: MESSAGES</option>
              <option value="title">SORT: TITLE</option>
            </select>
          )}
          <div className="storage__search-wrap">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            <input className="storage__search" placeholder="SEARCH..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Sessions */}
      {activeTab === 'sessions' && (
        <div className="storage__sessions">
          {filteredSessions.length === 0 ? (
            <div className="storage__empty">
              <p>NO SESSIONS FOUND</p>
              <button className="storage__empty-btn" onClick={() => navigate('chat')}>START A SESSION →</button>
            </div>
          ) : (
            filteredSessions.map(s => (
              <div key={s.id} className="storage__session-row">
                <div className="storage__session-main">
                  <div className="storage__session-title-row">
                    <h3 className="storage__session-title">{s.title}</h3>
                    <div className="storage__session-tags">
                      {(s.tags || []).map(t => <span key={t} className="storage__tag">{t}</span>)}
                    </div>
                  </div>
                  <div className="storage__session-agents">
                    {(s.agents || []).map(a => (
                      <span key={a} className="storage__agent-chip"
                        style={{ borderColor: AGENT_COLORS[a] || '#888', color: AGENT_COLORS[a] || '#888' }}>
                        {a.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="storage__session-stats">
                  <div className="storage__session-stat"><span>{s.messageCount || 0}</span><span>MSGS</span></div>
                  <div className="storage__session-stat"><span>{s.duration || '—'}</span><span>DURATION</span></div>
                  <div className="storage__session-stat"><span>{s.date?.split(',')[0] || '—'}</span><span>DATE</span></div>
                </div>
                <div className="storage__session-actions">
                  <button className="storage__action-btn" onClick={() => openSession(s.id)}>CONTINUE →</button>
                  {s.report && (
                    <button className="storage__action-btn storage__action-btn--outline" onClick={() => openReport(s.id)}>REPORT</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Files */}
      {activeTab === 'files' && (
        <div className="storage__files">
          {filteredFiles.length === 0 ? (
            <div className="storage__empty"><p>NO FILES YET</p></div>
          ) : (
            <div className="storage__files-grid">
              {filteredFiles.map(f => {
                const fi = FILE_ICONS[f.type] || FILE_ICONS.md;
                const session = sessions.find(s => s.id === f.sessionId);
                return (
                  <div key={f.id} className="storage__file-card">
                    <div className="storage__file-icon" style={{ background: fi.color + '18', color: fi.color }}>{fi.icon}</div>
                    <div className="storage__file-info">
                      <span className="storage__file-name">{f.name}</span>
                      <span className="storage__file-session">{session?.title || 'Unknown session'}</span>
                      <div className="storage__file-meta"><span>{f.size}</span><span>·</span><span>{f.date}</span></div>
                    </div>
                    <button className="storage__file-download" title="Download">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v8M3 6l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}