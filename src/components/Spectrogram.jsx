import React, { useEffect, useRef, useState } from 'react';

export default function Spectrogram({ audioBuffer }) {
  const canvasRef = useRef(null);
  const [fftSize, setFftSize] = useState(2048);
  const [colorMap, setColorMap] = useState('viridis');
  const [minDb, setMinDb] = useState(-100);
  const [maxFreq, setMaxFreq] = useState(22050);

  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = 800;
    canvas.height = 400;

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    const bufferLength = fftSize / 2;
    const numWindows = Math.floor(channelData.length / (fftSize / 2));

    // Create scaled canvas for proper display
    const scale = Math.min(canvas.width / numWindows, 1);
    const imageData = ctx.createImageData(Math.min(numWindows, Math.floor(canvas.width / 1)), bufferLength);

    for (let i = 0; i < Math.min(numWindows, Math.floor(canvas.width / 1)); i++) {
      const startSample = i * (fftSize / 2);
      const windowData = channelData.slice(startSample, startSample + fftSize);

      // Simple spectrum calculation
      const spectrum = performSimpleFFT(windowData);

      for (let j = 0; j < bufferLength; j++) {
        const freq = (j / bufferLength) * (sampleRate / 2);
        if (freq > maxFreq) continue;

        const magnitude = spectrum[j];
        const db = 20 * Math.log10(magnitude + 1e-10);
        const normalized = Math.max(0, Math.min(1, (db - minDb) / (0 - minDb)));

        const color = getColorFromMap(normalized, colorMap);
        const pixelIndex = (j * Math.min(numWindows, Math.floor(canvas.width / 1)) + i) * 4;

        if (pixelIndex + 3 < imageData.data.length) {
          imageData.data[pixelIndex] = color.r;
          imageData.data[pixelIndex + 1] = color.g;
          imageData.data[pixelIndex + 2] = color.b;
          imageData.data[pixelIndex + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [audioBuffer, fftSize, colorMap, minDb, maxFreq]);

  const performSimpleFFT = (data) => {
    const n = data.length;
    const spectrum = new Float32Array(n / 2);

    for (let k = 0; k < n / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let i = 0; i < n; i++) {
        const angle = -2 * Math.PI * k * i / n;
        real += data[i] * Math.cos(angle);
        imag += data[i] * Math.sin(angle);
      }

      spectrum[k] = Math.sqrt(real * real + imag * imag) / n;
    }

    return spectrum;
  };

  const getColorFromMap = (value, map) => {
    const colormaps = {
      viridis: [
        { r: 68, g: 1, b: 84 },
        { r: 59, g: 82, b: 139 },
        { r: 33, g: 145, b: 140 },
        { r: 94, g: 201, b: 98 },
        { r: 253, g: 231, b: 37 }
      ],
      magma: [
        { r: 0, g: 0, b: 4 },
        { r: 106, g: 0, b: 168 },
        { r: 214, g: 96, b: 77 },
        { r: 251, g: 252, b: 191 }
      ],
      jet: [
        { r: 0, g: 0, b: 255 },
        { r: 0, g: 255, b: 255 },
        { r: 0, g: 255, b: 0 },
        { r: 255, g: 255, b: 0 },
        { r: 255, g: 0, b: 0 }
      ]
    };

    const colors = colormaps[map] || colormaps.viridis;
    const index = Math.floor(value * (colors.length - 1));
    return colors[Math.min(index, colors.length - 1)];
  };

  return (
    <div className="spectrogram-container">
      <canvas ref={canvasRef} className="spectrogram-canvas" />

      <div className="spectrogram-controls">
        <div className="control-row">
          <label>FFT Size</label>
          <select value={fftSize} onChange={(e) => setFftSize(parseInt(e.target.value))}>
            <option value="512">512</option>
            <option value="1024">1024</option>
            <option value="2048">2048</option>
            <option value="4096">4096</option>
          </select>
        </div>

        <div className="control-row">
          <label>Color Map</label>
          <select value={colorMap} onChange={(e) => setColorMap(e.target.value)}>
            <option value="viridis">Viridis</option>
            <option value="magma">Magma</option>
            <option value="jet">Jet</option>
          </select>
        </div>

        <div className="control-row">
          <label>Min dB: {minDb}</label>
          <input
            type="range"
            min="-120"
            max="-40"
            value={minDb}
            onChange={(e) => setMinDb(parseInt(e.target.value))}
          />
        </div>

        <div className="control-row">
          <label>Max Freq: {maxFreq} Hz</label>
          <input
            type="range"
            min="1000"
            max="22050"
            value={maxFreq}
            onChange={(e) => setMaxFreq(parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
