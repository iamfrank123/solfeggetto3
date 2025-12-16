'use client';

import { useState, useCallback, useRef } from 'react';
import Header from '@/components/Layout/Header';
import ScoreStats from '@/components/Feedback/ScoreStats';
import Settings from '@/components/Settings/Settings';
import ScrollingStaff from '@/components/Staff/ScrollingStaff';
import FeedbackIndicator from '@/components/Feedback/FeedbackIndicator';
import { KeySignature, NoteRange } from '@/lib/generator/types';
import { NoteQueueManager } from '@/lib/generator/queue-manager';
import { checkNoteMatch } from '@/lib/generator/note-generator';
import { useMIDIInput } from '@/hooks/useMIDIInput';
import { MIDINoteEvent } from '@/lib/types/midi';

export default function HomePage() {
    // Settings state
    const [keySignature, setKeySignature] = useState<KeySignature>('C');
    const [noteRange, setNoteRange] = useState<NoteRange>({ low: 'C4', high: 'C5' });

    // Exercise state
    const [isExerciseActive, setIsExerciseActive] = useState(false);
    const [noteQueue, setNoteQueue] = useState<any[]>([]);
    const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
    const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');

    // Queue manager ref
    const queueManagerRef = useRef<NoteQueueManager | null>(null);

    // Progress tracking
    const [stats, setStats] = useState({ perfect: 0, good: 0, miss: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Lock for async operations
    const isProcessingRef = useRef(false);

    // Start exercise
    const handleStartExercise = useCallback(() => {
        // Create new queue manager with current settings
        const manager = new NoteQueueManager(keySignature, noteRange);
        manager.initializeQueue(20); // Generate 20 initial notes for preview

        queueManagerRef.current = manager;
        setNoteQueue(manager.getAllNotes());
        setCurrentNoteIndex(0);
        setCurrentNoteIndex(0);
        setIsExerciseActive(true);
        setFeedbackStatus('idle');
        setStats({ perfect: 0, good: 0, miss: 0 });

        setTimeout(() => {
            containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }, [keySignature, noteRange]);

    // Stop exercise
    const handleStopExercise = useCallback(() => {
        setIsExerciseActive(false);
        setNoteQueue([]);
        setCurrentNoteIndex(0);
        setFeedbackStatus('idle');
        queueManagerRef.current = null;
    }, []);

    // Handle MIDI input
    const handleMIDINote = useCallback((event: MIDINoteEvent) => {
        if (!isExerciseActive || !queueManagerRef.current || event.type !== 'noteOn') return;

        // Sync lock to prevent double-fire
        if (isProcessingRef.current) return;

        const manager = queueManagerRef.current;
        const currentNote = manager.getCurrentNote();

        if (!currentNote) return;

        const isCorrect = checkNoteMatch(event.pitch, currentNote);

        if (isCorrect) {
            // Lock briefly to prevent double-trigger on same event
            isProcessingRef.current = true;
            setTimeout(() => { isProcessingRef.current = false; }, 100);

            // Correct note! 
            // 1. Update Stats
            setStats(s => ({ ...s, perfect: s.perfect + 1 }));

            // 2. Shift Queue IMMEDIATELY (No delay)
            manager.shiftQueue();
            setNoteQueue([...manager.getAllNotes()]);

            // 3. Show feedback (non-blocking)
            setFeedbackStatus('correct');
            // Clear feedback visual after a delay, but logic continues
            setTimeout(() => setFeedbackStatus('idle'), 500);

        } else {
            // Lock briefly to prevent spamming errors (e.g. +11 errors)
            isProcessingRef.current = true;
            setTimeout(() => { isProcessingRef.current = false; }, 200);

            // Incorrect note
            setFeedbackStatus('incorrect');
            setStats(s => ({ ...s, miss: s.miss + 1 }));

            // Clear feedback after a moment
            setTimeout(() => {
                setFeedbackStatus('idle');
            }, 500);
        }
    }, [isExerciseActive]);

    const { isConnected, error: midiError } = useMIDIInput(handleMIDINote);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <Header />

            <main className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Title */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">
                        🎹 Lettura Musicale Continua
                    </h1>
                    <p className="text-lg text-gray-600 mb-4">
                        Esercizio continuo di lettura musicale a scorrimento
                    </p>

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 max-w-2xl mx-auto mb-8 text-left flex items-start">
                        <span className="text-2xl mr-3">🎹</span>
                        <div>
                            <p className="font-bold text-blue-800">Modalità MIDI</p>
                            <p className="text-blue-700 text-sm">
                                Questo esercizio funziona <strong>solo</strong> con uno strumento connesso tramite cavo MIDI.
                                Suona le note corrette sulla tua tastiera quando appaiono evidenziate.
                            </p>
                        </div>
                    </div>
                </div>

                {/* MIDI Status - Removed large blocks, now in Header */}
                <div className="mb-6 h-4"></div>

                {/* Settings */}
                <Settings
                    keySignature={keySignature}
                    noteRange={noteRange}
                    onKeySignatureChange={setKeySignature}
                    onNoteRangeChange={setNoteRange}
                    isExerciseActive={isExerciseActive}
                    onStartExercise={handleStartExercise}
                    onStopExercise={handleStopExercise}
                />

                {/* Scrolling Staff Display */}
                <div ref={containerRef} className="relative">
                    {isExerciseActive && (
                        <div className="absolute top-0 left-0 right-0 flex justify-center -mt-8 z-10 pointer-events-none">
                            <div className="bg-white/90 backdrop-blur px-6 py-2 rounded-full shadow-md border border-gray-200 flex gap-8">
                                <div className="flex flex-col items-center">
                                    <span className="text-xs font-bold text-green-600 uppercase">Corrette</span>
                                    <span className="text-2xl font-bold text-green-700">{stats.perfect}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-xs font-bold text-red-500 uppercase">Sbagliate</span>
                                    <span className="text-2xl font-bold text-red-600">{stats.miss}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <ScrollingStaff
                        notes={noteQueue}
                        currentNoteIndex={currentNoteIndex}
                        keySignature={keySignature}
                        feedbackStatus={feedbackStatus}
                    />
                </div>

                {/* Instructions */}
                {!isExerciseActive && (
                    <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">
                            📖 Come funziona la Lettura Musicale Continua
                        </h3>
                        <ul className="space-y-3 text-gray-700">
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-3 text-xl">1.</span>
                                <span>
                                    <strong>Configura:</strong> Scegli tonalità e range di note
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-3 text-xl">2.</span>
                                <span>
                                    <strong>Premi START:</strong> Vedrai 8-10 note generate sul pentagramma
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-3 text-xl">3.</span>
                                <span>
                                    <strong>Suona la PRIMA nota (BLU):</strong> La prima nota è sempre quella da suonare
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-3 text-xl">4.</span>
                                <span>
                                    <strong>Procedi automaticamente:</strong> Note corrette diventano grigie, l'esercizio avanza immediatamente
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-3 text-xl">5.</span>
                                <span>
                                    <strong>Esercizio infinito:</strong> Continua finché non premi STOP
                                </span>
                            </li>
                        </ul>
                    </div>
                )}

                {/* Exercise Stats (when active) - REMOVED (Replaced by ScoreStats) */}
            </main>

            {/* Feedback Overlay */}
            <FeedbackIndicator status={feedbackStatus} />
        </div>
    );
}
