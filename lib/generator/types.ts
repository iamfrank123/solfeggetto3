/**
 * Type definitions for note generation system
 */

/**
 * Musical note names (without octave)
 */
export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/**
 * Accidentals
 */
export type Accidental = '#' | 'b' | 'n'; // sharp, flat, natural

/**
 * Range of notes for practice (e.g., C5 to C6)
 */
export interface NoteRange {
    low: string;  // e.g., "C5"
    high: string; // e.g., "C6"
}

/**
 * Key signatures supported
 */
export type KeySignature =
    | 'C'   // C major (no accidentals)
    | 'G'   // G major (1#: F#)
    | 'D'   // D major (2#: F#, C#)
    | 'A'   // A major (3#: F#, C#, G#)
    | 'E'   // E major (4#: F#, C#, G#, D#)
    | 'F'   // F major (1b: Bb)
    | 'Bb'  // Bb major (2b: Bb, Eb)
    | 'Eb'  // Eb major (3b: Bb, Eb, Ab)
    | 'Ab'; // Ab major (4b: Bb, Eb, Ab, Db)

/**
 * Key signature info with accidentals
 */
export interface KeySignatureInfo {
    key: KeySignature;
    sharps: NoteName[];  // Notes that are sharp in this key
    flats: NoteName[];   // Notes that are flat in this key
}

/**
 * A generated note for practice
 */
export interface GeneratedNote {
    note: NoteName;
    octave: number;
    accidental?: Accidental;
    midiNumber: number; // For comparison with MIDI input
}

/**
 * Settings for note generation
 */
export interface GeneratorSettings {
    keySignature: KeySignature;
    noteRange: NoteRange;
}
