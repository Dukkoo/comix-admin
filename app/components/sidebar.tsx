'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, BookOpen, Store, LogOut, Image, Star } from 'lucide-react';
import { useAuth } from '@/app/providers';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Бүртгэл', href: '/users', icon: Users },
  { name: 'Гаргалт', href: '/projects', icon: BookOpen },
  { name: 'Carousel', href: '/carousel', icon: Image },
  { name: 'Алдартай', href: '/popular', icon: Star },
  { name: 'Бүтээгдэхүүн', href: '/#', icon: Store },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, currentUser } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="flex flex-col w-64 h-screen bg-zinc-900 border-r border-zinc-800">
      <div className="flex items-center h-16 px-6 border-b border-zinc-800">
        <span className="text-xl font-bold text-white">COMIX АДМИН</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-cyan-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center px-4 py-3 mb-2 rounded-lg bg-zinc-800">
          <div className="flex items-center justify-center w-8 h-8 bg-cyan-600 rounded-full">
            <span className="text-sm font-bold text-white">
              {currentUser?.email?.[0].toUpperCase() || 'A'}
            </span>
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              Admin
            </p>
            <p className="text-xs text-zinc-400 truncate">
              {currentUser?.email || 'admin@comix.mn'}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-400 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Гарах
        </button>
      </div>
    </div>
  );
}