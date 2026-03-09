import { useRef, useEffect } from 'react';
import './Spectrogram.css';

export default function Spectrogram({ audioBuffer }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const fftSize = 1024;
    const hopSize = 256;
    const numFrames = Math.min(800, Math.floor((channelData.length - fftSize) / hopSize));
    const numBins = fftSize / 2;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, width, height);

    const spectrogramData = [];

    for (let frame = 0; frame < numFrames; frame++) {
      const startSample = frame * hopSize;
      const frameSamples = channelData.slice(startSample, startSample + fftSize);

      const windowed = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        windowed[i] = (frameSamples[i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / fftSize));
      }

      const magnitudes = new Float32Array(numBins);
      const step = Math.max(1, Math.floor(fftSize / 128));
      for (let k = 0; k < numBins; k++) {
        let real = 0, imag = 0;
        for (let n = 0; n < fftSize; n += step) {
          const angle = -2 * Math.PI * k * n / fftSize;
          real += windowed[n] * Math.cos(angle);
          imag += windowed[n] * Math.sin(angle);
        }
        magnitudes[k] = Math.sqrt(real * real + imag * imag) * step;
      }

      spectrogramData.push(magnitudes);
    }

    let maxVal = 0;
    for (const frame of spectrogramData) {
      for (const val of frame) {
        if (val > maxVal) maxVal = val;
      }
    }

    const xStep = width / numFrames;
    const yStep = height / numBins;

    for (let x = 0; x < numFrames; x++) {
      for (let y = 0; y < numBins; y++) {
        const value = maxVal > 0 ? spectrogramData[x][y] / maxVal : 0;
        const dB = 20 * Math.log10(Math.max(value, 1e-10));
        const normalized = Math.max(0, Math.min(1, (dB + 60) / 60));

        const r = Math.floor(normalized * 255);
        const g = Math.floor(normalized * normalized * 200);
        const b = Math.floor((1 - normalized) * 100 + normalized * 50);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(
          Math.floor(x * xStep),
          height - Math.floor((y + 1) * yStep),
          Math.ceil(xStep) + 1,
          Math.ceil(yStep) + 1
        );
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px Poppins, sans-serif';
    ctx.fillText(`Duration: ${audioBuffer.duration.toFixed(1)}s`, width - 130, height - 5);
    ctx.fillText(`SR: ${sampleRate}Hz`, width - 130, height - 20);
    ctx.fillText('Time \u2192', width / 2 - 20, height - 5);

    ctx.save();
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Frequency \u2192', 0, 0);
    ctx.restore();

  }, [audioBuffer]);

  return (
    <div className="spectrogram-container">
      <h3>Spectrogram</h3>
      <canvas ref={canvasRef} width={800} height={300} className="spectrogram-canvas" />
      <div className="spectrogram-legend">
        <span>Low Energy</span>
        <div className="gradient-bar" />
        <span>High Energy</span>
      </div>
    </div>
  );
}
