import './globals.css'
import Link from 'next/link'
import ServiceWorker from '../components/ServiceWorker'

export const metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME || 'Sourdough Orders',
  description: 'Order fresh sourdough bread',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#111111" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <header>
          <div className="container">
            <div><strong>{process.env.NEXT_PUBLIC_SITE_NAME || 'Sourdough Orders'}</strong></div>
            <nav>
              <Link href="/order">Order</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </div>
        </header>

        <main className="container">{children}</main>

        {/* Register the PWA service worker */}
        <ServiceWorker />
      </body>
    </html>
  )
}

