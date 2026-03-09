import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import Meyda from 'meyda'
import './App.css'

function App() {
  const [audioBuffer, setAudioBuffer] = useState(null)
  const [features, setFeatures] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [bpm, setBpm] = useState(90)
  const fileInputRef = useRef(null)
  const synthRef = useRef(null)
  const sequenceRef = useRef(null)

  useEffect(() => {
    const synth = new Tone.PolySynth(Tone.Synth).toDestination()
    synthRef.current = synth
    return () => synth.dispose()
  }, [])

  useEffect(() => {
    Tone.Transport.bpm.value = bpm
  }, [bpm])

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const reader = new FileReader()
    
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result
        const buffer = await audioContext.decodeAudioData(arrayBuffer)
        setAudioBuffer(buffer)

        const channelData = buffer.getChannelData(0)
        const meyda = Meyda.extract({
          featureExtractors: ['spectralCentroid', 'rms', 'zcr'],
          audioBuffer: channelData
        })

        setFeatures({
          basePitch: Math.max(48, Math.min(84, Math.round(meyda.spectralCentroid / 20))),
          energy: Math.min(meyda.rms * 10, 1),
          complexity: Math.min(meyda.zcr / 100, 1)
        })
      } catch (error) {
        console.error('Error:', error)
        alert('Failed to load audio')
      }
    }
    
    reader.readAsArrayBuffer(file)
  }

  useEffect(() => {
    if (!features || !synthRef.current) return

    const scale = [0, 2, 4, 5, 7, 9, 11]
    const { basePitch, energy } = features
    const sequence = []
    let currentPitch = basePitch

    for (let i = 0; i < 16; i++) {
      if (Math.random() < energy) {
        const scaleStep = scale[Math.floor(Math.random() * scale.length)]
        const note = Tone.Frequency(currentPitch + scaleStep, 'midi').toNote()
        sequence.push(note)
        currentPitch = Math.max(48, Math.min(84, currentPitch + (Math.random() < 0.5 ? 1 : -1)))
      } else {
        sequence.push(null)
      }
    }

    if (sequenceRef.current) sequenceRef.current.dispose()

    const toneSequence = new Tone.Sequence((time, note) => {
      if (note) synthRef.current.triggerAttackRelease(note, '8n', time)
    }, sequence, '8n')

    sequenceRef.current = toneSequence
  }, [features])

  useEffect(() => {
    if (isPlaying) {
      Tone.start()
      sequenceRef.current?.start(0)
      Tone.Transport.start()
    } else {
      Tone.Transport.stop()
      sequenceRef.current?.stop()
    }
  }, [isPlaying])

  return (
    <div className="app">
      <header>
        <h1>🎵 Data Sonification</h1>
        <p>Transform soundscapes into generative music</p>
      </header>

      <main>
        <section className="card">
          <h2>1. Upload Audio</h2>
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <p>📁 Click to upload</p>
            <small>WAV, MP3, OGG, FLAC</small>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          {audioBuffer && <p className="status">✅ Loaded ({audioBuffer.duration.toFixed(1)}s)</p>}
        </section>

        {features && (
          <>
            <section className="card">
              <h2>2. Parameters</h2>
              <div className="features">
                <div><label>Pitch</label><span>{features.basePitch}</span></div>
                <div><label>Energy</label><span>{(features.energy * 100).toFixed(0)}%</span></div>
                <div><label>Complexity</label><span>{(features.complexity * 100).toFixed(0)}%</span></div>
              </div>
            </section>

            <section className="card">
              <h2>3. Controls</h2>
              <label>BPM: {bpm}</label>
              <input type="range" min="40" max="180" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} />
            </section>

            <section className="card">
              <h2>4. Playback</h2>
              <div className="controls">
                <button onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <button onClick={() => { setIsPlaying(false); Tone.Transport.stop(); Tone.Transport.position = 0; }}>
                  ⏹ Stop
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      <footer>
        <p>APSE Project • <a href="https://github.com/ApseProjectEU/datasonification">GitHub</a></p>
      </footer>
    </div>
  )
}

export default App
