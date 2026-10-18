import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useSession } from '../auth/session';
import { visibleNav } from '../nav';

export function Layout() {
  const { session, logout } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (!session) return null;
  const items = visibleNav(session.staff);

  const nav = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Menu principal">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2.5 text-sm font-medium ${
              isActive ? 'bg-primary-soft text-primary-dark' : 'text-muted hover:bg-background'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Menu fixe au-dessus de 768 px, tiroir en dessous. */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface md:block">
        <div className="px-6 py-5 text-lg font-bold">
          U<span className="text-primary">COLIS</span>
        </div>
        {nav}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-navy/40"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative h-full w-72 overflow-y-auto bg-surface shadow-xl">{nav}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:px-8">
          <button
            className="rounded-lg border border-border px-3 py-2 text-sm md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
          >
            Menu
          </button>
          <span className="hidden text-sm text-muted md:block">Back-office</span>
          <div className="flex items-center gap-3 text-sm">
            <span>
              {session.staff.firstName} {session.staff.lastName}
              {session.staff.role === 'super_admin' && (
                <span className="ms-2 rounded-full bg-navy px-2 py-0.5 text-xs text-white">
                  Super-admin
                </span>
              )}
            </span>
            <button className="text-muted hover:text-danger" onClick={() => void logout()}>
              Déconnexion
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
