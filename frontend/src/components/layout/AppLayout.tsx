import React, { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { NiroLogo, NiroMark } from '@/components/brand/Logo';
import {
  LayoutDashboard, Users, Receipt, Network, FileSearch,
  BarChart3, FileText, Database, Settings,
  Moon, Sun, Monitor, ChevronDown, AlertTriangle,
  LogOut, Menu, X, Activity,
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
  item, active, collapsed, onClick,
}: {
  item: { name: string; href: string; icon: React.ComponentType<any> };
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={item.href}
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      className={cn(
        'group relative flex items-center rounded-lg text-sm font-medium',
        'transition-all duration-150 focus-visible:outline-none',
        // When collapsed: full-width flex, icon centred; when expanded: left-aligned row with gap
        collapsed
          ? 'justify-center w-full px-0 py-2.5'
          : 'gap-3 px-3 py-2',
        active
          ? 'bg-[var(--accent)] text-white shadow-sm'
          : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]',
      )}
    >
      <item.icon
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-white' : 'text-[var(--fg-subtle)] group-hover:text-[var(--accent)]',
        )}
      />

      {/* Label fades + collapses horizontally */}
      <span
        className={cn(
          'truncate transition-all duration-150 leading-none',
          collapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100',
        )}
      >
        {item.name}
      </span>

      {/* Tooltip — only when collapsed */}
      {collapsed && (
        <span
          className={cn(
            'pointer-events-none absolute left-full ml-3 z-[60] whitespace-nowrap',
            'rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-xl',
            'opacity-0 -translate-x-1',
            'group-hover:opacity-100 group-hover:translate-x-0',
            'transition-all duration-150',
          )}
          style={{
            background: 'var(--surface-3)',
            color: 'var(--fg)',
            border: '1px solid var(--border-strong)',
          }}
        >
          {item.name}
        </span>
      )}
    </Link>
  );
}

/* ─── sidebar content ───────────────────────────────────── */
function Sidebar({
  collapsed,
  location,
  user,
  logout,
  onNav,
}: {
  collapsed: boolean;
  location: ReturnType<typeof useLocation>;
  user: any;
  logout: () => void;
  onNav?: () => void;
}) {
  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <div className="flex flex-col h-full relative overflow-hidden">

      {/* Logo */}
      <div
        className="flex items-center shrink-0 border-b border-[var(--border)] transition-all duration-200"
        style={{ padding: collapsed ? '18px 0' : '18px 20px' }}
      >
        <Link
          to="/dashboard"
          onClick={onNav}
          title={collapsed ? 'NIRO — Dashboard' : undefined}
          className={cn(
            'group flex items-center min-w-0 transition-all duration-200',
            collapsed ? 'w-full justify-center gap-0' : 'gap-3',
          )}
        >
          {collapsed
            ? <NiroMark size={32} />
            : <NiroLogo height={34} />
          }
          <span
            className={cn(
              'text-lg font-bold tracking-widest whitespace-nowrap',
              'transition-all duration-150 group-hover:text-[var(--accent)]',
              collapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100',
            )}
            style={{ color: 'var(--fg)' }}
          >
            NIRO
          </span>
        </Link>
      </div>

      {/* Pin / collapse toggle REMOVED — hover handles expand/collapse */}

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-4"
        style={{ padding: collapsed ? '16px 0' : '16px 12px' }}
      >
        {NAV.map((group) => (
          <div key={group.section}>
            {/* Section label */}
            <div
              className={cn(
                'mb-1.5 text-[10px] font-semibold tracking-widest uppercase',
                'transition-all duration-150 overflow-hidden whitespace-nowrap',
                collapsed ? 'opacity-0 h-0 mb-0 px-0' : 'opacity-100 h-auto px-3',
              )}
              style={{ color: 'var(--fg-subtle)' }}
            >
              {group.section}
            </div>

            {/* Thin divider when collapsed */}
            {collapsed && (
              <div className="h-px mx-3 mb-1.5" style={{ background: 'var(--border)' }} />
            )}

            <div className="space-y-0.5">
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

      {/* User row */}
      <div
        className="shrink-0 border-t border-[var(--border)]"
        style={{ padding: collapsed ? '10px 0' : '10px 12px' }}
      >
        <div
          className={cn(
            'flex items-center rounded-lg transition-all group',
            collapsed ? 'justify-center px-0 py-2 mx-0' : 'gap-3 px-3 py-2',
            'hover:bg-[var(--surface-2)]',
          )}
        >
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
            style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            title={collapsed ? `${user?.name} · ${user?.role}` : undefined}
          >
            {user?.name?.charAt(0) ?? 'A'}
          </div>

          <div
            className={cn(
              'flex items-center gap-2 min-w-0 transition-all duration-150',
              collapsed ? 'w-0 opacity-0 overflow-hidden' : 'flex-1 opacity-100',
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>
                {user?.name}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--fg-subtle)' }}>
                {user?.role}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded shrink-0"
              style={{ color: 'var(--fg-subtle)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--danger)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--fg-subtle)')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── app layout ─────────────────────────────────────────── */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout }   = useAuth();
  const { theme, setTheme } = useTheme();

  /**
   * pinned = false  → sidebar starts collapsed; hover expands it temporarily
   * pinned = true   → sidebar is locked open; hover has no effect
   */
  const [hovered, setHovered]       = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // collapsed = not hovered
  const collapsed = !hovered;

  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimer.current = setTimeout(() => setHovered(false), 120);
  };

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme as Theme);
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  };

  const currentPage = NAV.flatMap((g) => g.items).find(
    (i) => location.pathname === i.href || location.pathname.startsWith(i.href + '/'),
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'hidden md:flex flex-col shrink-0 border-r border-[var(--border)]',
          // Width transition is smooth
          'transition-[width] duration-200 ease-in-out',
          // overflow-visible so the tooltip can escape the sidebar boundary
          'overflow-visible relative z-10',
          collapsed ? 'w-[64px]' : 'w-60',
        )}
        style={{ background: 'var(--surface)' }}
      >
        <Sidebar
          collapsed={collapsed}
          location={location}
          user={user}
          logout={logout}
        />
      </aside>

      {/* ── Mobile backdrop ─────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer ───────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 flex flex-col',
          'border-r border-[var(--border)] md:hidden',
          'transition-transform duration-200',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: 'var(--surface)' }}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg z-10"
          style={{ color: 'var(--fg-subtle)' }}
        >
          <X className="h-4 w-4" />
        </button>
        <Sidebar
          collapsed={false}
          location={location}
          user={user}
          logout={logout}
          onNav={() => setDrawerOpen(false)}
        />
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header
          className="h-14 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-[var(--border)]"
          style={{ background: 'var(--surface)' }}
        >
          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-lg"
              style={{ color: 'var(--fg-muted)' }}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden sm:inline" style={{ color: 'var(--fg-subtle)' }}>NIRO</span>
              <span className="hidden sm:inline" style={{ color: 'var(--fg-subtle)' }}>/</span>
              <span className="font-semibold" style={{ color: 'var(--fg)' }}>
                {currentPage?.name ?? 'Risk Operations'}
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            <button
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
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
              ACME STORE
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
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--fg-subtle)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                (e.currentTarget as HTMLElement).style.color = 'var(--fg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--fg-subtle)';
              }}
            >
              {THEME_ICON[theme as Theme]}
            </button>

            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold select-none"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              title={user?.name}
            >
              {user?.name?.charAt(0) ?? 'A'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
