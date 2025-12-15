'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Layout/Header';
import RhythmStaff from '@/components/Staff/RhythmStaff';
import StaticRhythmStaff from '@/components/Staff/StaticRhythmStaff';
import { generateRhythmPattern, RhythmNoteType } from '@/lib/generator/rhythm-generator';
import { RhythmNote } from '@/lib/generator/rhythm-generator';
import { useRhythmAudio } from '@/hooks/useRhythmAudio';

// Game Constants
const SPAWN_X = 900;
const HIT_X = 100;
const HIT_WINDOW = 30; // +/- pixels for "perfect" (Green)
const HIT_WINDOW_GOOD = 35; // +/- pixels for "good" (Yellow)
const SCORE_PERFECT = 5;
const SCORE_GOOD = 3;
const SCORE_MISS = 0;

interface RhythmGameNote {
    id: string;
    note: RhythmNote;
    x: number;
    status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
    targetTime: number; // Audio time when note hits bar
}

export default function RhythmPage() {
    // Settings
    const [bpm, setBpm] = useState(60);
    const [timeSignature, setTimeSignature] = useState<'3/4' | '4/4' | '6/8'>('4/4');
    const [allowedFigures, setAllowedFigures] = useState<RhythmNoteType[]>(['w', 'h', 'q', '8']); // Default basic
    const [includeRests, setIncludeRests] = useState(false);

    // VISUAL MODE
    const [visualMode, setVisualMode] = useState<'scrolling' | 'static'>('scrolling');

    // Audio Settings
    const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(true);
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);

    // Audio Hook
    const { initAudio, startMetronome, stopMetronome, setBpm: updateAudioBpm, setTimeSignature: updateAudioSignature, playDrumSound, getAudioTime } = useRhythmAudio();

    // Sync Audio BPM & Signature
    useEffect(() => {
        updateAudioBpm(bpm);
    }, [bpm, updateAudioBpm]);

    useEffect(() => {
        const [num, den] = timeSignature.split('/').map(Number);
        updateAudioSignature(num, den || 4);
    }, [timeSignature, updateAudioSignature]);

    // Game State
    const [isPlaying, setIsPlaying] = useState(false);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [activeNotes, setActiveNotes] = useState<RhythmGameNote[]>([]);
    const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);

    // Refs
    // Timeline Refs
    const requestRef = useRef<number>();
    const nextSpawnTimeRef = useRef<number>(0);
    const patternQueueRef = useRef<RhythmNote[]>([]);
    const currentPageTimeRef = useRef<number>(0); // Start time of current Static Page (2 measures)
    const firstNoteTimeRef = useRef<number>(0); // For Count-In calculation

    // LINEAR SPEED CONFIG
    const measuresSpawnedRef = useRef<number>(0);

    // LINEAR SPEED CONFIG
    const pixelsPerSecond = bpm * 2;

    // Duration Settings
    const [durationOptions, setDurationOptions] = useState({
        'w': true,  // Whole
        'h': true,  // Half
        'q': true,  // Quarter
        '8': true,  // Eighth
        '16': false // Sixteenth
    });

    // Update allowedFigures when checkboxes change
    useEffect(() => {
        const selected = Object.entries(durationOptions)
            .filter(([_, isSelected]) => isSelected)
            .map(([key]) => key as RhythmNoteType);

        // Prevent empty selection (fallback to quarter)
        if (selected.length === 0) setAllowedFigures(['q']);
        else setAllowedFigures(selected);
    }, [durationOptions]);

    // Helper: Duration of 1 measure in Seconds
    const getMeasureDuration = useCallback(() => {
        const beatSec = 60 / bpm;
        const [num] = timeSignature.split('/').map(Number);
        return num * beatSec;
    }, [bpm, timeSignature]);

    // Start
    const startGame = async (e?: React.MouseEvent) => {
        e?.stopPropagation();

        // 1. Request Fullscreen & Landscape
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            }
            // @ts-ignore - Screen Orientation API
            if (screen.orientation && screen.orientation.lock) {
                // @ts-ignore
                await screen.orientation.lock('landscape').catch(err => console.log('Orientation lock failed:', err));
            }
        } catch (err) {
            console.log('Fullscreen/Orientation failed:', err);
        }

        initAudio(); // Ensure context is ready
        setIsPlaying(true);

        let audioStart = 0;
        if (isMetronomeEnabled) {
            // @ts-ignore
            audioStart = startMetronome() || 0;
        } else {
            audioStart = getAudioTime() + 0.1;
        }

        setScore(0);
        setCombo(0);
        setActiveNotes([]);
        patternQueueRef.current = [];
        measuresSpawnedRef.current = 0;

        // Time Logic
        const beatSec = 60 / bpm;
        const [num] = timeSignature.split('/').map(Number);
        const measureDur = num * beatSec;

        // We want: [Gap (1m)] [Play (2m)]
        // audioStart is NOW.
        // We want the Gap to start NOW (or slightly after audioStart).
        // And the first note to be at audioStart + measureDur.

        const firstNoteTime = audioStart + measureDur;

        nextSpawnTimeRef.current = firstNoteTime;
        firstNoteTimeRef.current = firstNoteTime; // Used for "first ever" check if needed, but cycle logic supersedes.

        // Static Page Start = Start of Gap
        currentPageTimeRef.current = audioStart;

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    // Stop
    const stopGame = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsPlaying(false);
        stopMetronome();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        // Unlock orientation
        // @ts-ignore
        if (screen.orientation && screen.orientation.unlock) {
            // @ts-ignore
            screen.orientation.unlock();
        }
        // Optional: Exit fullscreen? Maybe keep it for convenience.
        // if (document.exitFullscreen) document.exitFullscreen();
    };

    // Toggle Metronome Runtime
    useEffect(() => {
        if (isPlaying) {
            if (isMetronomeEnabled) startMetronome();
            else stopMetronome();
        }
    }, [isMetronomeEnabled, isPlaying, startMetronome, stopMetronome]);

    // Game Loop
    const gameLoop = () => {
        const currentTime = getAudioTime();
        const measureDur = getMeasureDuration();

        // CONFIG: STATIC MODE
        const EXERCISE_MEASURES = 2; // User requested 2 continuous measures
        const GAP_MEASURES = 1;      // User requested 4 beats break (1 measure in 4/4)

        // 1. Countdown & Page Logic (Static Mode)
        if (visualMode === 'static') {
            // Cycle: [Gap] + [Play]
            // Gap comes FIRST in the cycle logic visually (Screen clears => Count => Play)
            // But effectively, "Gap" consumes time.
            const gapDur = measureDur * GAP_MEASURES;
            const playDur = measureDur * EXERCISE_MEASURES;
            const cycleDur = gapDur + playDur;

            // Current Cycle Time
            const timeInCycle = currentTime - currentPageTimeRef.current;

            // 1a. Advance Cycle
            if (timeInCycle >= cycleDur) {
                currentPageTimeRef.current += cycleDur; // Flip Page
            }

            // 1b. Countdown (Visible during Gap)
            if (timeInCycle < gapDur) {
                // Precise Beat Calculation
                const beatSec = 60 / bpm;
                const currentBeatIndex = Math.floor(timeInCycle / beatSec);
                const gapBeats = Math.round(gapDur / beatSec);
                const beatsLeft = gapBeats - currentBeatIndex;

                setCountdown(beatsLeft > 0 ? beatsLeft : null);
            } else {
                setCountdown(null);
            }
        }
        else {
            if (currentTime < firstNoteTimeRef.current) {
                const beatSec = 60 / bpm;
                const timeLeft = firstNoteTimeRef.current - currentTime;
                const beatsLeft = Math.ceil(timeLeft / beatSec);
                setCountdown(beatsLeft > 0 ? beatsLeft : null);
            } else {
                setCountdown(null);
            }
        }

        // 2. Spawn Logic
        // Fix: Preload needs to cover [Gap + Play Measures].
        const PRELOAD_WINDOW = 20.0;

        const notesToAdd: RhythmGameNote[] = [];

        while (nextSpawnTimeRef.current < currentTime + PRELOAD_WINDOW) {
            if (patternQueueRef.current.length === 0) {
                patternQueueRef.current = generateRhythmPattern(allowedFigures, includeRests, timeSignature);
                measuresSpawnedRef.current += 1;
            }

            const nextNote = patternQueueRef.current.shift();
            if (nextNote) {
                const beatSec = 60 / bpm;
                const noteDur = (nextNote.duration === 'bar' ? 0 : nextNote.value) * beatSec;

                const gameNote: RhythmGameNote = {
                    id: Math.random().toString(36).substr(2, 9),
                    note: nextNote,
                    x: SPAWN_X,
                    status: 'pending',
                    targetTime: nextSpawnTimeRef.current
                };

                notesToAdd.push(gameNote); // Batch add
                nextSpawnTimeRef.current += noteDur;

                // Gap Insertion Logic
                if (nextNote.duration === 'bar' && visualMode === 'static') {
                    if (patternQueueRef.current.length === 0) {
                        // Check if we completed the exercise block
                        if (measuresSpawnedRef.current % EXERCISE_MEASURES === 0) {
                            // Insert Gap
                            nextSpawnTimeRef.current += (measureDur * GAP_MEASURES);
                        }
                    }
                }
            }
        }

        // 3. Status Update & cleanup
        setActiveNotes(prev => {
            // Combine previous with new batch
            let nextState = [...prev, ...notesToAdd];

            // Position update
            if (visualMode === 'scrolling') {
                nextState = nextState.map(n => {
                    const diff = n.targetTime - currentTime;
                    const newX = (diff * pixelsPerSecond) + HIT_X;
                    return { ...n, x: newX };
                });
            } else {
                // STATIC MODE: Position fixed by Staff component
            }

            // Expiration / Pruning
            return nextState.map(n => {
                if (n.status === 'pending' && currentTime > n.targetTime + 0.25) {
                    return { ...n, status: 'miss' as const };
                }
                return n;
            }).filter(n => {
                // Pruning Logic
                if (visualMode === 'static') {
                    // Keep notes for current page (with buffer)
                    // Page definition moved to dynamic calculation if needed, 
                    // but for pruning, just keeping "current and slightly past" is fine.
                    // A safe buffer is 1 cycle.
                    return n.targetTime >= currentPageTimeRef.current - 5.0;
                } else {
                    return n.targetTime > currentTime - 5.0;
                }
            });
        });

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // Interaction Handler
    const handleInteraction = useCallback(() => {
        if (!isPlaying) return;

        const currentTime = getAudioTime();

        setActiveNotes(currentNotes => {
            // Algorithm: Find closest pending note to Current Time
            // Filter candidates (Must be pending AND NOT A BAR LINE)
            const candidates = currentNotes.filter(n => n.status === 'pending' && n.note.duration !== 'bar');
            if (candidates.length === 0) return currentNotes;

            // Sort by time difference
            candidates.sort((a, b) => Math.abs(a.targetTime - currentTime) - Math.abs(b.targetTime - currentTime));
            const target = candidates[0];

            if (!target) return currentNotes;

            // Time Difference in Seconds
            const timeDiff = Math.abs(target.targetTime - currentTime);

            // Define Windows in Seconds
            const PERFECT_WINDOW_S = 0.10; // 50ms
            const GOOD_WINDOW_S = 0.15;   // 100ms
            // Miss window? If > 0.15s, maybe ignore click or count as miss?
            // Existing logic enforced auto-miss only if passed.
            // Here we treat click as attempt.

            if (target.note.isRest) {
                if (timeDiff < GOOD_WINDOW_S) {
                    setCombo(0);
                    setFeedback({ text: 'Don\'t Click Rests!', color: 'text-red-500' });
                    setTimeout(() => setFeedback(null), 500);
                    return currentNotes.map(n => n.id === target.id ? { ...n, status: 'miss' } : n);
                }
                return currentNotes;
            }

            let newStatus: RhythmGameNote['status'] = 'pending';
            let points = 0;

            if (timeDiff <= PERFECT_WINDOW_S) {
                newStatus = 'match_perfect';
                points = SCORE_PERFECT;
                setFeedback({ text: 'PERFECT! +5', color: 'text-green-500' });
            } else if (timeDiff <= GOOD_WINDOW_S) {
                newStatus = 'match_good';
                points = SCORE_GOOD;
                setFeedback({ text: 'Good +3', color: 'text-yellow-500' });
            } else {
                // Too early/late click?
                // If very far, maybe ignore?
                if (timeDiff > 0.2) return currentNotes; // Ignore accidental clicks far away

                newStatus = 'miss';
                setCombo(0);
                setFeedback({ text: 'Miss!', color: 'text-red-500' });
            }

            if (points > 0) {
                if (isSoundEnabled) playDrumSound();
                setScore(s => s + points);
                setCombo(c => c + 1);
            }
            setTimeout(() => setFeedback(null), 500);

            return currentNotes.map(n => n.id === target.id ? { ...n, status: newStatus } : n);
        });
    }, [isPlaying, isSoundEnabled, playDrumSound, getAudioTime]);

    return (
        <div className="min-h-screen bg-stone-50">
            <Header />

            <main
                className="container mx-auto px-4 py-8 max-w-6xl cursor-pointer select-none"
                onMouseDown={handleInteraction}
                onTouchStart={handleInteraction}
            >
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-amber-700">🥁 Rhythm Mode</h1>
                    <p className="text-amber-600">Master the groove</p>
                </div>

                {/* Visible STOP Button (When Playing) */}
                {isPlaying && (
                    <div className="fixed top-20 right-4 z-[60] animate-in fade-in slide-in-from-top-4 duration-300">
                        <button
                            onClick={stopGame}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-2xl border-4 border-white transform transition hover:scale-105 flex items-center gap-2"
                        >
                            <span className="text-2xl">⏹️</span>
                            <span>STOP</span>
                        </button>
                    </div>
                )}

                {/* Score Board */}
                <div className="grid grid-cols-3 gap-4 mb-2 text-center max-w-3xl mx-auto">
                    <div className="bg-white p-4 rounded-lg shadow border border-amber-100">
                        <p className="text-gray-500 text-sm">SCORE</p>
                        <p className="text-3xl font-bold text-amber-600">{score}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow border border-amber-100">
                        <p className="text-gray-500 text-sm">COMBO</p>
                        <p className="text-3xl font-bold text-orange-500">{combo}x</p>
                        {combo % 10 === 0 && combo > 0 && (
                            <span className="block text-xs font-bold text-amber-500 animate-bounce mt-1">PERFECT!</span>
                        )}
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow border border-amber-100">
                        <p className="text-gray-500 text-sm">BPM</p>
                        <div className="flex items-center justify-center space-x-2">
                            <input
                                type="range"
                                min="40"
                                max="200"
                                value={bpm}
                                onChange={(e) => { e.stopPropagation(); setBpm(Number(e.target.value)); }}
                                disabled={isPlaying}
                                className="w-24 accent-amber-600"
                            />
                            <span className="text-2xl font-bold text-stone-700">{bpm}</span>
                        </div>
                    </div>

                    {/* Note Durations Selection */}
                    <div className="col-span-3 bg-white p-4 rounded-lg shadow border border-amber-100 mt-2">
                        <span className="text-gray-500 text-sm font-bold block mb-2">NOTE VALUES:</span>
                        <div className="flex flex-wrap justify-center gap-4">
                            {[
                                { id: 'w', label: 'Whole (4)' },
                                { id: 'h', label: 'Half (2)' },
                                { id: 'q', label: 'Quarter (1)' },
                                { id: '8', label: 'Eighth (1/2)' },
                                { id: '16', label: '16th (1/4)' }
                            ].map(opt => (
                                <label key={opt.id} className="flex items-center space-x-2 cursor-pointer bg-stone-50 px-3 py-1 rounded-full border border-stone-200 hover:bg-stone-100">
                                    <input
                                        type="checkbox"
                                        checked={durationOptions[opt.id as keyof typeof durationOptions]}
                                        disabled={isPlaying}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            setDurationOptions(prev => ({
                                                ...prev,
                                                [opt.id]: e.target.checked
                                            }));
                                        }}
                                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                    />
                                    <span className={`text-sm font-medium ${durationOptions[opt.id as keyof typeof durationOptions] ? 'text-amber-800' : 'text-gray-400'}`}>
                                        {opt.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="col-span-3 bg-white p-4 rounded-lg shadow border border-amber-100 mt-2 flex justify-center items-center space-x-4">
                        <span className="text-gray-500 text-sm font-bold">TIME SIG:</span>
                        {(['3/4', '4/4', '6/8'] as const).map(sig => (
                            <button
                                key={sig}
                                onClick={(e) => { e.stopPropagation(); setTimeSignature(sig); }}
                                className={`px-3 py-1 rounded-full text-sm font-bold transition ${timeSignature === sig
                                    ? 'bg-amber-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                            >
                                {sig}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Visual Mode Toggle */}
                <div className="flex justify-center mb-1">
                    <div className="bg-stone-100 p-0.5 rounded-lg flex space-x-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setVisualMode('scrolling'); }}
                            className={`px-3 py-1 rounded-md text-sm font-bold transition ${visualMode === 'scrolling' ? 'bg-white shadow text-amber-600' : 'text-gray-400'}`}
                        >
                            🌊 Scrolling
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setVisualMode('static'); }}
                            className={`px-3 py-1 rounded-md text-sm font-bold transition ${visualMode === 'static' ? 'bg-white shadow text-amber-600' : 'text-gray-400'}`}
                        >
                            📄 Static
                        </button>
                    </div>
                </div>

                {/* Game Area */}
                <div className="relative max-w-5xl mx-auto h-[400px] flex items-center justify-center">

                    {/* UI OVERLAYS (Positioned ABOVE staff) */}

                    {/* Countdown Overlay - Moved TOP */}
                    {countdown !== null && (
                        <div className="absolute -top-32 left-0 right-0 flex items-center justify-center z-40 pointer-events-none transition-opacity duration-300">
                            <div key={countdown} className="text-center animate-in zoom-in duration-75 bg-white/90 px-8 py-4 rounded-2xl shadow-xl border border-amber-100">
                                <div className="text-4xl font-black text-amber-600 mb-1">
                                    {countdown > 1 ? 'WAIT' : 'READY...'}
                                </div>
                                <div className="text-7xl font-black text-amber-800">
                                    {countdown}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Feedback - Moved TOP */}
                    {feedback && (
                        <div className="absolute -top-16 left-0 right-0 z-50 flex justify-center pointer-events-none">
                            <div className={`text-4xl font-black animate-bounce ${feedback.color} bg-white/90 px-6 py-2 rounded-full shadow-lg`}>
                                {feedback.text}
                            </div>
                        </div>
                    )}



                    {visualMode === 'scrolling' ? (
                        <RhythmStaff notes={activeNotes} hitX={HIT_X} />
                    ) : (
                        <StaticRhythmStaff
                            notes={activeNotes.filter(n => n.targetTime >= currentPageTimeRef.current && n.targetTime < currentPageTimeRef.current + (getMeasureDuration() * 3))}
                            timeSignature={timeSignature}
                            currentBeatIndex={0}
                        />
                    )}

                </div>
            </main>
            {/* Start Screen Controls (Only visible when NOT playing) */}
            {!isPlaying && (
                <div className="flex justify-center flex-col items-center space-y-4 pb-12">
                    <div className="text-center space-y-4">
                        <div className="flex space-x-6 justify-center bg-white p-4 rounded-lg shadow-sm">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeRests}
                                    onChange={e => setIncludeRests(e.target.checked)}
                                    className="w-5 h-5 text-amber-600"
                                />
                                <span className="text-gray-700">Include Rests</span>
                            </label>

                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isMetronomeEnabled}
                                    onChange={e => setIsMetronomeEnabled(e.target.checked)}
                                    className="w-5 h-5 text-amber-600"
                                />
                                <span className="text-gray-700">Metronome</span>
                            </label>

                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isSoundEnabled}
                                    onChange={e => setIsSoundEnabled(e.target.checked)}
                                    className="w-5 h-5 text-amber-600"
                                />
                                <span className="text-gray-700">Sounds</span>
                            </label>
                        </div>
                        <button
                            onClick={startGame}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 px-12 rounded-full shadow-lg transform transition hover:scale-105"
                        >
                            START RHYTHM
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
