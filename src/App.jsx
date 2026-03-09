import React, { useState, useRef } from 'react';
import * as Tone from 'tone';
import Meyda from 'meyda';
import Spectrogram from './components/Spectrogram';
import Waveform from './components/Waveform';
import StepSequencer from './components/StepSequencer';
import PresetManager from './components/PresetManager';
import MIDIExporter from './components/MIDIExporter';

export default function App() {
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [features, setFeatures] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [scale, setScale] = useState('major');
  const [sequencerPattern, setSequencerPattern] = useState(null);

  // Effects state
  const [reverbWet, setReverbWet] = useState(0.3);
  const [delayFeedback, setDelayFeedback] = useState(0.4);
  const [filterFreq, setFilterFreq] = useState(2000);
  const [chorusDepth, setChorusDepth] = useState(0.5);
  const [distortionAmount, setDistortionAmount] = useState(0);

  // Synth voices state
  const [activeVoices, setActiveVoices] = useState({
    melody: true,
    pad: true,
    bass: true,
    percussion: false
  });

  const fileInputRef = useRef(null);
  const synthsRef = useRef({});
  const sequenceRef = useRef(null);
  const effectsRef = useRef({});

  // Initialize audio chain with multiple voices and effects
  React.useEffect(() => {
    const reverb = new Tone.Reverb(4).toDestination();
    const delay = new Tone.FeedbackDelay('8n', 0.4).connect(reverb);
    const filter = new Tone.Filter(2000, 'lowpass').connect(delay);
    const chorus = new Tone.Chorus(4, 2.5, 0.5).connect(filter);
    const distortion = new Tone.Distortion(0).connect(chorus);

    // Create multiple synth voices
    const melodySynth = new Tone.PolySynth(Tone.Synth).connect(distortion);
    const padSynth = new Tone.PolySynth(Tone.AMSynth).connect(distortion);
    const bassSynth = new Tone.MonoSynth().connect(distortion);
    const percSynth = new Tone.MembraneSynth().connect(distortion);

    synthsRef.current = { melody: melodySynth, pad: padSynth, bass: bassSynth, percussion: percSynth };
    effectsRef.current = { reverb, delay, filter, chorus, distortion };

    return () => {
      Object.values(synthsRef.current).forEach(synth => synth.dispose());
      Object.values(effectsRef.current).forEach(effect => effect.dispose());
    };
  }, []);

  // Update effects
  React.useEffect(() => {
    if (effectsRef.current.reverb) effectsRef.current.reverb.wet.value = reverbWet;
  }, [reverbWet]);

  React.useEffect(() => {
    if (effectsRef.current.delay) effectsRef.current.delay.feedback.value = delayFeedback;
  }, [delayFeedback]);

  React.useEffect(() => {
    if (effectsRef.current.filter) effectsRef.current.filter.frequency.value = filterFreq;
  }, [filterFreq]);

  React.useEffect(() => {
    if (effectsRef.current.chorus) effectsRef.current.chorus.depth = chorusDepth;
  }, [chorusDepth]);

  React.useEffect(() => {
    if (effectsRef.current.distortion) effectsRef.current.distortion.distortion = distortionAmount;
  }, [distortionAmount]);

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
          spectralRolloff: meyda.spectralRolloff,
          basePitch: Math.max(48, Math.min(84, Math.round(meyda.spectralCentroid / 20))),
          energy: Math.min(meyda.rms * 10, 1),
          complexity: Math.min(meyda.zcr / 100, 1),
          brightness: Math.min(meyda.spectralRolloff / 8000, 1)
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
    if (!features) return;

    const scales = {
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
      pentatonic: [0, 2, 4, 7, 9],
      dorian: [0, 2, 3, 5, 7, 9, 10]
    };

    const scaleNotes = scales[scale] || scales.major;
    const { basePitch, energy, complexity } = features;

    if (sequencerPattern) {
      // Use sequencer pattern
      playSequencerPattern(sequencerPattern, scaleNotes, basePitch);
    } else {
      // Generate automatic pattern
      generateAutoPattern(scaleNotes, basePitch, energy, complexity);
    }
  }, [features, scale, sequencerPattern, activeVoices]);

  const playSequencerPattern = (pattern, scale, basePitch) => {
    if (sequenceRef.current) {
      if (Array.isArray(sequenceRef.current)) {
        sequenceRef.current.forEach(seq => seq?.dispose());
      } else {
        sequenceRef.current?.dispose();
      }
    }

    const voiceSequences = pattern.map((row, voiceIndex) => {
      return row.map((isActive, step) => {
        if (!isActive) return null;
        const scaleStep = scale[step % scale.length];
        const octaveShift = voiceIndex === 2 ? -12 : voiceIndex === 1 ? 12 : 0; // Bass lower, pad higher
        return Tone.Frequency(basePitch + scaleStep + octaveShift, 'midi').toNote();
      });
    });

    const sequences = voiceSequences.map((notes, voiceIndex) => {
      const voiceName = ['melody', 'pad', 'bass', 'percussion'][voiceIndex];
      if (!activeVoices[voiceName] || !synthsRef.current[voiceName]) return null;

      return new Tone.Sequence((time, note) => {
        if (note) {
          synthsRef.current[voiceName].triggerAttackRelease(note, '8n', time);
        }
      }, notes, '16n');
    }).filter(Boolean);

    sequenceRef.current = sequences;
  };

  const generateAutoPattern = (scale, basePitch, energy, complexity) => {
    if (sequenceRef.current) {
      if (Array.isArray(sequenceRef.current)) {
        sequenceRef.current.forEach(seq => seq?.dispose());
      } else {
        sequenceRef.current?.dispose();
      }
    }

    const noteCount = Math.floor(16);
    const sequence = [];
    let currentPitch = basePitch;

    for (let i = 0; i < noteCount; i++) {
      if (Math.random() < energy) {
        const scaleStep = scale[Math.floor(Math.random() * scale.length)];
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

    const toneSequence = new Tone.Sequence((time, note) => {
      if (note && activeVoices.melody && synthsRef.current.melody) {
        synthsRef.current.melody.triggerAttackRelease(note, '8n', time);
      }
    }, sequence, '8n');

    sequenceRef.current = toneSequence;
  };

  // Play/Stop control
  React.useEffect(() => {
    if (isPlaying) {
      Tone.start();
      if (Array.isArray(sequenceRef.current)) {
        sequenceRef.current.forEach(seq => seq?.start(0));
      } else {
        sequenceRef.current?.start(0);
      }
      Tone.Transport.start();
    } else {
      Tone.Transport.stop();
      if (Array.isArray(sequenceRef.current)) {
        sequenceRef.current.forEach(seq => seq?.stop());
      } else {
        sequenceRef.current?.stop();
      }
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
      URL.revokeObjectURL(url);
    }, 15000);
  };

  const loadPreset = (preset) => {
    setBpm(preset.bpm);
    setScale(preset.scale);
    setReverbWet(preset.reverb);
    setDelayFeedback(preset.delay);
    setFilterFreq(preset.filter);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>🎵 Data Sonification</h1>
        <p>Transform soundscapes into generative music</p>
        <p className="subtitle">APSE Project</p>
      </header>

      <main className="main-grid">
        {/* Audio Upload + Waveform */}
        <section className="card full-width">
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
          {audioBuffer && (
            <>
              <p className="status">✅ Audio loaded ({audioBuffer.duration.toFixed(1)}s)</p>
              <Waveform audioBuffer={audioBuffer} />
            </>
          )}
        </section>

        {/* Spectrogram */}
        {audioBuffer && (
          <section className="card full-width">
            <h2>2. Spectrogram</h2>
            <Spectrogram audioBuffer={audioBuffer} />
          </section>
        )}

        {/* Features Display */}
        <section className="card">
          <h2>3. Extracted Parameters</h2>
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
                <label>Brightness</label>
                <span className="value">{(features.brightness * 100).toFixed(0)}%</span>
              </div>
            </div>
          ) : (
            <p className="empty">Upload audio to analyze</p>
          )}
        </section>

        {/* Music Controls */}
        <section className="card">
          <h2>4. Music Generation</h2>
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

          <div className="voice-toggles">
            <h4>Active Voices</h4>
            {Object.keys(activeVoices).map(voice => (
              <label key={voice} className="voice-toggle">
                <input
                  type="checkbox"
                  checked={activeVoices[voice]}
                  onChange={(e) => setActiveVoices({...activeVoices, [voice]: e.target.checked})}
                />
                {voice.charAt(0).toUpperCase() + voice.slice(1)}
              </label>
            ))}
          </div>
        </section>

        {/* Step Sequencer */}
        {features && (
          <section className="card full-width">
            <StepSequencer
              pattern={sequencerPattern}
              onPatternChange={setSequencerPattern}
              voices={4}
            />
          </section>
        )}

        {/* Effects Panel */}
        <section className="card">
          <h2>5. Effects</h2>
          <div className="control-group">
            <label>Reverb: {(reverbWet * 100).toFixed(0)}%</label>
            <input type="range" min="0" max="1" step="0.01" value={reverbWet} onChange={(e) => setReverbWet(parseFloat(e.target.value))} />
          </div>

          <div className="control-group">
            <label>Delay: {(delayFeedback * 100).toFixed(0)}%</label>
            <input type="range" min="0" max="0.9" step="0.01" value={delayFeedback} onChange={(e) => setDelayFeedback(parseFloat(e.target.value))} />
          </div>

          <div className="control-group">
            <label>Filter: {filterFreq} Hz</label>
            <input type="range" min="100" max="8000" value={filterFreq} onChange={(e) => setFilterFreq(parseInt(e.target.value))} />
          </div>

          <div className="control-group">
            <label>Chorus: {(chorusDepth * 100).toFixed(0)}%</label>
            <input type="range" min="0" max="1" step="0.01" value={chorusDepth} onChange={(e) => setChorusDepth(parseFloat(e.target.value))} />
          </div>

          <div className="control-group">
            <label>Distortion: {(distortionAmount * 100).toFixed(0)}%</label>
            <input type="range" min="0" max="1" step="0.01" value={distortionAmount} onChange={(e) => setDistortionAmount(parseFloat(e.target.value))} />
          </div>
        </section>

        {/* Preset Manager */}
        <section className="card">
          <PresetManager
            currentSettings={{ bpm, scale, reverb: reverbWet, delay: delayFeedback, filter: filterFreq }}
            onLoadPreset={loadPreset}
          />
        </section>

        {/* Transport Controls */}
        <section className="card transport full-width">
          <h2>6. Playback & Export</h2>
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
              💾 Export WAV (15s)
            </button>

            <MIDIExporter
              sequence={sequenceRef.current}
              bpm={bpm}
            />
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Powered by APSE Project • <a href="https://github.com/ApseProjectEU/datasonification" target="_blank" rel="noopener noreferrer">GitHub</a></p>
      </footer>
    </div>
  );
}