// app/admin/page.tsx
import Analytics from './components/admin/analytics';
import SuspiciousUsers from './components/admin/suspicious-users';
import Comments from './components/admin/comments';

export default function AdminDashboard() {
  return (
    <div className="cyber-bg min-h-full w-full p-4 sm:p-6">
      <div className="relative z-10">
        {/*
          Analytics: дээр нь статистик картууд, дунд нь [Pie chart | sidePanel],
          хамгийн доор children (сэтгэгдлүүд)
        */}
        <Analytics sidePanel={<SuspiciousUsers />}>
          <Comments />
        </Analytics>
      </div>
    </div>
  );
}