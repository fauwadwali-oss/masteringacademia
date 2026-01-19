import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'
import AuthProviderComponent from '@/components/auth/AuthProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mastering Academia',
  description: 'Research tools for MPH, MHA & MBA students - systematic reviews, literature search, and more',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProviderComponent>{children}</AuthProviderComponent>
      </body>
    </html>
  )
}
