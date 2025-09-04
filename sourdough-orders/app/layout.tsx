// app/layout.tsx
'use client';

import { usePathname } from 'next/navigation';
import './globals.css';

export const metadata = {
  title: 'Kanarra Heights Homestead — Orders',
  description: 'Pickup on Saturdays • Shipping on Fridays (US only)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showHeader = pathname !== '/order'; // hide header on order page

  return (
    <html lang="en">
      <body>
        {showHeader && (
          <header className="khh-header">
            <div className="khh-header__inner">
              <img
                src="/khh-logo.svg"
                alt="Kanarra Heights Homestead"
                width={56}
                height={56}
                className="khh-header__logo"
              />
              <div className="khh-header__text">
                <div className="khh-header__title">Kanarra Heights Homestead</div>
                <div className="khh-header__subtitle">
                  Artisan sourdough • Cedar City, UT
                </div>
              </div>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
