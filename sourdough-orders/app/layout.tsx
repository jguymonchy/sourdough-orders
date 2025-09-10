// app/layout.tsx
import './globals.css';

export const metadata = {
  title: 'Kanarra Heights Homestead — Orders',
  description: 'Pickup on Saturdays • Shipping on Fridays (US only)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Force browsers to always pull the latest manifest */}
        <link rel="manifest" href="/manifest.webmanifest?v=2025-09-10-2" />

        {/* Theme + background colors for PWA splash */}
        <meta name="theme-color" content="#ffffff" />
        <meta name="background-color" content="#ffffff" />

        {/* iOS PWA support */}
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="KHH Bread" />

        {/* iOS splash screens (portrait) */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1290x2796.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1179x2556.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1170x2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-828x1792.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1125x2436.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-750x1334.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-640x1136.png"
          media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-2048x2732.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1668x2388.png"
          media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      </head>
      <body>
        {/* Global header always renders (we'll hide it on /order from the page) */}
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
              <div className="khh-header__subtitle">Artisan sourdough • Cedar City, UT</div>
            </div>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}

