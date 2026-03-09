export function calculateACI(audioBuffer, options = {}) {
  const { fftSize = 512, hopSize = 256, minFreq = 0, maxFreq = 11025 } = options;
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = Math.floor((channelData.length - fftSize) / hopSize);
  const freqBins = fftSize / 2;

  let totalACI = 0;
  let validBins = 0;

  for (let bin = 0; bin < freqBins; bin++) {
    const freq = (bin / freqBins) * (sampleRate / 2);
    if (freq < minFreq || freq > maxFreq) continue;

    let intensities = [];
    for (let frame = 0; frame < numFrames; frame++) {
      const startSample = frame * hopSize;
      const frameSamples = channelData.slice(startSample, startSample + fftSize);
      const rms = Math.sqrt(frameSamples.reduce((sum, val) => sum + val * val, 0) / frameSamples.length);
      intensities.push(rms);
    }

    let differences = 0;
    for (let i = 1; i < intensities.length; i++) {
      differences += Math.abs(intensities[i] - intensities[i - 1]);
    }

    const sumIntensities = intensities.reduce((a, b) => a + b, 0);
    if (sumIntensities > 0) {
      totalACI += differences / sumIntensities;
      validBins++;
    }
  }

  return validBins > 0 ? totalACI / validBins : 0;
}

export function calculateADI(audioBuffer, options = {}) {
  const { numBands = 10, minFreq = 0, maxFreq = 11025 } = options;
  const channelData = audioBuffer.getChannelData(0);
  const fftSize = 2048;
  const bandEnergies = new Array(numBands).fill(0);
  const numSamples = Math.floor(channelData.length / fftSize);

  for (let i = 0; i < numSamples; i++) {
    const startSample = i * fftSize;
    const frameSamples = channelData.slice(startSample, startSample + fftSize);

    for (let band = 0; band < numBands; band++) {
      const bandStart = Math.floor((band / numBands) * fftSize);
      const bandEnd = Math.floor(((band + 1) / numBands) * fftSize);
      const bandSamples = frameSamples.slice(bandStart, bandEnd);
      const energy = Math.sqrt(bandSamples.reduce((sum, val) => sum + val * val, 0) / bandSamples.length);
      bandEnergies[band] += energy;
    }
  }

  const totalEnergy = bandEnergies.reduce((a, b) => a + b, 0);
  if (totalEnergy === 0) return 0;

  const proportions = bandEnergies.map(e => e / totalEnergy);
  let entropy = 0;
  for (let p of proportions) {
    if (p > 0) entropy -= p * Math.log(p);
  }

  return entropy / Math.log(numBands);
}

function calculateBandEnergy(audioBuffer, minFreq, maxFreq) {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const nyquist = sampleRate / 2;
  const fftSize = 2048;
  const numFrames = Math.floor(channelData.length / fftSize);

  let energy = 0;
  const minBin = Math.floor((minFreq / nyquist) * (fftSize / 2));
  const maxBin = Math.floor((maxFreq / nyquist) * (fftSize / 2));

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * fftSize;
    const frameSamples = channelData.slice(start, start + fftSize);
    for (let i = minBin; i < maxBin && i < frameSamples.length; i++) {
      energy += frameSamples[i] * frameSamples[i];
    }
  }

  return Math.sqrt(energy / Math.max(1, numFrames * (maxBin - minBin)));
}

export function analyzeUrbanSoundscape(audioBuffer) {
  const aci = calculateACI(audioBuffer, { minFreq: 500, maxFreq: 8000 });
  const adi = calculateADI(audioBuffer, { numBands: 10, minFreq: 200, maxFreq: 12000 });

  const lowFreqEnergy = calculateBandEnergy(audioBuffer, 0, 500);
  const midFreqEnergy = calculateBandEnergy(audioBuffer, 500, 4000);
  const highFreqEnergy = calculateBandEnergy(audioBuffer, 4000, 12000);
  const totalEnergy = lowFreqEnergy + midFreqEnergy + highFreqEnergy;

  return {
    aci: aci.toFixed(3),
    adi: adi.toFixed(3),
    geophony: totalEnergy > 0 ? ((lowFreqEnergy / totalEnergy) * 100).toFixed(1) : '0.0',
    biophony: totalEnergy > 0 ? ((midFreqEnergy / totalEnergy) * 100).toFixed(1) : '0.0',
    anthropophony: totalEnergy > 0 ? ((highFreqEnergy / totalEnergy) * 100).toFixed(1) : '0.0',
    complexity: aci > 0.5 ? 'High' : aci > 0.3 ? 'Medium' : 'Low',
    diversity: adi > 0.7 ? 'High' : adi > 0.4 ? 'Medium' : 'Low'
  };
}
