/**
 * One app, two workspaces (owner, 2026-11-25): the Company Admin dashboard
 * (desktop logic, including commission and payouts) and the referring
 * clinician portal (compliant: no money for the clinician). They share
 * nothing on screen. Until login exists, the role comes from the developer
 * switch in the menu (domain/role); later the signed-in account decides.
 */
import { useRole } from '@/domain/role';
import { AdminApp } from '@/admin/AdminApp';
import { App } from './App';
import { AppStoreProvider } from './store';

export function Root() {
  const role = useRole();
  if (role === 'admin') return <AdminApp key="admin" />;
  return (
    <AppStoreProvider key="clinician">
      <App />
    </AppStoreProvider>
  );
}
