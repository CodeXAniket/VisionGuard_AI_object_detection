import { useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import Folder from './Folder';
import SummaryNote from './SummaryNote';

const AUTH_TABS = [
  { key: 'login', to: '/login', label: ['Sign', 'In'] },
  { key: 'register', to: '/register', label: ['Create', 'Account'] },
];

// Login / Register share one folder; switching tabs slides the form sheet.
export default function AuthShell({ title, children }) {
  const { pathname } = useLocation();
  const activeKey = pathname.startsWith('/register') ? 'register' : 'login';

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="px-3 pb-16 pt-4 md:px-6 md:pt-10">
        <Folder tabs={AUTH_TABS} activeKey={activeKey}>
          <div className="flex min-h-[440px] flex-col items-center justify-center gap-6">
            <div className="paper-card w-full max-w-sm p-6">
              <h1 className="font-script text-[34px] leading-tight text-ink">{title}</h1>
              <div className="mt-4">{children}</div>
            </div>
            <SummaryNote
              className="max-w-xl"
              sentences={[
                <>
                  VisionGuard watches your webcam with a <b>pretrained YOLO model</b>.
                </>,
                <>
                  Only frames with the <b>objects you choose</b> become events.
                </>,
                <>
                  Snapshots go to <b>AWS S3</b>, details to <b>MongoDB</b>.
                </>,
              ]}
            />
          </div>
        </Folder>
      </main>
    </div>
  );
}
