import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Pentagramma - Interactive MIDI Piano Trainer',
    description: 'Learn piano with real-time MIDI feedback and digital sheet music',
    manifest: '/manifest.json',
    icons: {
        icon: '/icon.png',
        apple: '/apple-touch-icon.png',
    }
}

export const viewport = {
    themeColor: '#4a148c',
}

import PWAControls from '@/components/PWAControls'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="it">
            <body>
                {children}
                <PWAControls />
            </body>
        </html>
    )
}
