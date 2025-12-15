import { useRef, useEffect, useCallback } from 'react';

export const useRhythmAudio = () => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextNoteTimeRef = useRef<number>(0);
    const isMetronomeOnRef = useRef<boolean>(false);
    const timerIDRef = useRef<number | undefined>(undefined);

    // Config
    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // sec
    const bpmRef = useRef<number>(60);
    const signatureRef = useRef<{ num: number, den: number }>({ num: 4, den: 4 });
    const currentBeatRef = useRef<number>(0);

    // Initialize Audio Context on user interaction (usually)
    const initAudio = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    }, []);

    // Play a single metronome tick
    const playClick = (time: number, isDownbeat: boolean) => {
        if (!audioContextRef.current) return;
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();

        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);

        osc.frequency.value = isDownbeat ? 1000 : 800;
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        osc.start(time);
        osc.stop(time + 0.1);
    };

    // Synthesize a drum/hit sound
    const playDrumSound = useCallback(() => {
        if (!audioContextRef.current) return;
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Zap/Hit sound
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    }, []);

    // Scheduler
    // Scheduler
    const scheduler = useCallback(() => {
        if (!isMetronomeOnRef.current || !audioContextRef.current) return;

        while (nextNoteTimeRef.current < audioContextRef.current.currentTime + scheduleAheadTime) {
            // Determine accent
            const beat = currentBeatRef.current;
            const isDownbeat = beat % signatureRef.current.num === 0;

            // Schedule the click
            playClick(nextNoteTimeRef.current, isDownbeat);

            // Advance time
            const secondsPerBeat = 60.0 / bpmRef.current;
            nextNoteTimeRef.current += secondsPerBeat;

            currentBeatRef.current++;
        }

        timerIDRef.current = window.setTimeout(scheduler, lookahead);
    }, []);

    const startMetronome = useCallback(() => {
        initAudio(); // Ensure context is ready
        if (isMetronomeOnRef.current) return 0;

        isMetronomeOnRef.current = true;
        currentBeatRef.current = 0; // Reset beat on start
        let startTime = 0;

        if (audioContextRef.current) {
            startTime = audioContextRef.current.currentTime + 0.1; // Slight delay for safety
            nextNoteTimeRef.current = startTime;
        }
        scheduler();
        return startTime;
    }, [initAudio, scheduler]);

    const stopMetronome = useCallback(() => {
        isMetronomeOnRef.current = false;
        if (timerIDRef.current) {
            clearTimeout(timerIDRef.current);
        }
    }, []);

    const setBpm = useCallback((bpm: number) => {
        bpmRef.current = bpm;
    }, []);

    const setTimeSignature = useCallback((num: number, den: number) => {
        signatureRef.current = { num, den };
    }, []);

    const getAudioTime = useCallback(() => {
        return audioContextRef.current ? audioContextRef.current.currentTime : 0;
    }, []);

    useEffect(() => {
        return () => {
            stopMetronome();
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    return {
        initAudio,
        startMetronome,
        stopMetronome,
        setBpm,
        setTimeSignature,
        playDrumSound,
        getAudioTime
    };
};
