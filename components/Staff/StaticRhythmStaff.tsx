'use client';

import { useEffect, useRef } from 'react';
import { Vex } from 'vexflow';
import { RhythmNote } from '@/lib/generator/rhythm-generator';

const { Renderer, Stave, StaveNote, Voice, Formatter, Beam } = Vex.Flow;

interface RhythmGameNote {
    id: string;
    note: RhythmNote;
    x: number;
    status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
    targetTime: number;
}

interface StaticRhythmStaffProps {
    notes: RhythmGameNote[]; // Should be exactly 2 measures of notes
    timeSignature: string; // '4/4' etc
    currentBeatIndex: number; // Index of note currently active/next
}

export default function StaticRhythmStaff({ notes, timeSignature, currentBeatIndex }: StaticRhythmStaffProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<any>(null);
    const contextRef = useRef<any>(null);

    const STAFF_WIDTH_PER_BAR = 400;
    const STAFF_HEIGHT = 200;

    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';
        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(STAFF_WIDTH_PER_BAR * 2 + 50, STAFF_HEIGHT); // 2 bars
        const context = renderer.getContext();
        rendererRef.current = renderer;
        contextRef.current = context;

        renderFrame();
    }, [notes, timeSignature, currentBeatIndex]); // Re-render when notes change (page flip) or index updates (coloring)

    const renderFrame = () => {
        if (!contextRef.current) return;
        const context = contextRef.current;
        context.clear();

        // SPLIT NOTES INTO 2 MEASURES
        // We assume 'notes' input is a flat array of valid notes for 2 measures.
        // We need to group them.
        // Or simpler: The parent passes notes for Measure A and Measure B?
        // Let's assume the parent filters correctly.
        // We need to detect "Bar Lines" or just fill capacity?
        // Actually, if the generator includes 'bar' notes, we can split by that.

        const measure1Notes: RhythmGameNote[] = [];
        const measure2Notes: RhythmGameNote[] = [];
        let currentMeasure = 1;

        notes.forEach((n, index) => {
            // Fix: If the very first note is a 'bar' line, it is likely the End-Bar of the PREVIOUS cycle 
            // that overlaps the time window. We must ignore it to prevent skipping Measure 1.
            if (index === 0 && n.note.duration === 'bar') return;

            if (n.note.duration === 'bar') {
                currentMeasure++;
                return;
            }
            if (currentMeasure === 1) measure1Notes.push(n);
            else if (currentMeasure === 2) measure2Notes.push(n);
        });

        // DRAW MEASURE 1
        const stave1 = new Stave(10, 50, STAFF_WIDTH_PER_BAR);
        stave1.addClef('percussion');
        stave1.addTimeSignature(timeSignature);
        stave1.setContext(context).draw();

        // DRAW MEASURE 2
        const stave2 = new Stave(10 + STAFF_WIDTH_PER_BAR, 50, STAFF_WIDTH_PER_BAR);
        // stave2.addTimeSignature(timeSignature); // No need for clef/sig on 2nd bar generally, or maybe yes?
        // User asked for "Static, 2 whole bars visible". Standard notation shows clef only at start.
        stave2.setContext(context).draw();

        // Helper to create VexFlow Notes
        const createVexNotes = (measureNotes: RhythmGameNote[]) => {
            return measureNotes.map(gn => {
                const duration = gn.note.duration + (gn.note.isRest ? 'r' : '');

                // Color Logic
                let fillStyle = 'black';
                let strokeStyle = 'black';

                if (gn.status === 'match_perfect') { fillStyle = '#22c55e'; strokeStyle = '#22c55e'; }
                else if (gn.status === 'match_good') { fillStyle = '#eab308'; strokeStyle = '#eab308'; }
                else if (gn.status === 'miss') { fillStyle = '#ef4444'; strokeStyle = '#ef4444'; }

                const vn = new StaveNote({
                    clef: 'percussion',
                    keys: [gn.note.isRest ? 'b/4' : 'b/4'],
                    duration: duration,
                    auto_stem: true
                });

                vn.setStyle({ fillStyle, strokeStyle });
                return vn;
            });
        };

        // Helper to parse Time Signature
        const [numBeats, beatValue] = timeSignature.split('/').map(Number);

        // Render M1
        if (measure1Notes.length > 0) {
            const voice1 = new Voice({ num_beats: numBeats, beat_value: beatValue });
            voice1.setMode(Voice.Mode.SOFT); // Allow incomplete measures without crashing
            const vfNotes1 = createVexNotes(measure1Notes);

            // Auto Beaming
            const beams1 = Beam.generateBeams(vfNotes1);

            voice1.addTickables(vfNotes1);
            new Formatter().joinVoices([voice1]).format([voice1], STAFF_WIDTH_PER_BAR - 50);
            voice1.draw(context, stave1);
            beams1.forEach(b => b.setContext(context).draw());
        }

        // Render M2
        if (measure2Notes.length > 0) {
            const voice2 = new Voice({ num_beats: numBeats, beat_value: beatValue });
            voice2.setMode(Voice.Mode.SOFT);
            const vfNotes2 = createVexNotes(measure2Notes);

            const beams2 = Beam.generateBeams(vfNotes2);

            voice2.addTickables(vfNotes2);
            new Formatter().joinVoices([voice2]).format([voice2], STAFF_WIDTH_PER_BAR - 50);
            voice2.draw(context, stave2);
            beams2.forEach(b => b.setContext(context).draw());
        }
    };

    return (
        <div className="relative flex justify-center mt-10">
            <div ref={containerRef} className="bg-white p-4 rounded-xl shadow-lg border-2 border-gray-200" />
        </div>
    );
}
