// app/components/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, BookOpen, LogOut, Layers, Receipt, UserCircle } from 'lucide-react';
import { useAuth } from '@/app/providers';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Бүртгэл', href: '/users', icon: Users },
  { name: 'Гаргалт', href: '/projects', icon: BookOpen },
  { name: 'Client удирдлага', href: '/client', icon: Layers },
  { name: 'Хэрэглэгчийн профайл', href: '/user-profile', icon: UserCircle },
  { name: 'Төлбөрийн бүртгэл', href: '/payments', icon: Receipt },
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

  // '/' зөвхөн яг өөрөө, бусад нь дэд хуудсуудтайгаа (/users/123 гэх мэт) идэвхтэй болно
  const isItemActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="relative flex h-screen w-56 shrink-0 flex-col border-r border-[rgba(0,240,255,0.16)] bg-[#070913]">
      {/* Баруун ирмэг дээрх neon гэрэл */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[#00f0ff]/50 to-transparent"
      />
      {/* Дээд талын сул гэрэл */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(120px_80px_at_30%_0%,rgba(0,240,255,0.10),transparent)]"
      />

      {/* Лого тэмдэг: hex + куб, цахилгаан scan шугам, magenta glitch сүүдэр */}
      <div className="relative flex h-16 items-center border-b border-white/5 px-5">
        <svg
          aria-hidden
          viewBox="0 0 40 40"
          className="logo-mark h-10 w-10 overflow-visible"
        >
          <defs>
            <clipPath id="cyLogoClip">
              <polygon points="20,4 33.86,12 33.86,28 20,36 6.14,28 6.14,12" />
            </clipPath>
            <linearGradient id="cyLogoScan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0" />
              <stop offset="50%" stopColor="#00f0ff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Magenta glitch сүүдэр */}
          <g className="logo-glitch" opacity="0.75">
            <polygon
              points="20,4 33.86,12 33.86,28 20,36 6.14,28 6.14,12"
              fill="none"
              stroke="#ff2e88"
              strokeWidth="1.2"
            />
          </g>

          {/* Үндсэн cyan hex */}
          <polygon
            points="20,4 33.86,12 33.86,28 20,36 6.14,28 6.14,12"
            fill="rgba(0,240,255,0.07)"
            stroke="#00f0ff"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />

          {/* Дотор нь куб: дотоод hex + 3 дам */}
          <polygon
            points="20,12 26.93,16 26.93,24 20,28 13.07,24 13.07,16"
            fill="rgba(0,240,255,0.14)"
            stroke="#00f0ff"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <g stroke="#00f0ff" strokeWidth="1" strokeLinecap="round">
            <line x1="20" y1="20" x2="20" y2="12" />
            <line x1="20" y1="20" x2="26.93" y2="24" />
            <line x1="20" y1="20" x2="13.07" y2="24" />
          </g>
          <circle cx="20" cy="20" r="2" fill="#ff2e88" />

          {/* Гаднах оройнууд дээрх цэгүүд */}
          <g fill="#00f0ff">
            <circle cx="20" cy="4" r="1.3" />
            <circle cx="33.86" cy="28" r="1.3" />
            <circle cx="6.14" cy="28" r="1.3" />
          </g>

          {/* Scan шугам (hex дотор л харагдана) */}
          <g clipPath="url(#cyLogoClip)">
            <rect className="logo-scan" x="4" y="-6" width="32" height="10" fill="url(#cyLogoScan)" />
          </g>
        </svg>
      </div>

      <nav aria-label="Үндсэн цэс" className="cyber-scroll relative flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex items-center px-3 py-2.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00f0ff]',
                isActive
                  ? 'bg-gradient-to-r from-[#00f0ff]/15 to-transparent text-[#00f0ff]'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 bg-[#00f0ff] shadow-[0_0_10px_#00f0ff]"
                />
              )}
              <Icon
                className={cn('mr-3 h-[18px] w-[18px] shrink-0', isActive && 'drop-shadow-[0_0_6px_rgba(0,240,255,0.8)]')}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-white/5 p-3">
        <div className="cyber-panel mb-2 flex items-center px-3 py-2.5">
          <div className="font-display flex h-8 w-8 shrink-0 items-center justify-center border border-[#00f0ff]/50 bg-[#00f0ff]/10 text-sm font-bold text-[#00f0ff]">
            {currentUser?.email?.[0].toUpperCase() || 'A'}
          </div>
          <div className="ml-3 min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">Admin</p>
            <p className="truncate text-xs text-zinc-400" title={currentUser?.email || 'admin@comix.mn'}>
              {currentUser?.email || 'admin@comix.mn'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center border border-transparent px-3 py-2.5 text-sm font-medium text-[#ff2e88] transition-colors hover:border-[#ff2e88]/40 hover:bg-[#ff2e88]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff2e88]"
        >
          <LogOut className="mr-3 h-[18px] w-[18px]" />
          Гарах
        </button>
      </div>

      <style jsx>{`
        .logo-mark {
          filter: drop-shadow(0 0 6px rgba(0, 240, 255, 0.55));
        }

        /* Scan шугам дээрээс доош удаан гүйнэ */
        .logo-scan {
          animation: logoScan 3.2s linear infinite;
        }
        @keyframes logoScan {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(50px);
          }
        }

        /* Magenta сүүдэр ихэнх хугацаанд хөдөлгөөнгүй, богино glitch хийнэ */
        .logo-glitch {
          animation: logoGlitch 4.5s steps(1, end) infinite;
        }
        @keyframes logoGlitch {
          0%,
          88%,
          100% {
            transform: translate(1px, 0.5px);
          }
          90% {
            transform: translate(-2px, 0);
          }
          93% {
            transform: translate(2.5px, -1px);
          }
          96% {
            transform: translate(-1px, 1px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .logo-scan,
          .logo-glitch {
            animation: none;
          }
        }
      `}</style>
    </aside>
  );
}