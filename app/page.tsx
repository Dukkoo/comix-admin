// app/admin/page.tsx
import Analytics from './components/admin/analytics';
import SuspiciousUsers from './components/admin/suspicious-users';

export default function AdminDashboard() {
  return (
    <div className="w-full space-y-10 p-6 bg-zinc-900">
      <Analytics />
      
      {/* Suspicious Users Section */}
      <SuspiciousUsers />
    </div>
  );
}