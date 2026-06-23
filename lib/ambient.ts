// Synthesized beach ambience — filtered noise "waves" with a slow swell.
// No audio file (keeps the app light). Returns a stop() function.

export function startAmbient(): () => void {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctx();

  // ~2s of looping white noise.
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;

  // Lowpass → soft surf rather than hiss.
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 480;

  const gain = ctx.createGain();
  gain.gain.value = 0.06;

  // Slow LFO swells the volume like rolling waves.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.12;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain).connect(gain.gain);

  noise.connect(lp).connect(gain).connect(ctx.destination);
  noise.start();
  lfo.start();

  return () => {
    try {
      noise.stop();
      lfo.stop();
      ctx.close();
    } catch {
      /* already stopped */
    }
  };
}
