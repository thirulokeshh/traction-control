// Default fallback state values if storage is empty
const DEFAULT_SETTINGS = {
  focusDuration: 25 * 60, // 25 minutes in seconds
  breakDuration: 5 * 60,  // 5 minutes in seconds
  nudgeEnabled: true,
  widgetEnabled: true,
  blockedSites: [
    'youtube.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'facebook.com',
    'reddit.com',
    'tiktok.com',
    'netflix.com'
  ]
};

const DEFAULT_STATE = {
  timerRunning: false,
  mode: 'focus', // 'focus' or 'break'
  timeLeft: 25 * 60,
  endTime: 0,
  activeGoal: '',
  sessionCount: 0,
  sessionMinutesTotal: 0,
  emergencyPasses: {}
};

// Global Variables
let localTimerInterval = null;
let circumference = 2 * Math.PI * 82; // radius is 82

// Motivational Quotes List
const MOTIVATIONAL_QUOTES = [
  "Traction is what builds momentum. Keep pushing forward.",
  "Deep focus is a superpower in a distracted world.",
  "Your attention is your most valuable asset. Protect it.",
  "Small steps forward are still steps in the right direction.",
  "Focus on being productive, not busy.",
  "Done is better than perfect. Maintain your traction.",
  "Disconnect to reconnect with your true goals."
];

// Document Elements
const appLogo = document.getElementById('appLogo');
const statusPill = document.getElementById('statusPill');
const countdownDisplay = document.getElementById('countdownDisplay');
const timerLabel = document.getElementById('timerLabel');
const goalInput = document.getElementById('goalInput');
const goalLockBtn = document.getElementById('goalLockBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');

const nudgeToggle = document.getElementById('nudgeToggle');
const addSiteForm = document.getElementById('addSiteForm');
const siteInput = document.getElementById('siteInput');
const sitesList = document.getElementById('sitesList');

const statSessions = document.getElementById('statSessions');
const statTime = document.getElementById('statTime');
const milestoneRatio = document.getElementById('milestoneRatio');
const milestoneBar = document.getElementById('milestoneBar');
const motivationQuote = document.getElementById('motivationQuote');

const focusVal = document.getElementById('focusVal');
const breakVal = document.getElementById('breakVal');
const decFocusBtn = document.getElementById('decFocus');
const incFocusBtn = document.getElementById('incFocus');
const decBreakBtn = document.getElementById('decBreak');
const incBreakBtn = document.getElementById('incBreak');
const durationSettingsEl = document.getElementById('durationSettings');

const progressRingCircle = document.querySelector('.progress-ring__circle');

// Initialize SVG Circle stroke
if (progressRingCircle) {
  progressRingCircle.style.strokeDasharray = `${circumference} ${circumference}`;
  progressRingCircle.style.strokeDashoffset = circumference;
}

// Tab Switching logic
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Deactivate previous active tabs
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Activate selected tab
    btn.classList.add('active');
    const tabName = btn.getAttribute('data-tab');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Run tab-specific updates if needed
    if (tabName === 'stats') {
      updateStatsUI();
    } else if (tabName === 'blocklist') {
      renderBlocklist();
    }
  });
});

// Load everything on popup open
document.addEventListener('DOMContentLoaded', () => {
  // Sync state initially
  syncState();
  
  // Set random quote
  const randomIdx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  motivationQuote.textContent = `"${MOTIVATIONAL_QUOTES[randomIdx]}"`;
  
  // Add listeners
  playPauseBtn.addEventListener('click', toggleTimer);
  resetBtn.addEventListener('click', resetTimer);
  goalLockBtn.addEventListener('click', lockGoal);
  goalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      lockGoal();
      goalInput.blur();
    }
  });
  nudgeToggle.addEventListener('change', updateNudgeToggle);
  addSiteForm.addEventListener('submit', addBlockedSite);

  // Duration adjusters listeners
  decFocusBtn.addEventListener('click', () => adjustTimeSetting('focusDuration', -5));
  incFocusBtn.addEventListener('click', () => adjustTimeSetting('focusDuration', 5));
  decBreakBtn.addEventListener('click', () => adjustTimeSetting('breakDuration', -1));
  incBreakBtn.addEventListener('click', () => adjustTimeSetting('breakDuration', 1));

  // Poll state occasionally to ensure no sync drift
  setInterval(syncState, 1000);
});

// Sync UI with storage state
function syncState() {
  chrome.storage.local.get(['state', 'settings'], (data) => {
    // If state/settings are missing in storage, initialize them with defaults
    let state = data.state;
    let settings = data.settings;
    let needsInit = false;

    if (!state) {
      state = DEFAULT_STATE;
      needsInit = true;
    }
    if (!settings) {
      settings = DEFAULT_SETTINGS;
      needsInit = true;
    }
    if (needsInit) {
      chrome.storage.local.set({ state, settings });
    }

    // 1. Update Timer Status
    updateTimerDisplay(state, settings);

    // 2. Update Goal Input
    if (!goalInput.matches(':focus')) {
      goalInput.value = state.activeGoal || '';
      if (state.activeGoal) {
        goalLockBtn.classList.add('locked');
      } else {
        goalLockBtn.classList.remove('locked');
      }
    }

    // 3. Update Blocklist Toggle
    nudgeToggle.checked = settings.nudgeEnabled;

    // 4. Update Stats
    statSessions.textContent = state.sessionCount || 0;
    statTime.textContent = `${state.sessionMinutesTotal || 0}m`;

    // 5. Update Duration Text Displays
    focusVal.textContent = `${Math.round(settings.focusDuration / 60)}m`;
    breakVal.textContent = `${Math.round(settings.breakDuration / 60)}m`;

    // 6. Disable adjusters when timer is running
    if (state.timerRunning) {
      durationSettingsEl.classList.add('disabled');
    } else {
      durationSettingsEl.classList.remove('disabled');
    }
  });
}

// Start local counting interval for second-level smooth updates in UI
function startLocalCounter(endTime, duration, mode) {
  if (localTimerInterval) clearInterval(localTimerInterval);

  const tick = () => {
    const secondsLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    
    // Format Display
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    countdownDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Update Circle Progress
    const percent = duration > 0 ? (secondsLeft / duration) * 100 : 0;
    const offset = circumference - (percent / 100) * circumference;
    progressRingCircle.style.strokeDashoffset = offset;

    // If timer elapsed locally, trigger sync
    if (secondsLeft <= 0) {
      clearInterval(localTimerInterval);
      syncState();
    }
  };

  tick();
  localTimerInterval = setInterval(tick, 1000);
}

// Stop local counter
function stopLocalCounter() {
  if (localTimerInterval) {
    clearInterval(localTimerInterval);
    localTimerInterval = null;
  }
}

// Update the circular timer and labels
function updateTimerDisplay(state, settings) {
  const duration = state.mode === 'focus' ? settings.focusDuration : settings.breakDuration;
  
  // Set logo and status label
  if (state.timerRunning) {
    appLogo.classList.add('active');
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');

    if (state.mode === 'focus') {
      statusPill.textContent = 'Focusing';
      statusPill.className = 'status-pill';
      timerLabel.textContent = 'FOCUS SESSION';
      progressRingCircle.style.stroke = 'url(#timerGrad)';
    } else {
      statusPill.textContent = 'Break';
      statusPill.className = 'status-pill break';
      timerLabel.textContent = 'BREAK PHASE';
      progressRingCircle.style.stroke = 'var(--cyan-glow)';
    }

    // Run local counter
    startLocalCounter(state.endTime, duration, state.mode);
  } else {
    appLogo.classList.remove('active');
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    statusPill.textContent = 'Idle';
    statusPill.className = 'status-pill idle';
    timerLabel.textContent = state.mode === 'focus' ? 'READY TO FOCUS' : 'BREAK COMPLETED';
    progressRingCircle.style.stroke = 'url(#timerGrad)';

    stopLocalCounter();

    // Set static values based on saved state
    const mins = Math.floor(state.timeLeft / 60);
    const secs = state.timeLeft % 60;
    countdownDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const percent = duration > 0 ? (state.timeLeft / duration) * 100 : 0;
    const offset = circumference - (percent / 100) * circumference;
    progressRingCircle.style.strokeDashoffset = offset;
  }
}

// Toggle Timer (Play / Pause) - Storage-driven
function toggleTimer() {
  chrome.storage.local.get(['state', 'settings'], (data) => {
    const state = data.state || DEFAULT_STATE;
    const settings = data.settings || DEFAULT_SETTINGS;

    if (state.timerRunning) {
      // Pause
      state.timerRunning = false;
      const secondsLeft = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
      state.timeLeft = secondsLeft;
      state.endTime = 0;
    } else {
      // Start/Resume
      const goalText = goalInput.value.trim() || 'Focus session';
      state.timerRunning = true;
      state.activeGoal = goalText;
      goalInput.value = goalText;

      if (state.timeLeft <= 0 || state.timeLeft > (state.mode === 'focus' ? settings.focusDuration : settings.breakDuration)) {
        state.timeLeft = state.mode === 'focus' ? settings.focusDuration : settings.breakDuration;
      }
      state.endTime = Date.now() + (state.timeLeft * 1000);
    }

    chrome.storage.local.set({ state }, () => {
      syncState();
    });
  });
}

// Reset Timer - Storage-driven
function resetTimer() {
  if (confirm("Reset current focus session?")) {
    chrome.storage.local.get(['settings', 'state'], (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;
      const state = data.state || DEFAULT_STATE;

      state.timerRunning = false;
      state.mode = 'focus';
      state.timeLeft = settings.focusDuration;
      state.endTime = 0;
      state.emergencyPasses = {};

      chrome.storage.local.set({ state }, () => {
        syncState();
      });
    });
  }
}

// Lock active goal
function lockGoal() {
  const goalText = goalInput.value.trim();
  chrome.storage.local.get(['state'], (data) => {
    const state = data.state || DEFAULT_STATE;
    state.activeGoal = goalText;
    chrome.storage.local.set({ state }, () => {
      syncState();
    });
  });
}

// Adjust focus or break times (minutes delta) - Storage-driven
function adjustTimeSetting(type, deltaMinutes) {
  chrome.storage.local.get(['settings', 'state'], (data) => {
    const settings = data.settings || DEFAULT_SETTINGS;
    const state = data.state || DEFAULT_STATE;

    // Prevent modifications when running
    if (state.timerRunning) return;

    if (type === 'focusDuration') {
      const currentMin = Math.round(settings.focusDuration / 60);
      const targetMin = Math.max(5, Math.min(120, currentMin + deltaMinutes)); // bounds: 5m to 120m
      settings.focusDuration = targetMin * 60;
      
      // Update active time left if in focus mode
      if (state.mode === 'focus') {
        state.timeLeft = settings.focusDuration;
      }
    } else if (type === 'breakDuration') {
      const currentMin = Math.round(settings.breakDuration / 60);
      const targetMin = Math.max(1, Math.min(30, currentMin + deltaMinutes)); // bounds: 1m to 30m
      settings.breakDuration = targetMin * 60;

      // Update active time left if in break mode
      if (state.mode === 'break') {
        state.timeLeft = settings.breakDuration;
      }
    }

    chrome.storage.local.set({ settings, state }, () => {
      syncState();
    });
  });
}

// Toggle Nudge Blocker Setting
function updateNudgeToggle() {
  chrome.storage.local.get(['settings'], (data) => {
    const settings = data.settings || DEFAULT_SETTINGS;
    settings.nudgeEnabled = nudgeToggle.checked;
    chrome.storage.local.set({ settings });
  });
}

// Render the blocklist
function renderBlocklist() {
  chrome.storage.local.get(['settings'], (data) => {
    const settings = data.settings || DEFAULT_SETTINGS;
    const blockedSites = settings.blockedSites || [];
    
    sitesList.innerHTML = '';
    if (blockedSites.length === 0) {
      sitesList.innerHTML = '<div class="site-item"><span class="site-name">No blocked sites yet!</span></div>';
      return;
    }

    blockedSites.forEach(site => {
      const item = document.createElement('div');
      item.className = 'site-item';
      
      const name = document.createElement('span');
      name.className = 'site-name';
      name.textContent = site;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-site-btn';
      deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      deleteBtn.addEventListener('click', () => removeBlockedSite(site));

      item.appendChild(name);
      item.appendChild(deleteBtn);
      sitesList.appendChild(item);
    });
  });
}

// Parse domain inputs securely
function cleanDomain(input) {
  let domain = input.trim().toLowerCase();
  
  // Strip protocol
  if (domain.startsWith('http://')) domain = domain.substring(7);
  if (domain.startsWith('https://')) domain = domain.substring(8);
  
  // Strip www
  if (domain.startsWith('www.')) domain = domain.substring(4);
  
  // Strip path & query parameters
  const slashIdx = domain.indexOf('/');
  if (slashIdx !== -1) domain = domain.substring(0, slashIdx);
  
  const questionIdx = domain.indexOf('?');
  if (questionIdx !== -1) domain = domain.substring(0, questionIdx);
  
  return domain;
}

// Add site to blocklist
function addBlockedSite(e) {
  e.preventDefault();
  const inputVal = siteInput.value;
  const site = cleanDomain(inputVal);

  if (!site) return;

  chrome.storage.local.get(['settings'], (data) => {
    const settings = data.settings || DEFAULT_SETTINGS;
    if (!settings.blockedSites.includes(site)) {
      settings.blockedSites.push(site);
      chrome.storage.local.set({ settings }, () => {
        renderBlocklist();
        siteInput.value = '';
      });
    } else {
      alert("This site is already blocked!");
    }
  });
}

// Remove site from blocklist
function removeBlockedSite(site) {
  chrome.storage.local.get(['settings'], (data) => {
    const settings = data.settings || DEFAULT_SETTINGS;
    settings.blockedSites = settings.blockedSites.filter(s => s !== site);
    chrome.storage.local.set({ settings }, () => {
      renderBlocklist();
    });
  });
}

// Update milestone and achievements
function updateStatsUI() {
  chrome.storage.local.get(['state'], (data) => {
    const state = data.state || DEFAULT_STATE;
    const count = state.sessionCount || 0;
    
    // Set text metrics
    statSessions.textContent = count;
    statTime.textContent = `${state.sessionMinutesTotal || 0}m`;
    
    // Daily goal is 4 sessions
    const target = 4;
    const percent = Math.min(100, Math.round((count / target) * 100));
    
    milestoneRatio.textContent = `${percent}%`;
    milestoneBar.style.width = `${percent}%`;
  });
}

// Listen to message updates from the background script (as fallback)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'timerExpired' || message.action === 'timerStarted' || 
      message.action === 'timerPaused' || message.action === 'timerResumed' || 
      message.action === 'timerReset') {
    syncState();
  }
});

// Watch storage changes to synchronize multiple popup instances or background updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    syncState();
  }
});
