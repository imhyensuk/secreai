import React, { useState, useRef, useEffect } from 'react';
import './header.css';

const NAV_ITEMS = [
  {
    id: 'chat', label: 'CHAT',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4a1.5 1.5 0 011.5-1.5h11A1.5 1.5 0 0116 4v7a1.5 1.5 0 01-1.5 1.5H6L2 16V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'storage', label: 'STORAGE',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4.5" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="10.5" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/><circle cx="4.5" cy="6.5" r=".8" fill="currentColor"/><circle cx="4.5" cy="12.5" r=".8" fill="currentColor"/></svg>,
  },
  {
    id: 'tools', label: 'TOOLS',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M13 2.5a2.5 2.5 0 00-2.5 2.5c0 .35.07.68.2 1L3 13.2 4.8 15l7.2-7.2c.32.13.65.2 1 .2a2.5 2.5 0 100-5.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'rag', label: 'KNOWLEDGE',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L3 5v4c0 3.3 2.6 6.4 6 7 3.4-.6 6-3.7 6-7V5L9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'report', label: 'REPORTS',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6 7h6M6 10h6M6 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  },
  {
    id: 'contact', label: 'CONTACT',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M2 6l7 5 7-5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  },
];

export default function Header({ currentPage, navigate, collapsed, setCollapsed, user, onLogout }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleMenuAction = (action) => {
    setUserMenuOpen(false);
    if (action === 'logout') { onLogout(); return; }
    navigate(action);
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>

      {/* ── Logo ── */}
      <div className="sidebar__top-row">
        <div className="sidebar__logo" onClick={() => navigate('main')}>
          <div className="sidebar__logo-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--green)"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          {!collapsed && <span className="sidebar__logo-text">secreai</span>}
        </div>
      </div>

      <div className="sidebar__divider" />

      {/* ── Navigation ── */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => navigate(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <span className="sidebar__nav-icon">{item.icon}</span>
              {!collapsed && <span className="sidebar__nav-label">{item.label}</span>}
              {collapsed && hoveredItem === item.id && (
                <span className="sidebar__tooltip">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__spacer" />
      <div className="sidebar__divider" />

      {/* ── User area ── */}
      <div className="sidebar__user-wrap" ref={userMenuRef}>
        <button className="sidebar__user" onClick={() => setUserMenuOpen(o => !o)} title="Account">
          <div className={`sidebar__avatar ${user ? 'sidebar__avatar--active' : ''}`}>
            {user ? (user.name || user.email || '?')[0].toUpperCase() : 'G'}
          </div>
          {!collapsed && (
            <>
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">
                  {user ? (user.name || user.email || 'USER').toUpperCase() : 'GUEST'}
                </span>
                <span className="sidebar__user-plan">
                  {user ? (user.tier || user.plan || 'free').toUpperCase() + ' PLAN' : 'NOT LOGGED IN'}
                </span>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                style={{ marginLeft: 'auto', flexShrink: 0, transition: 'transform .2s',
                         transform: userMenuOpen ? 'rotate(180deg)' : '' }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
        </button>

        {userMenuOpen && (
          <div className={`sidebar__user-menu ${collapsed ? 'sidebar__user-menu--collapsed' : ''}`}>
            {!user ? (
              <>
                <button className="sidebar__menu-item" onClick={() => handleMenuAction('login')}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 7h7M9 4l3 3-3 3M1 2h4v10H1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  LOGIN / SIGN UP
                </button>
                <button className="sidebar__menu-item" onClick={() => handleMenuAction('pricing')}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M7 4v6M5 5.5h3a1 1 0 010 2H6a1 1 0 000 2h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  PRICING
                </button>
              </>
            ) : (
              <>
                <div className="sidebar__menu-user-header">
                  <span className="sidebar__menu-user-name">{user.name || user.email || 'User'}</span>
                  <span className="sidebar__menu-user-email">{user.email}</span>
                </div>
                <div className="sidebar__menu-divider" />
                <button className="sidebar__menu-item" onClick={() => handleMenuAction('pricing')}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                  PRICING
                </button>
                <button className="sidebar__menu-item sidebar__menu-item--plan">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1l1.5 3H12l-2.8 2 1 3.2L7 7.3l-3.2 1.9L4.8 6 2 4h3.5L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  </svg>
                  {(user.tier || user.plan || 'free').toUpperCase()} PLAN
                </button>
                <div className="sidebar__menu-divider" />
                <button className="sidebar__menu-item sidebar__menu-item--danger" onClick={() => handleMenuAction('logout')}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M9 7H2M6 4l-3 3 3 3M5 2H2v10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  LOGOUT
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Toggle Button (Bottom) ── */}
      <div className="sidebar__bottom-row">
        <button
          className="sidebar__collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            style={{ transform: collapsed ? 'rotate(180deg)' : '', transition: 'transform .28s' }}>
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

    </aside>
  );
}