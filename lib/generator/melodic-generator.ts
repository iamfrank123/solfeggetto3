import { generateRandomNote } from './note-generator';
import { NoteRange, KeySignature, GeneratedNote } from './types';

export type MelodicNoteDuration = 'w' | 'h' | 'q' | '8' | '16' | 'bar';

export interface MelodicNote {
    duration: MelodicNoteDuration;
    isRest: boolean;
    value: number;
    generated?: GeneratedNote;
}

const DURATIONS: Record<MelodicNoteDuration, number> = {
    'w': 4,
    'h': 2,
    'q': 1,
    '8': 0.5,
    '16': 0.25,
    'bar': 0
};

export const generateMelodicPattern = (
    allowedDurations: MelodicNoteDuration[],
    includeRests: boolean,
    range: NoteRange,
    keySignature: KeySignature,
    timeSignature: '3/4' | '4/4' | '6/8' = '4/4'
): MelodicNote[] => {
    let remainingBeats = 4;
    if (timeSignature === '3/4') remainingBeats = 3;
    if (timeSignature === '6/8') remainingBeats = 3;

    const pattern: MelodicNote[] = [];
    let nonRestCount = 0;

    // Main loop: generate notes until measure is full
    while (remainingBeats > 0.001) {
        const candidates = allowedDurations.filter(d => DURATIONS[d] <= remainingBeats + 0.001 && d !== 'bar');
        if (candidates.length === 0) break;

        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        // Only create rests if we already have at least one note in this measure
        const isRest = nonRestCount > 0 && includeRests && Math.random() < 0.15;

        const melodic: MelodicNote = {
            duration: choice,
            isRest,
            value: DURATIONS[choice]
        };

        if (!isRest) {
            melodic.generated = generateRandomNote(range, keySignature);
            nonRestCount++;
        }

        pattern.push(melodic);
        remainingBeats -= DURATIONS[choice];
    }

    // Ensure at least one non-rest note exists
    if (nonRestCount === 0) {
        pattern.push({
            duration: 'q',
            isRest: false,
            value: DURATIONS['q'],
            generated: generateRandomNote(range, keySignature)
        });
        remainingBeats -= DURATIONS['q'];
    }

    // Fill remaining beats with rests (guaranteed to fit with 16th notes)
    while (remainingBeats > 0.001) {
        if (remainingBeats >= 0.25 - 0.0001) {
            // Add 16th rest
            pattern.push({
                duration: '16',
                isRest: true,
                value: DURATIONS['16']
            });
            remainingBeats -= DURATIONS['16'];
        } else if (remainingBeats >= 0.125 - 0.0001) {
            // Very close to 1/8 — add 8th rest (shouldn't happen but just in case)
            pattern.push({
                duration: '8',
                isRest: true,
                value: DURATIONS['8']
            });
            remainingBeats -= DURATIONS['8'];
        } else {
            // Less than 1/8 left — just round to zero and finish
            break;
        }
    }

    // End with bar marker
    pattern.push({ duration: 'bar', isRest: false, value: 0 });

    return pattern;
};

export default generateMelodicPattern;
