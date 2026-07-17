// Default state values
const DEFAULT_BLOCKED_SITES = [
  'youtube.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebook.com',
  'reddit.com',
  'tiktok.com',
  'netflix.com'
];

const DEFAULT_SETTINGS = {
  focusDuration: 25 * 60, // 25 minutes in seconds
  breakDuration: 5 * 60,  // 5 minutes in seconds
  nudgeEnabled: true,
  widgetEnabled: true,
  blockedSites: DEFAULT_BLOCKED_SITES
};

const DEFAULT_STATE = {
  timerRunning: false,
  mode: 'focus', // 'focus' or 'break'
  timeLeft: 25 * 60,
  endTime: 0,
  activeGoal: '',
  sessionCount: 0,
  sessionMinutesTotal: 0,
  emergencyPasses: {} // hostname: expirationTimestamp
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings', 'state'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
    if (!result.state) {
      chrome.storage.local.set({ state: DEFAULT_STATE });
    }
  });
  console.log('Traction Control initialized.');
});

// Listener for alarms (Timer expiration)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tractionFocusTimer') {
    handleTimerExpiration();
  } else if (alarm.name === 'tractionBadgeUpdate') {
    updateBadge();
  }
});

// Helper to send a notification
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon.svg',
    title: title,
    message: message,
    priority: 2
  });
}

// Handle transition when the focus/break timer ends
function handleTimerExpiration() {
  chrome.storage.local.get(['settings', 'state'], (data) => {
    const settings = data.settings || DEFAULT_SETTINGS;
    const state = data.state || DEFAULT_STATE;

    chrome.alarms.clear('tractionFocusTimer');
    chrome.alarms.clear('tractionBadgeUpdate');

    let nextMode = 'focus';
    let nextTimeLeft = settings.focusDuration;
    let title = '';
    let message = '';

    if (state.mode === 'focus') {
      nextMode = 'break';
      nextTimeLeft = settings.breakDuration;
      title = 'Focus Session Completed! 🎯';
      message = 'Fantastic job. Take a well-deserved break!';
      
      // Update statistics
      state.sessionCount += 1;
      const minutesFocused = Math.round(settings.focusDuration / 60);
      state.sessionMinutesTotal += minutesFocused;
    } else {
      nextMode = 'focus';
      nextTimeLeft = settings.focusDuration;
      title = 'Break is Over! ⚡';
      message = 'Ready to build traction? Let\'s focus!';
    }

    state.timerRunning = false;
    state.mode = nextMode;
    state.timeLeft = nextTimeLeft;
    state.endTime = 0;
    state.emergencyPasses = {}; // Reset passes

    chrome.storage.local.set({ state }, () => {
      showNotification(title, message);
      notifyAllTabs({ action: 'timerExpired', state });
    });
  });
}

// Keep the badge text up-to-date
function updateBadge() {
  chrome.storage.local.get(['state'], (data) => {
    const state = data.state || DEFAULT_STATE;
    if (!state.timerRunning) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    const secondsLeft = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
    const minutesLeft = Math.ceil(secondsLeft / 60);

    if (minutesLeft > 0) {
      chrome.action.setBadgeText({ text: `${minutesLeft}m` });
      chrome.action.setBadgeBackgroundColor({
        color: state.mode === 'focus' ? '#a855f7' : '#06b6d4' // Violet for focus, Cyan for break
      });
    } else {
      chrome.action.setBadgeText({ text: '0m' });
    }
  });
}

// Send runtime message to all content scripts in active tabs
function notifyAllTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.url && tab.url.startsWith('http')) {
        chrome.tabs.sendMessage(tab.id, message, () => {
          if (chrome.runtime.lastError) {
            // Ignore errors for tabs without content script loaded
          }
        });
      }
    });
  });
}

// Listen to storage changes to coordinate background alarms with storage state shifts
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.state) {
    const oldState = changes.state.oldValue;
    const newState = changes.state.newValue;

    if (!newState) return;

    // Handle transitions
    if (newState.timerRunning) {
      // If was not running, or endTime changed/shifted (e.g. time adjusted or started)
      if (!oldState || !oldState.timerRunning || oldState.endTime !== newState.endTime) {
        chrome.alarms.create('tractionFocusTimer', { when: newState.endTime });
        chrome.alarms.create('tractionBadgeUpdate', { periodInMinutes: 1 });
        updateBadge();
      }
    } else {
      // If was running, clear the alarms
      if (oldState && oldState.timerRunning) {
        chrome.alarms.clear('tractionFocusTimer');
        chrome.alarms.clear('tractionBadgeUpdate');
        updateBadge();
      }
    }
  }
});

// Handle backup communication from popup or content scripts (if any)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startTimer') {
    chrome.storage.local.get(['settings', 'state'], (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;
      const state = data.state || DEFAULT_STATE;

      const duration = state.mode === 'focus' ? settings.focusDuration : settings.breakDuration;
      state.timerRunning = true;
      state.timeLeft = duration;
      state.endTime = Date.now() + (duration * 1000);
      state.activeGoal = message.goal || '';

      chrome.storage.local.set({ state }, () => {
        sendResponse({ success: true, state });
      });
    });
    return true; 
  }

  if (message.action === 'pauseTimer') {
    chrome.storage.local.get(['state'], (data) => {
      const state = data.state || DEFAULT_STATE;
      if (!state.timerRunning) {
        sendResponse({ success: false });
        return;
      }

      const secondsLeft = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
      state.timerRunning = false;
      state.timeLeft = secondsLeft;
      state.endTime = 0;

      chrome.storage.local.set({ state }, () => {
        sendResponse({ success: true, state });
      });
    });
    return true;
  }

  if (message.action === 'resumeTimer') {
    chrome.storage.local.get(['state'], (data) => {
      const state = data.state || DEFAULT_STATE;
      if (state.timerRunning) {
        sendResponse({ success: false });
        return;
      }

      state.timerRunning = true;
      state.endTime = Date.now() + (state.timeLeft * 1000);

      chrome.storage.local.set({ state }, () => {
        sendResponse({ success: true, state });
      });
    });
    return true;
  }

  if (message.action === 'resetTimer') {
    chrome.storage.local.get(['settings', 'state'], (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;
      const state = data.state || DEFAULT_STATE;

      state.timerRunning = false;
      state.mode = 'focus';
      state.timeLeft = settings.focusDuration;
      state.endTime = 0;
      state.emergencyPasses = {};

      chrome.storage.local.set({ state }, () => {
        sendResponse({ success: true, state });
      });
    });
    return true;
  }

  if (message.action === 'grantEmergencyPass') {
    chrome.storage.local.get(['state'], (data) => {
      const state = data.state || DEFAULT_STATE;
      const hostname = message.hostname;
      
      if (!state.emergencyPasses) state.emergencyPasses = {};
      
      // Grant 60 seconds of access
      const accessDuration = 60 * 1000;
      state.emergencyPasses[hostname] = Date.now() + accessDuration;

      chrome.storage.local.set({ state }, () => {
        sendResponse({ success: true, expiry: state.emergencyPasses[hostname] });
      });
    });
    return true;
  }
});

// Periodic badge updates in case alarms drift or wake from sleep
chrome.idle.onStateChanged.addListener((newState) => {
  if (newState === 'active') {
    chrome.storage.local.get(['state'], (data) => {
      const state = data.state || DEFAULT_STATE;
      if (state.timerRunning && state.endTime < Date.now()) {
        // Timer should have expired during sleep
        handleTimerExpiration();
      } else {
        updateBadge();
      }
    });
  }
});
