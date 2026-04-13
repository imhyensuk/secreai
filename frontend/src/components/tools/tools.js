import React, { useState } from 'react';
import './tools.css';

// Tier access map: tool id → minimum tier
const TOOL_TIER_REQUIREMENTS = {
  web_search:   'free',
  wikipedia:    'free',
  file_read:    'free',
  perm_network: 'free',
  news_api:     'pro',
  rss:          'pro',
  yfinance:     'pro',
  python:       'pro',
  file_write:   'pro',
  tavily:       'pro',
  rag:          'pro',     // student also
  github:       'ultra',
  slack:        'ultra',
  perm_persist: 'ultra',
  perm_user_data:'free',
};

const TIER_ORDER = ['free', 'pro', 'student', 'ultra'];
const TIER_RANK  = { free: 0, student: 1, pro: 2, ultra: 3 };

function tierAllows(userTier, requiredTier, toolId) {
  if (!userTier) return requiredTier === 'free';
  // student has special access same as pro for most tools except ultra
  const rank = TIER_RANK[userTier] ?? 0;
  const req  = TIER_RANK[requiredTier] ?? 0;
  // Student gets pro-level access for non-ultra tools
  if (userTier === 'student' && requiredTier === 'pro') return true;
  return rank >= req;
}

export const TOOL_REGISTRY = [
  // Search
  { id: 'web_search',   category: 'search',      name: 'Web Search',           desc: 'Real-time Google search via SerpAPI.',                        status: 'stable',       backendKey: 'serp'    },
  { id: 'tavily',       category: 'search',      name: 'Tavily AI Search',     desc: 'LLM-optimized deep web research with structured results.',   status: 'stable',       backendKey: 'tavily'  },
  { id: 'wikipedia',    category: 'search',      name: 'Wikipedia',            desc: 'Encyclopedic knowledge retrieval.',                          status: 'stable',       backendKey: null      },
  { id: 'news_api',     category: 'search',      name: 'News API',             desc: 'Real-time and historical news from global publications.',     status: 'stable',       backendKey: 'news'    },
  { id: 'rss',          category: 'search',      name: 'RSS Feed Reader',      desc: 'Parse RSS/Atom feeds for live content.',                     status: 'stable',       backendKey: 'rss'     },
  // Finance
  { id: 'yfinance',     category: 'finance',     name: 'Yahoo Finance',        desc: 'Stock prices, fundamentals, and market data.',               status: 'stable',       backendKey: 'yfinance'},
  // Code
  { id: 'python',       category: 'code',        name: 'Python Executor',      desc: 'Run Python code in a sandboxed environment.',                status: 'stable',       backendKey: null      },
  // Files
  { id: 'file_read',    category: 'files',       name: 'File Reader',          desc: 'Read uploaded documents (PDF, DOCX, CSV, TXT).',             status: 'stable',       backendKey: null      },
  { id: 'file_write',   category: 'files',       name: 'File Writer',          desc: 'Generate and save output files to storage.',                 status: 'stable',       backendKey: null      },
  // RAG
  { id: 'rag',          category: 'knowledge',   name: 'RAG Knowledge Base',   desc: 'Retrieve context from your uploaded documents during chat.',  status: 'stable',       backendKey: 'rag'     },
  // APIs
  { id: 'github',       category: 'apis',        name: 'GitHub API',           desc: 'Access repositories, issues, and pull requests.',            status: 'beta',         backendKey: null      },
  { id: 'slack',        category: 'apis',        name: 'Slack API',            desc: 'Send session summaries and actions to Slack channels.',       status: 'beta',         backendKey: null      },
  // Permissions
  { id: 'perm_network', category: 'permissions', name: 'Network Access',       desc: 'Allow outbound HTTP requests to external services.',         status: 'stable',       backendKey: null      },
  { id: 'perm_persist', category: 'permissions', name: 'Persistent Memory',    desc: 'Store and recall information across sessions.',              status: 'beta',         backendKey: null      },
  { id: 'perm_user_data',category:'permissions', name: 'User Data Access',     desc: 'Allow agents to reference your profile and past sessions.',  status: 'stable',       backendKey: null      },
];

const CATEGORIES = [
  { id: 'all',         label: 'ALL TOOLS' },
  { id: 'search',      label: 'SEARCH & DATA' },
  { id: 'finance',     label: 'FINANCIAL' },
  { id: 'code',        label: 'CODE' },
  { id: 'files',       label: 'FILES' },
  { id: 'knowledge',   label: 'KNOWLEDGE' },
  { id: 'apis',        label: 'EXTERNAL APIS' },
  { id: 'permissions', label: 'PERMISSIONS' },
];

const STATUS_META = {
  stable:       { bg: '#00FF6615', color: '#00CC52', label: 'STABLE' },
  beta:         { bg: '#FFD16618', color: '#B8860B', label: 'BETA'   },
  experimental: { bg: '#FF6B6B15', color: '#CC4444', label: 'ALPHA'  },
};

const TIER_COLORS = { free: '#888', pro: '#0984E3', ultra: '#6C5CE7', student: '#00B894' };

export default function Tools({ enabledTools, toggleTool, user }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery,    setSearchQuery]    = useState('');
  const userTier = user?.tier || 'free';

  const enabledCount = TOOL_REGISTRY.filter(t => enabledTools.has(t.id)).length;

  const visible = TOOL_REGISTRY.filter(t => {
    const matchCat = activeCategory === 'all' || t.category === activeCategory;
    const matchQ   = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQ;
  });

  const grouped = CATEGORIES.slice(1).reduce((acc, cat) => {
    const tools = visible.filter(t => t.category === cat.id);
    if (tools.length) acc.push({ ...cat, tools });
    return acc;
  }, []);

  const displayGroups = activeCategory === 'all'
    ? grouped
    : [{ id: activeCategory, label: CATEGORIES.find(c => c.id === activeCategory)?.label || '', tools: visible }];

  return (
    <div className="tools">
      <div className="tools__header">
        <div className="tools__header-left">
          <span className="tools__eyebrow">CONFIGURATION</span>
          <h1 className="tools__title">TOOLS & PERMISSIONS</h1>
          <p className="tools__subtitle">
            Only enabled tools are accessible to AI agents. Disabled tools are completely blocked — no API calls are made for them.
            {userTier !== 'ultra' && (
              <span className="tools__tier-note"> Some tools require a higher tier. <button onClick={() => {}} className="tools__upgrade-link">Upgrade →</button></span>
            )}
          </p>
        </div>
        <div className="tools__header-stats">
          <div className="tools__stat"><span className="tools__stat-num">{enabledCount}</span><span className="tools__stat-label">ENABLED</span></div>
          <div className="tools__stat-divider" />
          <div className="tools__stat"><span className="tools__stat-num">{TOOL_REGISTRY.length - enabledCount}</span><span className="tools__stat-label">BLOCKED</span></div>
          <div className="tools__stat-divider" />
          <div className="tools__stat">
            <span className="tools__stat-num" style={{ color: TIER_COLORS[userTier] }}>{userTier.toUpperCase()}</span>
            <span className="tools__stat-label">YOUR TIER</span>
          </div>
        </div>
      </div>

      <div className="tools__permission-notice">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="var(--green)" strokeWidth="1.3"/><path d="M7 5v3M7 9.5v.5" stroke="var(--green)" strokeWidth="1.3" strokeLinecap="round"/></svg>
        AI agents can <strong>only call tools that are enabled AND permitted by your tier</strong>. Tier restrictions are enforced server-side regardless of toggle state.
      </div>

      <div className="tools__filters">
        <div className="tools__search-wrap">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="tools__search-icon"><circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/><path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <input className="tools__search" placeholder="SEARCH TOOLS..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="tools__category-tabs">
          {CATEGORIES.map(c => (
            <button key={c.id} className={`tools__cat-tab ${activeCategory === c.id ? 'tools__cat-tab--active' : ''}`} onClick={() => setActiveCategory(c.id)}>{c.label}</button>
          ))}
        </div>
      </div>

      <div className="tools__content">
        {displayGroups.map(group => (
          <div key={group.id} className="tools__category">
            <div className="tools__category-header">
              <span className="tools__category-label">{group.label}</span>
              <span className="tools__category-count">{group.tools.filter(t => enabledTools.has(t.id)).length}/{group.tools.length} ENABLED</span>
            </div>
            <div className="tools__grid">
              {group.tools.map(tool => {
                const s         = STATUS_META[tool.status] || STATUS_META.stable;
                const isEnabled = enabledTools.has(tool.id);
                const reqTier   = TOOL_TIER_REQUIREMENTS[tool.id] || 'free';
                const isLocked  = !tierAllows(userTier, reqTier, tool.id);

                return (
                  <div key={tool.id} className={`tools__card ${isEnabled && !isLocked ? 'tools__card--enabled' : ''} ${isLocked ? 'tools__card--locked' : ''}`}>
                    {isEnabled && !isLocked && <div className="tools__card-active-bar" />}
                    {isLocked && (
                      <div className="tools__lock-overlay">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M4 6V5a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.3"/></svg>
                        <span>{reqTier.toUpperCase()}+ REQUIRED</span>
                      </div>
                    )}
                    <div className="tools__card-top">
                      <div className="tools__card-name-row">
                        <span className="tools__card-name">{tool.name}</span>
                        <span className="tools__status-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                        {tool.backendKey && <span className="tools__backend-badge">API</span>}
                        {reqTier !== 'free' && (
                          <span className="tools__tier-badge" style={{ background: TIER_COLORS[reqTier] + '18', color: TIER_COLORS[reqTier] }}>
                            {reqTier.toUpperCase()}+
                          </span>
                        )}
                      </div>
                      <label className={`tools__toggle ${isLocked ? 'tools__toggle--locked' : ''}`}>
                        <input type="checkbox" checked={isEnabled && !isLocked} disabled={isLocked}
                          onChange={() => !isLocked && toggleTool(tool.id)} />
                        <span className="tools__toggle-track"><span className="tools__toggle-thumb" /></span>
                      </label>
                    </div>
                    <p className="tools__card-desc">{tool.desc}</p>
                    {isEnabled && !isLocked && (
                      <div className="tools__card-status">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="var(--green)" strokeWidth="1"/><path d="M2.5 5l2 2 3-3" stroke="var(--green)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        ACCESSIBLE TO AI
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}