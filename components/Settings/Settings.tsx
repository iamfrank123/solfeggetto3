'use client';

import { useState } from 'react';
import { KeySignature, NoteRange } from '@/lib/generator/types';

interface SettingsProps {
    keySignature: KeySignature;
    noteRange: NoteRange;
    onKeySignatureChange: (key: KeySignature) => void;
    onNoteRangeChange: (range: NoteRange) => void;
    isExerciseActive: boolean;
    onStartExercise: () => void;
    onStopExercise: () => void;
}

/**
 * All possible note options for range selection
 */
const NOTE_OPTIONS = [
    'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
    'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
    'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5',
    'C6', 'D6', 'E6', 'F6', 'G6', 'A6', 'B6',
];

const KEY_SIGNATURES: KeySignature[] = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'];

const KEY_SIGNATURE_LABELS: Record<KeySignature, string> = {
    'C': 'C Major',
    'G': 'G Major (1♯)',
    'D': 'D Major (2♯)',
    'A': 'A Major (3♯)',
    'E': 'E Major (4♯)',
    'F': 'F Major (1♭)',
    'Bb': 'B♭ Major (2♭)',
    'Eb': 'E♭ Major (3♭)',
    'Ab': 'A♭ Major (4♭)',
};

export default function Settings({
    keySignature,
    noteRange,
    onKeySignatureChange,
    onNoteRangeChange,
    isExerciseActive,
    onStartExercise,
    onStopExercise,
}: SettingsProps) {
    const [lowNote, setLowNote] = useState(noteRange.low);
    const [highNote, setHighNote] = useState(noteRange.high);
    const [error, setError] = useState<string | null>(null);

    const handleLowNoteChange = (value: string) => {
        setLowNote(value);
        validateAndUpdate(value, highNote);
    };

    const handleHighNoteChange = (value: string) => {
        setHighNote(value);
        validateAndUpdate(lowNote, value);
    };

    const validateAndUpdate = (low: string, high: string) => {
        const lowIndex = NOTE_OPTIONS.indexOf(low);
        const highIndex = NOTE_OPTIONS.indexOf(high);

        if (lowIndex >= highIndex) {
            setError('La nota alta deve essere superiore alla nota bassa');
            return;
        }

        setError(null);
        onNoteRangeChange({ low, high });
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙️ Impostazioni</h2>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Key Signature Selection */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tonalità
                    </label>
                    <select
                        value={keySignature}
                        onChange={(e) => onKeySignatureChange(e.target.value as KeySignature)}
                        disabled={isExerciseActive}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors text-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                        {KEY_SIGNATURES.map((key) => (
                            <option key={key} value={key}>
                                {KEY_SIGNATURE_LABELS[key]}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Note Range Selection */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Range di Note
                    </label>
                    <div className="flex items-center gap-3">
                        <select
                            value={lowNote}
                            onChange={(e) => handleLowNoteChange(e.target.value)}
                            disabled={isExerciseActive}
                            className="flex-1 px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors text-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            {NOTE_OPTIONS.map((note) => (
                                <option key={note} value={note}>
                                    {note}
                                </option>
                            ))}
                        </select>

                        <span className="text-gray-500 font-bold text-lg">→</span>

                        <select
                            value={highNote}
                            onChange={(e) => handleHighNoteChange(e.target.value)}
                            disabled={isExerciseActive}
                            className="flex-1 px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors text-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            {NOTE_OPTIONS.map((note) => (
                                <option key={note} value={note}>
                                    {note}
                                </option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <p className="mt-2 text-sm text-red-600">⚠️ {error}</p>
                    )}
                </div>
            </div>

            {/* START/STOP Button */}
            <div className="mt-6 text-center">
                {!isExerciseActive ? (
                    <button
                        onClick={onStartExercise}
                        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xl rounded-lg shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!!error}
                    >
                        ▶️ START Esercizio
                    </button>
                ) : (
                    <button
                        onClick={onStopExercise}
                        className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                        ⏹️ STOP Esercizio
                    </button>
                )}
            </div>
        </div>
    );
}
