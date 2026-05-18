import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Toaster } from 'sonner'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DevAstra',
  description: 'A developer skill constellation that lights up as you code.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-[#010102]">
      <body className="bg-[#010102] text-gray-900 antialiased">
        {children}
        <Suspense fallback={null}>
          <Toaster theme="dark" position="bottom-right" />
        </Suspense>
        <SpeedInsights />
      </body>
    </html>
  )
}
