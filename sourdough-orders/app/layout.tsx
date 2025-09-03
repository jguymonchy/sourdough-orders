// app/layout.tsx
import './globals.css';

export const metadata = {
  title: 'Kanarra Heights Homestead — Orders',
  description: 'Pickup on Saturdays • Shipping on Fridays (US only)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{
          background: 'var(--khh-cream)',
          borderBottom: '1px solid var(--khh-border)',
        }}>
          <div style={{
            maxWidth: 980,
            margin: '0 auto',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <img
              src="/khh-logo.svg"
              alt="Kanarra Heights Homestead"
              width={36}
              height={36}
              style={{ display: 'block' }}
            />
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--khh-ink)' }}>
                Kanarra Heights Homestead
              </div>
              <div style={{ fontSize: 12, color: 'var(--khh-ink-2)' }}>
                Artisan sourdough • Cedar City, UT
              </div>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
