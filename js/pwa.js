/**
 * OmniDesk PWA Controller
 * Handles Service Worker registration, offline indicators, and "Add to Home Screen" installation.
 */

class PWAController {
  constructor() {
    this.deferredPrompt = null;
    this.installBtn = null;
  }

  init() {
    this.installBtn = document.getElementById('pwaInstallBtn');

    // 1. Register Service Worker for offline capability
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('ServiceWorker registered with scope:', registration.scope);
          })
          .catch((error) => {
            console.warn('ServiceWorker registration failed:', error);
          });
      });
    }

    // 2. Capture PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (this.installBtn) {
        this.installBtn.style.display = 'inline-flex';
      }
    });

    this.installBtn?.addEventListener('click', async () => {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        const choiceResult = await this.deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
          if (this.installBtn) this.installBtn.style.display = 'none';
        }
        this.deferredPrompt = null;
      } else {
        alert('To install on iOS: Tap Share (square with arrow) -> "Add to Home Screen"');
      }
    });

    // 3. Online / Offline status indicator
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
    this.updateOnlineStatus(navigator.onLine);
  }

  updateOnlineStatus(isOnline) {
    const dot = document.getElementById('globalStatusDot');
    const label = document.getElementById('globalStatusLabel');

    if (dot) {
      dot.className = `status-dot ${isOnline ? '' : 'offline'}`;
    }
    if (label) {
      label.textContent = isOnline ? 'Online' : 'Offline Mode';
    }
  }
}

// Global PWA instance
window.pwaController = new PWAController();
