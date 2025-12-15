/**
 * Note generator for practice exercises
 * Generates random notes within a specified range and key signature
 */

import {
    GeneratedNote,
    KeySignature,
    KeySignatureInfo,
    NoteRange,
    NoteName,
    Accidental
} from './types';

/**
 * Key signature definitions
 */
const KEY_SIGNATURES: Record<KeySignature, KeySignatureInfo> = {
    'C': { key: 'C', sharps: [], flats: [] },
    'G': { key: 'G', sharps: ['F'], flats: [] },
    'D': { key: 'D', sharps: ['F', 'C'], flats: [] },
    'A': { key: 'A', sharps: ['F', 'C', 'G'], flats: [] },
    'E': { key: 'E', sharps: ['F', 'C', 'G', 'D'], flats: [] },
    'F': { key: 'F', sharps: [], flats: ['B'] },
    'Bb': { key: 'Bb', sharps: [], flats: ['B', 'E'] },
    'Eb': { key: 'Eb', sharps: [], flats: ['B', 'E', 'A'] },
    'Ab': { key: 'Ab', sharps: [], flats: ['B', 'E', 'A', 'D'] },
};

/**
 * Note names in chromatic order
 */
const NOTE_NAMES: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Convert note name to MIDI number
 * C0 = 12, C4 = 60 (middle C)
 */
export function noteToMIDI(note: NoteName, octave: number, accidental?: Accidental): number {
    const baseNotes: Record<NoteName, number> = {
        'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    };

    let midiNumber = 12 + (octave * 12) + baseNotes[note];

    if (accidental === '#') {
        midiNumber += 1;
    } else if (accidental === 'b') {
        midiNumber -= 1;
    }

    return midiNumber;
}

/**
 * Convert MIDI number to note name and octave
 */
export function midiToNote(midiNumber: number): { note: NoteName; octave: number; accidental?: Accidental } {
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteIndex = midiNumber % 12;

    const noteMap: Record<number, { note: NoteName; accidental?: Accidental }> = {
        0: { note: 'C' },
        1: { note: 'C', accidental: '#' },
        2: { note: 'D' },
        3: { note: 'D', accidental: '#' },
        4: { note: 'E' },
        5: { note: 'F' },
        6: { note: 'F', accidental: '#' },
        7: { note: 'G' },
        8: { note: 'G', accidental: '#' },
        9: { note: 'A' },
        10: { note: 'A', accidental: '#' },
        11: { note: 'B' },
    };

    return { ...noteMap[noteIndex], octave };
}

/**
 * Parse a note string (e.g., "C5", "F#4") into components
 */
export function parseNoteString(noteStr: string): { note: NoteName; octave: number; accidental?: Accidental } {
    const match = noteStr.match(/^([A-G])([#b]?)(\d+)$/);
    if (!match) {
        throw new Error(`Invalid note string: ${noteStr}`);
    }

    const note = match[1] as NoteName;
    const accidental = match[2] ? (match[2] as Accidental) : undefined;
    const octave = parseInt(match[3], 10);

    return { note, octave, accidental };
}

/**
 * Get accidental for a note based on key signature
 */
function getAccidentalForKey(note: NoteName, keySignature: KeySignature): Accidental | undefined {
    const keyInfo = KEY_SIGNATURES[keySignature];

    if (keyInfo.sharps.includes(note)) {
        return '#';
    }
    if (keyInfo.flats.includes(note)) {
        return 'b';
    }
    return undefined;
}

/**
 * Generate a random note within the specified range and key signature
 */
export function generateRandomNote(
    range: NoteRange,
    keySignature: KeySignature
): GeneratedNote {
    // Parse range boundaries
    const lowNote = parseNoteString(range.low);
    const highNote = parseNoteString(range.high);

    const lowMIDI = noteToMIDI(lowNote.note, lowNote.octave, lowNote.accidental);
    const highMIDI = noteToMIDI(highNote.note, highNote.octave, highNote.accidental);

    // Generate random MIDI number in range
    const randomMIDI = lowMIDI + Math.floor(Math.random() * (highMIDI - lowMIDI + 1));

    // Convert back to note
    const { note, octave } = midiToNote(randomMIDI);

    // Apply key signature
    const accidental = getAccidentalForKey(note, keySignature);

    // Calculate final MIDI number with accidental
    const finalMIDI = noteToMIDI(note, octave, accidental);

    return {
        note,
        octave,
        accidental,
        midiNumber: finalMIDI
    };
}

/**
 * Check if a played MIDI note matches the target note
 */
export function checkNoteMatch(playedMIDI: number, targetNote: GeneratedNote): boolean {
    return playedMIDI === targetNote.midiNumber;
}

/**
 * Format a generated note as a string (e.g., "C#5")
 */
export function formatNote(note: GeneratedNote): string {
    const accidentalStr = note.accidental || '';
    return `${note.note}${accidentalStr}${note.octave}`;
}

/**
 * Get key signature info
 */
export function getKeySignatureInfo(keySignature: KeySignature): KeySignatureInfo {
    return KEY_SIGNATURES[keySignature];
}
