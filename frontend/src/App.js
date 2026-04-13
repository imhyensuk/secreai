import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import Header  from './components/header/header';
import Main    from './components/main/main';
import Contact from './components/contact/contact';
import Chat    from './components/chat/chat';
import Tools   from './components/tools/tools';
import Storage from './components/storage/storage';
import Report  from './components/report/report';
import Notion  from './components/notion/notion';
import Login   from './components/login/login';
import Pricing from './components/pricing/pricing';
import RAG     from './components/rag/rag';
import { auth as authAPI, userData as userDataAPI, setToken, clearToken, analytics } from './api';

// Pages that require authentication
const PROTECTED_PAGES = ['chat', 'storage', 'tools', 'rag', 'report'];

const TIER_DEFAULT_TOOLS = {
  free:    new Set(['web_search', 'wikipedia', 'file_read', 'perm_network', 'calculator', 'weather', 'currency']),
  pro:     new Set(['web_search', 'tavily', 'wikipedia', 'news_api', 'rss', 'yfinance', 'python',
                    'file_read', 'file_write', 'perm_network', 'rag', 'calculator', 'weather', 'currency',
                    'summarizer', 'translator', 'code_analyzer']),
  ultra:   new Set(['web_search', 'tavily', 'wikipedia', 'news_api', 'rss', 'yfinance', 'python',
                    'file_read', 'file_write', 'perm_network', 'rag', 'calculator', 'weather', 'currency',
                    'summarizer', 'translator', 'code_analyzer', 'chart_generator', 'swot', 'pros_cons', 'timeline', 'insight']),
  student: new Set(['web_search', 'tavily', 'wikipedia', 'news_api', 'rss', 'python',
                    'file_read', 'file_write', 'perm_network', 'rag', 'calculator', 'weather', 'currency',
                    'summarizer', 'translator']),
};

const GUEST_SESSIONS = [{
  id: 'guest-s1', title: 'Sample Session', topic: '', goal: '',
  agents: ['DATA_ANALYSIS', 'STRATEGY'], messages: [],
  messageCount: 0, duration: '—', date: 'Today', tags: [], report: null,
}];

// ── Login Gate (문구 수정) ────────────────────────────────────────────────────────
function LoginGate({ page, navigate }) {
  const PAGE_NAMES = {
    chat:    'CHAT',
    storage: 'STORAGE',
    tools:   'TOOLS & PERMISSIONS',
    rag:     'KNOWLEDGE BASE',
    report:  'REPORTS',
  };

  return (
    <div className="login-gate-container">
      <div className="login-gate-content">
        <div className="login-gate-left">
          <span className="login-gate-label">AUTHENTICATION REQUIRED</span>
          <h1 className="login-gate-title">ACCESS<br/>RESTRICTED</h1>
          <p className="login-gate-text">
            Access to <strong>{PAGE_NAMES[page] || page?.toUpperCase()}</strong> requires an active account.
            <br /><br />
            Please log in to continue and access your workspace.
          </p>
        </div>

        <div className="login-gate-right">
          <div className="login-status-box">
            <div className="status-time">LOCKED</div>
            <div className="status-date">Requires active session</div>
            <div className="status-icon">🔒 Unauthorized Access</div>
          </div>

          <div className="login-gate-actions">
            <button className="btn-primary-black" onClick={() => navigate('login')}>
              SECURE LOGIN &rarr;
            </button>
            <button className="btn-outline-gray" onClick={() => navigate('main')}>
              GO BACK HOME
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentPage,      setCurrentPage]      = useState('main');
  const [sidebarCollapsed, setSidebarCollapsed]  = useState(false);
  const [user,             setUser]              = useState(null);
  const [authLoading,      setAuthLoading]       = useState(true);
  const [sessions,         setSessions]          = useState(GUEST_SESSIONS);
  const [activeSessionId,  setActiveSessionId]   = useState('guest-s1');
  const [files,            setFiles]             = useState([]);
  const [enabledTools,     setEnabledTools]      = useState(TIER_DEFAULT_TOOLS.free);
  const [notionOpen,       setNotionOpen]        = useState(false);
  const [notionSessionId,  setNotionSessionId]   = useState(null);

  const navigate = useCallback((page) => setCurrentPage(page), []);

  const loadUserData = useCallback(async (tier = 'free') => {
    try {
      const [dataRes, settingsRes] = await Promise.all([
        userDataAPI.load(),
        userDataAPI.loadSettings(),
      ]);
      if (dataRes.sessions?.length) {
        setSessions(dataRes.sessions);
        setActiveSessionId(dataRes.sessions[0].id);
      } else {
        setSessions([]);
      }
      if (dataRes.files?.length) setFiles(dataRes.files);
      const saved = settingsRes.enabled_tools || [];
      setEnabledTools(
        saved.length > 0
          ? new Set(saved)
          : (TIER_DEFAULT_TOOLS[tier] || TIER_DEFAULT_TOOLS.free)
      );
    } catch (err) {
      console.warn('loadUserData failed:', err.message);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem('sb_token');
      if (token) {
        setToken(token);
        try {
          const ud   = await authAPI.me();
          const tier = ud.tier || 'free';
          const name = ud.name || ud.email?.split('@')[0] || 'User';
          setUser({ ...ud, name, tier, plan: tier });
          await loadUserData(tier);
        } catch {
          clearToken();
          localStorage.removeItem('sb_token');
        }
      }
      setAuthLoading(false);
    };
    restore();
  }, [loadUserData]);

  const handleLogin = useCallback(async (ud) => {
    const tier = ud.tier || 'free';
    const name = ud.name || ud.email?.split('@')[0] || 'User';
    setUser({ ...ud, name, tier, plan: tier });
    if (ud.access_token) {
      setToken(ud.access_token);
      localStorage.setItem('sb_token', ud.access_token);
    }
    await loadUserData(tier);
    analytics.track('login', { tier });
    navigate('chat');
  }, [navigate, loadUserData]);

  const handleLogout = useCallback(() => {
    authAPI.logout();
    clearToken();
    localStorage.removeItem('sb_token');
    setUser(null);
    setSessions(GUEST_SESSIONS);
    setFiles([]);
    setEnabledTools(TIER_DEFAULT_TOOLS.free);
    setActiveSessionId('guest-s1');
    navigate('main');
  }, [navigate]);

  const saveSession = useCallback(async (s) => {
    setSessions(prev => {
      const exists = prev.find(p => p.id === s.id);
      return exists ? prev.map(p => p.id === s.id ? s : p) : [s, ...prev];
    });
    if (user) userDataAPI.saveSession(s).catch(() => {});
  }, [user]);

  const deleteSession = useCallback(async (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (user) userDataAPI.deleteSession(id).catch(() => {});
  }, [user]);

  const addFile = useCallback(async (file) => {
    setFiles(prev => [file, ...prev]);
    if (user) userDataAPI.saveFile(file).catch(() => {});
  }, [user]);

  const toggleTool = useCallback(async (toolId) => {
    setEnabledTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId); else next.add(toolId);
      if (user) userDataAPI.updateEnabledTools(next).catch(() => {});
      return next;
    });
  }, [user]);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0D0D0D' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px',
          letterSpacing: '0.14em', color: '#00FF66' }}>LOADING...</div>
      </div>
    );
  }

  const isMainPage  = currentPage === 'main';
  const isFullPage  = currentPage === 'login' || currentPage === 'pricing';
  const hasSidebar  = !isMainPage && !isFullPage;
  const needsLogin  = PROTECTED_PAGES.includes(currentPage) && !user;

  const renderPage = () => {
    // Show login gate for protected pages when not logged in
    if (needsLogin) {
      return <LoginGate page={currentPage} navigate={navigate} />;
    }

    switch (currentPage) {
      case 'main':
        return <Main navigate={navigate} user={user} />;
      case 'contact':
        return <Contact user={user} />;
      case 'chat':
        return (
          <Chat
            user={user}
            sessions={sessions}
            activeSessionId={activeSessionId}
            setActiveSessionId={setActiveSessionId}
            saveSession={saveSession}
            deleteSession={deleteSession}
            addFile={addFile}
            openNotion={(id) => { setNotionSessionId(id); setNotionOpen(true); }}
            navigate={navigate}
            enabledTools={enabledTools}
          />
        );
      case 'tools':
        return <Tools enabledTools={enabledTools} toggleTool={toggleTool} user={user} navigate={navigate} />;
      case 'storage':
        return (
          <Storage
            sessions={sessions}
            files={files}
            openSession={(id) => { setActiveSessionId(id); navigate('chat'); }}
            openReport={(id)  => { setActiveSessionId(id); navigate('report'); }}
            navigate={navigate}
            user={user}
          />
        );
      case 'report':
        return (
          <Report
            sessions={sessions}
            activeSessionId={activeSessionId}
            setActiveSessionId={setActiveSessionId}
            user={user}
          />
        );
      case 'rag':
        return <RAG user={user} navigate={navigate} enabledTools={enabledTools} />;
      case 'login':
        return <Login onLogin={handleLogin} navigate={navigate} />;
      case 'pricing':
        return <Pricing user={user} navigate={navigate} />;
      default:
        return <Main navigate={navigate} user={user} />;
    }
  };

  return (
    <div className={`app ${hasSidebar ? 'app--dashboard' : 'app--full'}`}>
      {hasSidebar && (
        <Header
          currentPage={currentPage}
          navigate={navigate}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          user={user}
          onLogout={handleLogout}
        />
      )}
      <main
        className={`app__content ${
          hasSidebar
            ? sidebarCollapsed
              ? 'app__content--collapsed'
              : 'app__content--sidebar'
            : ''
        }`}
      >
        {renderPage()}
      </main>

      {notionOpen && (
        <Notion
          sessionId={notionSessionId}
          sessionTitle={sessions.find(s => s.id === notionSessionId)?.title || 'Workspace'}
          onClose={() => setNotionOpen(false)}
          addFile={addFile}
        />
      )}
    </div>
  );
}