import { Outlet, useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import Folder from './Folder';
import { useAuth } from '../context/AuthContext';
import { useMonitoring } from '../context/MonitoringContext';

// The little paper slip in the top-right corner.
function UserSlip() {
  const { user, logout } = useAuth();
  const { isMonitoring, stopMonitoring } = useMonitoring();

  function handleLogout() {
    stopMonitoring();
    logout();
  }

  return (
    <div className="paper-card flex -rotate-2 items-center gap-3 px-3 py-1.5 text-[12px]">
      <span className="flex items-center gap-1.5 text-muted" title={isMonitoring ? 'Monitoring active' : 'Monitoring idle'}>
        <span className={`h-2 w-2 rounded-full ${isMonitoring ? 'animate-pulse bg-accent-green' : 'bg-rule'}`} />
        <span className="max-w-[120px] truncate font-medium text-ink">{user?.name}</span>
      </span>
      <button type="button" onClick={handleLogout} className="cursor-pointer text-muted hover:text-ink">
        Sign out
      </button>
    </div>
  );
}

const TABS = [
  { key: 'camera', to: '/camera', label: ['Live', 'Camera'] },
  { key: 'log', to: '/log', label: ['Detection', 'Log'] },
];

export default function Layout() {
  const location = useLocation();
  const activeKey = TABS.find((tab) => location.pathname.startsWith(`/${tab.key}`))?.key ?? 'camera';

  return (
    <div className="min-h-screen">
      <AppHeader right={<UserSlip />} />
      <main className="px-3 pb-16 pt-4 md:px-6 md:pt-10">
        <Folder tabs={TABS} activeKey={activeKey}>
          <Outlet />
        </Folder>
      </main>
    </div>
  );
}
