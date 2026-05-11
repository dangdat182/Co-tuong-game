let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    if (!_ctx) _ctx = new AudioContext();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  } catch { return null; }
}

function tone(
  freq: number, dur: number,
  type: OscillatorType = 'sine', vol = 0.25, delay = 0,
) {
  if (isMuted()) return;
  const c = ctx();
  if (!c) return;
  try {
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = c.currentTime + delay;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + Math.max(dur, 0.05));
    osc.start(t0);
    osc.stop(t0 + dur + 0.06);
  } catch { /* ignore */ }
}

export function isMuted(): boolean {
  return localStorage.getItem('sound_muted') === 'true';
}
export function toggleMute(): boolean {
  const next = !isMuted();
  localStorage.setItem('sound_muted', String(next));
  return next;
}

export const sounds = {
  move()    { tone(700,  0.07, 'square',   0.15); },
  capture() { tone(280,  0.12, 'sawtooth', 0.22);
              tone(420,  0.08, 'sawtooth', 0.15, 0.06); },
  check()   { tone(900,  0.11, 'square',   0.28);
              tone(680,  0.11, 'square',   0.22, 0.15); },
  win()     { [523,659,784,1047].forEach((f,i) => tone(f, 0.28, 'sine', 0.30, i*0.15)); },
  lose()    { [523,440,349,262].forEach((f,i) => tone(f, 0.38, 'sine', 0.25, i*0.19)); },
  draw()    { [523,523,659,523].forEach((f,i) => tone(f, 0.22, 'sine', 0.25, i*0.18)); },
  tick()    { tone(550,  0.04, 'square',   0.10); },
  chat()    { tone(880,  0.06, 'sine',     0.12); tone(1100, 0.06, 'sine', 0.10, 0.07); },
  drawOffer(){ tone(660, 0.15, 'sine',     0.25); tone(880,  0.15, 'sine', 0.20, 0.18); },
};
