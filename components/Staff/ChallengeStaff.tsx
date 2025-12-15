'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Vex } from 'vexflow';
import { GeneratedNote, KeySignature } from '@/lib/generator/types';

const { Renderer, Stave, StaveNote, Accidental, Formatter, Voice } = Vex.Flow;

interface ChallengeStaffProps {
    notes: { note: GeneratedNote; id: string; x: number; status: 'pending' | 'hit' | 'miss' | 'match_perfect' | 'match_good' }[];
    speedPixelsPerFrame: number;
    keySignature: KeySignature;
    onHitZoneEnter: (noteId: string) => void;
    onHitZoneLeave: (noteId: string) => void;
    isPlaying: boolean;
}

export default function ChallengeStaff({
    notes,
    speedPixelsPerFrame,
    keySignature,
    onHitZoneEnter,
    onHitZoneLeave,
    isPlaying
}: ChallengeStaffProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<any>(null);
    const contextRef = useRef<any>(null);

    // Constants for layout
    const STAFF_WIDTH = 1000; // Fixed width for the canvas
    const STAFF_HEIGHT = 200;
    const HIT_ZONE_X = 100; // The "green line" position
    const HIT_ZONE_WIDTH = 60; // Width of the hit zone

    // Initialize VexFlow Renderer
    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = ''; // Clear previous

        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(STAFF_WIDTH, STAFF_HEIGHT);
        const context = renderer.getContext();

        rendererRef.current = renderer;
        contextRef.current = context;

        // Initial draw of static elements (stave, clef, key sig)
        drawStaticElements();

    }, [keySignature]); // Re-init if key signature changes

    const drawStaticElements = () => {
        if (!contextRef.current) return;

        const context = contextRef.current;
        context.clear(); // Clear canvas

        // Draw the stave
        const stave = new Stave(0, 40, STAFF_WIDTH);
        stave.addClef('treble');
        stave.addKeySignature(keySignature);
        stave.setContext(context).draw();

        // Draw Hit Zone (The Green Zone)
        // We draw it behind the notes, so we do it first or use z-index if possible, 
        // but VexFlow renders to SVG, so order matters.
        // Actually, let's draw a visual marker using SVG rect directly if we want custom styling
        // But context.rect works too.

        context.save();
        context.beginPath();
        context.rect(HIT_ZONE_X - HIT_ZONE_WIDTH / 2, 20, HIT_ZONE_WIDTH, 140);
        context.setFillStyle('rgba(34, 197, 94, 0.2)'); // Light green with opacity
        context.fill();


        context.restore();
    };

    // Render loop handling note positions
    // Note: We are controlling DOM elements (SVG groups) for performance if possible, 
    // OR re-rendering VexFlow notes at new positions. 
    // Re-rendering everything every frame might be heavy. 
    // A better approach for "Scrolling" in VexFlow is to render notes once into a group and translate the group?
    // But notes have different spacing. 
    // Let's try re-rendering the notes at their calculated X positions.
    // VexFlow StaveNote `setX` can be used.

    useEffect(() => {
        if (!contextRef.current || !rendererRef.current) return;

        // We need to clear only the notes area or redraw everything. 
        // Clef/Stave is static. 
        // VexFlow context.clear() wipes everything.
        // So we redraw static + dynamic notes every frame? 
        // Or we use a separate layer for notes? 
        // Let's try full redraw for simplicity first, optimizable later. 

        const renderFrame = () => {
            if (!contextRef.current) return;

            // 1. Clear & Draw Static
            drawStaticElements();

            // 2. Draw Notes at their current X
            // We can't easily use "Formatter" because we want absolute X positions based on time.
            // So we manually position StaveNotes.

            const context = contextRef.current;
            const stave = new Stave(0, 40, STAFF_WIDTH); // Need stave reference for y-positioning

            notes.forEach(noteData => {
                // Skip if off screen
                if (noteData.x < -50 || noteData.x > STAFF_WIDTH + 50) return;

                const accidentalStr = noteData.note.accidental === '#' ? '#' : noteData.note.accidental === 'b' ? 'b' : '';
                const noteStr = `${noteData.note.note.toLowerCase()}${accidentalStr}/${noteData.note.octave}`;

                const staveNote = new StaveNote({
                    clef: 'treble',
                    keys: [noteStr],
                    duration: 'q', // Quarter note appearance
                    auto_stem: true
                });

                if (noteData.note.accidental) {
                    staveNote.addModifier(new Accidental(noteData.note.accidental));
                }

                // Style based on status
                let color = '#000000';
                if (noteData.status === 'match_perfect') color = '#22c55e'; // Green
                else if (noteData.status === 'match_good') color = '#eab308'; // Yellow/Gold
                else if (noteData.status === 'miss') color = '#ef4444'; // Red
                else if (noteData.status === 'hit') color = '#9ca3af'; // Gray (already played)

                staveNote.setStyle({ fillStyle: color, strokeStyle: color });

                // Calculate X relative to stave
                // noteData.x is absolute pixel position
                // VexFlow usually wants relative to stave, but if we set stave at 0, it matches.
                // We need to manually set the note's X.
                // StaveNote.setStave is required for getting y metrics but we can try setX directly?
                // Or we use a TickContext? 
                // The easiest "hack" for absolute positioning in VexFlow is to put each note in its own Voice/Formatter 
                // but that's overkill. 
                // Let's try: setContext -> setStave -> draw().
                // But draw() uses the TickContext x. 
                // We can override note.getAbsoluteX() ? No.

                // Alternative: Create a TickContext, set its X, add note to it.
                const tickContext = new Vex.Flow.TickContext();
                tickContext.addTickable(staveNote);
                tickContext.preFormat().setX(noteData.x);

                staveNote.setStave(stave);
                staveNote.setContext(context);
                staveNote.draw();
            });
        };

        const animationId = requestAnimationFrame(renderFrame);
        return () => cancelAnimationFrame(animationId);
    }, [notes, keySignature]); // Re-run when notes data changes (which happens every tick in parent)

    return (
        <div className="relative">
            <div
                ref={containerRef}
                className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden"
            />
            {/* Visual Guide for the Hit Zone - Overlay for clarity */}
            <div
                className="absolute top-0 bottom-0 pointer-events-none bg-green-500/10"
                style={{
                    left: `${HIT_ZONE_X - HIT_ZONE_WIDTH / 2}px`,
                    width: `${HIT_ZONE_WIDTH}px`
                }}
            >
            </div>
            <div className="absolute top-2 left-2 text-xs text-gray-400">
                Debug: {notes.length} notes
            </div>
        </div>
    );
}

// NOTE: Ideally, the parent component handles the loop that updates `notes[].x`.
// This component simply renders the current state of `notes`.
