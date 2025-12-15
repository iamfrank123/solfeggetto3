// Feedback event types for real-time note evaluation

export interface FeedbackEvent {
    type: 'correct' | 'wrong' | 'preview';
    noteId: string; // ID of the expected note
    pitch: number; // MIDI pitch
    timestamp: number;
    position?: { x: number; y: number }; // Position on staff
}

export interface CorrectFeedback extends FeedbackEvent {
    type: 'correct';
}

export interface WrongFeedback extends FeedbackEvent {
    type: 'wrong';
    expectedPitch: number;
    playedPitch: number;
}

export interface PreviewFeedback extends FeedbackEvent {
    type: 'preview';
    playedPitch: number;
    clef: 'treble' | 'bass';
}

// Feedback state for UI rendering
export interface FeedbackState {
    [noteId: string]: {
        status: 'correct' | 'wrong' | 'pending';
        timestamp: number;
    };
}
