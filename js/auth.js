/**
 * OmniDesk Security & Authentication Manager
 * Master Password / PIN Lock with AES-256-GCM End-to-End Encryption
 * Uses browser-native Web Crypto API (PBKDF2 with 100,000 iterations).
 */

class AuthManager {
  constructor() {
    this.isUnlocked = false;
    this.activeKey = null;
    this.authConfig = {
      enabled: false,
      salt: null,
      verifier: null, // Encrypted "OMNIDESK_VALID"
      autoLockMinutes: 15 // 0 = never
    };
    this.inactivityTimer = null;
    this.magicCheckPhrase = 'OMNIDESK_VAULT_OK';
    this.listeners = new Map();
  }

  async init() {
    // Load auth config from localStorage
    try {
      const saved = localStorage.getItem('omnidesk_auth_config');
      if (saved) {
        this.authConfig = { ...this.authConfig, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not read auth config:', e);
    }

    this.bindDOM();
    this.setupInactivityListener();

    if (this.authConfig.enabled && this.authConfig.verifier) {
      // Lock is enabled -> prompt login
      this.isUnlocked = false;
      this.showLockScreen(true, false);
    } else {
      // No lock set yet -> unlocked by default
      this.isUnlocked = true;
      this.showLockScreen(false);
    }

    this.updateSecuritySettingsUI();
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(cb);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  // Cryptographic Helpers
  async deriveKey(password, saltUint8) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltUint8,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptWithKey(key, plaintext) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = enc.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    // Return combined Base64 string: IV (12 bytes) + Ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decryptWithKey(key, base64String) {
    const binary = atob(base64String);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  // Set up / Change Password
  async setMasterPassword(newPassword) {
    if (!newPassword || newPassword.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltBase64 = btoa(String.fromCharCode(...salt));
    const key = await this.deriveKey(newPassword, salt);
    const verifier = await this.encryptWithKey(key, this.magicCheckPhrase);

    this.authConfig.enabled = true;
    this.authConfig.salt = saltBase64;
    this.authConfig.verifier = verifier;
    this.saveConfig();

    this.activeKey = key;
    this.isUnlocked = true;
    this.showLockScreen(false);
    this.resetInactivityTimer();
    this.emit('unlocked');
    return true;
  }

  // Unlock with Password
  async unlock(password) {
    if (!this.authConfig.enabled || !this.authConfig.verifier) {
      this.isUnlocked = true;
      this.showLockScreen(false);
      return true;
    }

    try {
      const saltBinary = atob(this.authConfig.salt);
      const salt = new Uint8Array(saltBinary.length);
      for (let i = 0; i < saltBinary.length; i++) salt[i] = saltBinary.charCodeAt(i);

      const candidateKey = await this.deriveKey(password, salt);
      const decrypted = await this.decryptWithKey(candidateKey, this.authConfig.verifier);

      if (decrypted === this.magicCheckPhrase) {
        this.activeKey = candidateKey;
        this.isUnlocked = true;
        this.showLockScreen(false);
        this.resetInactivityTimer();
        this.emit('unlocked');
        return true;
      } else {
        throw new Error('Incorrect password');
      }
    } catch (e) {
      throw new Error('Incorrect password. Please try again.');
    }
  }

  // Lock App
  lock() {
    if (!this.authConfig.enabled) return;
    this.isUnlocked = false;
    this.activeKey = null;
    clearTimeout(this.inactivityTimer);
    this.showLockScreen(true, false);
    this.emit('locked');
  }

  // Disable password protection
  disablePassword(currentPassword) {
    return this.unlock(currentPassword).then(() => {
      this.authConfig.enabled = false;
      this.authConfig.salt = null;
      this.authConfig.verifier = null;
      this.saveConfig();
      this.activeKey = null;
      this.isUnlocked = true;
      this.showLockScreen(false);
      this.updateSecuritySettingsUI();
      return true;
    });
  }

  saveConfig() {
    localStorage.setItem('omnidesk_auth_config', JSON.stringify(this.authConfig));
    this.updateSecuritySettingsUI();
  }

  // Public encryption wrapper for storage.js
  async encryptData(data) {
    if (!this.authConfig.enabled || !this.activeKey) {
      return data; // Return unencrypted if lock not set
    }
    const jsonStr = JSON.stringify(data);
    const encString = await this.encryptWithKey(this.activeKey, jsonStr);
    return `ENC:${encString}`;
  }

  async decryptData(data) {
    if (typeof data !== 'string' || !data.startsWith('ENC:')) {
      return data; // Plain object or not encrypted
    }
    if (!this.activeKey) {
      console.warn('Cannot decrypt: app is locked');
      return null;
    }
    const cipherStr = data.substring(4);
    const decryptedJson = await this.decryptWithKey(this.activeKey, cipherStr);
    return JSON.parse(decryptedJson);
  }

  // Inactivity tracking
  setupInactivityListener() {
    const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    const handler = () => {
      if (this.isUnlocked && this.authConfig.enabled && this.authConfig.autoLockMinutes > 0) {
        this.resetInactivityTimer();
      }
    };

    events.forEach(ev => window.addEventListener(ev, handler, { passive: true }));
  }

  resetInactivityTimer() {
    clearTimeout(this.inactivityTimer);
    if (!this.authConfig.enabled || this.authConfig.autoLockMinutes <= 0) return;

    this.inactivityTimer = setTimeout(() => {
      if (this.isUnlocked) {
        console.log('Auto-locking OmniDesk due to inactivity');
        this.lock();
        window.app?.showToast('OmniDesk locked due to inactivity', 'info');
      }
    }, this.authConfig.autoLockMinutes * 60 * 1000);
  }

  // DOM Binding
  bindDOM() {
    const unlockBtn = document.getElementById('authUnlockBtn');
    const pwdInput = document.getElementById('authPasswordInput');
    const setupBtn = document.getElementById('authSetupBtn');
    const lockHeaderBtn = document.getElementById('headerLockBtn');
    const toggleEyeBtn = document.getElementById('authToggleEye');

    unlockBtn?.addEventListener('click', () => this.handleUnlockAttempt());
    pwdInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (this.authConfig.enabled) {
          this.handleUnlockAttempt();
        } else {
          this.handleSetupAttempt();
        }
      }
    });

    setupBtn?.addEventListener('click', () => this.handleSetupAttempt());
    lockHeaderBtn?.addEventListener('click', () => {
      if (this.authConfig.enabled) {
        this.lock();
      } else {
        // Prompt to enable lock
        this.showLockScreen(true, true);
      }
    });

    // Password visibility toggle
    toggleEyeBtn?.addEventListener('click', () => {
      if (pwdInput) {
        pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
        toggleEyeBtn.textContent = pwdInput.type === 'password' ? '👁' : '🙈';
      }
    });

    // Security Settings Form in Settings Modal
    const enableLockToggle = document.getElementById('secEnableLockToggle');
    const autoLockSelect = document.getElementById('secAutoLockSelect');
    const changePwdBtn = document.getElementById('secChangePwdBtn');

    enableLockToggle?.addEventListener('change', (e) => {
      if (e.target.checked) {
        window.app?.closeSyncModal();
        this.showLockScreen(true, true);
      } else {
        const pwd = prompt('Enter current Master Password to disable lock:');
        if (pwd) {
          this.disablePassword(pwd)
            .then(() => window.app?.showToast('Password protection disabled', 'info'))
            .catch(err => {
              alert(err.message);
              e.target.checked = true;
            });
        } else {
          e.target.checked = true;
        }
      }
    });

    autoLockSelect?.addEventListener('change', (e) => {
      this.authConfig.autoLockMinutes = parseInt(e.target.value, 10);
      this.saveConfig();
      this.resetInactivityTimer();
      window.app?.showToast('Auto-lock timeout updated', 'success');
    });

    changePwdBtn?.addEventListener('click', () => {
      window.app?.closeSyncModal();
      this.showLockScreen(true, true);
    });
  }

  showLockScreen(show, isSetup = false) {
    const screen = document.getElementById('authLockScreen');
    const unlockContainer = document.getElementById('authUnlockGroup');
    const setupContainer = document.getElementById('authSetupGroup');
    const titleEl = document.getElementById('authScreenTitle');
    const descEl = document.getElementById('authScreenDesc');
    const pwdInput = document.getElementById('authPasswordInput');
    const headerLockBtn = document.getElementById('headerLockBtn');

    if (!screen) return;

    if (show) {
      screen.classList.add('active');
      if (pwdInput) {
        pwdInput.value = '';
        setTimeout(() => pwdInput.focus(), 100);
      }

      const confirmWrapper = document.getElementById('authConfirmWrapper');

      if (isSetup || !this.authConfig.enabled) {
        // Setup Mode
        if (unlockContainer) unlockContainer.style.display = 'none';
        if (setupContainer) setupContainer.style.display = 'flex';
        if (confirmWrapper) confirmWrapper.style.display = 'block';
        if (titleEl) titleEl.textContent = 'Set Master Password';
        if (descEl) descEl.textContent = 'Create a secure Master Password or PIN to encrypt and protect your private notes & journals.';
      } else {
        // Unlock Mode
        if (unlockContainer) unlockContainer.style.display = 'flex';
        if (setupContainer) setupContainer.style.display = 'none';
        if (confirmWrapper) confirmWrapper.style.display = 'none';
        if (titleEl) titleEl.textContent = 'OmniDesk Locked';
        if (descEl) descEl.textContent = 'Enter your Master Password or PIN to unlock your productivity workspace.';
      }
    } else {
      screen.classList.remove('active');
    }

    if (headerLockBtn) {
      headerLockBtn.title = this.authConfig.enabled ? 'Lock App Now' : 'Set Password Protection';
    }
  }

  async handleUnlockAttempt() {
    const pwdInput = document.getElementById('authPasswordInput');
    const card = document.querySelector('.auth-card');
    const errorMsg = document.getElementById('authErrorMsg');
    const password = (pwdInput?.value || '').trim();

    if (!password) {
      if (errorMsg) errorMsg.textContent = 'Please enter your password.';
      return;
    }

    try {
      if (errorMsg) errorMsg.textContent = '';
      await this.unlock(password);
      window.app?.showToast('Welcome back! Workspace unlocked.', 'success');
    } catch (err) {
      if (errorMsg) errorMsg.textContent = err.message;
      if (card) {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 500);
      }
    }
  }

  async handleSetupAttempt() {
    const pwdInput = document.getElementById('authPasswordInput');
    const confirmInput = document.getElementById('authPasswordConfirm');
    const errorMsg = document.getElementById('authErrorMsg');

    const p1 = (pwdInput?.value || '').trim();
    const p2 = (confirmInput?.value || '').trim();

    if (p1.length < 4) {
      if (errorMsg) errorMsg.textContent = 'Password must be at least 4 characters long.';
      return;
    }
    if (p1 !== p2) {
      if (errorMsg) errorMsg.textContent = 'Passwords do not match. Please re-enter.';
      return;
    }

    try {
      await this.setMasterPassword(p1);
      if (errorMsg) errorMsg.textContent = '';
      window.app?.showToast('Master password set! AES-256 encryption active.', 'success');
    } catch (err) {
      if (errorMsg) errorMsg.textContent = err.message;
    }
  }

  updateSecuritySettingsUI() {
    const enableLockToggle = document.getElementById('secEnableLockToggle');
    const autoLockSelect = document.getElementById('secAutoLockSelect');
    const changePwdBtn = document.getElementById('secChangePwdBtn');
    const lockStatusBadge = document.getElementById('secLockStatusBadge');

    if (enableLockToggle) enableLockToggle.checked = !!this.authConfig.enabled;
    if (autoLockSelect) autoLockSelect.value = (this.authConfig.autoLockMinutes || 15).toString();
    if (changePwdBtn) changePwdBtn.style.display = this.authConfig.enabled ? 'inline-flex' : 'none';
    if (lockStatusBadge) {
      lockStatusBadge.textContent = this.authConfig.enabled ? 'Active (AES-256)' : 'Disabled';
      lockStatusBadge.style.color = this.authConfig.enabled ? 'var(--accent-green)' : 'var(--text-muted)';
    }
  }
}

// Global Auth Manager
window.authManager = new AuthManager();
