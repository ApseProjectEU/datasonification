import React, { useState, useEffect } from 'react';

export default function StepSequencer({ pattern, onPatternChange, voices = 4 }) {
  const steps = 16;
  const [grid, setGrid] = useState(
    Array(voices).fill(null).map(() => Array(steps).fill(false))
  );

  useEffect(() => {
    if (pattern) {
      setGrid(pattern);
    }
  }, [pattern]);

  const toggleStep = (voice, step) => {
    const newGrid = grid.map((row, i) =>
      i === voice
        ? row.map((val, j) => j === step ? !val : val)
        : row
    );
    setGrid(newGrid);
    onPatternChange(newGrid);
  };

  const voiceNames = ['Melody', 'Pad', 'Bass', 'Percussion'];
  const voiceColors = ['#2ecc71', '#3498db', '#e74c3c', '#f39c12'];

  return (
    <div className="step-sequencer">
      <h3>Step Sequencer (16 Steps)</h3>

      <div className="sequencer-grid">
        {grid.map((row, voiceIndex) => (
          <div key={voiceIndex} className="sequencer-row">
            <div
              className="voice-label"
              style={{ backgroundColor: voiceColors[voiceIndex] }}
            >
              {voiceNames[voiceIndex]}
            </div>

            <div className="steps-container">
              {row.map((isActive, stepIndex) => (
                <button
                  key={stepIndex}
                  className={`step ${isActive ? 'active' : ''} ${stepIndex % 4 === 0 ? 'beat' : ''}`}
                  style={isActive ? { backgroundColor: voiceColors[voiceIndex] } : {}}
                  onClick={() => toggleStep(voiceIndex, stepIndex)}
                >
                  {stepIndex + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sequencer-actions">
        <button onClick={() => setGrid(Array(voices).fill(null).map(() => Array(steps).fill(false)))}>
          Clear All
        </button>
        <button onClick={() => {
          const randomGrid = Array(voices).fill(null).map(() =>
            Array(steps).fill(null).map(() => Math.random() < 0.3)
          );
          setGrid(randomGrid);
          onPatternChange(randomGrid);
        }}>
          Randomize
        </button>
      </div>
    </div>
  );
}
