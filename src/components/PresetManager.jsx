import React, { useState, useEffect } from 'react';

export default function PresetManager({ currentSettings, onLoadPreset }) {
  const [presets, setPresets] = useState([
    {
      name: 'Forest Ambient',
      bpm: 60,
      scale: 'pentatonic',
      reverb: 0.7,
      delay: 0.3,
      filter: 1500
    },
    {
      name: 'Urban Energy',
      bpm: 140,
      scale: 'minor',
      reverb: 0.2,
      delay: 0.6,
      filter: 5000
    },
    {
      name: 'Ocean Waves',
      bpm: 75,
      scale: 'dorian',
      reverb: 0.9,
      delay: 0.4,
      filter: 800
    }
  ]);

  useEffect(() => {
    const saved = localStorage.getItem('datasonification-presets');
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load presets:', e);
      }
    }
  }, []);

  const savePreset = () => {
    const name = prompt('Preset name:');
    if (!name) return;

    const newPreset = {
      name,
      ...currentSettings
    };

    const newPresets = [...presets, newPreset];
    setPresets(newPresets);
    localStorage.setItem('datasonification-presets', JSON.stringify(newPresets));
  };

  const loadPreset = (preset) => {
    onLoadPreset(preset);
  };

  const deletePreset = (index) => {
    if (!confirm('Delete this preset?')) return;
    const newPresets = presets.filter((_, i) => i !== index);
    setPresets(newPresets);
    localStorage.setItem('datasonification-presets', JSON.stringify(newPresets));
  };

  return (
    <div className="preset-manager">
      <h3>Presets</h3>

      <div className="preset-list">
        {presets.map((preset, index) => (
          <div key={index} className="preset-item">
            <span className="preset-name">{preset.name}</span>
            <div className="preset-actions">
              <button onClick={() => loadPreset(preset)}>Load</button>
              {index >= 3 && (
                <button className="delete-btn" onClick={() => deletePreset(index)}>×</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button className="save-preset-btn" onClick={savePreset}>
        💾 Save Current Settings
      </button>
    </div>
  );
}
