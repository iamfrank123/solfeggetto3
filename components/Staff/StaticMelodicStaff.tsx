'use client';

import { useEffect, useRef } from 'react';
import { Vex } from 'vexflow';
import { MelodicNote } from '@/lib/generator/melodic-generator';

const { Renderer, Stave, StaveNote, Voice, Formatter, Beam } = Vex.Flow;

interface StaticMelodicStaffProps {
    notes: Array<{
        id: string;
        note: MelodicNote;
        x: number;
        status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
        targetTime: number;
    }>;
    timeSignature: string;
}

export default function StaticMelodicStaff({ notes, timeSignature }: StaticMelodicStaffProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<any>(null);
    const contextRef = useRef<any>(null);

    const STAFF_WIDTH_PER_BAR = 380;
    const STAFF_HEIGHT = 220;

    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';
        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(STAFF_WIDTH_PER_BAR * 2 + 60, STAFF_HEIGHT);
        const context = renderer.getContext();
        rendererRef.current = renderer;
        contextRef.current = context;

        renderFrame();
    }, [notes, timeSignature]);

    const renderFrame = () => {
        if (!contextRef.current) return;
        const context = contextRef.current;
        context.clear();

        // split into two measures by 'bar'
        const measure1: any[] = [];
        const measure2: any[] = [];
        let current = 1;

        notes.forEach((n, i) => {
            if (i === 0 && n.note.duration === 'bar') return;
            if (n.note.duration === 'bar') { current++; return; }
            if (current === 1) measure1.push(n);
            else measure2.push(n);
        });

        const stave1 = new Stave(10, 50, STAFF_WIDTH_PER_BAR);
        stave1.addClef('treble');
        stave1.addTimeSignature(timeSignature);
        stave1.setContext(context).draw();

        const stave2 = new Stave(10 + STAFF_WIDTH_PER_BAR, 50, STAFF_WIDTH_PER_BAR);
        stave2.setContext(context).draw();

        const createVexNotes = (measureNotes: typeof measure1) => {
            return measureNotes.map(gn => {
                const duration = gn.note.duration + (gn.note.isRest ? 'r' : '');

                let fillStyle = 'black';
                let strokeStyle = 'black';
                if (gn.status === 'match_perfect') { fillStyle = '#22c55e'; strokeStyle = '#22c55e'; }
                else if (gn.status === 'match_good') { fillStyle = '#eab308'; strokeStyle = '#eab308'; }
                else if (gn.status === 'miss') { fillStyle = '#ef4444'; strokeStyle = '#ef4444'; }

                // Build key for VexFlow
                let key = 'b/4';
                if (!gn.note.isRest && gn.note.generated) {
                    const noteName = gn.note.generated.note.toLowerCase();
                    const acc = gn.note.generated.accidental || '';
                    const oct = gn.note.generated.octave;
                    key = `${noteName}${acc}/${oct}`;
                }

                const vn = new StaveNote({
                    clef: 'treble',
                    keys: [key],
                    duration: duration,
                    auto_stem: true
                });

                vn.setStyle({ fillStyle, strokeStyle });
                return vn;
            });
        };

        const [numBeats, beatValue] = timeSignature.split('/').map(Number);

        if (measure1.length > 0) {
            const voice1 = new Voice({ num_beats: numBeats, beat_value: beatValue });
            voice1.setMode(Voice.Mode.SOFT);
            const vfNotes1 = createVexNotes(measure1);
            const beams1 = Beam.generateBeams(vfNotes1);
            voice1.addTickables(vfNotes1);
            new Formatter().joinVoices([voice1]).format([voice1], STAFF_WIDTH_PER_BAR - 80);
            voice1.draw(context, stave1);
            beams1.forEach(b => b.setContext(context).draw());
        }

        if (measure2.length > 0) {
            const voice2 = new Voice({ num_beats: numBeats, beat_value: beatValue });
            voice2.setMode(Voice.Mode.SOFT);
            const vfNotes2 = createVexNotes(measure2);
            const beams2 = Beam.generateBeams(vfNotes2);
            voice2.addTickables(vfNotes2);
            new Formatter().joinVoices([voice2]).format([voice2], STAFF_WIDTH_PER_BAR - 80);
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
