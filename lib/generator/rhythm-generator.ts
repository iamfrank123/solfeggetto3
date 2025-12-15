
export type RhythmNoteType = 'w' | 'h' | 'q' | '8' | '16' | 'bar'; // Added 'bar'

export interface RhythmNote {
    duration: RhythmNoteType;
    isRest: boolean;
    value: number; // For math (1, 0.5, 0.25, etc.)
}

const DURATIONS: Record<RhythmNoteType, number> = {
    'w': 4,
    'h': 2,
    'q': 1,
    '8': 0.5,
    '16': 0.25,
    'bar': 0
};

export const generateRhythmPattern = (
    allowedDurations: RhythmNoteType[],
    includeRests: boolean,
    timeSignature: '3/4' | '4/4' | '6/8' = '4/4'
): RhythmNote[] => {
    // Determine total beat value required
    let remainingBeats = 4; // Default 4/4
    if (timeSignature === '3/4') remainingBeats = 3;
    if (timeSignature === '6/8') remainingBeats = 3; // 6 eighths = 3 quarters

    const pattern: RhythmNote[] = [];

    while (remainingBeats > 0) {
        // Filter candidates that fit.
        // For 6/8, usually we want dotted quarters or groups of 3 eighths.
        // For simplicity, we stick to standard math but could favor '8' or 'q.' if adding dotted support.
        const candidates = allowedDurations.filter(d => DURATIONS[d] <= remainingBeats && d !== 'bar');

        if (candidates.length === 0) {
            // Fill with smallest unit (16th) or break to avoid crash
            // Ideally we re-roll or backtrack, but breaking is safe fallback.
            break;
        }

        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        const isRest = includeRests && Math.random() < 0.2;

        pattern.push({
            duration: choice,
            isRest: isRest,
            value: DURATIONS[choice]
        });

        remainingBeats -= DURATIONS[choice];
    }

    // Add Bar Line at the end of the measure
    pattern.push({
        duration: 'bar',
        isRest: false,
        value: 0
    });

    return pattern;
};
