import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from './providers';
import Sidebar from './components/sidebar';
import { Nunito } from 'next/font/google';

const nunito = Nunito({
  subsets: ['latin', 'cyrillic'],
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-nunito',
});

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${nunito.variable}`}>
      <body className="bg-zinc-900 text-white antialiased font-nunito">
        <AuthProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-zinc-900">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}