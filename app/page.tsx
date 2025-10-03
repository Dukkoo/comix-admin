import Link from 'next/link';
import { Users, BookOpen, Store } from 'lucide-react';
import Analytics from './components/admin/analytics';
import AdminCarouselManager from './components/admin/carousel-manager';
import AdminPopularManager from './components/admin/popular-manager';

function AdminActionButtons() {
  const buttons = [
    { href: '/users', title: 'Бүртгэл', icon: Users },
    { href: '/projects', title: 'Гаргалт', icon: BookOpen },
    { href: '/products', title: 'Бүтээгдэхүүн', icon: Store },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {buttons.map(({ href, title, icon: Icon }) => (
        <Link key={href} href={href}>
          <div className="group bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 flex items-center gap-4 hover:bg-zinc-800 hover:border-zinc-600/50 hover:shadow-lg hover:shadow-cyan-900/20 transition-all duration-200 cursor-pointer">
            <div className="bg-zinc-700/50 p-3 rounded-lg group-hover:scale-105 transition">
              <Icon className="h-7 w-7 text-cyan-400" />
            </div>
            <span className="text-lg font-semibold text-gray-200 group-hover:text-white transition">
              {title}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-10 p-4 md:p-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Системийн хяналтын төв
        </p>
      </div>

      {/* Action Buttons */}
      <AdminActionButtons />

      {/* Carousel Management Section */}
      <div id="carousel">
        <AdminCarouselManager />
      </div>

      {/* Popular Manga Management Section */}
      <div id="popular">
        <AdminPopularManager />
      </div>

      {/* Analytics Section */}
      <div>
        <Analytics />
      </div>
    </div>
  );
}