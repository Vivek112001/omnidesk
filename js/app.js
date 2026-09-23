/**
 * OmniDesk Main Application Orchestrator
 * Coordinates navigation, views, sync modals, and toast messages.
 */

class AppController {
  constructor() {
    this.currentView = 'timer';
    this.toastContainer = null;
  }

  async init() {
    this.toastContainer = document.getElementById('toastContainer');

    // Initialize all modules
    window.timerModule?.init();
    window.stopwatchModule?.init();
    await window.todoModule?.init();
    await window.notesModule?.init();
    await window.journalModule?.init();
    window.pwaController?.init();

    this.bindNavigation();
    this.bindSyncSettingsModal();
    this.startHeaderClock();
    this.updateSyncUI();

    // Listen for sync events
    window.storage.on('sync:complete', (detail) => {
      this.showToast(`Cloud Sync successful (${detail.type === 'push' ? 'Uploaded' : 'Downloaded'})`, 'success');
      this.updateSyncUI();
    });

    console.log('OmniDesk initialized successfully.');
  }

  bindNavigation() {
    const navButtons = document.querySelectorAll('.nav-link-btn, .mobile-nav-btn');

    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const viewTarget = btn.dataset.view;
        if (!viewTarget) return;

        // If settings button clicked, open modal instead of route
        if (viewTarget === 'settings') {
          this.openSyncModal();
          return;
        }

        this.switchView(viewTarget);
      });
    });
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Update active nav buttons
    document.querySelectorAll('.nav-link-btn, .mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Update view containers
    document.querySelectorAll('.app-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });

    // Update Topbar View Title
    const titleEl = document.getElementById('currentViewTitle');
    const tagEl = document.getElementById('currentViewTag');

    const titles = {
      timer: { title: 'Timer', tag: 'FOCUS' },
      stopwatch: { title: 'Stopwatch', tag: 'PRECISION' },
      todo: { title: 'To-Do Tasks', tag: 'PLANNER' },
      notes: { title: 'Quick Notes', tag: 'IDEAS' },
      journal: { title: 'My Journals', tag: 'DAILY REFLECTION' }
    };

    if (titles[viewName]) {
      if (titleEl) titleEl.textContent = titles[viewName].title;
      if (tagEl) tagEl.textContent = titles[viewName].tag;
    }
  }

  startHeaderClock() {
    const clockEl = document.getElementById('headerClock');
    const update = () => {
      const now = new Date();
      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    };
    update();
    setInterval(update, 1000);
  }

  // Toast System
  showToast(message, type = 'info') {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span>${message}</span>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Sync Settings Modal
  async openSyncModal() {
    const modal = document.getElementById('syncSettingsModal');
    if (!modal) return;

    const settings = await window.storage.getSyncSettings();

    const tokenInput = document.getElementById('syncGithubToken');
    const gistInput = document.getElementById('syncGistId');
    const autoSyncCheckbox = document.getElementById('syncAutoCheckbox');
    const lastSyncDisplay = document.getElementById('syncLastSyncedLabel');

    if (tokenInput) tokenInput.value = settings.githubToken || '';
    if (gistInput) gistInput.value = settings.gistId || '';
    if (autoSyncCheckbox) autoSyncCheckbox.checked = !!settings.autoSync;
    if (lastSyncDisplay) {
      lastSyncDisplay.textContent = settings.lastSync
        ? new Date(settings.lastSync).toLocaleString()
        : 'Never';
    }

    modal.classList.add('active');
  }

  closeSyncModal() {
    const modal = document.getElementById('syncSettingsModal');
    if (modal) modal.classList.remove('active');
  }

  async updateSyncUI() {
    const settings = await window.storage.getSyncSettings();
    const statusDot = document.getElementById('sidebarSyncDot');
    const statusText = document.getElementById('sidebarSyncText');

    if (settings.githubToken && settings.gistId) {
      if (statusDot) statusDot.style.background = 'var(--accent-green)';
      if (statusText) statusText.textContent = 'Cloud Synced';
    } else {
      if (statusDot) statusDot.style.background = 'var(--accent-orange)';
      if (statusText) statusText.textContent = 'Local Only (Click to Sync)';
    }
  }

  bindSyncSettingsModal() {
    const modal = document.getElementById('syncSettingsModal');
    const closeBtn = document.getElementById('closeSyncModalBtn');
    const saveSettingsBtn = document.getElementById('saveSyncSettingsBtn');
    const syncPushBtn = document.getElementById('syncPushBtn');
    const syncPullBtn = document.getElementById('syncPullBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const importFileInput = document.getElementById('importJsonFileInput');
    const triggerImportBtn = document.getElementById('triggerImportBtn');
    const sidebarSyncBtn = document.getElementById('sidebarSyncCard');

    sidebarSyncBtn?.addEventListener('click', () => this.openSyncModal());
    closeBtn?.addEventListener('click', () => this.closeSyncModal());

    // Save Settings
    saveSettingsBtn?.addEventListener('click', async () => {
      const token = document.getElementById('syncGithubToken')?.value.trim() || '';
      const gistId = document.getElementById('syncGistId')?.value.trim() || '';
      const autoSync = document.getElementById('syncAutoCheckbox')?.checked || false;

      await window.storage.saveSyncSettings({
        githubToken: token,
        gistId: gistId,
        autoSync: autoSync
      });

      this.showToast('Sync settings saved', 'success');
      this.updateSyncUI();
    });

    // Cloud Push
    syncPushBtn?.addEventListener('click', async () => {
      syncPushBtn.disabled = true;
      syncPushBtn.textContent = 'Syncing...';
      try {
        const result = await window.storage.syncToGitHubGist();
        document.getElementById('syncGistId').value = result.gistId;
        document.getElementById('syncLastSyncedLabel').textContent = new Date(result.lastSync).toLocaleString();
        this.showToast('Uploaded data to private GitHub Gist!', 'success');
      } catch (err) {
        this.showToast(err.message, 'error');
      } finally {
        syncPushBtn.disabled = false;
        syncPushBtn.textContent = 'Sync Now (Upload)';
      }
    });

    // Cloud Pull
    syncPullBtn?.addEventListener('click', async () => {
      syncPullBtn.disabled = true;
      syncPullBtn.textContent = 'Fetching...';
      try {
        const result = await window.storage.pullFromGitHubGist();
        document.getElementById('syncLastSyncedLabel').textContent = new Date(result.lastSync).toLocaleString();
        this.showToast('Downloaded & restored data from GitHub Gist!', 'success');
      } catch (err) {
        this.showToast(err.message, 'error');
      } finally {
        syncPullBtn.disabled = false;
        syncPullBtn.textContent = 'Fetch from Cloud (Download)';
      }
    });

    // Export Backup File (.json)
    exportJsonBtn?.addEventListener('click', async () => {
      try {
        const backup = await window.storage.exportAllData();
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `omnidesk-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Backup file downloaded', 'success');
      } catch (e) {
        this.showToast('Failed to export backup', 'error');
      }
    });

    // Import Backup File
    triggerImportBtn?.addEventListener('click', () => {
      importFileInput?.click();
    });

    importFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const payload = JSON.parse(event.target.result);
          await window.storage.importAllData(payload);
          this.showToast('All data successfully restored from backup!', 'success');
          this.closeSyncModal();
        } catch (err) {
          this.showToast('Failed to import file: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    });
  }
}

// Instantiate global app
window.app = new AppController();
window.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
