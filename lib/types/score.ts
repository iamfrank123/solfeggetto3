// Core Score Model Types

export interface ScoreModel {
    timeSignatures: TimeSignature[];
    tempoMap: Tempo[];
    measures: Measure[];
    meta: ScoreMeta;
}

export interface TimeSignature {
    time: number; // in seconds
    numerator: number;
    denominator: number;
}

export interface Tempo {
    time: number; // in seconds
    bpm: number;
}

export interface Measure {
    index: number;
    startTime: number; // in seconds
    endTime: number;
    trebleNotes: Note[];
    bassNotes: Note[];
    timeSignature?: TimeSignature;
}

export interface Note {
    id: string;
    pitch: number; // MIDI note number (0-127)
    startTime: number; // in seconds
    duration: number; // in seconds
    velocity: number; // 0-127
    quantizedDuration?: NoteDuration;
    isDotted?: boolean;
}

export interface ScoreMeta {
    keySignature: number; // number of sharps (positive) or flats (negative)
    clef: 'grand' | 'treble' | 'bass';
    title?: string;
    composer?: string;
}

// Rhythmic note durations
export type NoteDuration =
    | 'whole'       // semibreve
    | 'half'        // minima
    | 'quarter'     // semiminima
    | 'eighth'      // croma
    | 'sixteenth'   // semicroma
    | 'thirty-second'
    | 'sixty-fourth';

// VexFlow compatible duration strings
export type VexFlowDuration =
    | '1'   // whole
    | '2'   // half
    | '4'   // quarter
    | '8'   // eighth
    | '16'  // sixteenth
    | '32'
    | '64';
