import React, { useEffect, useRef } from 'react';

export default function Waveform({ audioBuffer, color = '#2ecc71' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.offsetWidth || 800;
    canvas.height = 100;

    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / canvas.width);
    const amp = canvas.height / 2;

    ctx.fillStyle = '#0A2F24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < canvas.width; i++) {
      const start = i * step;
      const end = Math.min((i + 1) * step, channelData.length);
      let min = 0;
      let max = 0;

      for (let j = start; j < end; j++) {
        if (channelData[j] < min) min = channelData[j];
        if (channelData[j] > max) max = channelData[j];
      }

      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }

    ctx.stroke();
  }, [audioBuffer, color]);

  return <canvas ref={canvasRef} className="waveform-canvas" />;
}
