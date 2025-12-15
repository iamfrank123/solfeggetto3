/**
 * Web MIDI API Manager
 * Handles MIDI device connection and note events
 */

import { MIDINoteEvent, MIDIConnectionStatus, MIDIInputDevice } from '@/lib/types/midi';

class MIDIManager {
    private midiAccess: MIDIAccess | null = null;
    private activeInput: MIDIInput | null = null;
    private noteCallback: ((event: MIDINoteEvent) => void) | null = null;

    async requestAccess(): Promise<MIDIConnectionStatus> {
        if (!navigator.requestMIDIAccess) {
            return {
                hasAccess: false,
                isSupported: false,
                devices: [],
                selectedDevice: null,
                error: 'Web MIDI API not supported in this browser'
            };
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess();
            const devices = this.getDevices();

            return {
                hasAccess: true,
                isSupported: true,
                devices,
                selectedDevice: null,
            };
        } catch (error) {
            return {
                hasAccess: false,
                isSupported: true,
                devices: [],
                selectedDevice: null,
                error: `Failed to access MIDI devices: ${error}`
            };
        }
    }

    private getDevices(): MIDIInputDevice[] {
        if (!this.midiAccess) return [];

        const devices: MIDIInputDevice[] = [];
        this.midiAccess.inputs.forEach((input) => {
            devices.push({
                id: input.id,
                name: input.name || 'Unknown Device',
                manufacturer: input.manufacturer || 'Unknown',
                state: input.state === 'connected' ? 'connected' : 'disconnected',
            });
        });

        return devices;
    }

    connectDevice(deviceId: string): boolean {
        if (!this.midiAccess) return false;

        const input = this.midiAccess.inputs.get(deviceId);
        if (!input) return false;

        this.activeInput = input;
        this.activeInput.onmidimessage = this.handleMIDIMessage.bind(this);

        return true;
    }

    disconnectDevice(): void {
        if (this.activeInput) {
            this.activeInput.onmidimessage = null;
            this.activeInput = null;
        }
    }

    private handleMIDIMessage(message: MIDIMessageEvent): void {
        if (!message.data) return;
        const status = message.data[0];
        const note = message.data[1];
        const velocity = message.data[2];
        const command = status >> 4;

        // Note On: command = 9, Note Off: command = 8
        if (command === 9 && velocity > 0) {
            // Note On
            this.emitNoteEvent({
                type: 'noteOn',
                pitch: note,
                velocity,
                timestamp: message.timeStamp,
            });
        } else if (command === 8 || (command === 9 && velocity === 0)) {
            // Note Off
            this.emitNoteEvent({
                type: 'noteOff',
                pitch: note,
                velocity: 0,
                timestamp: message.timeStamp,
            });
        }
    }

    private emitNoteEvent(event: MIDINoteEvent): void {
        if (this.noteCallback) {
            this.noteCallback(event);
        }
    }

    onNoteEvent(callback: (event: MIDINoteEvent) => void): void {
        this.noteCallback = callback;
    }
}

export const midiManager = new MIDIManager();
