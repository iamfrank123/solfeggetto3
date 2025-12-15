'use client';

import { useState, useCallback, useRef } from 'react';
import Header from '@/components/Layout/Header';
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
    const [notesPlayed, setNotesPlayed] = useState(0);

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
        setIsExerciseActive(true);
        setFeedbackStatus('idle');
        setNotesPlayed(0);
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

        // Prevent double triggering if we're already showing feedback/transitioning
        if (feedbackStatus !== 'idle') return;

        const manager = queueManagerRef.current;
        const currentNote = manager.getCurrentNote();

        if (!currentNote) return;

        const isCorrect = checkNoteMatch(event.pitch, currentNote);

        if (isCorrect) {
            // Lock immediately
            isProcessingRef.current = true;

            // Correct note! Show green feedback
            setFeedbackStatus('correct');
            setNotesPlayed(prev => prev + 1);

            // Add a small delay to allow for smooth transition before shifting
            setTimeout(() => {
                manager.shiftQueue();
                setNoteQueue([...manager.getAllNotes()]);
                // Index stays at 0 - we're always playing the first note
                setFeedbackStatus('idle');

                // Unlock after transition completes
                isProcessingRef.current = false;
            }, 400); // Slightly longer delay for smoother visual

        } else {
            // Incorrect note - show red feedback
            setFeedbackStatus('incorrect');

            // Clear feedback after a moment
            setTimeout(() => {
                setFeedbackStatus('idle');
            }, 600);
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
                        🎹 Pentagramma - Continuous Sight Reading
                    </h1>
                    <p className="text-lg text-gray-600">
                        Esercizio continuo di lettura musicale a scorrimento
                    </p>
                </div>

                {/* MIDI Status */}
                <div className="mb-6">
                    {isConnected ? (
                        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
                            <p className="text-green-700 font-semibold">
                                ✅ Tastiera MIDI connessa - Pronto per l'esercizio!
                            </p>
                        </div>
                    ) : (
                        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 text-center">
                            <p className="text-yellow-700">
                                ⚠️ Nessuna tastiera MIDI connessa
                            </p>
                            <p className="text-yellow-600 text-sm mt-1">
                                Collega una tastiera MIDI per iniziare
                            </p>
                        </div>
                    )}

                    {midiError && (
                        <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-lg p-4">
                            <p className="text-red-700">🚫 Errore MIDI: {midiError}</p>
                        </div>
                    )}
                </div>

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
                <ScrollingStaff
                    notes={noteQueue}
                    currentNoteIndex={currentNoteIndex}
                    keySignature={keySignature}
                    feedbackStatus={feedbackStatus}
                />

                {/* Instructions */}
                {!isExerciseActive && (
                    <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">
                            📖 Come funziona il Sight Reading Continuo
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
                                    <strong>Procedi automaticamente:</strong> Note corrette diventano grigie, l'esercizio avanza, nuove note appaiono
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-3 text-xl">5.</span>
                                <span>
                                    <strong>Esercizio infinito:</strong> L'esercizio continua finché non premi STOP
                                </span>
                            </li>
                        </ul>
                    </div>
                )}

                {/* Exercise Stats (when active) */}
                {isExerciseActive && (
                    <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
                        <div className="text-center">
                            <p className="text-gray-700">
                                <span className="font-bold text-2xl text-blue-600">{notesPlayed}</span>
                                <span className="text-gray-500 ml-2">note suonate correttamente</span>
                            </p>
                        </div>
                    </div>
                )}
            </main>

            {/* Feedback Overlay */}
            <FeedbackIndicator status={feedbackStatus} />
        </div>
    );
}
