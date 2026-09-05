import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ZenoMark } from '@/components/brand/Logo';
import {
  LayoutDashboard, Users, Receipt, Network, FileSearch,
  BarChart3, FileText, Database, Settings,
  Moon, Sun, Monitor, ChevronDown, AlertTriangle,
  LogOut, Menu, X, Activity, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── nav structure ─────────────────────────────────────── */
const NAV = [
  {
    section: 'OVERVIEW',
    items: [{ name: 'Dashboard',      href: '/dashboard',      icon: LayoutDashboard }],
  },
  {
    section: 'INVESTIGATE',
    items: [
      { name: 'Customers',      href: '/customers',      icon: Users       },
      { name: 'Transactions',   href: '/transactions',   icon: Receipt     },
      { name: 'Risk Clusters',  href: '/clusters',       icon: Network     },
      { name: 'Investigations', href: '/investigations', icon: FileSearch  },
      { name: 'Live Events',    href: '/live-events',    icon: Activity    },
    ],
  },
  {
    section: 'MEASURE',
    items: [{ name: 'Evaluation', href: '/evaluation', icon: BarChart3 }],
  },
  {
    section: 'SYSTEM',
    items: [
      { name: 'Audit Trail', href: '/audit',    icon: FileText  },
      { name: 'Dataset',     href: '/dataset',  icon: Database  },
      { name: 'Settings',    href: '/settings', icon: Settings  },
    ],
  },
];

/* ─── theme helpers ─────────────────────────────────────── */
type Theme = 'light' | 'dark' | 'system';
const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];
const THEME_ICON: Record<Theme, React.ReactNode> = {
  light:  <Sun     className="h-4 w-4" />,
  dark:   <Moon    className="h-4 w-4" />,
  system: <Monitor className="h-4 w-4" />,
};
const THEME_LABEL: Record<Theme, string> = {
  light: 'Light', dark: 'Dark', system: 'System',
};

/* ─── nav item ──────────────────────────────────────────── */
function NavItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: { name: string; href: string; icon: React.ComponentType<any> };
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const isLive = item.name === 'Live Events';

  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        'group relative flex items-center rounded-xl text-sm font-medium',
        'transition-all duration-200 select-none outline-none',
        // When collapsed: centered icon box; when expanded: left-aligned row with gap
        collapsed
          ? 'justify-center w-11 h-11 mx-auto'
          : 'gap-3 px-3 py-2.5 w-full',
        active
          ? 'bg-[var(--accent)] text-white shadow-[0_4px_16px_rgba(94,91,193,0.32)] dark:shadow-[0_4px_20px_rgba(133,136,230,0.28)] font-semibold'
          : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]/80 active:scale-[0.98]',
      )}
    >
      {/* Left glowing accent bar for active item when expanded */}
      {active && !collapsed && (
        <span
          className="absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full bg-white/80 shadow-sm"
          aria-hidden="true"
        />
      )}

      {/* Icon with hover bounce - centered in collapsed box */}
      <div className="relative shrink-0 flex items-center justify-center">
        <item.icon
          className={cn(
            'h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110',
            active ? 'text-white' : 'text-[var(--fg-subtle)] group-hover:text-[var(--accent)]',
          )}
        />
        {/* Pulsing emerald dot for Live Events when collapsed */}
        {isLive && collapsed && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-2 ring-[var(--surface)]" />
          </span>
        )}
      </div>

      {/* Label and Badge (only in DOM when expanded so flexbox doesn't offset icon) */}
      {!collapsed && (
        <div className="flex items-center justify-between flex-1 gap-2.5 leading-none whitespace-nowrap">
          <span className="whitespace-nowrap">{item.name}</span>
          {isLive && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      )}

      {/* Polished Floating Glass Tooltip when collapsed */}
      {collapsed && (
        <div
          className={cn(
            'pointer-events-none absolute left-full ml-3.5 z-[70]',
            'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap',
            'bg-[var(--surface-3)] text-[var(--fg)] border border-[var(--border-strong)]/70',
            'shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.5)]',
            'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0',
            'transition-all duration-150',
          )}
        >
          <span>{item.name}</span>
          {isLive && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>
      )}
    </Link>
  );
}

/* ─── sidebar content ───────────────────────────────────── */
function Sidebar({
  collapsed,
  isPinned,
  onTogglePin,
  location,
  onNav,
}: {
  collapsed: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  location: ReturnType<typeof useLocation>;
  onNav?: () => void;
}) {
  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <div className="flex flex-col h-full w-full relative select-none">

      {/* Brand & Top Header */}
      <div
        className={cn(
          'shrink-0 flex items-center border-b border-[var(--border)]/60 h-14',
          collapsed ? 'justify-center px-0' : 'justify-between px-3.5',
        )}
      >
        {collapsed ? (
          <Link
            to="/dashboard"
            onClick={onNav}
            title="ZENO — Dashboard"
            className="flex items-center justify-center p-2 rounded-xl hover:bg-[var(--surface-2)]/60 hover:scale-105 transition-all"
          >
            <ZenoMark size={32} />
          </Link>
        ) : (
          <div className="flex items-center justify-between w-full gap-2">
            <Link
              to="/dashboard"
              onClick={onNav}
              className="flex items-center gap-2.5 p-1 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <ZenoMark size={28} />
              <span
                className="text-[15px] font-extrabold tracking-widest leading-none"
                style={{ color: 'var(--fg)' }}
              >
                ZENO
              </span>
            </Link>

            {onTogglePin && (
              <button
                onClick={onTogglePin}
                title={isPinned ? 'Unpin sidebar (floating dock)' : 'Pin sidebar (locked open)'}
                className={cn(
                  'p-1.5 rounded-lg transition-colors shrink-0',
                  isPinned
                    ? 'text-[var(--accent)] bg-[var(--accent-muted)]'
                    : 'text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]',
                )}
              >
                {isPinned ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation - compact, fits content height without stretching */}
      <nav
        className={cn(
          'flex-1 overflow-y-auto no-scrollbar',
          collapsed
            ? 'flex flex-col items-center py-2 px-0 space-y-1'
            : 'py-2.5 px-2.5 space-y-2.5',
        )}
      >
        {NAV.map((group, groupIdx) => (
          <div
            key={group.section}
            className={cn('w-full', collapsed && 'flex flex-col items-center')}
          >
            {/* Section label (only when expanded) */}
            {!collapsed && (
              <div className="mb-1 text-[10px] font-bold tracking-wider uppercase px-2.5 text-[var(--fg-subtle)] whitespace-nowrap">
                {group.section}
              </div>
            )}

            {/* Thin subtle divider when collapsed (between groups) */}
            {collapsed && groupIdx > 0 && (
              <div className="h-px w-8 mx-auto my-1 bg-[var(--border)]/60" />
            )}

            <div className={cn('space-y-1 w-full', collapsed && 'flex flex-col items-center')}>
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                  onClick={onNav}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

/* ─── app layout ─────────────────────────────────────────── */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout }   = useAuth();
  const { theme, setTheme } = useTheme();

  /**
   * isPinned = true   → sidebar is locked expanded (236px)
   * isPinned = false  → sidebar is a floating dock (68px); hover expands temporarily
   */
  const [isPinned, setIsPinned] = useState(() => {
    try {
      const stored = localStorage.getItem('zeno_sidebar_pinned');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const [hovered, setHovered]       = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUserMenuOpen(false);
    try {
      await logout();
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
  };

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('zeno_sidebar_pinned', String(next));
      } catch {}
      return next;
    });
  };

  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (!isPinned) setHovered(true);
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      hoverTimer.current = setTimeout(() => setHovered(false), 120);
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme as Theme);
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  };

  const currentPage = NAV.flatMap((g) => g.items).find(
    (i) => location.pathname === i.href || location.pathname.startsWith(i.href + '/'),
  );

  const sidebarExpanded = isPinned || hovered;

  return (
    <div
      className="flex h-screen w-screen overflow-hidden p-3 gap-3 relative"
      style={{ background: 'var(--bg)' }}
    >

      {/* ── Desktop floating sidebar (stretched full-height island) ── */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'hidden md:flex flex-col shrink-0 h-full',
          'rounded-2xl border border-[var(--border)]/80',
          'shadow-[0_12px_32px_-4px_rgba(0,0,0,0.08),0_4px_12px_-2px_rgba(0,0,0,0.04)]',
          'dark:shadow-[0_16px_40px_-4px_rgba(0,0,0,0.5)]',
          'backdrop-blur-xl bg-[var(--surface)]/90 dark:bg-[var(--surface)]/80',
          'transition-[width] duration-200 ease-in-out',
          'overflow-visible relative z-30',
          sidebarExpanded ? 'w-fit' : 'w-[68px]',
        )}
      >
        <Sidebar
          collapsed={!sidebarExpanded}
          isPinned={isPinned}
          onTogglePin={togglePin}
          location={location}
        />
      </aside>

      {/* ── Mobile backdrop ─────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile floating drawer ──────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-3 left-3 z-50 w-[270px] max-w-[calc(100vw-24px)] flex flex-col',
          'rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-2xl shadow-2xl',
          'md:hidden transition-transform duration-300 ease-out',
          drawerOpen ? 'translate-x-0' : '-translate-x-[calc(100%+24px)]',
        )}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg z-10 text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
          title="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <Sidebar
          collapsed={false}
          location={location}
          onNav={() => setDrawerOpen(false)}
        />
      </aside>

      {/* ── Main content island ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full rounded-2xl border border-[var(--border)]/80 bg-[var(--surface)]/70 dark:bg-[var(--surface)]/40 backdrop-blur-md overflow-hidden shadow-sm">

        {/* Top bar */}
        <header
          className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-[var(--border)]/60 bg-[var(--surface)]/50 backdrop-blur-sm relative z-40"
        >
          {/* Left: Mobile trigger & Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
              onClick={() => setDrawerOpen(true)}
              title="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden sm:inline font-bold tracking-wider text-xs text-[var(--fg-subtle)]">
                ZENO
              </span>
              <span className="hidden sm:inline text-[var(--fg-subtle)]">/</span>
              <span className="font-semibold" style={{ color: 'var(--fg)' }}>
                {currentPage?.name ?? 'Risk Operations'}
              </span>
            </div>
          </div>

          {/* Right: Environment, Status, Theme, User Profile */}
          <div className="flex items-center gap-2">
            <button
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLElement).style.color = 'var(--fg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.color = 'var(--fg-muted)';
              }}
            >
              <span>ACME STORE</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">TEST ENV</span>
            </div>

            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--success-bg)', color: 'var(--success)' }}
            >
              <Activity className="h-3 w-3" />
              Operational
            </div>

            <button
              onClick={cycleTheme}
              title={`Theme: ${THEME_LABEL[theme as Theme]}`}
              className="p-2 rounded-lg transition-colors text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]"
            >
              {THEME_ICON[theme as Theme]}
            </button>

            {/* User Profile dropdown */}
            <div className="relative z-50" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border)]/60 transition-all select-none"
                title={`${user?.name ?? 'User'} (${user?.role ?? 'Role'})`}
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold select-none ring-2 ring-[var(--accent)]/30 shrink-0"
                  style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                >
                  {user?.name?.charAt(0) ?? 'A'}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-tight pr-0.5">
                  <span className="text-xs font-semibold max-w-[100px] truncate" style={{ color: 'var(--fg)' }}>
                    {user?.name ?? 'Analyst'}
                  </span>
                  <span className="text-[10px] text-[var(--fg-subtle)] max-w-[100px] truncate">
                    {user?.role ?? 'Risk Operations'}
                  </span>
                </div>
                <ChevronDown className={cn('h-3.5 w-3.5 text-[var(--fg-subtle)] transition-transform duration-200', userMenuOpen && 'rotate-180')} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/98 dark:bg-[var(--surface)]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-[100] p-2 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2.5 border-b border-[var(--border)]/60">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--fg)' }}>
                      {user?.name ?? 'Analyst'}
                    </p>
                    <p className="text-[11px] text-[var(--fg-subtle)] truncate mt-0.5">
                      {user?.email ?? 'analyst@zeno.risk'}
                    </p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent)]/20">
                      {user?.role ?? 'Risk Operations'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full mt-1.5 flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-7 page-ambient no-scrollbar">
          <div className="relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

