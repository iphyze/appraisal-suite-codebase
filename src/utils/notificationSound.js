let audioContext = null;
let soundUnlocked = false;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
};

export const primeNotificationSound = async () => {
  try {
    const context = getAudioContext();
    if (!context) return false;

    if (context.state !== 'running') {
      await context.resume();
    }

    soundUnlocked = context.state === 'running';
    return soundUnlocked;
  } catch (error) {
    return false;
  }
};

export const playNotificationSound = () => {
  try {
    const context = getAudioContext();
    if (!context || !soundUnlocked || context.state !== 'running') return false;

    const now = context.currentTime;
    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    masterGain.connect(context.destination);

    const tones = [
      { frequency: 659.25, start: 0, duration: 0.16 },
      { frequency: 783.99, start: 0.14, duration: 0.22 },
    ];

    tones.forEach(({ frequency, start, duration }) => {
      const oscillator = context.createOscillator();
      const toneGain = context.createGain();
      const startAt = now + start;
      const endAt = startAt + duration;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      toneGain.gain.setValueAtTime(0.0001, startAt);
      toneGain.gain.exponentialRampToValueAtTime(0.9, startAt + 0.01);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      oscillator.connect(toneGain);
      toneGain.connect(masterGain);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    });

    return true;
  } catch (error) {
    return false;
  }
};
