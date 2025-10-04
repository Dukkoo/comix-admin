'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './sidebar';

const PUBLIC_ROUTES = ['/login', '/unauthorized'];

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Public route - no sidebar
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Protected route - with sidebar
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-900">
        {children}
      </main>
    </div>
  );
}