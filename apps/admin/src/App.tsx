import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { hasAnyPermission, type Permission } from '@ucolis/shared';
import { useSession } from './auth/session';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { AcceptInvite } from './pages/AcceptInvite';
import { Audit } from './pages/Audit';
import { Broadcasts } from './pages/Broadcasts';
import { Content } from './pages/Content';
import { ConversationView, Conversations } from './pages/Conversations';
import { Dashboard } from './pages/Dashboard';
import { DisputeDetail, Disputes } from './pages/Disputes';
import { Login } from './pages/Login';
import { ParcelDetail, Parcels } from './pages/Parcels';
import { ReportDetail, Reports } from './pages/Reports';
import { Reviews } from './pages/Reviews';
import { Settings } from './pages/Settings';
import { Staff } from './pages/Staff';
import { Trips } from './pages/Trips';
import { UserDetail } from './pages/UserDetail';
import { Users } from './pages/Users';
import { IdentityDetail, IdentityQueue, ProDetail, ProQueue } from './pages/Verifications';

/** Chaque route déclare les permissions qui l'ouvrent, comme le menu ; l'API reste seule juge. */
const ROUTES: { path: string; anyOf: Permission[]; element: ReactNode }[] = [
  { path: 'users', anyOf: ['users.view'], element: <Users /> },
  { path: 'users/:id', anyOf: ['users.view'], element: <UserDetail /> },
  { path: 'verifications/identity', anyOf: ['verifications.identity'], element: <IdentityQueue /> },
  { path: 'verifications/identity/:userId', anyOf: ['verifications.identity'], element: <IdentityDetail /> },
  { path: 'verifications/pro', anyOf: ['verifications.pro'], element: <ProQueue /> },
  { path: 'verifications/pro/:userId', anyOf: ['verifications.pro'], element: <ProDetail /> },
  { path: 'parcels', anyOf: ['parcels.view'], element: <Parcels /> },
  { path: 'parcels/:id', anyOf: ['parcels.view'], element: <ParcelDetail /> },
  { path: 'trips', anyOf: ['parcels.view'], element: <Trips /> },
  { path: 'disputes', anyOf: ['disputes.handle'], element: <Disputes /> },
  { path: 'disputes/:id', anyOf: ['disputes.handle'], element: <DisputeDetail /> },
  { path: 'reports', anyOf: ['reports.handle'], element: <Reports /> },
  { path: 'reports/:id', anyOf: ['reports.handle'], element: <ReportDetail /> },
  { path: 'reviews', anyOf: ['reviews.moderate'], element: <Reviews /> },
  { path: 'conversations', anyOf: ['conversations.view_reported', 'conversations.view_all'], element: <Conversations /> },
  { path: 'conversations/:id', anyOf: ['conversations.view_reported', 'conversations.view_all'], element: <ConversationView /> },
  { path: 'broadcasts', anyOf: ['broadcast.send'], element: <Broadcasts /> },
  { path: 'content', anyOf: ['content.manage'], element: <Content /> },
  { path: 'settings', anyOf: ['settings.manage'], element: <Settings /> },
  { path: 'staff', anyOf: ['staff.manage'], element: <Staff /> },
  { path: 'audit', anyOf: ['audit.view'], element: <Audit /> },
];

function RequireSession({ children }: { children: ReactNode }) {
  const { session, restoring } = useSession();
  if (restoring) return <Loading />;
  return session ? children : <Navigate to="/login" replace />;
}

function Forbidden() {
  return (
    <div className="rounded-card bg-surface p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold">Accès refusé</h1>
      <p className="mt-2 text-sm text-muted">Cette page demande une permission que votre compte n’a pas.</p>
    </div>
  );
}

export function App() {
  const { session } = useSession();
  const allowed = (anyOf: Permission[]) => (session ? hasAnyPermission(session.staff, anyOf) : false);
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite/:token" element={<AcceptInvite />} />
      <Route
        element={
          <RequireSession>
            <Layout />
          </RequireSession>
        }
      >
        <Route index element={allowed(['dashboard.view']) ? <Dashboard /> : <Forbidden />} />
        {ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={allowed(r.anyOf) ? r.element : <Forbidden />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
