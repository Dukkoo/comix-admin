// app/layout.tsx
import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from './providers';
import ConditionalLayout from './components/conditionalLayout';
import { Nunito, Exo_2 } from 'next/font/google';

// Үндсэн текст
const nunito = Nunito({
  subsets: ['latin', 'cyrillic'],
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-nunito',
});

// Cyberpunk гарчиг, том тоонууд (кирилл дэмждэг)
const exo = Exo_2({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-exo',
});

export const metadata = {
  title: 'Comix Admin',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${nunito.variable} ${exo.variable}`}>
      <body className="bg-[#04050a] text-white antialiased font-nunito">
        <AuthProvider>
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </AuthProvider>
      </body>
    </html>
  );
}