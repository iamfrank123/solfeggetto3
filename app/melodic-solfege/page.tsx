'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Layout/Header';
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
    const [visualMode, setVisualMode] = useState<'scrolling' | 'static'>('static');
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
    const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);

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

            // Exact MIDI match required (no octave flexibility)
            if (played !== target.note.generated.midiNumber) {
                setCombo(0);
                setFeedback({ text: '❌ Wrong Note!', color: 'text-red-500' });
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
                feedbackText = '✅ PERFECT!';
                feedbackColor = 'text-green-500';
                setCombo(c => c + 1);
            } else if (absTimeDiff <= GOOD_WINDOW_S) {
                newStatus = 'match_good';
                points = 3;
                if (timeDiff > 0) {
                    feedbackText = '⏱️ Early (Good)';
                } else {
                    feedbackText = '⏱️ Late (Good)';
                }
                feedbackColor = 'text-yellow-500';
                setCombo(c => c + 1);
            } else {
                newStatus = 'miss';
                feedbackText = timeDiff > 0 ? '⚠️ Too Early!' : '⚠️ Too Late!';
                feedbackColor = 'text-red-500';
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

        setScore(0); setCombo(0); setActiveNotes([]); patternQueueRef.current = []; measuresSpawnedRef.current = 0;
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
        setActiveNotes(prev => prev.map(n => {
            if (n.status === 'pending' && currentTime > n.targetTime + 0.25) return { ...n, status: 'miss' as GameNote['status'] };
            return n;
        }).filter(n => n.targetTime >= currentPageTimeRef.current - 5.0));

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    useEffect(() => { return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }; }, []);

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
                    <p className="text-amber-600">Play the correct pitches, in the right octave, and in time.</p>
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

                <div className="grid grid-cols-3 gap-4 mb-6 text-center max-w-4xl mx-auto">
                    <div className="bg-white p-4 rounded-lg shadow border border-amber-100">
                        <p className="text-gray-500 text-sm">SCORE</p>
                        <p className="text-3xl font-bold text-amber-600">{score}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow border border-amber-100">
                        <p className="text-gray-500 text-sm">COMBO</p>
                        <p className="text-3xl font-bold text-orange-500">{combo}x</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow border border-amber-100">
                        <p className="text-gray-500 text-sm">BPM</p>
                        <div className="flex items-center justify-center space-x-2">
                            <input type="range" min={40} max={200} value={bpm} onChange={(e) => { setBpm(Number(e.target.value)); }} disabled={isPlaying} className="w-24 accent-amber-600" />
                            <span className="text-2xl font-bold text-stone-700">{bpm}</span>
                        </div>
                    </div>
                </div>

                <div className="col-span-3 bg-white p-4 rounded-lg shadow border border-amber-100 mt-2 flex justify-center items-center space-x-4 max-w-4xl mx-auto">
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

                <div className="flex justify-center mb-4">
                    <div className="bg-stone-100 p-0.5 rounded-lg flex space-x-1">
                        <button onClick={() => setVisualMode('scrolling')} className={`px-3 py-1 rounded-md text-sm font-bold ${visualMode === 'scrolling' ? 'bg-white shadow text-amber-600' : 'text-gray-400'}`}>🌊 Scrolling</button>
                        <button onClick={() => setVisualMode('static')} className={`px-3 py-1 rounded-md text-sm font-bold ${visualMode === 'static' ? 'bg-white shadow text-amber-600' : 'text-gray-400'}`}>📄 Static</button>
                    </div>
                </div>

                <div className="relative max-w-5xl mx-auto h-[420px] flex items-center justify-center" onMouseDown={handleInteraction} onTouchStart={handleInteraction}>
                    {countdown !== null && (
                        <div className="absolute -top-32 left-0 right-0 flex items-center justify-center z-40 pointer-events-none">
                            <div className="text-center bg-white/90 px-8 py-4 rounded-2xl shadow-xl border border-amber-100">
                                <div className="text-4xl font-black text-amber-600 mb-1">{countdown > 1 ? 'WAIT' : 'READY...'}</div>
                                <div className="text-7xl font-black text-amber-800">{countdown}</div>
                            </div>
                        </div>
                    )}

                    {feedback && (
                        <div className="absolute -top-16 left-0 right-0 z-50 flex justify-center pointer-events-none">
                            <div className={`text-3xl font-black animate-bounce ${feedback.color} bg-white/90 px-6 py-3 rounded-full shadow-lg`}>
                                {feedback.text}
                            </div>
                        </div>
                    )}

                    <StaticMelodicStaff notes={activeNotes} timeSignature={timeSignature} />
                </div>

                {!isPlaying && (
                    <div className="flex justify-center flex-col items-center space-y-4 pb-12">
                        <div className="text-center space-y-4">
                            <div className="flex space-x-6 justify-center bg-white p-4 rounded-lg shadow-sm flex-wrap">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" checked={includeRests} onChange={e => setIncludeRests(e.target.checked)} className="w-5 h-5 text-amber-600" />
                                    <span className="text-gray-700">Include Rests</span>
                                </label>

                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" checked={isMetronomeEnabled} onChange={e => setIsMetronomeEnabled(e.target.checked)} className="w-5 h-5 text-amber-600" />
                                    <span className="text-gray-700">Metronome</span>
                                </label>

                                <div className="flex items-center space-x-2">
                                    <label className="text-sm text-gray-600">Range</label>
                                    <input value={minNote} onChange={e => setMinNote(e.target.value)} className="border px-2 py-1 rounded" />
                                    <span className="text-gray-500">—</span>
                                    <input value={maxNote} onChange={e => setMaxNote(e.target.value)} className="border px-2 py-1 rounded" />
                                </div>

                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" checked={customizeDurations} onChange={e => setCustomizeDurations(e.target.checked)} className="w-5 h-5 text-amber-600" />
                                    <span className="text-gray-700">Custom Durations</span>
                                </label>
                            </div>

                            {customizeDurations && (
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-amber-100">
                                    <p className="text-sm text-gray-600 font-bold mb-3">Select Note Durations:</p>
                                    <div className="flex flex-wrap gap-3 justify-center">
                                        {(['w', 'h', 'q', '8', '16'] as const).map((dur) => (
                                            <label key={dur} className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={allowedDurations.includes(dur)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setAllowedDurations([...allowedDurations, dur]);
                                                        } else {
                                                            setAllowedDurations(allowedDurations.filter(d => d !== dur));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-amber-600"
                                                />
                                                <span className="text-sm text-gray-700">
                                                    {dur === 'w' && 'Whole (4/4)'}
                                                    {dur === 'h' && 'Half (2/4)'}
                                                    {dur === 'q' && 'Quarter (1/4)'}
                                                    {dur === '8' && 'Eighth (1/8)'}
                                                    {dur === '16' && 'Sixteenth (1/16)'}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button onClick={startGame} className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 px-12 rounded-full shadow-lg">START MELODIC</button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
