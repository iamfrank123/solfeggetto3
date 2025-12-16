'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Layout/Header';
import ScoreStats from '@/components/Feedback/ScoreStats';
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
    const [stats, setStats] = useState({ perfect: 0, good: 0, miss: 0 });
    const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Refs
    // Timeline Refs
    const requestRef = useRef<number>();
    const nextSpawnTimeRef = useRef<number>(0);
    const patternQueueRef = useRef<RhythmNote[]>([]);
    const currentPageTimeRef = useRef<number>(0); // Start time of current Static Page (2 measures)
    const firstNoteTimeRef = useRef<number>(0); // For Count-In calculation

    // PROCESSED RESTS (For Auto-Success Logic)
    const processedRestIdsRef = useRef<Set<string>>(new Set());

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
        processedRestIdsRef.current = new Set(); // Reset processed rests

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

        setStats({ perfect: 0, good: 0, miss: 0 });

        // Auto-scroll to container
        setTimeout(() => {
            containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

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

            // Expiration / Pruning / Rest Logic
            return nextState.map(n => {
                if (n.status === 'pending' && currentTime > n.targetTime + 0.25) {
                    // Check if it's a rest
                    if (n.note.isRest) {
                        return { ...n, status: 'match_perfect' as const };
                    }
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

    const scoredNoteIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!isPlaying) return;

        const unscoredGreenRests = activeNotes.filter(n =>
            n.note.isRest &&
            n.status === 'match_perfect' &&
            !scoredNoteIds.current.has(n.id)
        );

        if (unscoredGreenRests.length > 0) {
            unscoredGreenRests.forEach(n => scoredNoteIds.current.add(n.id));

            // Apply rewards
            setScore(s => s + (unscoredGreenRests.length * SCORE_PERFECT));
            setStats(s => ({ ...s, perfect: s.perfect + unscoredGreenRests.length }));
            setCombo(c => c + unscoredGreenRests.length);
            setFeedback({ text: 'GOOD REST! +5', color: 'text-green-500' });
            setTimeout(() => setFeedback(null), 500);
        }

    }, [activeNotes, isPlaying]);

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
                    setStats(s => ({ ...s, miss: s.miss + 1 }));
                    setFeedback({ text: 'Non suonare durante le pause!', color: 'text-red-500' });
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
                setStats(s => ({ ...s, perfect: s.perfect + 1 }));
                setFeedback({ text: 'PERFETTO! +5', color: 'text-green-500' });
                scoredNoteIds.current.add(target.id);
            } else if (timeDiff <= GOOD_WINDOW_S) {
                newStatus = 'match_good';
                points = SCORE_GOOD;
                setStats(s => ({ ...s, good: s.good + 1 }));
                setFeedback({ text: 'Buono +3', color: 'text-yellow-500' });
                scoredNoteIds.current.add(target.id);
            } else {
                // Too early/late click?
                // If very far, maybe ignore?
                if (timeDiff > 0.2) return currentNotes; // Ignore accidental clicks far away

                newStatus = 'miss';
                setCombo(0);
                setStats(s => ({ ...s, miss: s.miss + 1 }));
                setFeedback({ text: 'Errore!', color: 'text-red-500' });
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
                    <h1 className="text-4xl font-bold text-amber-700">🥁 Solfeggio Ritmico</h1>
                    <p className="text-amber-600 font-medium mt-2 max-w-xl mx-auto">
                        Tocca lo schermo o clicca con il mouse <strong>a tempo</strong> con le note.
                        Durante le <strong>pause</strong>, non fare nulla e aspetta che passino (diventeranno verdi!).
                    </p>
                </div>


                {/* CONTROL PANEL (Above Staff) */}
                <div className="bg-white p-4 rounded-xl shadow-md border border-amber-100 mb-6 relative z-20">

                    {/* TOP ROW: Start/Stop + BPM + Visual Mode */}
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4 border-b border-gray-100 pb-4">

                        {/* Start/Stop Button */}
                        <div>
                            {!isPlaying ? (
                                <button
                                    onClick={startGame}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105 flex items-center gap-2"
                                >
                                    <span className="text-xl">▶️</span>
                                    <span>START</span>
                                </button>
                            ) : (
                                <button
                                    onClick={stopGame}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105 flex items-center gap-2"
                                >
                                    <span className="text-xl">⏹️</span>
                                    <span>STOP</span>
                                </button>
                            )}
                        </div>

                        {/* Visual Mode Toggle */}
                        <div className="bg-stone-100 p-1 rounded-lg flex space-x-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); setVisualMode('scrolling'); }}
                                className={`px-4 py-2 rounded-md font-bold transition flex items-center gap-2 ${visualMode === 'scrolling' ? 'bg-white shadow text-amber-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <span className="text-xl">🌊</span>
                                <span>Scorrimento</span>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setVisualMode('static'); }}
                                className={`px-4 py-2 rounded-md font-bold transition flex items-center gap-2 ${visualMode === 'static' ? 'bg-white shadow text-amber-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <span className="text-xl">📄</span>
                                <span>Statico</span>
                            </button>
                        </div>

                        {/* BPM Slider */}
                        <div className="flex items-center space-x-3 bg-stone-50 px-4 py-2 rounded-lg border border-stone-200">
                            <span className="text-xs font-bold text-gray-500 uppercase">BPM</span>
                            <input
                                type="range"
                                min="40"
                                max="200"
                                value={bpm}
                                onChange={(e) => { e.stopPropagation(); setBpm(Number(e.target.value)); }}
                                className="w-32 accent-amber-600"
                            />
                            <span className="text-xl font-bold text-amber-700 min-w-[3ch]">{bpm}</span>
                        </div>
                    </div>

                    {/* MIDDLE ROW: Durations + Time Sig */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">

                        {/* Durations (Always Visible) */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 uppercase mr-2">Note:</span>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { id: 'w', label: 'Semibreve' },
                                    { id: 'h', label: 'Minima' },
                                    { id: 'q', label: 'Semiminima' },
                                    { id: '8', label: 'Croma' },
                                    { id: '16', label: 'Semicroma' }
                                ].map(opt => (
                                    <label key={opt.id} className={`flex items-center space-x-1 cursor-pointer px-3 py-1.5 rounded-full border transition-all ${durationOptions[opt.id as keyof typeof durationOptions] ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                                        <input
                                            type="checkbox"
                                            checked={durationOptions[opt.id as keyof typeof durationOptions]}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                setDurationOptions(prev => ({ ...prev, [opt.id]: e.target.checked }));
                                            }}
                                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 accent-amber-600"
                                        />
                                        <span className="text-sm font-medium">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Time Signature */}
                        <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
                            <span className="text-xs font-bold text-gray-500 uppercase">Tempo:</span>
                            {(['3/4', '4/4', '6/8'] as const).map(sig => (
                                <button
                                    key={sig}
                                    onClick={(e) => { e.stopPropagation(); setTimeSignature(sig); }}
                                    className={`px-2 py-0.5 rounded text-sm font-bold transition ${timeSignature === sig
                                        ? 'bg-amber-600 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                >
                                    {sig}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* BOTTOM ROW: Settings (Rests, Metronome, Sounds) */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 pt-2 border-t border-gray-50">
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input type="checkbox" checked={includeRests} onChange={e => setIncludeRests(e.target.checked)} className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500" />
                            <span className="text-gray-700 font-medium group-hover:text-amber-700 transition">Aggiungi Pause</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input type="checkbox" checked={isMetronomeEnabled} onChange={e => setIsMetronomeEnabled(e.target.checked)} className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500" />
                            <span className="text-gray-700 font-medium group-hover:text-amber-700 transition">Metronomo</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input type="checkbox" checked={isSoundEnabled} onChange={e => setIsSoundEnabled(e.target.checked)} className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500" />
                            <span className="text-gray-700 font-medium group-hover:text-amber-700 transition">Suoni</span>
                        </label>
                    </div>

                </div>

                {/* Game Area */}
                <div
                    ref={containerRef}
                    className="relative max-w-5xl mx-auto h-[400px] flex items-center justify-center border-t border-gray-100 mt-8 pt-4"
                >

                    {/* UI OVERLAYS (Positioned ABOVE staff) */}

                    {/* Internal Stats Overlay */}
                    <div className="absolute top-2 left-0 right-0 flex justify-center space-x-4 pointer-events-none z-30">
                        <ScoreStats perfect={stats.perfect} good={stats.good} miss={stats.miss} />
                        {combo > 1 && (
                            <div className="bg-white/90 px-4 py-2 rounded-lg border border-orange-200 shadow-sm">
                                <span className="text-orange-500 font-bold block text-sm">COMBO</span>
                                <span className="text-2xl font-bold text-orange-600">{combo}x</span>
                            </div>
                        )}
                    </div>

                    {/* Countdown Overlay - Moved TOP */}
                    {countdown !== null && (
                        <div className="absolute top-24 left-0 right-0 flex items-center justify-center z-40 pointer-events-none transition-opacity duration-300">
                            <div key={countdown} className="text-center animate-in zoom-in duration-75 bg-white/90 px-6 py-2 rounded-xl shadow-lg border border-amber-100">
                                <div className="text-xl font-black text-amber-600 mb-0.5">
                                    {countdown > 1 ? 'WAIT' : 'READY...'}
                                </div>
                                <div className="text-4xl font-black text-amber-800">
                                    {countdown}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Feedback - Moved TOP */}
                    {feedback && (
                        <div className="absolute top-36 left-0 right-0 z-50 flex justify-center pointer-events-none">
                            <div className={`text-2xl font-black animate-bounce ${feedback.color} bg-white/90 px-6 py-2 rounded-full shadow-lg`}>
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
            </main >
        </div >
    );
};

