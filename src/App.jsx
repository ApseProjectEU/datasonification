import React, { useState, useRef } from 'react';
import * as Tone from 'tone';
import Meyda from 'meyda';

export default function App() {
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [features, setFeatures] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [scale, setScale] = useState('major');
  const [reverbWet, setReverbWet] = useState(0.3);
  const [delayFeedback, setDelayFeedback] = useState(0.4);
  const [filterFreq, setFilterFreq] = useState(2000);

  const fileInputRef = useRef(null);
  const synthRef = useRef(null);
  const sequenceRef = useRef(null);
  const reverbRef = useRef(null);
  const delayRef = useRef(null);
  const filterRef = useRef(null);

  // Audio chain setup
  React.useEffect(() => {
    const reverb = new Tone.Reverb(4).toDestination();
    const delay = new Tone.FeedbackDelay('8n', 0.4).connect(reverb);
    const filter = new Tone.Filter(2000, 'lowpass').connect(delay);
    const synth = new Tone.PolySynth(Tone.Synth).connect(filter);

    reverbRef.current = reverb;
    delayRef.current = delay;
    filterRef.current = filter;
    synthRef.current = synth;

    return () => {
      synth.dispose();
      reverb.dispose();
      delay.dispose();
      filter.dispose();
    };
  }, []);

  // Update effects
  React.useEffect(() => {
    if (reverbRef.current) reverbRef.current.wet.value = reverbWet;
  }, [reverbWet]);

  React.useEffect(() => {
    if (delayRef.current) delayRef.current.feedback.value = delayFeedback;
  }, [delayFeedback]);

  React.useEffect(() => {
    if (filterRef.current) filterRef.current.frequency.value = filterFreq;
  }, [filterFreq]);

  React.useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  // Load audio file
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result;
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        setAudioBuffer(buffer);

        // Extract features
        const channelData = buffer.getChannelData(0);
        const meyda = Meyda.extract([
          'spectralCentroid',
          'rms',
          'zcr',
          'spectralRolloff'
        ], channelData);

        const extractedFeatures = {
          spectralCentroid: meyda.spectralCentroid,
          rms: meyda.rms,
          zcr: meyda.zcr,
          basePitch: Math.max(48, Math.min(84, Math.round(meyda.spectralCentroid / 20))),
          energy: Math.min(meyda.rms * 10, 1),
          complexity: Math.min(meyda.zcr / 100, 1)
        };

        setFeatures(extractedFeatures);
      } catch (error) {
        console.error('Error:', error);
        alert('Failed to load audio');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Generate musical sequence
  React.useEffect(() => {
    if (!features || !synthRef.current) return;

    const scales = {
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
      pentatonic: [0, 2, 4, 7, 9],
      dorian: [0, 2, 3, 5, 7, 9, 10]
    };

    const scaleNotes = scales[scale] || scales.major;
    const { basePitch, energy, complexity } = features;

    const noteCount = Math.floor(8 + (complexity * 8));
    const sequence = [];
    let currentPitch = basePitch;

    for (let i = 0; i < noteCount; i++) {
      if (Math.random() < energy) {
        const scaleStep = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
        const midiNote = currentPitch + scaleStep;
        const note = Tone.Frequency(midiNote, 'midi').toNote();
        sequence.push(note);

        const direction = Math.random() < 0.5 ? 1 : -1;
        currentPitch += direction * (Math.random() < complexity ? 2 : 1);
        currentPitch = Math.max(48, Math.min(84, currentPitch));
      } else {
        sequence.push(null);
      }
    }

    if (sequenceRef.current) {
      sequenceRef.current.dispose();
    }

    const toneSequence = new Tone.Sequence((time, note) => {
      if (note) {
        synthRef.current.triggerAttackRelease(note, '8n', time);
      }
    }, sequence, '4n');

    sequenceRef.current = toneSequence;
  }, [features, scale]);

  // Play/Stop control
  React.useEffect(() => {
    if (isPlaying) {
      Tone.start();
      sequenceRef.current?.start(0);
      Tone.Transport.start();
    } else {
      Tone.Transport.stop();
      sequenceRef.current?.stop();
    }
  }, [isPlaying]);

  const handleExport = async () => {
    const recorder = new Tone.Recorder();
    Tone.Destination.connect(recorder);
    recorder.start();

    setTimeout(async () => {
      const recording = await recorder.stop();
      const url = URL.createObjectURL(recording);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'datasonification.webm';
      a.click();
    }, 10000);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>🎵 Data Sonification</h1>
        <p>Transform soundscapes into generative music</p>
        <p className="subtitle">APSE Project</p>
      </header>

      <main className="main-grid">
        {/* Audio Upload */}
        <section className="card">
          <h2>1. Audio Source</h2>
          <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
            <p>📁 Upload Audio File</p>
            <small>WAV, MP3, OGG, FLAC</small>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          {audioBuffer && <p className="status">✅ Audio loaded ({audioBuffer.duration.toFixed(1)}s)</p>}
        </section>

        {/* Features Display */}
        <section className="card">
          <h2>2. Extracted Parameters</h2>
          {features ? (
            <div className="feature-grid">
              <div className="feature-item">
                <label>Base Pitch</label>
                <span className="value">{features.basePitch}</span>
              </div>
              <div className="feature-item">
                <label>Energy</label>
                <span className="value">{(features.energy * 100).toFixed(0)}%</span>
              </div>
              <div className="feature-item">
                <label>Complexity</label>
                <span className="value">{(features.complexity * 100).toFixed(0)}%</span>
              </div>
              <div className="feature-item">
                <label>Spectral Centroid</label>
                <span className="value">{Math.round(features.spectralCentroid)} Hz</span>
              </div>
            </div>
          ) : (
            <p className="empty">Upload audio to analyze</p>
          )}
        </section>

        {/* Music Controls */}
        <section className="card">
          <h2>3. Music Generation</h2>
          <div className="control-group">
            <label>BPM: {bpm}</label>
            <input
              type="range"
              min="40"
              max="180"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Scale</label>
            <select value={scale} onChange={(e) => setScale(e.target.value)}>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="pentatonic">Pentatonic</option>
              <option value="dorian">Dorian</option>
            </select>
          </div>
        </section>

        {/* Effects Panel */}
        <section className="card">
          <h2>4. Effects</h2>
          <div className="control-group">
            <label>Reverb: {(reverbWet * 100).toFixed(0)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={reverbWet}
              onChange={(e) => setReverbWet(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Delay: {(delayFeedback * 100).toFixed(0)}%</label>
            <input
              type="range"
              min="0"
              max="0.9"
              step="0.01"
              value={delayFeedback}
              onChange={(e) => setDelayFeedback(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Filter: {filterFreq} Hz</label>
            <input
              type="range"
              min="100"
              max="8000"
              value={filterFreq}
              onChange={(e) => setFilterFreq(parseInt(e.target.value))}
            />
          </div>
        </section>

        {/* Transport Controls */}
        <section className="card transport">
          <h2>5. Playback</h2>
          <div className="transport-controls">
            <button
              className={`play-btn ${isPlaying ? 'playing' : ''}`}
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!features}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>

            <button
              className="stop-btn"
              onClick={() => {
                setIsPlaying(false);
                Tone.Transport.stop();
                Tone.Transport.position = 0;
              }}
              disabled={!features}
            >
              ⏹ Stop
            </button>

            <button
              className="export-btn"
              onClick={handleExport}
              disabled={!features}
            >
              💾 Export (10s)
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Powered by APSE Project • <a href="https://github.com/ApseProjectEU/datasonification" target="_blank" rel="noopener noreferrer">GitHub</a></p>
      </footer>
    </div>
  );
}