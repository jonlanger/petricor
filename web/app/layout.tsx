import type { Metadata } from 'next'
import { Geist, Reddit_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] })
const reddit = Reddit_Mono({ variable: '--font-reddit-mono', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: { default: 'Petricor — automated fungal culture imaging', template: '%s · Petricor' },
  description:
    'Petricor is a benchtop incubator and imaging system for fungal and mould cultures, with an on-device workflow and a cloud platform for review, traceability and reporting.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geist.variable} ${reddit.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
