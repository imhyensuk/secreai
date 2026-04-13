import React, { useState, useRef, useEffect, useCallback } from 'react';
import './chat.css';
import { chat as chatAPI, rag as ragAPI } from '../../api';

// ══ 42 Expert registry with Categories ══════════════════════════════════
export const ALL_AGENTS = {
  // 💼 Business & Operations
  STRATEGY:        { category: 'Business & Operations', color: '#FFD166', bg: '#FFD16614', desc: 'Strategic planning & roadmaps', short: 'ST', minTier: 'free' },
  OPERATIONS:      { category: 'Business & Operations', color: '#55EFC4', bg: '#55EFC414', desc: 'Process & efficiency', short: 'OP', minTier: 'pro' },
  PRODUCT:         { category: 'Business & Operations', color: '#6C5CE7', bg: '#6C5CE714', desc: 'Product management & UX', short: 'PM', minTier: 'pro' },
  MARKETING:       { category: 'Business & Operations', color: '#FD79A8', bg: '#FD79A814', desc: 'Brand & campaigns', short: 'MK', minTier: 'pro' },
  SALES:           { category: 'Business & Operations', color: '#00B894', bg: '#00B89414', desc: 'Revenue & pipeline', short: 'SA', minTier: 'pro' },
  HUMAN_RESOURCES: { category: 'Business & Operations', color: '#E17055', bg: '#E1705514', desc: 'Talent & culture', short: 'HR', minTier: 'pro' },
  SUPPLY_CHAIN:    { category: 'Business & Operations', color: '#B33771', bg: '#B3377114', desc: 'Logistics & procurement', short: 'SCM', minTier: 'pro' },

  // 📈 Finance & Economics
  FINANCE:         { category: 'Finance & Economics', color: '#FDCB6E', bg: '#FDCB6E14', desc: 'Financial modeling & ROI', short: 'FI', minTier: 'free' },
  ECONOMIST:       { category: 'Finance & Economics', color: '#0984E3', bg: '#0984E314', desc: 'Macro/Micro economics', short: 'ECO', minTier: 'pro' },
  INVESTOR:        { category: 'Finance & Economics', color: '#27AE60', bg: '#27AE6014', desc: 'Venture capital & valuation', short: 'VC', minTier: 'pro' },
  RISK:            { category: 'Finance & Economics', color: '#FF6B6B', bg: '#FF6B6B14', desc: 'Risk & mitigation', short: 'RK', minTier: 'free' },

  // 💻 Tech & Engineering
  ENGINEERING:     { category: 'Tech & Engineering', color: '#0984E3', bg: '#0984E314', desc: 'Architecture & code', short: 'EN', minTier: 'free' },
  DATA_ANALYSIS:   { category: 'Tech & Engineering', color: '#00FF66', bg: '#00FF6614', desc: 'Quantitative analysis', short: 'DA', minTier: 'free' },
  CYBERSECURITY:   { category: 'Tech & Engineering', color: '#8E44AD', bg: '#8E44AD14', desc: 'Threat modeling & privacy', short: 'SEC', minTier: 'pro' },
  QUALITY:         { category: 'Tech & Engineering', color: '#F8C291', bg: '#F8C29114', desc: 'Standards & QA', short: 'QA', minTier: 'pro' },
  CRYPTO_EXPERT:   { category: 'Tech & Engineering', color: '#F39C12', bg: '#F39C1214', desc: 'Web3 & tokenomics', short: 'WEB3', minTier: 'pro' },

  // 📚 Education & Science
  PROFESSOR:       { category: 'Education & Science', color: '#20C997', bg: '#20C99714', desc: 'Academic theory', short: 'PR', minTier: 'free' },
  RESEARCH:        { category: 'Education & Science', color: '#74C0FC', bg: '#74C0FC14', desc: 'Literature & intelligence', short: 'RE', minTier: 'free' },
  SCIENTIST:       { category: 'Education & Science', color: '#16A085', bg: '#16A08514', desc: 'Physics & empiricism', short: 'SCI', minTier: 'pro' },
  HISTORIAN:       { category: 'Education & Science', color: '#D35400', bg: '#D3540014', desc: 'Events & causality', short: 'HIS', minTier: 'pro' },
  PHILOSOPHER:     { category: 'Education & Science', color: '#34495E', bg: '#34495E14', desc: 'Ethics & logic', short: 'PHI', minTier: 'pro' },
  TEACHER:         { category: 'Education & Science', color: '#15AABF', bg: '#15AABF14', desc: 'Pedagogy & guidance', short: 'TE', minTier: 'free' },
  STUDENT:         { category: 'Education & Science', color: '#FAB005', bg: '#FAB00514', desc: 'Curiosity & basics', short: 'STU', minTier: 'free' },

  // 🩺 Healthcare & Wellness
  DOCTOR:          { category: 'Healthcare & Wellness', color: '#2980B9', bg: '#2980B914', desc: 'Clinical diagnosis', short: 'MD', minTier: 'pro' },
  THERAPIST:       { category: 'Healthcare & Wellness', color: '#9B59B6', bg: '#9B59B614', desc: 'Mental health & psychology', short: 'PSY', minTier: 'pro' },
  NUTRITIONIST:    { category: 'Healthcare & Wellness', color: '#2ECC71', bg: '#2ECC7114', desc: 'Dietetics & metabolism', short: 'NUT', minTier: 'pro' },
  FITNESS_COACH:   { category: 'Healthcare & Wellness', color: '#E67E22', bg: '#E67E2214', desc: 'Biomechanics & training', short: 'FIT', minTier: 'pro' },

  // 🎨 Arts & Culture
  DESIGN:          { category: 'Arts & Culture', color: '#B197FC', bg: '#B197FC14', desc: 'UX & visual direction', short: 'DX', minTier: 'pro' },
  ARTIST:          { category: 'Arts & Culture', color: '#E84393', bg: '#E8439314', desc: 'Aesthetics & expression', short: 'ART', minTier: 'pro' },
  MUSICIAN:        { category: 'Arts & Culture', color: '#3498DB', bg: '#3498DB14', desc: 'Harmony & sound', short: 'MUS', minTier: 'pro' },
  FILM_DIRECTOR:   { category: 'Arts & Culture', color: '#C0392B', bg: '#C0392B14', desc: 'Storytelling & framing', short: 'DIR', minTier: 'pro' },
  CHEF:            { category: 'Arts & Culture', color: '#D35400', bg: '#D3540014', desc: 'Culinary arts & flavors', short: 'CHF', minTier: 'pro' },
  ARCHITECT:       { category: 'Arts & Culture', color: '#7F8C8D', bg: '#7F8C8D14', desc: 'Spatial design & structure', short: 'ARC', minTier: 'pro' },

  // ⚖️ Society & Law
  LEGAL:           { category: 'Society & Law', color: '#A29BFE', bg: '#A29BFE14', desc: 'Compliance & contracts', short: 'LG', minTier: 'pro' },
  JUDGE:           { category: 'Society & Law', color: '#2C3E50', bg: '#2C3E5014', desc: 'Jurisprudence & fairness', short: 'JDG', minTier: 'ultra' },
  POLITICIAN:      { category: 'Society & Law', color: '#1ABC9C', bg: '#1ABC9C14', desc: 'Public policy & optics', short: 'POL', minTier: 'ultra' },
  ACTIVIST:        { category: 'Society & Law', color: '#E74C3C', bg: '#E74C3C14', desc: 'Social justice & equity', short: 'ACT', minTier: 'pro' },
  JOURNALIST:      { category: 'Society & Law', color: '#34495E', bg: '#34495E14', desc: 'Investigation & facts', short: 'JRN', minTier: 'pro' },
  COMMUNICATIONS:  { category: 'Society & Law', color: '#E84393', bg: '#E8439314', desc: 'PR & messaging', short: 'CM', minTier: 'pro' },
  POLICE:          { category: 'Society & Law', color: '#82C91E', bg: '#82C91E14', desc: 'Law enforcement & safety', short: 'PO', minTier: 'pro' },

  // 🏠 Everyday Life
  ENTREPRENEUR:    { category: 'Everyday Life', color: '#7950F2', bg: '#7950F214', desc: 'Innovation & risk-taking', short: 'ENT', minTier: 'free' },
  WORKER:          { category: 'Everyday Life', color: '#4C6EF5', bg: '#4C6EF514', desc: 'Labor rights & reality', short: 'WK', minTier: 'free' },
  PARENT:          { category: 'Everyday Life', color: '#FA5252', bg: '#FA525214', desc: 'Care & household', short: 'PA', minTier: 'free' },
  FARMER:          { category: 'Everyday Life', color: '#27AE60', bg: '#27AE6014', desc: 'Agriculture & nature', short: 'FRM', minTier: 'free' },
};

const TIER_RANK       = { free: 0, student: 1, pro: 2, ultra: 3 };
const TIER_MAX_AGENTS = { free: 2, pro: 5, ultra: 15, student: 4 };

function agentAllowed(tier, minTier) {
  if (tier === 'student' && minTier === 'pro') return true;
  return (TIER_RANK[tier] ?? 0) >= (TIER_RANK[minTier] ?? 0);
}
function gid() { return `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`; }
function parseMentions(text) {
  const out = []; let m; const re = /@([A-Z_]+)/g;
  while ((m = re.exec(text)) !== null) if (ALL_AGENTS[m[1]]) out.push(m[1]);
  return [...new Set(out)];
}

function MessageText({ content }) {
  let cleaned = content || "";
  let toolsUsed = [];

  const toolRegex = /\{[^}]*"tool"\s*:\s*["'“”]([^"'“”]+)["'“”][^}]*"query"\s*:\s*["'“”]([^"'“”]+)["'“”][^}]*\}/gi;
  
  let match;
  while ((match = toolRegex.exec(content)) !== null) {
    toolsUsed.push({ tool: match[1], query: match[2] });
  }

  cleaned = cleaned.replace(/\[[^\]]*\]\s*\{[^}]*"tool"[^}]*\}/gi, ''); 
  cleaned = cleaned.replace(/\{[^}]*"tool"[^}]*\}/gi, '');             
  cleaned = cleaned.replace(/<TOOL_CALL>|<\/TOOL_CALL>/gi, '');         
  cleaned = cleaned.trim();

  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {toolsUsed.map((t, idx) => (
        <span key={`tool-${idx}`} className="chat__tool-action-badge">
          🔍 Searched '{t.tool}': {t.query}
        </span>
      ))}
      
      {cleaned && (
        <span style={{ whiteSpace: 'pre-wrap' }}>
          {cleaned.split(/(@[A-Z_]+)/g).map((p, i) => {
            const k = p.slice(1);
            if (p.startsWith('@') && ALL_AGENTS[k]) {
              const a = ALL_AGENTS[k];
              return <span key={i} className="chat__mention" style={{ color: a.color, background: a.bg }}>@{k.replace(/_/g, ' ')}</span>;
            }
            return <span key={i}>{p}</span>;
          })}
        </span>
      )}
    </span>
  );
}

// ══ Session Item ═════════════════════════════════════════════════════
function SessionItem({ session, isActive, onClick, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="chat__session-wrapper">
      <div
        className={`chat__session-item ${isActive ? 'chat__session-item--active' : ''}`}
        onClick={() => { if (!open) onClick(); }}
      >
        <div className="chat__session-top">
          <span className="chat__session-name">{session.title}</span>
          <div className="chat__session-top-right">
            {isActive && <span className="chat__session-live">LIVE</span>}
            <button
              className={`chat__session-menu-btn ${open ? 'chat__session-menu-btn--open' : ''}`}
              onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="2.5" r="1" fill="currentColor"/>
                <circle cx="6" cy="6"   r="1" fill="currentColor"/>
                <circle cx="6" cy="9.5" r="1" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
        {session.topic && <span className="chat__session-topic">{session.topic}</span>}
        <div className="chat__session-meta">
          <div className="chat__session-dots">
            {(session.agents || []).slice(0, 4).map(a => (
              <span key={a} className="chat__session-dot" style={{ background: ALL_AGENTS[a]?.color || '#888' }} />
            ))}
          </div>
          <span className="chat__session-time">{session.date?.split(',')[0] || ''}</span>
        </div>
      </div>

      <div className={`chat__session-panel ${open ? 'chat__session-panel--open' : ''}`}>
        <button
          className="chat__session-panel-btn chat__session-panel-btn--edit"
          onClick={e => { e.stopPropagation(); setOpen(false); onEdit(session); }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M8 1.5l1.5 1.5-6.5 6.5H1.5V8L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          EDIT SESSION
        </button>
        <button
          className="chat__session-panel-btn chat__session-panel-btn--delete"
          onClick={e => { e.stopPropagation(); setOpen(false); onDelete(session.id); }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1.5 3h8M4.5 3V2h2v1M3.5 3v6h4V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          DELETE SESSION
        </button>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ onConfirm, onClose }) {
  return (
    <div className="chat__modal-overlay" onClick={onClose}>
      <div className="chat__new-modal chat__delete-modal" onClick={e => e.stopPropagation()}>
        <div className="chat__new-modal-header">
          <div>
            <h2 className="chat__new-modal-title" style={{ color: '#CC3333' }}>DELETE SESSION</h2>
            <p className="chat__new-modal-sub">This action cannot be undone.</p>
          </div>
          <button className="chat__new-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="chat__new-modal-body">
          <p style={{ fontSize: '13px', color: 'var(--black)', margin: 0, lineHeight: 1.6 }}>
            Are you sure you want to permanently delete this chat session? All messages and configurations will be lost.
          </p>
        </div>
        <div className="chat__new-modal-footer">
          <button className="chat__new-modal-cancel" onClick={onClose}>CANCEL</button>
          <button className="chat__new-modal-submit" style={{ background: '#CC3333', color: '#fff' }} onClick={onConfirm}>
            DELETE
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentRAGModal({ agents, documents, agentDocMap, onSave, onClose }) {
  const [map, setMap] = useState(
    agents.reduce((acc, a) => ({ ...acc, [a]: agentDocMap[a] || [] }), {})
  );

  const toggle = (agent, docId) => {
    setMap(prev => {
      const current = new Set(prev[agent] || []);
      if (current.has(docId)) current.delete(docId); else current.add(docId);
      return { ...prev, [agent]: [...current] };
    });
  };

  const assignAll = (agent) => {
    setMap(prev => ({ ...prev, [agent]: documents.map(d => d.doc_id) }));
  };

  const clearAgent = (agent) => {
    setMap(prev => ({ ...prev, [agent]: [] }));
  };

  return (
    <div className="chat__modal-overlay" onClick={onClose}>
      <div className="chat__rag-assign-modal" onClick={e => e.stopPropagation()}>
        <div className="chat__rag-assign-header">
          <div>
            <h3 className="chat__rag-assign-title">📚 ASSIGN DOCS TO EXPERTS</h3>
            <p className="chat__rag-assign-sub">Each expert can focus on different documents. Assign individually to control context.</p>
          </div>
          <button className="chat__rag-assign-close" onClick={onClose}>✕</button>
        </div>

        {documents.length === 0 ? (
          <div className="chat__rag-assign-empty">
            No documents in knowledge base yet. Upload files in the Knowledge Base section first.
          </div>
        ) : (
          <div className="chat__rag-assign-body">
            {agents.map(agent => {
              const ag       = ALL_AGENTS[agent];
              const assigned = map[agent] || [];
              return (
                <div key={agent} className="chat__rag-agent-section">
                  <div className="chat__rag-agent-header">
                    <span className="chat__rag-agent-dot" style={{ background: ag?.color }} />
                    <span className="chat__rag-agent-name" style={{ color: ag?.color }}>
                      {agent.replace(/_/g, ' ')}
                    </span>
                    <span className="chat__rag-agent-count">{assigned.length}/{documents.length} docs</span>
                    <div className="chat__rag-agent-actions">
                      <button className="chat__rag-quick-btn" onClick={() => assignAll(agent)}>ALL</button>
                      <button className="chat__rag-quick-btn" onClick={() => clearAgent(agent)}>NONE</button>
                    </div>
                  </div>
                  <div className="chat__rag-doc-grid">
                    {documents.map(doc => {
                      const isOn = assigned.includes(doc.doc_id);
                      const ext  = doc.filename.split('.').pop().toLowerCase();
                      return (
                        <button
                          key={doc.doc_id}
                          className={`chat__rag-doc-chip ${isOn ? 'chat__rag-doc-chip--on' : ''}`}
                          style={isOn ? { borderColor: ag?.color, color: ag?.color, background: ag?.bg } : {}}
                          onClick={() => toggle(agent, doc.doc_id)}
                        >
                          <span className="chat__rag-doc-ext">{ext.toUpperCase()}</span>
                          <span className="chat__rag-doc-name">
                            {doc.filename.length > 20 ? doc.filename.slice(0, 20) + '…' : doc.filename}
                          </span>
                          {isOn && <span className="chat__rag-doc-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="chat__rag-assign-footer">
          <button className="chat__rag-assign-cancel" onClick={onClose}>CANCEL</button>
          <button className="chat__rag-assign-save" onClick={() => onSave(map)}>
            SAVE ASSIGNMENTS →
          </button>
        </div>
      </div>
    </div>
  );
}

function FilePreview({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <div className="chat__attach-preview">
      {files.map((f, i) => (
        <div key={i} className="chat__attach-chip">
          <span className="chat__attach-chip-icon">
            {f.type.startsWith('image/') ? '🖼' : f.type.includes('pdf') ? '📄' : '📎'}
          </span>
          <span className="chat__attach-chip-name">
            {f.name.length > 22 ? f.name.slice(0, 22) + '…' : f.name}
          </span>
          <span className="chat__attach-chip-size">
            {(f.size / 1024).toFixed(0)}KB
          </span>
          <button className="chat__attach-chip-remove" onClick={() => onRemove(i)}>✕</button>
        </div>
      ))}
    </div>
  );
}

function SessionModal({ onConfirm, onClose, initial, userTier = 'free' }) {
  const [title,  setTitle]  = useState(initial?.title  || '');
  const [topic,  setTopic]  = useState(initial?.topic  || '');
  const [goal,   setGoal]   = useState(initial?.goal   || '');
  const [agents, setAgents] = useState(initial?.agents || ['DATA_ANALYSIS', 'STRATEGY', 'RISK']);
  const max    = TIER_MAX_AGENTS[userTier] || 2;
  const isEdit = !!initial?.id;

  const toggleAgent = name => {
    if (!agentAllowed(userTier, ALL_AGENTS[name]?.minTier)) return;
    setAgents(prev =>
      prev.includes(name)
        ? prev.filter(a => a !== name)
        : prev.length < max ? [...prev, name] : prev
    );
  };

  const groupedAgents = Object.entries(ALL_AGENTS).reduce((acc, [name, ag]) => {
    const cat = ag.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push([name, ag]);
    return acc;
  }, {});

  return (
    <div className="chat__modal-overlay" onClick={onClose}>
      <div className="chat__new-modal" onClick={e => e.stopPropagation()}>
        <div className="chat__new-modal-header">
          <div>
            <h2 className="chat__new-modal-title">{isEdit ? 'EDIT SESSION' : 'NEW SESSION'}</h2>
            <p className="chat__new-modal-sub">Max {max} experts on your plan.</p>
          </div>
          <button className="chat__new-modal-close" onClick={onClose}>✕</button>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (title.trim()) onConfirm({ title: title.trim(), topic: topic.trim(), goal: goal.trim(), agents });
          }}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
        >
          <div className="chat__new-modal-body">
            <div className="chat__form-field">
              <label className="chat__form-label">TITLE <span className="chat__form-req">*</span></label>
              <input className="chat__form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q3 Strategy Review" autoFocus />
            </div>
            <div className="chat__form-field">
              <label className="chat__form-label">TOPIC</label>
              <input className="chat__form-input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. APAC market expansion" />
            </div>
            <div className="chat__form-field">
              <label className="chat__form-label">GOAL</label>
              <textarea className="chat__form-textarea" value={goal} onChange={e => setGoal(e.target.value)} placeholder="What should the team achieve in this session?" rows={2} />
            </div>
            
            <div className="chat__form-field">
              <label className="chat__form-label">
                TEAM MEMBERS
                <span className="chat__form-count">{agents.length}/{max}</span>
              </label>
              <div className="chat__agent-categories" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(groupedAgents).map(([cat, catAgents]) => (
                  <div key={cat} className="chat__agent-category">
                    <div className="chat__agent-category-title">{cat.toUpperCase()}</div>
                    <div className="chat__agent-picker-grid">
                      {catAgents.map(([name, ag]) => {
                        const active = agents.includes(name);
                        const locked = !agentAllowed(userTier, ag.minTier);
                        return (
                          <button type="button" key={name}
                            className={`chat__agent-pick-btn ${active ? 'chat__agent-pick-btn--active' : ''} ${locked ? 'chat__agent-pick-btn--locked' : ''}`}
                            style={active ? { borderColor: ag.color, background: ag.bg } : {}}
                            disabled={locked && !active}
                            onClick={() => toggleAgent(name)}
                          >
                            <span className="chat__agent-pick-dot" style={{ background: locked ? '#555' : ag.color }} />
                            <span className="chat__agent-pick-name" style={active ? { color: ag.color } : locked ? { color: '#555' } : {}}>
                              {name.replace(/_/g, ' ')}
                            </span>
                            {locked && <span style={{ fontSize: 9, marginLeft: 'auto' }}>🔒</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="chat__new-modal-footer">
            <button type="button" className="chat__new-modal-cancel" onClick={onClose}>CANCEL</button>
            <button type="submit" className="chat__new-modal-submit" disabled={!title.trim()}>
              {isEdit ? 'SAVE CHANGES' : 'START SESSION'} →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateVoteModal({ onClose, onLaunch }) {
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleAdd = () => setOptions([...options, '']);
  const handleRemove = (idx) => setOptions(options.filter((_, i) => i !== idx));
  const handleChange = (idx, val) => {
    const newOpts = [...options];
    newOpts[idx] = val;
    setOptions(newOpts);
  };

  const isValid = title.trim() && options.every(o => o.trim()) && options.length >= 2;

  return (
    <div className="chat__modal-overlay" onClick={onClose}>
      <div className="chat__new-modal" onClick={e => e.stopPropagation()}>
        <div className="chat__new-modal-header">
          <div>
            <h2 className="chat__new-modal-title">CREATE VOTE</h2>
            <p className="chat__new-modal-sub">Configure options for your team to vote on.</p>
          </div>
          <button className="chat__new-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="chat__new-modal-body">
          <div className="chat__form-field">
            <label className="chat__form-label">VOTE TITLE <span className="chat__form-req">*</span></label>
            <input className="chat__form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Which marketing strategy should we adopt?" autoFocus />
          </div>
          <div className="chat__form-field">
            <label className="chat__form-label">OPTIONS <span className="chat__form-req">*</span></label>
            {options.map((opt, idx) => (
              <div key={idx} className="chat__vote-opt-row">
                <input className="chat__form-input" style={{ flex: 1 }} value={opt} onChange={e => handleChange(idx, e.target.value)} placeholder={`Option ${idx + 1}`} />
                {options.length > 2 && (
                  <button type="button" onClick={() => handleRemove(idx)} className="chat__vote-opt-remove">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={handleAdd} className="chat__rag-quick-btn" style={{ alignSelf: 'flex-start', marginTop: '4px', padding: '6px 12px' }}>+ ADD OPTION</button>
          </div>
        </div>
        <div className="chat__new-modal-footer">
          <button className="chat__new-modal-cancel" onClick={onClose}>CANCEL</button>
          <button className="chat__new-modal-submit" disabled={!isValid} onClick={() => onLaunch({ title: title.trim(), options: options.map(o => o.trim()) })}>
            POST VOTE →
          </button>
        </div>
      </div>
    </div>
  );
}

// ══ Main Chat Component ═══════════════════════════════════════════════
export default function Chat({
  user, sessions, activeSessionId, setActiveSessionId,
  saveSession, deleteSession, addFile, openNotion, navigate, enabledTools = new Set(),
}) {
  const userTier   = user?.tier || 'free';

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const [messages,        setMessages]       = useState(activeSession?.messages?.length ? activeSession.messages : []);
  const [activeAgents,    setActiveAgents]   = useState(activeSession?.agents || ['DATA_ANALYSIS', 'STRATEGY']);
  const [sessionTitle,    setSessionTitle]   = useState(activeSession?.title || 'New Session');
  const [sessionTopic,    setSessionTopic]   = useState(activeSession?.topic || '');
  const [sessionGoal,     setSessionGoal]    = useState(activeSession?.goal  || '');
  const [input,           setInput]          = useState('');
  
  const [isThinking,      setIsThinking]     = useState(false);
  const [currentSpeaker,  setCurrentSpeaker] = useState(null); 
  const [autoMode,        setAutoMode]       = useState(false); 
  
  const [showAgentPicker, setShowAgentPicker]= useState(false);
  const [showMention,     setShowMention]    = useState(false);
  const [mentionAgents,   setMentionAgents]  = useState([]);
  const [mentionIdx,      setMentionIdx]     = useState(0);
  const [showNewModal,    setShowNewModal]   = useState(false);
  const [editingSession,  setEditingSession] = useState(null);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [openHelpId,      setOpenHelpId]     = useState(null);
  const [agentProviders,  setAgentProviders] = useState({});
  const [showCreateVote,  setShowCreateVote] = useState(false);
  const [pinnedIds,       setPinnedIds]      = useState([]);
  const [ragDocuments,    setRagDocuments]   = useState([]);
  const [agentDocMap,     setAgentDocMap]    = useState({});
  const [showRagModal,    setShowRagModal]   = useState(false);
  const [attachedFiles,   setAttachedFiles]  = useState([]);
  
  // ✅ 질문 추출 상태 추가
  const [pendingQuestions, setPendingQuestions] = useState([]);
  
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ✅ 수정됨: 세션이 변경되거나 삭제되었을 때 화면 및 상태를 정확히 동기화
  useEffect(() => {
    const s = sessions.find(s => s.id === activeSessionId);
    if (!s) {
      setSessionTitle('New Session');
      setSessionTopic('');
      setSessionGoal('');
      setActiveAgents(['DATA_ANALYSIS', 'STRATEGY']);
      setMessages([]);
      return;
    }
    setSessionTitle(s.title); setSessionTopic(s.topic || ''); setSessionGoal(s.goal || '');
    setActiveAgents(s.agents || ['DATA_ANALYSIS', 'STRATEGY']);
    setMessages(s.messages?.length ? s.messages : []);
  }, [activeSessionId]); 

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.chat__help-menu-wrapper')) setOpenHelpId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user || !enabledTools.has('rag')) return;
    ragAPI.list(user.id || user.email).then(r => setRagDocuments(r.documents || [])).catch(() => {});
  }, [user, enabledTools]);

  useEffect(() => {
    let timer;
    if (autoMode && !isThinking && messages.length > 0) {
      timer = setTimeout(() => {
        runSequentialTurn(
          "[Auto-Pilot] Team, let's keep the momentum going. What are the next steps or alternative views?", 
          "auto_continue", 
          "",
          activeAgents,
          true
        );
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [autoMode, isThinking, messages, activeAgents]);

  const toggleAutoMode = () => {
    if (autoMode || isThinking) {
      setAutoMode(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsThinking(false);
      setCurrentSpeaker(null);
      console.log("Meeting paused by user.");
    } else {
      setAutoMode(true);
      if (!isThinking) {
        runSequentialTurn(
          "[Auto-Pilot] The meeting has resumed. Let's pick up the context and continue.", 
          "auto_resume", 
          "",
          activeAgents,
          true
        );
      }
    }
  };

  const handleInputChange = e => {
    const val = e.target.value; setInput(val);
    const before = val.slice(0, e.target.selectionStart);
    const atIdx  = before.lastIndexOf('@');
    if (atIdx !== -1 && !before.slice(atIdx).includes(' ')) {
      const q       = before.slice(atIdx + 1).toUpperCase();
      const matches = Object.keys(ALL_AGENTS).filter(a => activeAgents.includes(a) && a.includes(q));
      setMentionAgents(matches); setShowMention(matches.length > 0); setMentionIdx(0);
    } else { setShowMention(false); }
  };

  const insertMention = agent => {
    const atIdx = input.lastIndexOf('@');
    setInput(input.slice(0, atIdx) + `@${agent} `);
    setShowMention(false); inputRef.current?.focus();
  };

  const handleKeyDown = e => {
    if (showMention) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(p => (p + 1) % mentionAgents.length); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(p => (p - 1 + mentionAgents.length) % mentionAgents.length); }
      if (e.key === 'Enter')     { e.preventDefault(); insertMention(mentionAgents[mentionIdx]); }
      if (e.key === 'Escape')    { setShowMention(false); }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessage(); 
    }
  };

  const handleFileAttach = e => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const runSequentialTurn = async (initialPrompt, actionType, targetText, agentsToRun, isSilentAction = false) => {
    if (autoMode && !isSilentAction) {
      setAutoMode(false); 
    }

    setIsThinking(true);
    abortControllerRef.current = new AbortController();

    let displayMessages = [...messages];
    let currentExecHistory = [...messages]; 

    let userMsgForHistory = null;

    if (actionType === 'auto_start') {
      const sysMsg = { id: gid(), role: 'SYSTEM', type: 'system', content: `🚀 The meeting is live! Experts are reviewing the topic...` };
      displayMessages = [sysMsg];
      setMessages(displayMessages);
      currentExecHistory = [];
    } else if (!isSilentAction) {
      userMsgForHistory = {
        id: gid(), role: 'USER', type: 'user', content: initialPrompt,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        reactions: {},
        attachments: attachedFiles.map(f => ({ name: f.name, type: f.type, size: f.size }))
      };
      displayMessages = [...displayMessages, userMsgForHistory];
      setMessages(displayMessages);
      setInput(''); setAttachedFiles([]); setShowMention(false);
    }

    const shuffledAgents = [...agentsToRun].sort(() => Math.random() - 0.5);
    let currentPrompt = initialPrompt;

    for (let i = 0; i < shuffledAgents.length; i++) {
      if (abortControllerRef.current?.signal.aborted) break;

      const agent = shuffledAgents[i];
      setCurrentSpeaker(agent);

      if (i > 0 || isSilentAction) {
        const lastContent = displayMessages[displayMessages.length - 1]?.content || "";
        const readingDelay = Math.min(lastContent.length * 15, 6000); 
        const delay = Math.max(3500, readingDelay); 
        
        await new Promise(res => setTimeout(res, delay));
      }

      if (abortControllerRef.current?.signal.aborted) break;

      const cleanHistory = currentExecHistory.filter(msg => {
        const text = msg.content || "";
        return !text.startsWith('⚠️ Hmm, I ran into an issue') &&
               !text.startsWith('🔌 Connection lost') &&
               !text.includes('[Groq error]') &&
               !text.includes('[Gemini error]');
      });

      const historyPayload = cleanHistory.length > 40 ? [cleanHistory[0], ...cleanHistory.slice(-39)] : cleanHistory;
      const ragMeta = { userId: user?.id || user?.email, docMap: agentDocMap || {} };

      const backendMessage = JSON.stringify({
        text: currentPrompt,
        actionType: i === 0 ? actionType : 'auto_continue', 
        targetText: targetText
      });

      try {
        const result = await chatAPI.send({
          sessionId: activeSessionId,
          message: backendMessage,
          activeAgents: [agent], 
          enabledTools,
          history: historyPayload,
          provider: JSON.stringify(agentProviders),
          ragContext: JSON.stringify(ragMeta),
          signal: abortControllerRef.current.signal
        });

        if (abortControllerRef.current?.signal.aborted) break;

        const agentResponse = result.responses[0].content;
        const isError = result.responses[0].error;

        const newAgentMsg = {
          id: gid(), role: agent, type: 'agent',
          content: isError ? `⚠️ Hmm, I ran into an issue: ${agentResponse}` : agentResponse,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          reactions: {}
        };

        displayMessages = [...displayMessages, newAgentMsg];
        setMessages(displayMessages);
        
        const currentSession = sessions.find(s => s.id === activeSessionId);
        if (currentSession) saveSession({ ...currentSession, messages: displayMessages });

        if (i === 0 && userMsgForHistory) {
          currentExecHistory = [...currentExecHistory, userMsgForHistory];
        } else if (i > 0 || isSilentAction) {
          currentExecHistory = [...currentExecHistory, { role: 'user', type: 'user', content: currentPrompt }];
        }
        currentExecHistory = [...currentExecHistory, newAgentMsg];

        currentPrompt = "(참고: 이전 발언을 바탕으로 자연스럽게 대화에 참여하세요. 기계처럼 말하거나 소제목을 달면 안 됩니다.)";

      } catch (err) {
        if (err.name === 'AbortError' || err.message === 'Aborted') {
          console.log("Turn aborted by user.");
          break;
        } else {
          const errMsg = { id: gid(), role: agent, type: 'agent', content: `🔌 Connection lost. (${err.message})` };
          displayMessages = [...displayMessages, errMsg];
          setMessages(displayMessages);
        }
      }
    }

    setCurrentSpeaker(null);
    setIsThinking(false);

    if (!isSilentAction && !abortControllerRef.current?.signal.aborted) {
      const turnAgentMsgs = displayMessages.slice(-shuffledAgents.length);
      const extracted = [];
      turnAgentMsgs.forEach(msg => {
        if (msg.type === 'agent' && !msg.content.startsWith('⚠️') && !msg.content.startsWith('🔌')) {
          const matches = msg.content.match(/[^.!?\n]+[?]/g) || [];
          matches.forEach(q => {
            const cleaned = q.trim().replace(/^[-*•\s]+/, '');
            if (cleaned.length > 4 && !extracted.some(e => e.text === cleaned)) {
              extracted.push({ agent: msg.role, text: cleaned });
            }
          });
        }
      });
      if (extracted.length > 0) {
        setPendingQuestions(extracted);
      }
    }
  };

  const sendMessage = () => {
    const trimmed = input.trim();
    if ((!trimmed && !attachedFiles.length) || isThinking) return;

    let content = trimmed;
    if (attachedFiles.length) {
      const names = attachedFiles.map(f => `${f.name} (${(f.size / 1024).toFixed(0)}KB)`).join(', ');
      content = content ? `${content}\n\n[Attached files: ${names}]` : `[Attached files: ${names}]`;
    }

    const mentions = parseMentions(trimmed);
    const responding = (mentions.length > 0 ? mentions.filter(a => activeAgents.includes(a)) : activeAgents)
                        .slice(0, TIER_MAX_AGENTS[userTier] || 2);

    setPendingQuestions([]);
    runSequentialTurn(content, null, null, responding, false);
  };

  const handleQuickAction = (msg, actionType) => {
    setOpenHelpId(null);
    const excerpt = msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content;
    const responding = activeAgents.slice(0, TIER_MAX_AGENTS[userTier] || 2);

    if (actionType === 'follow_up') {
      setInput(`[Follow-up] I have a question about your point ("${excerpt}"):\n`);
      inputRef.current?.focus();
    } else if (actionType === 'redirect') {
      setInput(`[Course Correction] Let's adjust the direction regarding ("${excerpt}"):\n`);
      inputRef.current?.focus();
    } else if (actionType === 'elaborate') {
      runSequentialTurn(`Could you elaborate on your point about "${excerpt}"?`, 'elaborate', msg.content, responding, true);
    } else if (actionType === 'summarize') {
      runSequentialTurn(`Could you summarize your point about "${excerpt}" into key takeaways?`, 'summarize', msg.content, responding, true);
    }
  };

  const handleNewSession = data => {
    const id = `s${Date.now()}`;
    const newSession = {
      id, title: data.title, topic: data.topic, goal: data.goal, agents: data.agents,
      messages: [], messageCount: 0, duration: '—',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      tags: [], report: null,
    };
    
    saveSession(newSession);
    setActiveSessionId(id); 
    setShowNewModal(false);

    const prompt = `[회의 정보]\n- 주제: ${data.title}\n- 설명: ${data.topic || '없음'}\n- 목표: ${data.goal || '없음'}\n\n(시스템: 회의가 시작되었습니다. AI나 봇이 아닌 '실제 전문가'로서 동료들에게 말하듯 자연스럽게 첫 의견을 제시해주세요. "Initial Analysis:" 나 "제 분석은 다음과 같습니다" 같은 딱딱하고 기계적인 표현은 절대 쓰지 마세요.)`;
    runSequentialTurn(prompt, 'auto_start', '', data.agents.slice(0, TIER_MAX_AGENTS[userTier] || 2), true);
  };

  const handleEditSession = data => {
    const updated = { ...editingSession, ...data };
    saveSession(updated);
    if (editingSession?.id === activeSessionId) {
      setSessionTitle(data.title); setSessionTopic(data.topic);
      setSessionGoal(data.goal);   setActiveAgents(data.agents);
    }
    setEditingSession(null);
  };

  const togglePin = useCallback((msgId) => {
    setPinnedIds(p => p.includes(msgId) ? p.filter(id => id !== msgId) : [...p, msgId]);
  }, []);

  const pinnedMsgs = messages.filter(m => pinnedIds.includes(m.id));
  const TIER_COLOR = { free: '#888', pro: '#0984E3', ultra: '#6C5CE7', student: '#00B894' };

  const groupedAgents = Object.entries(ALL_AGENTS).reduce((acc, [name, ag]) => {
    const cat = ag.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push([name, ag]);
    return acc;
  }, {});

  return (
    <div className="chat">
      <aside className="chat__sessions">
        <div className="chat__sessions-header">
          <span className="chat__sessions-title">SESSIONS</span>
          <button className="chat__sessions-new" onClick={() => setShowNewModal(true)}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="chat__sessions-list">
          {sessions.filter(s => !s._deleted).map(s => (
            <SessionItem
              key={s.id} session={s} isActive={activeSessionId === s.id}
              onClick={() => setActiveSessionId(s.id)}
              onEdit={s => setEditingSession(s)}
              onDelete={id => setSessionToDelete(id)}
            />
          ))}
          {sessions.filter(s => !s._deleted).length === 0 && (
            <div className="chat__sessions-empty">No sessions yet.<br/>Click + to start.</div>
          )}
        </div>

        <div className="chat__provider-section">
          <span className="chat__provider-heading">AI PROVIDERS</span>
          <div className="chat__agent-providers-list">
            {activeAgents.map(agent => (
              <div key={agent} className="chat__agent-provider-row">
                <span className="chat__agent-provider-name" style={{ color: ALL_AGENTS[agent]?.color }}>
                  {ALL_AGENTS[agent]?.short || agent}
                </span>
                <select
                  className="chat__agent-provider-select"
                  value={agentProviders[agent] || 'auto'}
                  onChange={e => setAgentProviders(p => ({ ...p, [agent]: e.target.value }))}
                >
                  <option value="auto">Auto</option>
                  <option value="gemini">Gemini</option>
                  <option value="groq">Groq</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {enabledTools.has('rag') && (
          <button className="chat__rag-assign-btn" onClick={() => setShowRagModal(true)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L1 4v3.5C1 10 3.5 11.8 6 12c2.5-.2 5-2 5-4.5V4L6 1z" stroke="var(--green)" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            ASSIGN DOCS TO EXPERTS
            {ragDocuments.length > 0 && (
              <span className="chat__rag-doc-count">{ragDocuments.length}</span>
            )}
          </button>
        )}

        <div className="chat__sidebar-footer">
          <span className="chat__sidebar-tier" style={{ color: TIER_COLOR[userTier] }}>
            {userTier.toUpperCase()}
          </span>
          <span className="chat__sidebar-tools">{enabledTools.size} TOOLS</span>
          <button className="chat__sidebar-manage" onClick={() => navigate('tools')}>MANAGE →</button>
        </div>
      </aside>

      <div className="chat__main">
        <div className="chat__header">
          <div className="chat__header-left">
            <div className="chat__title-row">
              <h2 className="chat__title">{sessionTitle}</h2>
              <button className="chat__title-edit-btn" onClick={() => setEditingSession(activeSession)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            {sessionTopic && <p className="chat__header-topic">{sessionTopic}</p>}
            <div className="chat__active-agents">
              {activeAgents.map(a => (
                <span key={a} className="chat__agent-badge"
                  style={{ borderColor: ALL_AGENTS[a]?.color, color: ALL_AGENTS[a]?.color }}>
                  {a.replace(/_/g, ' ')}
                </span>
              ))}
              <button className="chat__agents-edit" onClick={() => setShowAgentPicker(true)}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="chat__header-actions">
            <button className="chat__header-btn" onClick={() => setShowCreateVote(true)}>📊 VOTE</button>
            <button className="chat__header-btn" onClick={() => openNotion(activeSessionId)}>WORKSPACE</button>
            <button className="chat__header-btn" onClick={() => navigate('report')}>REPORT</button>
          </div>
        </div>

        {sessionGoal && (
          <div className="chat__goal-banner">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <circle cx="5.5" cy="5.5" r="4.5" stroke="var(--green)" strokeWidth="1.2"/>
              <path d="M5.5 3v2.5l1.5 1.5" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="chat__goal-label">GOAL</span>
            <span className="chat__goal-text">{sessionGoal}</span>
          </div>
        )}

        {pinnedMsgs.length > 0 && (
          <div className="chat__pinned-bar">
            <span>📌</span>
            <span className="chat__pinned-count">{pinnedMsgs.length} PINNED</span>
            <span className="chat__pinned-preview">{pinnedMsgs[0].content.slice(0, 50)}…</span>
          </div>
        )}

        <div className="chat__messages">
          {messages.length === 0 && !isThinking ? (
            <div className="chat__welcome-container">
              <div className="chat__welcome-icon">⚡️</div>
              <h1 className="chat__welcome-title">LET'S START<br/>THE MEETING</h1>
              <p className="chat__welcome-subtitle">
                Your expert team is ready to assist. Type a message or attach a file to begin the discussion.
              </p>
            </div>
          ) : (
            messages.map(msg => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="chat__system-msg">
                    <span>{msg.content}</span>
                  </div>
                );
              }

              if (msg.type === 'vote') {
                return (
                  <div key={msg.id} className={`chat__msg chat__msg--user`}>
                    <div className="chat__msg-body">
                      <div className="chat__poll">
                        <div className="chat__poll-title">📊 {msg.title}</div>
                        <div className="chat__poll-options">
                          {msg.options.map((opt, idx) => {
                            const totalVotes = msg.options.reduce((sum, o) => sum + o.votes.length, 0);
                            const pct = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                            return (
                              <div key={idx} className="chat__poll-option">
                                <div className="chat__poll-opt-header">
                                  <span className="chat__poll-opt-text">{opt.text}</span>
                                  <span className="chat__poll-opt-pct">{pct}% ({opt.votes.length})</span>
                                </div>
                                <div className="chat__poll-bar">
                                  <div className="chat__poll-bar-fill" style={{ width: `${pct}%` }}></div>
                                </div>
                                {opt.votes.length > 0 && (
                                  <div className="chat__poll-voters">
                                    {opt.votes.map(v => (
                                      <span key={v} className="chat__poll-voter-dot" style={{ background: ALL_AGENTS[v]?.color }} title={v} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              const isPinned = pinnedIds.includes(msg.id);
              return (
                <div key={msg.id} className={`chat__msg chat__msg--${msg.type} ${isPinned ? 'chat__msg--pinned' : ''}`}>
                  {msg.type === 'agent' && (
                    <div className="chat__msg-avatar"
                      style={{ background: ALL_AGENTS[msg.role]?.bg, borderColor: ALL_AGENTS[msg.role]?.color }}>
                      <span style={{ color: ALL_AGENTS[msg.role]?.color, fontSize: '8px', fontWeight: 700, fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em' }}>
                        {ALL_AGENTS[msg.role]?.short}
                      </span>
                    </div>
                  )}
                  <div className="chat__msg-body">
                    {msg.type === 'agent' && (
                      <div className="chat__msg-meta">
                        <span className="chat__msg-role" style={{ color: ALL_AGENTS[msg.role]?.color }}>
                          {msg.role.replace(/_/g, ' ')}
                        </span>
                        <span className="chat__msg-time">{msg.time}</span>
                        {isPinned && <span className="chat__msg-pin-badge">📌</span>}
                      </div>
                    )}
                    <div className="chat__msg-content">
                      <MessageText content={msg.content} />
                    </div>

                    {msg.attachments?.length > 0 && (
                      <div className="chat__msg-attachments">
                        {msg.attachments.map((a, i) => (
                          <span key={i} className="chat__msg-attach-badge">
                            {a.type?.startsWith('image/') ? '🖼' : '📎'} {a.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="chat__msg-footer">
                      <div className="chat__msg-actions">
                        {msg.type === 'agent' && (
                          <div className="chat__help-menu-wrapper">
                            <button className="chat__action-btn" onClick={() => setOpenHelpId(openHelpId === msg.id ? null : msg.id)}>?</button>
                            {openHelpId === msg.id && (
                              <div className="chat__help-menu">
                                <button className="chat__help-menu-item" onClick={() => handleQuickAction(msg, 'follow_up')}>추가 질문하기</button>
                                <button className="chat__help-menu-item" onClick={() => handleQuickAction(msg, 'redirect')}>방향성 수정하기</button>
                                <button className="chat__help-menu-item" onClick={() => handleQuickAction(msg, 'elaborate')}>더 자세히 설명하기</button>
                                <button className="chat__help-menu-item" onClick={() => handleQuickAction(msg, 'summarize')}>핵심만 요약하기</button>
                              </div>
                            )}
                          </div>
                        )}
                        {msg.type === 'agent' && (
                          <button className="chat__action-btn" onClick={() => handleQuickAction(msg, 'follow_up')}>↩</button>
                        )}
                      </div>
                    </div>
                  </div>
                  {msg.type === 'user' && (
                    <div className="chat__msg-avatar chat__msg-avatar--user">
                      <span>{user ? (user.name || user.email || '?')[0].toUpperCase() : 'U'}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isThinking && (
            <div className="chat__msg chat__msg--agent">
              <div className="chat__msg-avatar"
                style={{ background: ALL_AGENTS[currentSpeaker || activeAgents[0]]?.bg, borderColor: ALL_AGENTS[currentSpeaker || activeAgents[0]]?.color }}>
                <span style={{ color: ALL_AGENTS[currentSpeaker || activeAgents[0]]?.color, fontSize: '8px', fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>
                  {ALL_AGENTS[currentSpeaker || activeAgents[0]]?.short}
                </span>
              </div>
              <div className="chat__msg-body">
                <div className="chat__msg-meta">
                  <span className="chat__msg-role" style={{ color: ALL_AGENTS[currentSpeaker || activeAgents[0]]?.color }}>
                    {currentSpeaker ? `${currentSpeaker.replace(/_/g, ' ')} IS TYPING...` : 'EXPERT IS THINKING...'}
                  </span>
                </div>
                <div className="chat__typing"><span/><span/><span/></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat__input-area">
          <div className="chat__auto-bar">
            <div className="chat__auto-status">
              <span className={`chat__auto-status-dot ${autoMode || isThinking ? 'chat__auto-status-dot--active' : 'chat__auto-status-dot--inactive'}`} />
              {autoMode ? 'AUTO MEETING IN PROGRESS...' : isThinking ? 'EXPERTS ARE THINKING...' : 'AUTO MEETING PAUSED'}
            </div>
            {(autoMode || isThinking) ? (
              <button className="chat__auto-btn chat__auto-btn--stop" onClick={toggleAutoMode}>■ STOP</button>
            ) : (
              <button className="chat__auto-btn chat__auto-btn--play" onClick={toggleAutoMode}>▶ RESUME</button>
            )}
          </div>

          <FilePreview files={attachedFiles} onRemove={i => setAttachedFiles(p => p.filter((_, idx) => idx !== i))} />

          {/* ✅ [새 기능 UI] 추출된 질문 목록 렌더링 영역 */}
          {pendingQuestions.length > 0 && (
            <div style={{ marginBottom: '10px', background: 'var(--gray-100)', border: '1.5px solid var(--gray-200)', borderRadius: '10px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 700, color: 'var(--gray-600)', letterSpacing: '0.05em' }}>
                  🤔 전문가들이 질문을 남겼습니다:
                </span>
                <button onClick={() => setPendingQuestions([])} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--gray-400)' }}>
                  ✕ 무시하기
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                {pendingQuestions.map((q, idx) => (
                  <button key={idx} 
                    style={{ display: 'flex', gap: '8px', textAlign: 'left', background: 'var(--white)', border: '1px solid var(--gray-200)', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', transition: 'border 0.2s' }}
                    onClick={() => {
                      setInput(prev => prev + (prev ? '\n\n' : '') + `[@${q.agent} 질문에 대한 답변: "${q.text}"]\n`);
                      inputRef.current?.focus();
                      setPendingQuestions(prev => prev.filter((_, i) => i !== idx));
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--black)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-200)'}
                  >
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 700, color: ALL_AGENTS[q.agent]?.color, flexShrink: 0, marginTop: '2px' }}>
                      @{ALL_AGENTS[q.agent]?.short}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--black)', lineHeight: 1.4 }}>{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="chat__input-wrap">
            {showMention && (
              <div className="chat__mention-dropdown">
                <div className="chat__mention-header">TAG EXPERT — ↑↓ NAVIGATE  ENTER SELECT  ESC CLOSE</div>
                {mentionAgents.map((agent, idx) => (
                  <button key={agent}
                    className={`chat__mention-item ${idx === mentionIdx ? 'chat__mention-item--selected' : ''}`}
                    onClick={() => insertMention(agent)}
                  >
                    <span className="chat__mention-dot" style={{ background: ALL_AGENTS[agent]?.color }} />
                    <span className="chat__mention-name" style={{ color: ALL_AGENTS[agent]?.color }}>
                      {agent.replace(/_/g, ' ')}
                    </span>
                    <span className="chat__mention-desc">{ALL_AGENTS[agent]?.desc}</span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={inputRef}
              className="chat__input"
              placeholder="Message your team… @ to mention · 📎 attach files · ↵ to send · ⇧↵ newline"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />

            <div className="chat__input-actions">
              <button className="chat__attach-btn" onClick={() => fileInputRef.current?.click()}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M12 6.5l-5.5 5.5a3.5 3.5 0 01-5-5l6-6a2 2 0 013 3L4 10a.5.5 0 01-.7-.7L9 3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
                accept="image/*,.pdf,.txt,.md,.csv,.docx,.xlsx,.pptx,.json,.py,.js,.ts,.jsx,.tsx"
                onChange={handleFileAttach}
              />
              <span className="chat__input-hint">⇧↵ NEWLINE</span>
              <button
                className={`chat__send-btn ${(input.trim() || attachedFiles.length) ? 'chat__send-btn--active' : ''}`}
                onClick={sendMessage}
                disabled={(!input.trim() && !attachedFiles.length) || isThinking}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M12 7H2M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="chat__input-toolbar">
            <span className="chat__tools-label">QUICK TAG:</span>
            {activeAgents.slice(0, 4).map(a => (
              <button key={a} className="chat__quick-mention"
                style={{ borderColor: ALL_AGENTS[a]?.color + '55', color: ALL_AGENTS[a]?.color }}
                onClick={() => { setInput(p => p + `@${a} `); inputRef.current?.focus(); }}>
                @{a.replace(/_/g, ' ')}
              </button>
            ))}
            <div className="chat__toolbar-sep" />
            <button className="chat__toolbar-icon-btn" onClick={() => setShowCreateVote(true)}>📊</button>
            <button className="chat__toolbar-icon-btn" onClick={() => openNotion(activeSessionId)}>📄</button>
            {enabledTools.size === 0
              ? <button className="chat__tool-chip chat__tool-chip--warn" onClick={() => navigate('tools')}>NO TOOLS</button>
              : ['rag', 'web_search', 'yfinance'].filter(t => enabledTools.has(t)).slice(0, 3).map(t => (
                  <span className="chat__tool-chip chat__tool-chip--on" key={t}>{t.replace(/_/g, ' ').toUpperCase()}</span>
                ))
            }
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {(showNewModal || editingSession) && (
        <SessionModal
          initial={editingSession}
          userTier={userTier}
          onClose={() => {
            setShowNewModal(false);
            setEditingSession(null);
          }}
          onConfirm={data => {
            if (editingSession) {
              handleEditSession(data);
            } else {
              handleNewSession(data);
            }
          }}
        />
      )}

      {sessionToDelete && (
        <DeleteConfirmModal onClose={() => setSessionToDelete(null)}
          onConfirm={() => {
            const isDeletingActive = sessionToDelete === activeSessionId;
            deleteSession(sessionToDelete);

            // 삭제하는 세션이 현재 활성화된 세션일 경우 처리
            if (isDeletingActive) {
              const remaining = sessions.filter(s => s.id !== sessionToDelete && !s._deleted);
              if (remaining.length > 0) {
                // 다른 세션이 남아있다면 첫 번째 남은 세션으로 이동
                setActiveSessionId(remaining[0].id);
              } else {
                // 남은 세션이 없다면 초기 상태(새 세션 시작 대기 상태)로 변경
                setActiveSessionId(null);
                setMessages([]);
                setSessionTitle('New Session');
                setSessionTopic('');
                setSessionGoal('');
              }
            }
            setSessionToDelete(null);
          }} />
      )}

      {showCreateVote && (
        <CreateVoteModal onClose={() => setShowCreateVote(false)}
          onLaunch={(config) => {
            const voteMsgId = gid();
            const voteMsg = {
              id: voteMsgId, role: 'USER', type: 'vote', title: config.title,
              options: config.options.map(o => ({ text: o, votes: [] })),
              time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            };
            setMessages(prev => [...prev, voteMsg]);
            setShowCreateVote(false);

            setTimeout(() => {
              setMessages(prev => prev.map(m => {
                if (m.id !== voteMsgId) return m;
                const newOpts = [...m.options];
                activeAgents.forEach(agent => {
                  const optIdx = Math.floor(Math.random() * newOpts.length);
                  if (!newOpts[optIdx].votes.includes(agent)) newOpts[optIdx].votes.push(agent);
                });
                return { ...m, options: newOpts };
              }));
            }, 1800);
          }}
        />
      )}

      {showRagModal && (
        <AgentRAGModal agents={activeAgents} documents={ragDocuments} agentDocMap={agentDocMap}
          onSave={map => { setAgentDocMap(map); setShowRagModal(false); }} onClose={() => setShowRagModal(false)} />
      )}

      {showAgentPicker && (
        <div className="chat__modal-overlay" onClick={() => setShowAgentPicker(false)}>
          <div className="chat__modal" onClick={e => e.stopPropagation()}>
            <div className="chat__modal-header">
              <span>MANAGE TEAM</span>
              <span className="chat__modal-count">{activeAgents.length} ACTIVE</span>
              <button onClick={() => setShowAgentPicker(false)}>✕</button>
            </div>
            <p className="chat__modal-hint">Each expert operates independently with their own perspective and memory.</p>
            <div className="chat__modal-agents">
              {Object.entries(groupedAgents).map(([cat, catAgents]) => (
                <div key={cat} style={{ marginBottom: '12px' }}>
                  <div className="chat__modal-category-title">{cat.toUpperCase()}</div>
                  {catAgents.map(([name, agent]) => {
                    const isActive = activeAgents.includes(name);
                    const isLocked = !agentAllowed(userTier, agent.minTier);
                    return (
                      <button key={name} style={{ marginBottom: '4px' }}
                        className={`chat__modal-agent ${isActive ? 'chat__modal-agent--active' : ''} ${isLocked ? 'chat__modal-agent--locked' : ''}`}
                        onClick={() => !isLocked && setActiveAgents(prev => prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name])}
                      >
                        <span className="chat__modal-dot" style={{ background: isLocked ? '#555' : agent.color }} />
                        <span>
                          <span className="chat__modal-agent-name" style={isActive ? { color: agent.color } : isLocked ? { color: '#555' } : {}}>
                            {name.replace(/_/g, ' ')}
                          </span>
                          <span className="chat__modal-agent-desc">{isLocked ? `Requires ${agent.minTier}+ tier` : agent.desc}</span>
                        </span>
                        {isActive && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                          <path d="M2 6l3 3 5-5" stroke={agent.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>}
                        {isLocked && <span style={{ marginLeft: 'auto', fontSize: 11 }}>🔒</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <button className="chat__modal-confirm" onClick={() => setShowAgentPicker(false)}>
              CONFIRM ({activeAgents.length} EXPERTS)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}