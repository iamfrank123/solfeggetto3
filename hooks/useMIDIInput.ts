'use client';

import { useState, useEffect } from 'react';
import { midiManager } from '@/lib/midi/web-midi';
import { MIDINoteEvent } from '@/lib/types/midi';

export function useMIDIInput(onNoteEvent?: (event: MIDINoteEvent) => void) {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Register note event callback
        if (onNoteEvent) {
            midiManager.onNoteEvent(onNoteEvent);
        }
    }, [onNoteEvent]);

    // Auto-connect on mount
    useEffect(() => {
        connect();
    }, []);

    const connect = async () => {
        const status = await midiManager.requestAccess();

        if (!status.hasAccess) {
            setError(status.error || 'Failed to connect to MIDI device');
            setIsConnected(false);
            return;
        }

        if (status.devices.length === 0) {
            setError('No MIDI devices found');
            setIsConnected(false);
            return;
        }

        // Connect to first device
        const connected = midiManager.connectDevice(status.devices[0].id);
        setIsConnected(connected);
        setError(null);
    };

    const disconnect = () => {
        midiManager.disconnectDevice();
        setIsConnected(false);
    };

    return {
        isConnected,
        error,
        connect,
        disconnect,
    };
}
