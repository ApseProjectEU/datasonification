import { useState, useRef, useEffect, useCallback } from 'react'
import * as Tone from 'tone'
import './App.css'

function App() {
  const [audioBuffer, setAudioBuffer] = useState(null)
  const [features, setFeatures] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [bpm, setBpm] = useState(90)
  const [status, setStatus] = useState('')
  const fileInputRef = useRef(null)
  const synthRef = useRef(null)
  const sequenceRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    const synth = new Tone.PolySynth(Tone.Synth).toDestination()
    synthRef.current = synth
    return () => synth.dispose()
  }, [])

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm
  }, [bpm])

  const extractFeatures = useCallback((buffer) => {
    const channelData = buffer.getChannelData(0)
    const bufferSize = 2048
    let totalRms = 0
    let totalZcr = 0
    let totalCentroid = 0
    let numFrames = 0

    for (let i = 0; i <= channelData.length - bufferSize; i += bufferSize) {
      const frame = channelData.slice(i, i + bufferSize)

      // RMS
      let sumSq = 0
      for (let j = 0; j < frame.length; j++) sumSq += frame[j] * frame[j]
      const rms = Math.sqrt(sumSq / frame.length)

      // ZCR
      let zcr = 0
      for (let j = 1; j < frame.length; j++) {
        if ((frame[j] >= 0 && frame[j - 1] < 0) || (frame[j] < 0 && frame[j - 1] >= 0)) zcr++
      }

      // Spectral centroid (simple FFT-based approximation)
      let weightedSum = 0, magnitudeSum = 0
      for (let j = 0; j < frame.length; j++) {
        const mag = Math.abs(frame[j])
        weightedSum += j * mag
        magnitudeSum += mag
      }
      const centroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0

      totalRms += rms
      totalZcr += zcr
      totalCentroid += centroid
      numFrames++
    }

    if (numFrames === 0) return null

    const avgRms = totalRms / numFrames
    const avgZcr = totalZcr / numFrames
    const avgCentroid = totalCentroid / numFrames

    return {
      basePitch: Math.max(48, Math.min(84, Math.round(avgCentroid / 20))),
      energy: Math.min(avgRms * 10, 1),
      complexity: Math.min(avgZcr / 100, 1)
    }
  }, [])

  const processAudioBuffer = useCallback(async (arrayBuffer) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const buffer = await audioContext.decodeAudioData(arrayBuffer)
      setAudioBuffer(buffer)

      const extracted = extractFeatures(buffer)
      if (extracted) {
        setFeatures(extracted)
        setStatus('Audio analyzed! Press Play to hear the sonification.')
      } else {
        setStatus('Audio too short to analyze.')
      }
      audioContext.close()
    } catch (error) {
      console.error('Error processing audio:', error)
      setStatus('Failed to process audio: ' + error.message)
    }
  }, [extractFeatures])

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('Loading file...')
    const arrayBuffer = await file.arrayBuffer()
    processAudioBuffer(arrayBuffer)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        setStatus('Processing recording...')
        const arrayBuffer = await blob.arrayBuffer()
        processAudioBuffer(arrayBuffer)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setStatus('Recording... Click Stop to finish.')
    } catch (error) {
      console.error('Microphone error:', error)
      setStatus('Microphone access denied. Please allow microphone access.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  useEffect(() => {
    if (!features || !synthRef.current) return

    const scale = [0, 2, 4, 5, 7, 9, 11]
    const { basePitch, energy } = features
    const sequence = []
    let currentPitch = basePitch

    for (let i = 0; i < 16; i++) {
      if (Math.random() < Math.max(energy, 0.3)) {
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
    if (!isPlaying) {
      await Tone.start()
      sequenceRef.current?.start(0)
      Tone.getTransport().start()
      setIsPlaying(true)
    } else {
      Tone.getTransport().stop()
      sequenceRef.current?.stop()
      setIsPlaying(false)
    }
  }

  const handleStop = () => {
    setIsPlaying(false)
    Tone.getTransport().stop()
    Tone.getTransport().position = 0
    sequenceRef.current?.stop()
  }

  return (
    <div className="app">
      <header>
        <h1>Data Sonification</h1>
        <p>Transform soundscapes into generative music</p>
      </header>

      <main>
        <section className="card">
          <h2>1. Input Audio</h2>

          <div className="input-methods">
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <p>Click to upload a file</p>
              <small>WAV, MP3, OGG, FLAC, WebM</small>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            <div className="record-section">
              {!isRecording ? (
                <button className="record-btn" onClick={startRecording}>
                  Record from Microphone
                </button>
              ) : (
                <button className="record-btn recording" onClick={stopRecording}>
                  Stop Recording
                </button>
              )}
            </div>
          </div>

          {status && <p className="status">{status}</p>}
          {audioBuffer && <p className="status">Audio loaded: {audioBuffer.duration.toFixed(1)}s</p>}
        </section>

        {features && (
          <>
            <section className="card">
              <h2>2. Extracted Parameters</h2>
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
              <h2>4. Sonification Playback</h2>
              <div className="controls">
                <button onClick={togglePlay}>
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button onClick={handleStop}>
                  Stop
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      <footer>
        <p>APSE Project - <a href="https://github.com/ApseProjectEU/datasonification">GitHub</a></p>
      </footer>
    </div>
  )
}

export default App
