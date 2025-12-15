/**
 * Note Queue Manager for continuous sight reading
 * Manages a queue of notes that scroll as the user plays
 */

import { GeneratedNote, KeySignature, NoteRange } from './types';
import { generateRandomNote } from './note-generator';

export class NoteQueueManager {
    private queue: GeneratedNote[] = [];
    private keySignature: KeySignature;
    private noteRange: NoteRange;
    private currentIndex: number = 0;

    constructor(keySignature: KeySignature, noteRange: NoteRange) {
        this.keySignature = keySignature;
        this.noteRange = noteRange;
    }

    /**
     * Initialize the queue with a specified number of notes
     */
    initializeQueue(count: number = 10): void {
        this.queue = [];
        this.currentIndex = 0;

        for (let i = 0; i < count; i++) {
            this.addNote();
        }
    }

    /**
     * Add a new note to the end of the queue
     */
    addNote(): void {
        const note = generateRandomNote(this.noteRange, this.keySignature);
        this.queue.push(note);
    }

    /**
     * Advance to the next note in the queue
     * Returns true if successful, false if at end
     */
    advance(): boolean {
        if (this.currentIndex < this.queue.length - 1) {
            this.currentIndex++;
            return true;
        }
        return false;
    }

    /**
     * Shift the queue: remove first note, add new note at end, reset index
     */
    shiftQueue(): void {
        this.queue.shift(); // Remove first note
        this.addNote();     // Add new note at end
        // currentIndex stays the same (pointing to what was the second note)
    }

    /**
     * Get the current note that should be played
     */
    getCurrentNote(): GeneratedNote | null {
        return this.queue[this.currentIndex] || null;
    }

    /**
     * Get all notes in the queue
     */
    getAllNotes(): GeneratedNote[] {
        return [...this.queue];
    }

    /**
     * Get the current index
     */
    getCurrentIndex(): number {
        return this.currentIndex;
    }

    /**
     * Reset the queue
     */
    reset(): void {
        this.queue = [];
        this.currentIndex = 0;
    }

    /**
     * Update settings (key signature or range)
     */
    updateSettings(keySignature: KeySignature, noteRange: NoteRange): void {
        this.keySignature = keySignature;
        this.noteRange = noteRange;
    }

    /**
     * Get number of notes in queue
     */
    getQueueLength(): number {
        return this.queue.length;
    }
}
