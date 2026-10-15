import type { Metadata } from 'next'
import { IBM_Plex_Mono, Inter } from 'next/font/google'
import './globals.css'

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Codebench · Agent Control',
  description: 'Enterprise coding harness governed by LaunchDarkly Agent Control',
}

// Runs before paint so the stored or system theme applies without a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('codebench-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
