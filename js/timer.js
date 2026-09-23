/**
 * OmniDesk Precision Timer Module
 * Handles countdown, background-tab drift protection, title alerts, and alarm ringing.
 */

class TimerModule {
  constructor() {
    this.totalSeconds = 25 * 60; // Default 25 min Pomodoro
    this.remainingSeconds = this.totalSeconds;
    this.state = 'IDLE'; // IDLE, RUNNING, PAUSED, RINGING
    this.targetEndTime = null;
    this.tickInterval = null;
    this.titleBlinkInterval = null;
    this.originalTitle = document.title;
    this.circumference = 2 * Math.PI * 135; // r = 135

    // DOM Elements (assigned on init)
    this.digitsEl = null;
    this.sublabelEl = null;
    this.progressCircle = null;
    this.startBtn = null;
    this.pauseBtn = null;
    this.resetBtn = null;
    this.presetChips = [];
    this.inputHours = null;
    this.inputMinutes = null;
    this.inputSeconds = null;
    this.soundSelect = null;
    this.volumeSlider = null;
    this.testSoundBtn = null;
    this.ringingOverlay = null;
    this.stopAlarmBtn = null;
  }

  init() {
    // Bind DOM elements
    this.digitsEl = document.getElementById('timerDigits');
    this.sublabelEl = document.getElementById('timerSublabel');
    this.progressCircle = document.getElementById('timerCircleProgress');
    this.startBtn = document.getElementById('timerStartBtn');
    this.pauseBtn = document.getElementById('timerPauseBtn');
    this.resetBtn = document.getElementById('timerResetBtn');
    this.inputHours = document.getElementById('timerInputHours');
    this.inputMinutes = document.getElementById('timerInputMinutes');
    this.inputSeconds = document.getElementById('timerInputSeconds');
    this.soundSelect = document.getElementById('timerSoundSelect');
    this.volumeSlider = document.getElementById('timerVolumeSlider');
    this.testSoundBtn = document.getElementById('testSoundBtn');
    this.ringingOverlay = document.getElementById('ringingOverlay');
    this.stopAlarmBtn = document.getElementById('stopAlarmBtn');

    if (this.progressCircle) {
      this.progressCircle.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
      this.progressCircle.style.strokeDashoffset = '0';
    }

    this.bindEvents();
    this.updateDisplay();

    // Check notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => {
        Notification.requestPermission();
      }, 3000);
    }
  }

  bindEvents() {
    // Primary Controls
    this.startBtn?.addEventListener('click', () => {
      window.soundEngine.init();
      this.start();
    });

    this.pauseBtn?.addEventListener('click', () => this.pause());
    this.resetBtn?.addEventListener('click', () => this.reset());

    // Stop Alarm from Ringing Overlay
    this.stopAlarmBtn?.addEventListener('click', () => this.dismissAlarm());

    // Preset chips
    const chips = document.querySelectorAll('.preset-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const minutes = parseInt(chip.dataset.minutes, 10);
        this.setCustomDuration(0, minutes, 0);
      });
    });

    // Custom time input fields
    const handleTimeChange = () => {
      const h = parseInt(this.inputHours?.value || 0, 10);
      const m = parseInt(this.inputMinutes?.value || 0, 10);
      const s = parseInt(this.inputSeconds?.value || 0, 10);
      this.setCustomDuration(h, m, s);
    };

    this.inputHours?.addEventListener('change', handleTimeChange);
    this.inputMinutes?.addEventListener('change', handleTimeChange);
    this.inputSeconds?.addEventListener('change', handleTimeChange);

    // Sound selection
    this.soundSelect?.addEventListener('change', (e) => {
      window.soundEngine.setTone(e.target.value);
    });

    this.volumeSlider?.addEventListener('input', (e) => {
      window.soundEngine.setVolume(e.target.value);
    });

    this.testSoundBtn?.addEventListener('click', () => {
      window.soundEngine.init();
      window.soundEngine.testSound(this.soundSelect?.value || 'digital');
    });

    // Spacebar shortcut to Start / Pause timer when on timer view
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.getElementById('view-timer')?.classList.contains('active')) {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (this.state === 'RINGING') {
            this.dismissAlarm();
          } else if (this.state === 'RUNNING') {
            this.pause();
          } else {
            this.start();
          }
        }
      }
    });
  }

  setCustomDuration(hours, minutes, seconds) {
    const total = (hours * 3600) + (minutes * 60) + seconds;
    if (total <= 0) return;
    this.totalSeconds = total;
    this.remainingSeconds = total;
    if (this.state === 'RUNNING') {
      this.pause();
    }
    this.state = 'IDLE';
    this.updateDisplay();
    this.syncInputBoxes();
  }

  syncInputBoxes() {
    const h = Math.floor(this.totalSeconds / 3600);
    const m = Math.floor((this.totalSeconds % 3600) / 60);
    const s = this.totalSeconds % 60;
    if (this.inputHours) this.inputHours.value = h.toString().padStart(2, '0');
    if (this.inputMinutes) this.inputMinutes.value = m.toString().padStart(2, '0');
    if (this.inputSeconds) this.inputSeconds.value = s.toString().padStart(2, '0');
  }

  start() {
    if (this.state === 'RUNNING') return;

    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = this.totalSeconds;
    }

    this.state = 'RUNNING';
    this.targetEndTime = Date.now() + (this.remainingSeconds * 1000);

    // Update UI controls
    if (this.startBtn) this.startBtn.style.display = 'none';
    if (this.pauseBtn) this.pauseBtn.style.display = 'inline-flex';
    if (this.sublabelEl) this.sublabelEl.textContent = 'RUNNING';

    // Precision tick loop (evaluates actual wall-clock delta to prevent background tab lag)
    clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => this.tick(), 150);
    this.tick();
  }

  pause() {
    if (this.state !== 'RUNNING') return;
    this.state = 'PAUSED';
    clearInterval(this.tickInterval);

    if (this.startBtn) {
      this.startBtn.style.display = 'inline-flex';
      this.startBtn.textContent = 'Resume';
    }
    if (this.pauseBtn) this.pauseBtn.style.display = 'none';
    if (this.sublabelEl) this.sublabelEl.textContent = 'PAUSED';

    document.title = `(Paused) ${this.formatTime(this.remainingSeconds)} - Timer`;
  }

  reset() {
    this.state = 'IDLE';
    clearInterval(this.tickInterval);
    this.dismissAlarm();

    this.remainingSeconds = this.totalSeconds;
    if (this.startBtn) {
      this.startBtn.style.display = 'inline-flex';
      this.startBtn.textContent = 'Start';
    }
    if (this.pauseBtn) this.pauseBtn.style.display = 'none';
    if (this.sublabelEl) this.sublabelEl.textContent = 'READY';

    document.title = 'OmniDesk - Personal Utility Suite';
    this.updateDisplay();
  }

  tick() {
    const now = Date.now();
    const millisLeft = this.targetEndTime - now;
    const secondsLeft = Math.max(0, Math.ceil(millisLeft / 1000));

    this.remainingSeconds = secondsLeft;
    this.updateDisplay();

    // Tab Title live update
    const timeFormatted = this.formatTime(this.remainingSeconds);
    document.title = `(${timeFormatted}) ⏳ Timer - OmniDesk`;

    if (secondsLeft <= 0) {
      clearInterval(this.tickInterval);
      this.onFinish();
    }
  }

  onFinish() {
    this.state = 'RINGING';
    this.remainingSeconds = 0;
    this.updateDisplay();

    // 1. Play continuous Web Audio Alarm
    const tone = this.soundSelect?.value || 'digital';
    window.soundEngine.startAlarmLoop(tone);

    // 2. Show Ringing Modal Overlay
    if (this.ringingOverlay) {
      this.ringingOverlay.classList.add('active');
    }

    // 3. Tab Alert Animation (Blinking Title)
    let blinkToggle = false;
    clearInterval(this.titleBlinkInterval);
    this.titleBlinkInterval = setInterval(() => {
      document.title = blinkToggle ? '⏰ TIME\'S UP! ⏰' : '🔔 (00:00:00) Ringing!';
      blinkToggle = !blinkToggle;
    }, 600);

    // 4. Desktop Web Notification (if permission was granted)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('⏰ OmniDesk Timer Complete!', {
          body: 'Your fixed timer has finished! Click to dismiss.',
          icon: './icons/icon-192.svg'
        });
      } catch (e) {}
    }

    if (this.sublabelEl) this.sublabelEl.textContent = "TIME'S UP!";
    if (this.startBtn) {
      this.startBtn.style.display = 'inline-flex';
      this.startBtn.textContent = 'Restart';
    }
    if (this.pauseBtn) this.pauseBtn.style.display = 'none';
  }

  dismissAlarm() {
    window.soundEngine.stopAlarm();
    clearInterval(this.titleBlinkInterval);
    document.title = 'OmniDesk - Personal Utility Suite';

    if (this.ringingOverlay) {
      this.ringingOverlay.classList.remove('active');
    }

    if (this.state === 'RINGING') {
      this.state = 'IDLE';
      this.remainingSeconds = this.totalSeconds;
      if (this.sublabelEl) this.sublabelEl.textContent = 'READY';
      this.updateDisplay();
    }
  }

  updateDisplay() {
    if (this.digitsEl) {
      this.digitsEl.textContent = this.formatTime(this.remainingSeconds);
    }

    // SVG Progress Bar
    if (this.progressCircle && this.totalSeconds > 0) {
      const progressFraction = this.remainingSeconds / this.totalSeconds;
      const offset = this.circumference * (1 - progressFraction);
      this.progressCircle.style.strokeDashoffset = offset.toString();

      // Color indication when low
      if (this.remainingSeconds <= 10 && this.remainingSeconds > 0) {
        this.progressCircle.classList.add('danger');
        this.progressCircle.classList.remove('warning');
      } else if (this.remainingSeconds <= 60 && this.remainingSeconds > 10) {
        this.progressCircle.classList.add('warning');
        this.progressCircle.classList.remove('danger');
      } else {
        this.progressCircle.classList.remove('warning', 'danger');
      }
    }
  }

  formatTime(totalSec) {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const pad = (n) => n.toString().padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }
}

// Global Timer
window.timerModule = new TimerModule();
