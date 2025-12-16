'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Layout/Header';
import ScoreStats from '@/components/Feedback/ScoreStats';
import StaticMelodicStaff from '@/components/Staff/StaticMelodicStaff';
import generateMelodicPattern, { MelodicNote } from '@/lib/generator/melodic-generator';
import { useRhythmAudio } from '@/hooks/useRhythmAudio';
import { useMIDIInput } from '@/hooks/useMIDIInput';
import { MIDINoteEvent } from '@/lib/types/midi';

// Game constants
const SPAWN_X = 900;
const HIT_X = 100;

interface GameNote {
    id: string;
    note: MelodicNote;
    x: number;
    status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
    targetTime: number;
}

export default function MelodicSolfegePage() {
    const [bpm, setBpm] = useState(60);
    const [timeSignature, setTimeSignature] = useState<'3/4' | '4/4' | '6/8'>('4/4');
    const visualMode = 'static'; // Force Static
    const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(true);

    const { initAudio, startMetronome, stopMetronome, setBpm: updateAudioBpm, setTimeSignature: updateAudioSignature, getAudioTime } = useRhythmAudio();

    useEffect(() => { updateAudioBpm(bpm); }, [bpm, updateAudioBpm]);
    useEffect(() => { const [num] = timeSignature.split('/').map(Number); updateAudioSignature(num, 4); }, [timeSignature, updateAudioSignature]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [activeNotes, setActiveNotes] = useState<GameNote[]>([]);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [bpmInput, setBpmInput] = useState(60);
    const [stats, setStats] = useState({ perfect: 0, good: 0, miss: 0 });
    const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const requestRef = useRef<number>();
    const nextSpawnTimeRef = useRef<number>(0);
    const patternQueueRef = useRef<MelodicNote[]>([]);
    const playPatternGeneratedRef = useRef<boolean>(false);
    const currentPageTimeRef = useRef<number>(0);
    const firstNoteTimeRef = useRef<number>(0);
    const measuresSpawnedRef = useRef<number>(0);

    const pixelsPerSecond = bpm * 2;

    const getMeasureDuration = useCallback(() => { const beatSec = 60 / bpm; const [num] = timeSignature.split('/').map(Number); return num * beatSec; }, [bpm, timeSignature]);

    // Settings for melodic generator
    const [includeRests, setIncludeRests] = useState(false);
    const [minNote, setMinNote] = useState('C4');
    const [maxNote, setMaxNote] = useState('C5');
    const [keySignature, setKeySignature] = useState<'C' | 'G' | 'D' | 'A' | 'E' | 'F' | 'Bb' | 'Eb' | 'Ab'>('C');
    const [allowedDurations, setAllowedDurations] = useState<('w' | 'h' | 'q' | '8' | '16')[]>(['q', '8', '16']);
    const [customizeDurations, setCustomizeDurations] = useState(false);

    // MIDI handler - must be defined before useMIDIInput
    const handleMIDINote = useCallback((event: MIDINoteEvent) => {
        // Only handle note on events
        if (event.type !== 'noteOn') return;

        const played = event.pitch; // The MIDI pitch number
        if (!isPlaying || !played) return;

        const currentTime = getAudioTime();

        setActiveNotes(currentNotes => {
            const candidates = currentNotes.filter(n => n.status === 'pending' && n.note.duration !== 'bar' && !n.note.isRest);
            if (candidates.length === 0) return currentNotes;
            candidates.sort((a, b) => Math.abs(a.targetTime - currentTime) - Math.abs(b.targetTime - currentTime));

            // Fix: Prevent duplicate consecutive notes from both being validated
            // Filter candidates to only include the first note with matching MIDI number
            // This ensures that if there are 2 consecutive notes with the same pitch,
            // only the first one (closest to current time) will be validated
            const matchingCandidates = candidates.filter(n =>
                n.note.generated && n.note.generated.midiNumber === played
            );

            // If no exact match, check the first candidate anyway (for wrong note feedback)
            const target = matchingCandidates.length > 0 ? matchingCandidates[0] : candidates[0];
            if (!target || !target.note.generated) return currentNotes;

            const timeDiff = target.targetTime - currentTime; // Signed: positive = early, negative = late
            const absTimeDiff = Math.abs(timeDiff);
            const PERFECT_WINDOW_S = 0.10;
            const GOOD_WINDOW_S = 0.15;
            const IGNORE_WINDOW_S = 0.4; // Notes further than this should be ignored (stray inputs)

            // Fix: If input is too far from target (e.g. double trigger hitting next note), ignore it completely
            if (absTimeDiff > IGNORE_WINDOW_S) {
                return currentNotes;
            }

            // Exact MIDI match required (no octave flexibility)
            if (played !== target.note.generated.midiNumber) {
                setCombo(0);
                setStats(s => ({ ...s, miss: s.miss + 1 }));
                setFeedback({ text: '❌ Nota Sbagliata!', color: 'text-red-500' });
                setTimeout(() => setFeedback(null), 800);
                return currentNotes.map(n => n.id === target.id ? { ...n, status: 'miss' as GameNote['status'] } : n);
            }

            let newStatus: GameNote['status'] = 'miss';
            let points = 0;
            let feedbackText = '';
            let feedbackColor = '';

            if (absTimeDiff <= PERFECT_WINDOW_S) {
                newStatus = 'match_perfect';
                points = 5;
                feedbackText = '✅ PERFETTO!';
                feedbackColor = 'text-green-500';
                setStats(s => ({ ...s, perfect: s.perfect + 1 }));
                setCombo(c => c + 1);
            } else if (absTimeDiff <= GOOD_WINDOW_S) {
                newStatus = 'match_good';
                points = 3;
                if (timeDiff > 0) {
                    feedbackText = '⏱️ Presto (Buono)';
                } else {
                    feedbackText = '⏱️ Tardi (Buono)';
                }
                feedbackColor = 'text-yellow-500';
                setStats(s => ({ ...s, good: s.good + 1 }));
                setCombo(c => c + 1);
            } else {
                newStatus = 'miss';
                feedbackText = timeDiff > 0 ? '⚠️ Troppo Presto!' : '⚠️ Troppo Tardi!';
                feedbackColor = 'text-red-500';
                setStats(s => ({ ...s, miss: s.miss + 1 }));
                setCombo(0);
            }

            if (points > 0) setScore(s => s + points);
            setFeedback({ text: feedbackText, color: feedbackColor });
            setTimeout(() => setFeedback(null), 1000);

            return currentNotes.map(n => n.id === target.id ? { ...n, status: newStatus } : n);
        });
    }, [isPlaying, getAudioTime]);

    // MIDI hook: register handler
    useMIDIInput(handleMIDINote);

    useEffect(() => {
        // keep bpm UI in sync
        setBpmInput(bpm);
    }, [bpm]);

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

        initAudio();
        setIsPlaying(true);
        let audioStart = 0;
        if (isMetronomeEnabled) audioStart = startMetronome() || 0; else audioStart = getAudioTime() + 0.1;

        setScore(0); setCombo(0); setStats({ perfect: 0, good: 0, miss: 0 }); setActiveNotes([]); patternQueueRef.current = []; measuresSpawnedRef.current = 0;
        playPatternGeneratedRef.current = false;

        // Auto-scroll to container
        setTimeout(() => {
            containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        playPatternGeneratedRef.current = false;

        const beatSec = 60 / bpm;
        const [num] = timeSignature.split('/').map(Number);
        const measureDur = num * beatSec;

        const firstNoteTime = audioStart + measureDur; // 1 measure count-in
        nextSpawnTimeRef.current = firstNoteTime;
        firstNoteTimeRef.current = firstNoteTime;
        currentPageTimeRef.current = audioStart;

        requestRef.current = requestAnimationFrame(gameLoop);
    };

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
    };

    useEffect(() => { if (isPlaying) { if (isMetronomeEnabled) startMetronome(); else stopMetronome(); } }, [isMetronomeEnabled, isPlaying, startMetronome, stopMetronome]);

    const gameLoop = () => {
        const currentTime = getAudioTime();
        const measureDur = getMeasureDuration();

        // Static page cycle [Gap + Play]
        const EXERCISE_MEASURES = 2;
        const GAP_MEASURES = 1;

        const gapDur = measureDur * GAP_MEASURES;
        const playDur = measureDur * EXERCISE_MEASURES;
        const cycleDur = gapDur + playDur;

        const timeInCycle = currentTime - currentPageTimeRef.current;
        if (timeInCycle >= cycleDur) {
            currentPageTimeRef.current += cycleDur;
            // New cycle -> allow generating a fresh pattern next play section
            playPatternGeneratedRef.current = false;
            // Clear previous active notes when page flips
            setActiveNotes([]);
        }
        if (timeInCycle < gapDur) {
            const beatSec = 60 / bpm; const currentBeatIndex = Math.floor(timeInCycle / beatSec); const gapBeats = Math.round(gapDur / beatSec); const beatsLeft = gapBeats - currentBeatIndex; setCountdown(beatsLeft > 0 ? beatsLeft : null);
        } else setCountdown(null);

        // For Static Melodic mode we generate exactly EXERCISE_MEASURES measures once per cycle
        // Play section start time (after gap)
        const playStartTime = currentPageTimeRef.current + gapDur;

        // Generate the upcoming static pattern (preview during the GAP and used during PLAY)
        if (!playPatternGeneratedRef.current) {
            const [num] = timeSignature.split('/').map(Number);
            const beatSec = 60 / bpm;
            const measureSec = num * beatSec;

            const generatedNotes: GameNote[] = [];

            for (let m = 0; m < EXERCISE_MEASURES; m++) {
                // Generate exactly one measure with user-selected durations
                const measurePattern = generateMelodicPattern(allowedDurations, includeRests, { low: minNote, high: maxNote }, keySignature, timeSignature as any);

                const measureStart = playStartTime + (m * measureSec);
                let cursorInMeasure = 0;

                for (const pn of measurePattern) {
                    // Include BAR markers so the staff can split measures correctly
                    if (pn.duration === 'bar') {
                        const gameNote: GameNote = {
                            id: Math.random().toString(36).substr(2, 9),
                            note: pn,
                            x: SPAWN_X,
                            status: 'pending',
                            targetTime: measureStart + cursorInMeasure
                        };
                        generatedNotes.push(gameNote);
                        continue;
                    }

                    const noteDurSec = pn.value * beatSec;

                    const gameNote: GameNote = {
                        id: Math.random().toString(36).substr(2, 9),
                        note: pn,
                        x: SPAWN_X,
                        status: 'pending',
                        targetTime: measureStart + cursorInMeasure
                    };

                    generatedNotes.push(gameNote);
                    cursorInMeasure += noteDurSec;
                }
            }

            // Show preview immediately during count-in
            setActiveNotes(generatedNotes);
            playPatternGeneratedRef.current = true;
            nextSpawnTimeRef.current = playStartTime + playDur;
        }

        // Expire pending notes if too late
        // Expire pending notes if too late
        setActiveNotes(prev => prev.map(n => {
            if (n.status === 'pending' && currentTime > n.targetTime + 0.25) {
                // Fix: Green Rest Logic
                if (n.note.isRest) {
                    return { ...n, status: 'match_perfect' as const };
                }
                return { ...n, status: 'miss' as const };
            }
            return n;
        }).filter(n => n.targetTime >= currentPageTimeRef.current - 5.0));

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    useEffect(() => { return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }; }, []);

    // Scoring effect for passive rests
    const scoredNoteIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!isPlaying) return;
        const unscoredGreenRests = activeNotes.filter(n =>
            n.note.isRest && n.status === 'match_perfect' && !scoredNoteIds.current.has(n.id)
        );
        if (unscoredGreenRests.length > 0) {
            unscoredGreenRests.forEach(n => scoredNoteIds.current.add(n.id));
            setScore(s => s + (unscoredGreenRests.length * 5));
            setStats(s => ({ ...s, perfect: s.perfect + unscoredGreenRests.length }));
            setCombo(c => c + unscoredGreenRests.length);
            setFeedback({ text: 'PAUSA OK! +5', color: 'text-green-500' });
            setTimeout(() => setFeedback(null), 500);
        }
    }, [activeNotes, isPlaying]);

    // Expose a simple click handler (attempt) — prompts to use MIDI if pitch not available
    const handleInteraction = useCallback(() => {
        // For melodic mode, clicks only indicate attempt but without pitch we cannot validate.
        setActiveNotes(prev => prev);
    }, []);

    return (
        <div className="min-h-screen bg-stone-50">
            <Header />
            <main className="container mx-auto px-4 py-8 max-w-6xl">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-amber-700">🎵 Melodic Solfege</h1>
                    <p className="text-amber-600 mb-4">Play the correct pitches, in the right octave, and in time.</p>

                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 max-w-2xl mx-auto text-left flex items-start">
                        <span className="text-2xl mr-3">⚠️</span>
                        <div>
                            <p className="font-bold text-yellow-800">Tastiera MIDI Richiesta</p>
                            <p className="text-yellow-700 text-sm">
                                Questa modalità funziona solo collegando una tastiera MIDI.
                                Se non hai un cavo MIDI, prova la <a href="/" className="underline font-bold hover:text-yellow-900">Rhythm Mode</a> per esercitarti con il ritmo (tocco/click).
                            </p>
                        </div>
                    </div>
                </div>



                {/* CONTROL PANEL (Above Staff) */}
                <div className="bg-white p-4 rounded-xl shadow-md border border-amber-100 mb-6 relative z-20">

                    {/* TOP ROW: Start/Stop + BPM */}
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4 border-b border-gray-100 pb-4">
                        <div>
                            {!isPlaying ? (
                                <button onClick={startGame} className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105 flex items-center gap-2">
                                    <span className="text-xl">▶️</span><span>START</span>
                                </button>
                            ) : (
                                <button onClick={stopGame} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105 flex items-center gap-2">
                                    <span className="text-xl">⏹️</span><span>STOP</span>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center space-x-3 bg-stone-50 px-4 py-2 rounded-lg border border-stone-200">
                            <span className="text-xs font-bold text-gray-500 uppercase">BPM</span>
                            <input type="range" min="40" max="200" value={bpm} onChange={(e) => { e.stopPropagation(); setBpm(Number(e.target.value)); }} className="w-32 accent-amber-600" />
                            <span className="text-xl font-bold text-amber-700 min-w-[3ch]">{bpm}</span>
                        </div>
                    </div>

                    {/* MIDDLE ROW: Durations + Time Sig */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 uppercase mr-2">Note:</span>
                            <div className="flex flex-wrap gap-2">
                                {/* Duration Checkboxes */}
                                {([
                                    { id: 'w', label: 'Semibreve' },
                                    { id: 'h', label: 'Minima' },
                                    { id: 'q', label: 'Semiminima' },
                                    { id: '8', label: 'Croma' },
                                    { id: '16', label: 'Semicroma' }
                                ] as const).map((opt) => (
                                    <label key={opt.id} className={`flex items-center space-x-1 cursor-pointer px-3 py-1.5 rounded-full border transition-all ${allowedDurations.includes(opt.id) ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                                        <input
                                            type="checkbox"
                                            checked={allowedDurations.includes(opt.id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                if (e.target.checked) setAllowedDurations([...allowedDurations, opt.id]);
                                                else setAllowedDurations(allowedDurations.filter(d => d !== opt.id));
                                            }}
                                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 accent-amber-600"
                                        />
                                        <span className="text-sm font-medium">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
                            <span className="text-xs font-bold text-gray-500 uppercase">Tempo:</span>
                            {(['3/4', '4/4'] as const).map(sig => (
                                <button key={sig} onClick={(e) => { e.stopPropagation(); setTimeSignature(sig); }} className={`px-2 py-0.5 rounded text-sm font-bold transition ${timeSignature === sig ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{sig}</button>
                            ))}
                        </div>
                    </div>

                    {/* BOTTOM ROW: Settings (Rests, Metronome, Range) */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 pt-2 border-t border-gray-50">
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input type="checkbox" checked={includeRests} onChange={e => setIncludeRests(e.target.checked)} className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500" />
                            <span className="text-gray-700 font-medium group-hover:text-amber-700 transition">Aggiungi Pause</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input type="checkbox" checked={isMetronomeEnabled} onChange={e => setIsMetronomeEnabled(e.target.checked)} className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500" />
                            <span className="text-gray-700 font-medium group-hover:text-amber-700 transition">Metronomo</span>
                        </label>
                        <div className="flex items-center space-x-2 bg-stone-50 px-3 py-1 rounded-lg border border-stone-200">
                            <span className="text-xs font-bold text-gray-500 uppercase">Intervallo:</span>
                            <input value={minNote} onChange={e => setMinNote(e.target.value)} className="w-12 text-center border-b border-gray-300 focus:border-amber-500 outline-none bg-transparent" />
                            <span className="text-gray-400">—</span>
                            <input value={maxNote} onChange={e => setMaxNote(e.target.value)} className="w-12 text-center border-b border-gray-300 focus:border-amber-500 outline-none bg-transparent" />
                        </div>
                    </div>
                </div>

                {/* Removed Visual Mode Toggle - Forced Static */}

                <div
                    ref={containerRef}
                    className="relative max-w-5xl mx-auto h-[420px] flex items-center justify-center border-t border-gray-100 pt-4"
                    onMouseDown={handleInteraction}
                    onTouchStart={handleInteraction}
                >
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

                    {countdown !== null && (
                        <div className="absolute top-24 left-0 right-0 flex items-center justify-center z-40 pointer-events-none">
                            <div className="text-center bg-white/90 px-6 py-2 rounded-xl shadow-lg border border-amber-100">
                                <div className="text-xl font-bold text-amber-600 mb-0.5">{countdown > 1 ? 'WAIT' : 'READY...'}</div>
                                <div className="text-4xl font-black text-amber-800">{countdown}</div>
                            </div>
                        </div>
                    )}

                    {feedback && (
                        <div className="absolute top-32 left-0 right-0 z-50 flex justify-center pointer-events-none">
                            <div className={`text-2xl font-black animate-bounce ${feedback.color} bg-white/95 px-6 py-2 rounded-full shadow-lg`}>
                                {feedback.text}
                            </div>
                        </div>
                    )}

                    <StaticMelodicStaff notes={activeNotes} timeSignature={timeSignature} />
                </div>


            </main>
        </div>
    );
}
