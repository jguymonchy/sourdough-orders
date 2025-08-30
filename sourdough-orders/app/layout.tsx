import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME || 'Sourdough Orders',
  description: 'Order fresh sourdough bread'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
      </body>
    </html>
  )
}
