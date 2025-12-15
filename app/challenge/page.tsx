'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Layout/Header';
import ChallengeStaff from '@/components/Staff/ChallengeStaff';
import { generateRandomNote, checkNoteMatch } from '@/lib/generator/note-generator';
import { GeneratedNote, KeySignature, NoteRange } from '@/lib/generator/types';
import { useMIDIInput } from '@/hooks/useMIDIInput';
import { MIDINoteEvent } from '@/lib/types/midi';

// Game Constants
// Game Constants
const SPAWN_X = 900;
const HIT_X = 100;
const HIT_WINDOW = 30; // +/- pixels for "perfect" (Green)
const HIT_WINDOW_GOOD = 35; // +/- pixels for "good" (Yellow, 5px tolerance)
const SCORE_PERFECT = 5;
const SCORE_GOOD = 3;
const SCORE_MISS = 0;

interface GameNote {
    id: string;
    note: GeneratedNote;
    x: number;
    status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
}

export default function ChallengePage() {
    // Settings
    const [bpm, setBpm] = useState(60);
    const [keySignature, setKeySignature] = useState<KeySignature>('C');
    const [noteRange, setNoteRange] = useState<NoteRange>({ low: 'C4', high: 'C5' });

    // Game State
    const [isPlaying, setIsPlaying] = useState(false);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [activeNotes, setActiveNotes] = useState<GameNote[]>([]);
    const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);

    // Refs for loop
    const lastFrameTimeRef = useRef<number>(0);
    const requestRef = useRef<number>();
    const nextSpawnTimeRef = useRef<number>(0);

    // Derived speed
    const pixelsPerSecond = bpm * 2; // Arbitrary scaling factor, adjustable

    // Start Game
    const startGame = (e?: React.MouseEvent) => {
        e?.stopPropagation(); // Prevent immediate trigger of click handler
        setIsPlaying(true);
        setScore(0);
        setCombo(0);
        setActiveNotes([]);
        lastFrameTimeRef.current = performance.now();
        requestRef.current = requestAnimationFrame(gameLoop);
    };

    // Stop Game
    const stopGame = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsPlaying(false);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };

    // Game Loop
    const gameLoop = (time: number) => {
        const deltaTime = (time - lastFrameTimeRef.current) / 1000; // seconds
        lastFrameTimeRef.current = time;

        const pixelsToMove = pixelsPerSecond * deltaTime;

        // 1. Move Notes
        setActiveNotes(prevNotes => {
            const nextNotes = prevNotes.map(n => ({
                ...n,
                x: n.x - pixelsToMove
            }));

            // Filter out missed notes (scrolled past screen)
            // But mark as miss first to show red?
            // For now, simpler: just remove if way off screen
            const validNotes = nextNotes.filter(n => {
                if (n.status === 'pending' && n.x < -50) {
                    // Missed!
                    // Triggers side effect inside render is bad practice vs finding them.
                    // But strictly here we are just computing next state.
                    // We'll handle "Miss" logic in a separate effect or checking logic
                    return false;
                }
                if (n.x < -100) return false; // Garbage collect
                return true;
            });

            return validNotes;
        });

        // 2. Spawn Notes
        if (time > nextSpawnTimeRef.current) {
            const newNote = generateRandomNote(noteRange, keySignature);
            const gameNote: GameNote = {
                id: Math.random().toString(36).substr(2, 9),
                note: newNote,
                x: SPAWN_X,
                status: 'pending'
            };

            setActiveNotes(prev => [...prev, gameNote]);

            // Calc next spawn time based on BPM (e.g. quarter notes)
            // 60 BPM = 1 beat per sec. 
            const secondsPerBeat = 60 / bpm;
            nextSpawnTimeRef.current = time + (secondsPerBeat * 1000);
        }

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // Unified Input Handler (MIDI + Mouse)
    const handleInput = useCallback((input: { type: 'midi' | 'mouse', pitch?: number }) => {
        if (!isPlaying) return;

        setActiveNotes(currentNotes => {
            // Find targetable notes.
            // For mouse, we want to be linient if nothing is "perfectly" in range, maybe target the absolute closest even if far out?
            // But requirements say "0 points if missing".
            // So we still look for something reasonably close.
            // Let's use a max interactive range of e.g. 150px to find a candidate to grade.
            const MAX_INTERACTION_RANGE = 200;

            let pendingNotes = currentNotes.filter(n =>
                n.status === 'pending' &&
                n.x > (HIT_X - MAX_INTERACTION_RANGE) &&
                n.x < (HIT_X + MAX_INTERACTION_RANGE)
            );

            // Fix: For MIDI input, filter by pitch first to prevent duplicate consecutive notes
            // from both being validated with a single note input
            if (input.type === 'midi' && pendingNotes.length > 0) {
                const inputPitch = input.pitch! % 12;
                // Filter to only notes with matching pitch
                const matchingNotes = pendingNotes.filter(n => (n.note.midiNumber % 12) === inputPitch);
                if (matchingNotes.length > 0) {
                    // Use only matching notes - this ensures only the first matching note is validated
                    pendingNotes = matchingNotes;
                } else {
                    // No matching pitch found - will show wrong note feedback
                }
            }

            if (pendingNotes.length === 0) return currentNotes;

            // Sort by distance to HIT_X to find the most "intentional" target
            // Typically the one closest to the line is the one being aimed at.
            pendingNotes.sort((a, b) => Math.abs(a.x - HIT_X) - Math.abs(b.x - HIT_X));

            const targetNote = pendingNotes[0];

            if (!targetNote) return currentNotes;

            // Usage validation
            if (input.type === 'midi') {
                // Check Patch (should already match due to filtering above, but double-check for safety)
                const isMatch = (input.pitch! % 12) === (targetNote.note.midiNumber % 12);
                if (!isMatch) {
                    setCombo(0);
                    setFeedback({ text: 'Wrong Note!', color: 'text-red-500' });
                    setTimeout(() => setFeedback(null), 500);
                    return currentNotes;
                }
            }
            // For mouse, we assume they are trying to hit the current note regardless of pitch understanding (rhythm game style)

            // Grading
            const dist = Math.abs(targetNote.x - HIT_X);
            let newStatus: GameNote['status'] = 'pending';
            let points = 0;

            if (dist <= HIT_WINDOW) {
                // Green Zone (+/- 30px)
                newStatus = 'match_perfect';
                points = SCORE_PERFECT;
                setFeedback({ text: 'PERFECT! +5', color: 'text-green-500' });
            } else if (dist <= HIT_WINDOW_GOOD) {
                // Yellow Zone (+/- 35px)
                newStatus = 'match_good';
                points = SCORE_GOOD;
                setFeedback({ text: 'Good +3', color: 'text-yellow-500' });
            } else {
                // Missed Zone (Red)
                // If they clicked but were outside the valid window
                setCombo(0);
                points = SCORE_MISS;
                // We intentionally DON'T mark it as 'hit' so it might still be active? 
                // No, if they attempted and failed, it should probably count as their attempt for this note.
                // Or does missing a click mean you can try again?
                // Usually rhythm games: bad timing = miss = note exhausted.
                newStatus = 'miss';
                setFeedback({ text: 'Miss! 0', color: 'text-red-500' });
            }

            if (points > 0) {
                setScore(s => s + points);
                setCombo(c => c + 1);
            }

            setTimeout(() => setFeedback(null), 800);

            return currentNotes.map(n =>
                n.id === targetNote.id ? { ...n, status: newStatus } : n
            );
        });
    }, [isPlaying]);

    // MIDI Listener
    const handleMidiInput = useCallback((event: MIDINoteEvent) => {
        if (event.type === 'noteOn') {
            handleInput({ type: 'midi', pitch: event.pitch });
        }
    }, [handleInput]);

    useMIDIInput(handleMidiInput);

    // Mouse Listener
    const handleMouseClick = useCallback(() => {
        handleInput({ type: 'mouse' });
    }, [handleInput]);

    return (
        <div className="min-h-screen bg-slate-50">
            <Header />

            <main
                className="container mx-auto px-4 py-8 max-w-6xl cursor-pointer select-none"
                onClick={handleMouseClick}
            >
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800">
                        ⚡ Challenge Mode
                    </h1>
                    <p className="text-gray-600">Tempo & Precision Training</p>
                </div>

                {/* Score Board */}
                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div className="bg-white p-4 rounded-lg shadow">
                        <p className="text-gray-500 text-sm">SCORE</p>
                        <p className="text-3xl font-bold text-blue-600">{score}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <p className="text-gray-500 text-sm">COMBO</p>
                        <p className="text-3xl font-bold text-orange-500">{combo}x</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <p className="text-gray-500 text-sm">BPM</p>
                        <div className="flex items-center justify-center space-x-2">
                            <button onClick={() => setBpm(b => Math.max(30, b - 5))} className="p-1 bg-gray-200 rounded hover:bg-gray-300">-</button>
                            <span className="text-2xl font-bold">{bpm}</span>
                            <button onClick={() => setBpm(b => Math.min(200, b + 5))} className="p-1 bg-gray-200 rounded hover:bg-gray-300">+</button>
                        </div>
                    </div>
                </div>

                {/* Game Area */}
                <div className="relative mb-8">
                    <ChallengeStaff
                        notes={activeNotes}
                        speedPixelsPerFrame={0} // handled in parent loop
                        keySignature={keySignature}
                        onHitZoneEnter={() => { }}
                        onHitZoneLeave={() => { }}
                        isPlaying={isPlaying}
                    />

                    {/* Feedback Popup */}
                    {feedback && (
                        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl font-black ${feedback.color} animate-bounce pointer-events-none shadow-sm`}>
                            {feedback.text}
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex justify-center space-x-6">
                    {!isPlaying ? (
                        <button
                            onClick={startGame}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-12 rounded-full shadow-lg transform transition hover:scale-105"
                        >
                            START CHALLENGE
                        </button>
                    ) : (
                        <button
                            onClick={stopGame}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-12 rounded-full shadow-lg"
                        >
                            STOP
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
}
