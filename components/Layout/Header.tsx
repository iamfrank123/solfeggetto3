'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header() {
    const [mounted, setMounted] = useState(false);
    const [midiStatus, setMidiStatus] = useState({
        hasAccess: false,
        error: null as string | null,
    });

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Only run on client
    useEffect(() => {
        setMounted(true);

        // Check availability on mount but DO NOT auto-set to true.
        // We only set to true if we actually have active inputs or permission is already 'granted' with inputs.
        const checkConnection = async () => {
            // Auto-detect and connect if permission is already granted
            if (typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function') {
                try {
                    // Check permissions API first
                    // @ts-ignore - permissions API for MIDI
                    const permission = await navigator.permissions.query({ name: 'midi' });

                    if (permission.state === 'granted') {
                        // Safe to call without prompt
                        handleMIDIConnect();
                    } else {
                        // User hasn't granted yet, start OFF
                        setMidiStatus(prev => ({ ...prev, hasAccess: false, error: null }));
                    }
                } catch (e) {
                    // Permission API failed or not supported, strictly wait for user interaction to avoid prompts
                    // But verify if we can just try requestMIDIAccess logic? No, keep it safe.
                    setMidiStatus(prev => ({ ...prev, hasAccess: false, error: null }));
                }
            } else {
                setMidiStatus({
                    hasAccess: false,
                    error: 'WebMIDI not supported'
                });
            }
        };

        checkConnection();
    }, []);

    const handleMIDIConnect = async () => {
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function') {
                const access = await navigator.requestMIDIAccess();

                // Strict check: Are there inputs?
                if (access.inputs.size > 0) {
                    setMidiStatus({ hasAccess: true, error: null });
                } else {
                    // Start listener for hot-plug
                    setMidiStatus({ hasAccess: false, error: 'No MIDI inputs found' });
                }

                // Listen for state changes
                access.onstatechange = (e: any) => {
                    // Re-check count
                    if (access.inputs.size > 0) {
                        setMidiStatus({ hasAccess: true, error: null });
                    } else {
                        setMidiStatus({ hasAccess: false, error: 'Device disconnected' });
                    }
                };

            }
        } catch (error) {
            setMidiStatus({
                hasAccess: false,
                error: 'Failed to access MIDI'
            });
        }
    };

    return (
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex flex-col">
                        <h1 className="text-xl md:text-2xl font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition">
                            🎼 Pentagramma
                        </h1>
                        <p className="text-xs text-gray-600 hidden sm:block">Interactive MIDI Piano Trainer</p>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex space-x-2">
                        <Link href="/sight-reading" className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md font-medium text-sm lg:text-base">
                            Lettura Musicale
                        </Link>
                        <Link href="/challenge" className="px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md font-medium text-sm lg:text-base">
                            Challenge
                        </Link>
                        <Link href="/" className="px-3 py-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-md font-medium text-sm lg:text-base">
                            Solfeggio Ritmico
                        </Link>
                        <Link href="/melodic-solfege" className="px-3 py-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-md font-medium text-sm lg:text-base">
                            Solfeggio Melodico
                        </Link>
                    </nav>

                    <div className="flex items-center gap-2">
                        {/* Only render after mounting (prevents hydration error) */}
                        {mounted && (
                            <div className="hidden sm:flex items-center space-x-2">
                                <button
                                    onClick={handleMIDIConnect}
                                    className={`text-sm font-bold px-2 py-1 rounded transition-colors ${midiStatus.hasAccess
                                        ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                        : 'text-red-600 bg-red-50 hover:bg-red-100'
                                        }`}
                                    title={midiStatus.hasAccess ? "MIDI Connected" : "Click to Connect MIDI"}
                                >
                                    {midiStatus.hasAccess ? '● MIDI ON' : '○ MIDI OFF'}
                                </button>
                            </div>
                        )}

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isMobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                        {/* Full Screen Toggle */}
                        <button
                            onClick={() => {
                                if (!document.fullscreenElement) {
                                    document.documentElement.requestFullscreen().catch(e => console.log(e));
                                } else {
                                    if (document.exitFullscreen) {
                                        document.exitFullscreen();
                                    }
                                }
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hidden sm:block"
                            title="Toggle Full Screen"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden mt-4 pb-2 border-t border-gray-100 pt-4 space-y-2">
                        <div className="flex flex-col space-y-2">
                            <Link
                                href="/sight-reading"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="px-4 py-3 bg-gray-50 text-gray-800 rounded-lg font-medium hover:bg-gray-100"
                            >
                                👁️ Lettura Musicale
                            </Link>
                            <Link
                                href="/challenge"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100"
                            >
                                ⚡ Challenge Mode
                            </Link>
                            <Link
                                href="/"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="px-4 py-3 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100"
                            >
                                🥁 Solfeggio Ritmico
                            </Link>
                            <Link
                                href="/melodic-solfege"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="px-4 py-3 bg-purple-50 text-purple-700 rounded-lg font-medium hover:bg-purple-100"
                            >
                                🎵 Solfeggio Melodico
                            </Link>

                            <button
                                onClick={() => {
                                    if (!document.fullscreenElement) {
                                        document.documentElement.requestFullscreen().catch(e => console.log(e));
                                    } else {
                                        if (document.exitFullscreen) {
                                            document.exitFullscreen();
                                        }
                                    }
                                    setIsMobileMenuOpen(false);
                                }}
                                className="px-4 py-3 bg-gray-50 text-gray-700 rounded-lg font-medium hover:bg-gray-100 text-left flex items-center w-full"
                            >
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                                Schermo Intero / Fullscreen
                            </button>
                        </div>

                        {/* Mobile MIDI Status */}
                        {mounted && (
                            <div className="pt-2">
                                {!midiStatus.hasAccess ? (
                                    <button
                                        onClick={handleMIDIConnect}
                                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                                    >
                                        🎹 Connect MIDI Device
                                    </button>
                                ) : (
                                    <div className="w-full px-4 py-3 bg-green-100 border border-green-200 rounded-lg text-center">
                                        <span className="text-green-800 font-bold">✓ MIDI Connected</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
}
