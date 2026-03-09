import React from 'react';

export default function MIDIExporter({ sequence, bpm, onExport }) {
  const exportMIDI = () => {
    // Simple MIDI file generation
    const midiData = generateMIDI(sequence, bpm);
    const blob = new Blob([midiData], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'datasonification.mid';
    a.click();

    URL.revokeObjectURL(url);
    if (onExport) onExport();
  };

  const generateMIDI = (notes, tempo) => {
    // Basic MIDI header
    const header = new Uint8Array([
      0x4D, 0x54, 0x68, 0x64, // "MThd"
      0x00, 0x00, 0x00, 0x06, // Header length
      0x00, 0x00, // Format type 0
      0x00, 0x01, // Number of tracks
      0x00, 0x60  // Time division (96 ticks per quarter note)
    ]);

    // Track header
    const trackHeader = new Uint8Array([
      0x4D, 0x54, 0x72, 0x6B, // "MTrk"
      0x00, 0x00, 0x00, 0x20  // Track length (32 bytes - will be updated)
    ]);

    // Tempo meta event (500000 microseconds per beat = 120 BPM)
    const tempoMeta = new Uint8Array([
      0x00, // Delta time
      0xFF, 0x51, 0x03, // Meta event: Set Tempo
      0x07, 0xA1, 0x20  // 500000 in 3 bytes
    ]);

    // Note on/off events
    const events = [];
    if (Array.isArray(notes)) {
      notes.forEach((note, index) => {
        if (note) {
          // Note on
          events.push(0x00); // Delta time
          events.push(0x90); // Note on, channel 0
          events.push(60); // Middle C (could be extracted from note)
          events.push(100); // Velocity

          // Note off
          events.push(0x18); // Delta time (24 ticks = quarter note)
          events.push(0x80); // Note off, channel 0
          events.push(60); // Middle C
          events.push(0x40); // Velocity
        }
      });
    }

    // End of track
    const endOfTrack = new Uint8Array([
      0x00, // Delta time
      0xFF, 0x2F, 0x00 // Meta event: End of Track
    ]);

    // Combine all data
    const trackData = new Uint8Array(tempoMeta.length + events.length + endOfTrack.length);
    let offset = 0;

    trackData.set(tempoMeta, offset);
    offset += tempoMeta.length;

    trackData.set(new Uint8Array(events), offset);
    offset += events.length;

    trackData.set(endOfTrack, offset);

    // Update track length
    const trackLength = trackData.length;
    const lengthBytes = [
      (trackLength >> 24) & 0xFF,
      (trackLength >> 16) & 0xFF,
      (trackLength >> 8) & 0xFF,
      trackLength & 0xFF
    ];

    const finalMIDI = new Uint8Array(header.length + 4 + trackLength);
    finalMIDI.set(header, 0);
    finalMIDI.set(new Uint8Array(lengthBytes), header.length);
    finalMIDI.set(trackData, header.length + 4);

    return finalMIDI;
  };

  return (
    <button className="midi-export-btn" onClick={exportMIDI}>
      🎹 Export MIDI
    </button>
  );
}
