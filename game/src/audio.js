// EMBERFALL — audio.js: every sound is synthesized with WebAudio. No files.
// The context is created lazily and resumed on the first user gesture.
export function createAudio() {
  const audio = {
    ctx: null, master: null, muted: false,
    ensure() {
      if (!this.ctx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.5;
          this.master.connect(this.ctx.destination);
        } catch (e) { /* audio unavailable: stay silent */ }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },
  };
  return audio;
}

function tone(audio, { type = 'sine', freq = 440, freqEnd = null, dur = 0.12, vol = 0.2, delay = 0, attack = 0.005 }) {
  const ctx = audio.ensure();
  if (!ctx || audio.muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain); gain.connect(audio.master);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

function noiseBurst(audio, { dur = 0.2, vol = 0.25, freq = 1200, delay = 0, q = 1 }) {
  const ctx = audio.ensure();
  if (!ctx || audio.muted) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter); filter.connect(gain); gain.connect(audio.master);
  src.start(t0);
}

export const sfx = {
  // Per-tower shot sounds.
  shoot(audio, type) {
    if (type === 'spark') tone(audio, { type: 'square', freq: 880, freqEnd: 620, dur: 0.07, vol: 0.10 });
    else if (type === 'frost') {
      tone(audio, { type: 'sine', freq: 1320, dur: 0.18, vol: 0.08 });
      tone(audio, { type: 'sine', freq: 1390, dur: 0.18, vol: 0.06 });
    } else if (type === 'storm') noiseBurst(audio, { dur: 0.12, vol: 0.16, freq: 3200, q: 0.7 });
  },
  mortarFire(audio) {
    noiseBurst(audio, { dur: 0.22, vol: 0.22, freq: 500, q: 0.8 });
    tone(audio, { type: 'sine', freq: 140, freqEnd: 55, dur: 0.25, vol: 0.22 });
  },
  explosion(audio) {
    noiseBurst(audio, { dur: 0.3, vol: 0.28, freq: 300, q: 0.6 });
    tone(audio, { type: 'sine', freq: 110, freqEnd: 40, dur: 0.3, vol: 0.25 });
  },
  coin(audio) {
    tone(audio, { type: 'sine', freq: 990, dur: 0.09, vol: 0.12 });
    tone(audio, { type: 'sine', freq: 1320, dur: 0.14, vol: 0.12, delay: 0.07 });
  },
  death(audio) { tone(audio, { type: 'triangle', freq: 320, freqEnd: 90, dur: 0.14, vol: 0.14 }); },
  crystalHit(audio) {
    tone(audio, { type: 'sine', freq: 90, freqEnd: 45, dur: 0.35, vol: 0.35 });
    noiseBurst(audio, { dur: 0.15, vol: 0.15, freq: 200, q: 1 });
  },
  waveHorn(audio) {
    tone(audio, { type: 'sawtooth', freq: 196, freqEnd: 392, dur: 0.7, vol: 0.14, attack: 0.15 });
    tone(audio, { type: 'sawtooth', freq: 294, freqEnd: 392, dur: 0.7, vol: 0.08, attack: 0.15 });
  },
  build(audio) { tone(audio, { type: 'triangle', freq: 520, freqEnd: 780, dur: 0.12, vol: 0.12 }); },
  upgrade(audio) {
    tone(audio, { type: 'triangle', freq: 520, dur: 0.1, vol: 0.12 });
    tone(audio, { type: 'triangle', freq: 660, dur: 0.1, vol: 0.12, delay: 0.08 });
    tone(audio, { type: 'triangle', freq: 880, dur: 0.16, vol: 0.12, delay: 0.16 });
  },
  error(audio) { tone(audio, { type: 'square', freq: 160, dur: 0.12, vol: 0.1 }); },
  click(audio) { tone(audio, { type: 'sine', freq: 700, dur: 0.05, vol: 0.08 }); },
  victory(audio) {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(audio, { type: 'triangle', freq: f, dur: 0.28, vol: 0.14, delay: i * 0.14 }));
  },
  defeat(audio) {
    [392, 370, 330, 262].forEach((f, i) =>
      tone(audio, { type: 'triangle', freq: f, dur: 0.35, vol: 0.14, delay: i * 0.18 }));
  },
};
