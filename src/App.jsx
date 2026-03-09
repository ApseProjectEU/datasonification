import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import Spectrogram from './components/Spectrogram'
import EcoacousticMetrics from './components/EcoacousticMetrics'
import { analyzeUrbanSoundscape } from './utils/ecoacoustics'
import './App.css'

function App() {
  const [audioBuffer, setAudioBuffer] = useState(null)
  const [fileName, setFileName] = useState('')
  const [activeTab, setActiveTab] = useState('analysis')
  const [ecoMetrics, setEcoMetrics] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Music generation state
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
    Tone.getTransport().bpm.value = bpm
  }, [bpm])

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setFileName(file.name)
    setIsAnalyzing(true)

    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result
        const buffer = await audioContext.decodeAudioData(arrayBuffer)
        setAudioBuffer(buffer)

        // Ecoacoustic analysis
        const metrics = analyzeUrbanSoundscape(buffer)
        setEcoMetrics(metrics)

        // Music features from simple analysis
        const channelData = buffer.getChannelData(0)
        let rmsSum = 0
        let zcrCount = 0
        for (let i = 0; i < channelData.length; i++) {
          rmsSum += channelData[i] * channelData[i]
          if (i > 0 && ((channelData[i] >= 0) !== (channelData[i - 1] >= 0))) {
            zcrCount++
          }
        }
        const rms = Math.sqrt(rmsSum / channelData.length)
        const zcr = zcrCount / channelData.length

        setFeatures({
          basePitch: Math.max(48, Math.min(84, Math.round(zcr * 1000))),
          energy: Math.min(rms * 10, 1),
          complexity: Math.min(zcr * 10, 1)
        })

        setIsAnalyzing(false)
      } catch (error) {
        console.error('Error:', error)
        alert('Failed to load audio file. Please try a different file.')
        setIsAnalyzing(false)
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

  const togglePlay = async () => {
    if (isPlaying) {
      Tone.getTransport().stop()
      sequenceRef.current?.stop()
      setIsPlaying(false)
    } else {
      await Tone.start()
      sequenceRef.current?.start(0)
      Tone.getTransport().start()
      setIsPlaying(true)
    }
  }

  const stopPlayback = () => {
    Tone.getTransport().stop()
    Tone.getTransport().position = 0
    sequenceRef.current?.stop()
    setIsPlaying(false)
  }

  return (
    <div className="app">
      <header>
        <h1>Data Sonification & Urban Soundscapes</h1>
        <p className="subtitle">Ecoacoustic analysis and generative music from environmental audio</p>
        <p className="badge">APSE Project</p>
      </header>

      {/* Upload Section */}
      <section className="card upload-card">
        <h2>Upload Audio</h2>
        <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
          <div className="upload-icon">&#127925;</div>
          <p>Click to upload an audio file</p>
          <small>WAV, MP3, OGG, FLAC</small>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        {isAnalyzing && <p className="status analyzing">Analyzing...</p>}
        {audioBuffer && !isAnalyzing && (
          <p className="status success">Loaded: {fileName} ({audioBuffer.duration.toFixed(1)}s, {audioBuffer.sampleRate}Hz)</p>
        )}
      </section>

      {/* Tabs */}
      {audioBuffer && (
        <>
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              Ecoacoustic Analysis
            </button>
            <button
              className={`tab ${activeTab === 'music' ? 'active' : ''}`}
              onClick={() => setActiveTab('music')}
            >
              Music Generation
            </button>
          </div>

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="tab-content">
              <Spectrogram audioBuffer={audioBuffer} />
              <EcoacousticMetrics metrics={ecoMetrics} />
            </div>
          )}

          {/* Music Tab */}
          {activeTab === 'music' && features && (
            <div className="tab-content">
              <section className="card">
                <h2>Audio Features</h2>
                <div className="features">
                  <div>
                    <label>Base Pitch</label>
                    <span>{features.basePitch}</span>
                  </div>
                  <div>
                    <label>Energy</label>
                    <span>{(features.energy * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <label>Complexity</label>
                    <span>{(features.complexity * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </section>

              <section className="card">
                <h2>Generative Music Controls</h2>
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
                <div className="controls">
                  <button className="btn-play" onClick={togglePlay}>
                    {isPlaying ? '\u23F8 Pause' : '\u25B6 Play'}
                  </button>
                  <button className="btn-stop" onClick={stopPlayback}>
                    \u23F9 Stop
                  </button>
                  <button className="btn-regen" onClick={() => setFeatures({ ...features })}>
                    Regenerate
                  </button>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      <footer>
        <p>APSE Project &bull; <a href="https://github.com/ApseProjectEU/datasonification" target="_blank" rel="noreferrer">GitHub</a></p>
      </footer>
    </div>
  )
}

export default App
