'use client';

import { useEffect, useRef } from 'react';
import { Vex } from 'vexflow';
import { RhythmNote } from '@/lib/generator/rhythm-generator';

const { Renderer, Stave, StaveNote, Voice, Formatter } = Vex.Flow;

interface RhythmGameNote {
    id: string;
    note: RhythmNote;
    x: number;
    status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good';
}

interface RhythmStaffProps {
    notes: RhythmGameNote[];
    onHitZoneEnter?: (noteId: string) => void;
    onHitZoneLeave?: (noteId: string) => void;
    hitX: number;
}

export default function RhythmStaff({ notes, hitX }: RhythmStaffProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<any>(null);
    const contextRef = useRef<any>(null);

    const STAFF_WIDTH = 1000;
    const STAFF_HEIGHT = 200;

    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';
        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(STAFF_WIDTH, STAFF_HEIGHT);
        const context = renderer.getContext();
        rendererRef.current = renderer;
        contextRef.current = context;

        // Initial render
        renderFrame();

    }, []);

    const renderFrame = () => {
        if (!contextRef.current) return;
        const context = contextRef.current;
        context.clear();

        // 1. Draw Static Staff (Single Line)
        // VexFlow Stave(x, y, width)
        // num_lines = 1 for percussion/rhythm
        const stave = new Stave(0, 70, STAFF_WIDTH);
        stave.setConfigForLine(0, { visible: true }); // Line 0 is top
        // Actually VexFlow 1-line staff:
        stave.setNumLines(1);
        stave.setContext(context).draw();

        // 2. Draw Hit Marker (Green Line)
        context.save();
        context.beginPath();
        context.rect(hitX - 20, 50, 40, 60); // Centered on hitX
        context.setFillStyle('rgba(34, 197, 94, 0.2)');
        context.fill();
        context.restore();

        // 3. Draw Notes
        notes.forEach(gameNote => {
            if (gameNote.x < -50 || gameNote.x > STAFF_WIDTH + 50) return;

            // Handle Bar Line
            if (gameNote.note.duration === 'bar') {
                context.save();
                context.beginPath();
                // Draw vertical line across staff height
                context.moveTo(gameNote.x, 70);
                context.lineTo(gameNote.x, 70 + 80); // Staff height roughly
                context.lineWidth = 2;
                context.setStrokeStyle('#666666'); // Dark gray
                context.stroke();
                context.restore();
                return;
            }

            // Map duration to VexFlow
            const duration = gameNote.note.duration;
            const type = gameNote.note.isRest ? 'r' : '';

            // Construct StaveNote
            // "b/4" is default for single line (center)
            const noteKey = gameNote.note.isRest ? 'b/4' : 'b/4';

            // Catch invalid keys for VexFlow just in case


            const vfNote = new StaveNote({
                clef: 'percussion',
                keys: [noteKey],
                duration: duration + type,
                auto_stem: true
            });

            // Style
            let color = '#000000';
            if (gameNote.status === 'match_perfect') color = '#22c55e';
            else if (gameNote.status === 'match_good') color = '#eab308';
            else if (gameNote.status === 'miss') color = '#ef4444';
            else if (gameNote.status === 'hit') color = '#9ca3af';

            vfNote.setStyle({ fillStyle: color, strokeStyle: color });

            // Absolute Positioning Hack (same as ChallengeStaff)
            // Create a tick context for layout (needed for draw)
            // But force X position.
            const tickContext = new Vex.Flow.TickContext();
            tickContext.addTickable(vfNote);
            tickContext.preFormat().setX(gameNote.x);

            vfNote.setStave(stave);
            vfNote.setContext(context);
            vfNote.draw();
        });
    };

    // Re-render on notes update
    useEffect(() => {
        renderFrame();
    }, [notes]);

    return (
        <div className="relative">
            <div ref={containerRef} className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden" />
        </div>
    );
}

