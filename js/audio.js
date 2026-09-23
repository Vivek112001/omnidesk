/**
 * Web Audio API Alarm Synthesizer for OmniDesk Timer
 * Zero external audio dependencies, no 404s, works reliably across browsers.
 */

class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.isRinging = false;
    this.ringInterval = null;
    this.masterVolume = 0.8;
    this.selectedTone = 'digital';
    this.activeNodes = [];
  }

  // Initialize AudioContext upon user gesture (browser autoplay policy)
  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, parseFloat(volume)));
  }

  setTone(tone) {
    this.selectedTone = tone;
  }

  // Generate tone burst
  playTone(frequency, type = 'sine', duration = 0.15, startTimeOffset = 0, gainLevel = 0.5) {
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime + startTimeOffset;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gainLevel * this.masterVolume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.05);

      this.activeNodes.push(osc);
      osc.onended = () => {
        const idx = this.activeNodes.indexOf(osc);
        if (idx > -1) this.activeNodes.splice(idx, 1);
      };
    } catch (e) {
      console.warn('Audio tone play error:', e);
    }
  }

  // Sound Profiles
  playDigitalPattern() {
    // Classic 4-beep alarm pulse: Beep-Beep-Beep-Beep
    const freq = 1046; // C6 note
    this.playTone(freq, 'square', 0.1, 0.0, 0.35);
    this.playTone(freq, 'square', 0.1, 0.15, 0.35);
    this.playTone(freq, 'square', 0.1, 0.30, 0.35);
    this.playTone(freq * 1.25, 'square', 0.18, 0.45, 0.4);
  }

  playBellPattern() {
    // Harmonic bell with natural chime decay
    const harmonics = [523.25, 783.99, 1046.5, 1318.5]; // C5, G5, C6, E6
    harmonics.forEach((f, idx) => {
      this.playTone(f, 'sine', 0.65 - (idx * 0.1), idx * 0.04, 0.35 / (idx + 1));
    });
  }

  playChimePattern() {
    // Ascending melody: C5 -> E5 -> G5 -> C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'triangle', 0.3, idx * 0.12, 0.4);
    });
  }

  playGongPattern() {
    // Deep resonant gong
    this.playTone(220, 'sine', 1.2, 0.0, 0.5);
    this.playTone(440, 'triangle', 0.8, 0.05, 0.3);
  }

  // Play a single cycle of the current tone
  playCycle(toneName = this.selectedTone) {
    switch (toneName) {
      case 'bell':
        this.playBellPattern();
        break;
      case 'chime':
        this.playChimePattern();
        break;
      case 'gong':
        this.playGongPattern();
        break;
      case 'digital':
      default:
        this.playDigitalPattern();
        break;
    }
  }

  // Continuous loop ringing until manually stopped
  startAlarmLoop(toneName = this.selectedTone) {
    this.stopAlarm();
    this.init();
    this.isRinging = true;

    // Immediately play first burst
    this.playCycle(toneName);

    // Repeat loop every 1.4 seconds
    this.ringInterval = setInterval(() => {
      if (this.isRinging) {
        this.playCycle(toneName);
      }
    }, 1400);
  }

  // Stop alarm immediately
  stopAlarm() {
    this.isRinging = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }

    // Stop any active oscillators
    this.activeNodes.forEach(node => {
      try {
        node.stop();
      } catch (e) {}
    });
    this.activeNodes = [];
  }

  // Preview test sound
  testSound(toneName = this.selectedTone) {
    this.init();
    this.playCycle(toneName);
  }
}

// Global Sound Engine
window.soundEngine = new SoundEngine();
