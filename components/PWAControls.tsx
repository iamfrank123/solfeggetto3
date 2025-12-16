'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
    const [installPrompt, setInstallPrompt] = useState<any>(null)
    const [showInstall, setShowInstall] = useState(false)
    const [showUpdate, setShowUpdate] = useState(false)
    const [isStandalone, setIsStandalone] = useState(false)

    useEffect(() => {
        // Check if already in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true)
        }

        // Install Prompt Logic
        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault()
            setInstallPrompt(e)
            // Only show install button if not already standalone
            if (!isStandalone) {
                setShowInstall(true)
            }
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        // Service Worker Update Logic
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                // This fires when the service worker controlling this page changes
                // (e.g. invalidating the old one)
                setShowUpdate(true)
            })
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        }
    }, [isStandalone])

    const handleInstall = async () => {
        if (!installPrompt) return
        installPrompt.prompt()
        const { outcome } = await installPrompt.userChoice
        if (outcome === 'accepted') {
            setShowInstall(false)
        }
    }

    const handleUpdate = () => {
        window.location.reload()
    }

    // If we are offline or something, we can handle it here too, but for now just these controls.

    if (!showInstall && !showUpdate) return null

    return (
        <div className="fixed z-[100] flex flex-col gap-4 pointer-events-none w-full bottom-0 left-0 p-4 items-center md:w-auto md:bottom-6 md:right-6 md:items-end">
            {/* Container is pointer-events-none so it doesn't block clicks elsewhere, 
          but children have pointer-events-auto */}

            {showInstall && (
                <div className="bg-white/95 backdrop-blur-md p-6 md:p-4 rounded-xl shadow-2xl border border-purple-200 pointer-events-auto w-full max-w-sm animate-in slide-in-from-bottom duration-500">
                    <h3 className="font-bold text-gray-900 mb-1">Installa App</h3>
                    <p className="text-sm text-gray-600 mb-3">Scarica l'app per un'esperienza a schermo intero e offline!</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowInstall(false)}
                            className="flex-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                        >
                            Più tardi
                        </button>
                        <button
                            onClick={handleInstall}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:shadow-lg transition transform hover:scale-105"
                        >
                            Scarica
                        </button>
                    </div>
                </div>
            )}

            {showUpdate && (
                <div className="bg-blue-600/95 backdrop-blur-md p-4 rounded-xl shadow-xl text-white pointer-events-auto max-w-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <h3 className="font-bold text-white mb-1">Aggiornamento Disponibile</h3>
                            <p className="text-xs text-blue-100">Nuovi contenuti e miglioramenti pronti.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleUpdate}
                        className="mt-3 w-full bg-white text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-50 transition shadow-inner"
                    >
                        Aggiorna Ora
                    </button>
                </div>
            )}
        </div>
    )
}
