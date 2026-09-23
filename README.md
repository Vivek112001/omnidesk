# OmniDesk - Personal Utility Suite

> A modern, 100% free, private productivity web application featuring a **Timer**, **Stopwatch**, **To-Do List**, **Quick Notes**, and **Daily Journals** with **free cross-device cloud sync** and **offline PWA** capabilities.

Designed to be hosted with zero cost on **GitHub Pages** and installed as a standalone app on your iPhone, Android, and PC.

---

## Features

### 1. ⏳ Precision Timer (with Audio Ringing)
- **Web Audio API Alarm Engine**: Synthesizes alarm ringtones (Digital Beep, Chime, Harmonic Bell, Gong) right in the browser with **zero external sound file dependencies** (no broken links or 404s).
- **Continuous Ringing**: Rings continuously when time completes until you click "STOP ALARM".
- **Background-Tab Drift Protection**: Uses wall-clock timestamp calculations (`targetEndTime`) so timer doesn't slow down or lag when you are in another tab or minimize the browser.
- **Tab Title & Favicon Flashing**: Pulsing title (`⏰ TIME'S UP! ⏰`) and favicon so you never miss an alert.
- **Quick Presets & Custom Duration**: 1m, 5m, 10m, 15m, 25m Pomodoro, 30m, 45m, 1h, plus custom Hours/Mins/Secs inputs.

### 2. ⏱️ Stopwatch
- Millisecond precision counter using `performance.now()`.
- Lap tracking with overall splits and individual lap durations.
- Automatically calculates and badges the **Fastest Lap** (green) and **Slowest Lap** (red).

### 3. ✅ To-Do Planner
- Organize tasks with priority tags: `Urgent`, `High`, `Medium`, `Low`.
- Category tabs: `Personal`, `Work`, `Study`, `Health`, `Ideas`.
- Due date indicators, live search filtering, and instant persistence.

### 4. 📝 Quick Notes & Scratchpad
- **Transient Scratchpad**: Live auto-saving notepad for jotting numbers, thoughts, and quick snippets without pressing save.
- **Pinned Note Cards**: Color-coded cards (Blue, Yellow, Green, Purple, Red) with pin-to-top support and clipboard copying.

### 5. 📖 My Journals (Daily Reflection)
- Daily diary entries with seamless calendar date navigation (`◀`, `Today`, `▶`).
- Daily mood tracker: 😊 Great, 😌 Peaceful, ⚡ Productive, 😐 Neutral, 🌧 Rough.
- Quick prompt chips ("What went well?", "Grateful for...", "Focus for tomorrow").
- Searchable archive to search your past reflections by keyword, date, or mood.
- Streak counter tracking consecutive journaling days.

---

## ☁️ 100% Free Cross-Device Cloud Sync

OmniDesk is built **local-first** with `IndexedDB`, meaning it opens instantaneously and works 100% offline.

To access your data seamlessly across your **phone, tablet, and PC without paying any subscription fees**:

1. Open **Sync Settings** (the cloud icon in the top header or sidebar).
2. Generate a free **GitHub Personal Access Token** on your GitHub account:
   - Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens).
   - Generate a token and check the **`gist`** scope checkbox.
3. Paste the token into OmniDesk and click **Save Token**.
4. Click **"Sync Now (Upload)"**: OmniDesk will automatically create a private, hidden GitHub Gist containing your encrypted data.
5. Open OmniDesk on your phone, paste the same token, and tap **"Fetch from Cloud (Download)"** (or enable Auto-Sync). Your journals, tasks, and notes will sync automatically!

### Offline & File Backups
- You can also export a `.json` backup file anytime with **"Export Backup"** and restore it on any device with **"Restore from File"**.

---

## 📲 Installing on Mobile (PWA Standalone Mode)

OmniDesk includes a Web App Manifest and Service Worker:
- **iPhone / iPad (Safari)**: Open your deployed GitHub Pages URL, tap the **Share** button (box with upward arrow), and select **"Add to Home Screen"**. It will appear as an app icon and run full-screen without Safari browser bars.
- **Android (Chrome)**: Tap the 3-dot menu and select **"Install App"** (or click the "Install App" button in the header).

---

## 🚀 How to Host on GitHub Pages (Free in 2 Minutes)

1. **Initialize Git** in this project folder:
   ```bash
   cd /Users/vivek/.gemini/antigravity/scratch/tech-project
   git init
   git add .
   git commit -m "Initial commit of OmniDesk"
   ```

2. **Create a new repository** on [github.com/new](https://github.com/new) (e.g. named `omnidesk` or `utility-app`).

3. **Push the code**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

4. **Enable GitHub Pages**:
   - In your GitHub repository, go to **Settings** > **Pages** (on the left menu).
   - Under **Build and deployment > Source**, select **Deploy from a branch**.
   - Under **Branch**, select `main` and folder `/ (root)`.
   - Click **Save**.

Your app will be live within 60 seconds at:
```
https://<your-username>.github.io/<your-repo-name>/
```

---

## 💻 Running Locally

You can open `index.html` directly in your browser, or serve it with Python / Node:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve .
```
Then visit `http://localhost:8000`.
