// Anti-flicker: Immediately hide body if we match common distracting sites
const defaultBlockedRegex = /youtube\.com|twitter\.com|x\.com|instagram\.com|facebook\.com|reddit\.com|tiktok\.com|netflix\.com/;
let hiderStyle = null;
const currentHostname = window.location.hostname.replace('www.', '');

if (defaultBlockedRegex.test(window.location.hostname)) {
  hiderStyle = document.createElement('style');
  hiderStyle.id = 'traction-flicker-hider';
  hiderStyle.innerHTML = 'html { display: none !important; }';
  if (document.documentElement) {
    document.documentElement.appendChild(hiderStyle);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.appendChild(hiderStyle);
    });
  }
}

// Shadow DOM elements
let shadowHost = null;
let shadowRoot = null;
let blockerElement = null;
let widgetElement = null;
let timerUpdateInterval = null;
let breathingInterval = null;

// CSS styles to inject inside the Shadow DOM
const SHADOW_CSS = `
  :host {
    all: initial;
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  /* Reset box sizing */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Blocker Fullscreen Overlay */
  .blocker-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle at 50% 50%, #15151a 0%, #050507 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    color: #f8fafc;
    z-index: 2147483647;
    pointer-events: auto;
    overflow: hidden;
  }

  .blocker-card {
    background: rgba(18, 18, 22, 0.75);
    border: 1px solid rgba(245, 158, 11, 0.18);
    border-radius: 24px;
    padding: 40px;
    width: 90%;
    max-width: 460px;
    text-align: center;
    backdrop-filter: blur(20px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    animation: fadeInUp 0.5s ease-out;
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .logo-area {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-icon {
    width: 32px;
    height: 32px;
    filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.4));
  }

  .logo-text {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #fff;
  }

  .logo-accent {
    background: linear-gradient(135deg, #f59e0b, #0d9488);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .message-area h1 {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #f8fafc;
  }

  .message-area p {
    font-size: 14px;
    color: #94a3b8;
    line-height: 1.5;
  }

  .goal-pill {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.18);
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 500;
    color: #fcd34d;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Breathing Circle Animation */
  .breathing-container {
    position: relative;
    width: 130px;
    height: 130px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 8px 0;
  }

  .breathing-circle-outer {
    position: absolute;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%);
    animation: breatheOuter 12s infinite ease-in-out;
  }

  .breathing-circle-inner {
    position: absolute;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.65), rgba(13, 148, 136, 0.65));
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.25);
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: center;
    line-height: 1.2;
    padding: 10px;
    z-index: 2;
    animation: breatheInner 12s infinite ease-in-out;
  }

  @keyframes breatheInner {
    0%, 100%, 16.66%, 83.33% { transform: scale(1); background: rgba(245, 158, 11, 0.65); }
    33.33%, 50% { transform: scale(1.35); background: rgba(13, 148, 136, 0.65); box-shadow: 0 0 30px rgba(13, 148, 136, 0.35); }
    66.66%, 75% { transform: scale(1); background: rgba(245, 158, 11, 0.65); }
  }

  @keyframes breatheOuter {
    0%, 100%, 16.66%, 83.33% { transform: scale(1); opacity: 0.3; }
    33.33%, 50% { transform: scale(1.6); opacity: 0.8; }
    66.66%, 75% { transform: scale(1); opacity: 0.3; }
  }

  .timer-display {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.5px;
    font-variant-numeric: tabular-nums;
    background: linear-gradient(135deg, #fff, #94a3b8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* Blocker Actions */
  .blocker-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .btn {
    width: 100%;
    padding: 12px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    border: none;
  }

  .btn-primary {
    background: linear-gradient(135deg, #f59e0b, #f97316);
    color: #fff;
    box-shadow: 0 4px 15px rgba(245, 158, 11, 0.2);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(245, 158, 11, 0.25);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  /* Nudge Confirmation Screen */
  .nudge-confirm {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ON-PAGE FLOATING TIMER WIDGET */
  .traction-widget {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(10, 10, 12, 0.85);
    border: 1px solid rgba(13, 148, 136, 0.25);
    border-radius: 9999px;
    padding: 6px 14px 6px 8px;
    backdrop-filter: blur(12px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    gap: 10px;
    color: #fff;
    z-index: 2147483646;
    pointer-events: auto;
    cursor: grab;
    user-select: none;
    transition: transform 0.2s, border-color 0.3s, box-shadow 0.3s;
    max-width: 280px;
  }

  .traction-widget:hover {
    border-color: rgba(13, 148, 136, 0.5);
    box-shadow: 0 10px 30px rgba(13, 148, 136, 0.1);
  }

  .traction-widget:active {
    cursor: grabbing;
  }

  .widget-drag-handle {
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: grab;
  }

  .widget-drag-handle span {
    width: 4px;
    height: 4px;
    background: #64748b;
    border-radius: 50%;
  }

  .widget-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f59e0b;
    box-shadow: 0 0 8px #f59e0b;
  }

  .widget-indicator.break {
    background: #0d9488;
    box-shadow: 0 0 8px #0d9488;
  }

  .widget-time {
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #f8fafc;
    letter-spacing: -0.2px;
  }

  .widget-divider {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.15);
  }

  .widget-goal {
    font-size: 11px;
    font-weight: 500;
    color: #94a3b8;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

// Helper: Check if site is blocked and start overlays
function checkBlockState() {
  chrome.storage.local.get(['state', 'settings'], (data) => {
    const state = data.state;
    const settings = data.settings;

    // Reset styles
    removeBlocker();
    removeWidget();

    // Remove flicker hider if settings/state dictate no blocking is active
    const isFocusActive = state && state.timerRunning && state.mode === 'focus';
    const isNudgeEnabled = settings && settings.nudgeEnabled;
    const isSiteBlocked = settings && settings.blockedSites && settings.blockedSites.some(site => {
      // Check if hostname matches or ends with the site domain
      return currentHostname === site || currentHostname.endsWith('.' + site);
    });

    // Check emergency pass status
    let hasEmergencyPass = false;
    if (state && state.emergencyPasses && state.emergencyPasses[currentHostname]) {
      const expiry = state.emergencyPasses[currentHostname];
      if (expiry > Date.now()) {
        hasEmergencyPass = true;
        // Schedule a rebuild for when the pass expires
        const timeUntilExpiry = expiry - Date.now();
        setTimeout(checkBlockState, timeUntilExpiry + 500);
      }
    }

    // 1. Blocker logic
    if (isFocusActive && isNudgeEnabled && isSiteBlocked && !hasEmergencyPass) {
      // Remove hider and draw blocker overlay
      removeFlickerHider();
      drawBlocker(state);
    } else {
      // Remove hider (show webpage)
      removeFlickerHider();

      // 2. Widget logic (only if focus is active, settings say yes, and not currently blocked)
      if (state && state.timerRunning && settings && settings.widgetEnabled) {
        drawWidget(state);
      }
    }
  });
}

function removeFlickerHider() {
  const hider = document.getElementById('traction-flicker-hider');
  if (hider) hider.remove();
}

// Create the Shadow DOM Host in the webpage
function getOrCreateShadowRoot() {
  if (!shadowHost) {
    shadowHost = document.createElement('div');
    shadowHost.id = 'traction-control-shadow-host';
    document.documentElement.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'open' });
    
    // Inject Fonts link inside shadow root (requires Outfit loaded on screen)
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap';
    shadowRoot.appendChild(fontLink);

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = SHADOW_CSS;
    shadowRoot.appendChild(styleEl);
  }
  return shadowRoot;
}

// Draw Blocker Overlay
function drawBlocker(state) {
  const root = getOrCreateShadowRoot();
  document.body.classList.add('traction-blocked-scroll');
  shadowHost.className = 'traction-interactive'; // allow mouse actions on host

  blockerElement = document.createElement('div');
  blockerElement.className = 'blocker-overlay';
  
  const card = document.createElement('div');
  card.className = 'blocker-card';

  // Logo Area
  const logoDiv = document.createElement('div');
  logoDiv.className = 'logo-area';
  // Use SVG path representing the needle logo icon
  logoDiv.innerHTML = `
    <svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="32" height="32">
      <circle cx="64" cy="64" r="42" fill="none" stroke="#27272a" stroke-width="6" />
      <path d="M 34.3 93.7 A 42 42 0 1 1 93.7 93.7" fill="none" stroke="#f59e0b" stroke-width="6" stroke-linecap="round" />
      <path d="M 64 64 L 58 58 L 64 28 L 70 58 Z" fill="#f97316" transform="rotate(35, 64, 64)" />
    </svg>
    <span class="logo-text">Traction <span class="logo-accent">Control</span></span>
  `;
  card.appendChild(logoDiv);

  // Message Area
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message-area';
  
  const heading = document.createElement('h1');
  heading.textContent = 'Focus Session Active ⚡';
  
  const p = document.createElement('p');
  p.textContent = `${currentHostname} is locked to reduce distractions. Take a breath and align on your goal.`;

  messageDiv.appendChild(heading);
  messageDiv.appendChild(p);
  card.appendChild(messageDiv);

  // Goal Pill
  if (state.activeGoal) {
    const goalPill = document.createElement('div');
    goalPill.className = 'goal-pill';
    goalPill.textContent = `Goal: ${state.activeGoal}`;
    card.appendChild(goalPill);
  }

  // Breathing Circle Animation
  const breathingContainer = document.createElement('div');
  breathingContainer.className = 'breathing-container';
  
  const circleOuter = document.createElement('div');
  circleOuter.className = 'breathing-circle-outer';
  
  const circleInner = document.createElement('div');
  circleInner.className = 'breathing-circle-inner';
  circleInner.textContent = 'Breathe\nIn';

  breathingContainer.appendChild(circleOuter);
  breathingContainer.appendChild(circleInner);
  card.appendChild(breathingContainer);

  // Breathing script cycles
  const breathingTexts = ['Breathe\nIn', 'Hold', 'Exhale', 'Hold'];
  const breathingDurations = [4000, 2000, 4000, 2000]; // 12 seconds loop
  let textIndex = 0;

  const cycleBreathingText = () => {
    textIndex = (textIndex + 1) % breathingTexts.length;
    circleInner.textContent = breathingTexts[textIndex];
    breathingInterval = setTimeout(cycleBreathingText, breathingDurations[textIndex]);
  };
  // Start the cycle
  breathingInterval = setTimeout(cycleBreathingText, 4000);

  // Timer Display inside blocker
  const timerDisplay = document.createElement('div');
  timerDisplay.className = 'timer-display';
  timerDisplay.textContent = '00:00';
  card.appendChild(timerDisplay);

  // Blocker Actions
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'blocker-actions';
  
  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-primary';
  backBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
    Go Back to Work
  `;
  backBtn.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // If we cannot go back, suggest closing or redirecting to blank page
      window.location.href = 'about:blank';
    }
  });

  const passBtn = document.createElement('button');
  passBtn.className = 'btn btn-secondary';
  passBtn.textContent = 'Emergency Pass (1m)';
  passBtn.addEventListener('click', () => showEmergencyPassConfirm(card, state));

  actionsDiv.appendChild(backBtn);
  actionsDiv.appendChild(passBtn);
  card.appendChild(actionsDiv);

  blockerElement.appendChild(card);
  root.appendChild(blockerElement);

  // Start counter updates inside blocker
  startTimerCounter(state.endTime, timerDisplay);
}

// Show validation card for emergency pass
function showEmergencyPassConfirm(card, state) {
  // Clear old action contents
  const actionsDiv = card.querySelector('.blocker-actions');
  actionsDiv.innerHTML = '';

  const confirmContainer = document.createElement('div');
  confirmContainer.className = 'nudge-confirm';

  const confirmHeading = document.createElement('h3');
  confirmHeading.style.fontSize = '15px';
  confirmHeading.style.fontWeight = '600';
  confirmHeading.style.color = '#fff';
  confirmHeading.textContent = 'Is this a conscious choice?';
  confirmContainer.appendChild(confirmHeading);

  const buttonRow = document.createElement('div');
  buttonRow.style.display = 'flex';
  buttonRow.style.gap = '10px';
  buttonRow.style.width = '100%';

  const yesBtn = document.createElement('button');
  yesBtn.className = 'btn btn-primary';
  yesBtn.style.flex = '1';
  yesBtn.textContent = 'Yes, let me in';
  yesBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'grantEmergencyPass', hostname: currentHostname }, (res) => {
      if (res && res.success) {
        checkBlockState(); // rebuild page logic
      }
    });
  });

  const noBtn = document.createElement('button');
  noBtn.className = 'btn btn-secondary';
  noBtn.style.flex = '1';
  noBtn.textContent = 'No, go back';
  noBtn.addEventListener('click', () => {
    // Restore default view
    checkBlockState();
  });

  buttonRow.appendChild(yesBtn);
  buttonRow.appendChild(noBtn);
  confirmContainer.appendChild(buttonRow);
  actionsDiv.appendChild(confirmContainer);
}

// Draw Floating Widget
function drawWidget(state) {
  const root = getOrCreateShadowRoot();
  shadowHost.className = 'traction-interactive';

  widgetElement = document.createElement('div');
  widgetElement.className = 'traction-widget';

  // Drag Handle
  const handle = document.createElement('div');
  handle.className = 'widget-drag-handle';
  handle.innerHTML = '<span></span><span></span><span></span>';
  widgetElement.appendChild(handle);

  // Mode Indicator Dot
  const dot = document.createElement('div');
  dot.className = `widget-indicator ${state.mode === 'break' ? 'break' : ''}`;
  widgetElement.appendChild(dot);

  // Time Count text
  const timeText = document.createElement('span');
  timeText.className = 'widget-time';
  timeText.textContent = '00:00';
  widgetElement.appendChild(timeText);

  // Goal info (if active)
  if (state.activeGoal) {
    const divider = document.createElement('div');
    divider.className = 'widget-divider';
    widgetElement.appendChild(divider);

    const goal = document.createElement('span');
    goal.className = 'widget-goal';
    goal.textContent = state.activeGoal;
    goal.title = state.activeGoal;
    widgetElement.appendChild(goal);
  }

  root.appendChild(widgetElement);

  // Initialize Draggable events
  makeElementDraggable(widgetElement);

  // Start counter updates inside widget
  startTimerCounter(state.endTime, timeText);
}

// Timer counting ticking logic
function startTimerCounter(endTime, displayElement) {
  if (timerUpdateInterval) clearInterval(timerUpdateInterval);

  const update = () => {
    const secondsLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    displayElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (secondsLeft <= 0) {
      clearInterval(timerUpdateInterval);
      checkBlockState();
    }
  };

  update();
  timerUpdateInterval = setInterval(update, 1000);
}

// Element Dragger logic (Pointer API for multi-device support)
function makeElementDraggable(el) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  // Set default coordinates if not set (bottom right corner)
  el.style.bottom = '20px';
  el.style.right = '20px';
  el.style.top = 'auto';
  el.style.left = 'auto';

  const dragMouseDown = (e) => {
    e = e || window.event;
    // Don't drag if clicking buttons inside widget (if any)
    if (e.target.tagName === 'BUTTON') return;
    
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    document.onpointermove = elementDrag;
    document.onpointerup = closeDragElement;
    el.style.transition = 'none'; // disable transitions while dragging
  };

  const elementDrag = (e) => {
    e = e || window.event;
    e.preventDefault();
    
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    // Boundary checking
    let newTop = el.offsetTop - pos2;
    let newLeft = el.offsetLeft - pos1;

    const maxLeft = window.innerWidth - el.offsetWidth - 10;
    const maxTop = window.innerHeight - el.offsetHeight - 10;

    newLeft = Math.max(10, Math.min(newLeft, maxLeft));
    newTop = Math.max(10, Math.min(newTop, maxTop));

    // set the element's new position:
    el.style.top = newTop + "px";
    el.style.left = newLeft + "px";
    el.style.bottom = 'auto';
    el.style.right = 'auto';
  };

  const closeDragElement = () => {
    // stop moving when mouse button is released:
    document.onpointermove = null;
    document.onpointerup = null;
    el.style.transition = 'transform 0.2s, border-color 0.3s, box-shadow 0.3s';
  };

  el.onpointerdown = dragMouseDown;
}

// Clean up DOM objects
function removeBlocker() {
  if (blockerElement) {
    blockerElement.remove();
    blockerElement = null;
  }
  if (breathingInterval) {
    clearTimeout(breathingInterval);
    breathingInterval = null;
  }
  document.body.classList.remove('traction-blocked-scroll');
}

function removeWidget() {
  if (widgetElement) {
    widgetElement.remove();
    widgetElement = null;
  }
  if (timerUpdateInterval) {
    clearInterval(timerUpdateInterval);
    timerUpdateInterval = null;
  }
}

// Run state checks initially
checkBlockState();

// Listen to storage shifts from background / popup
chrome.storage.onChanged.addListener((changes) => {
  if (changes.state || changes.settings) {
    checkBlockState();
  }
});

// Listen to direct messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'timerExpired' || message.action === 'timerStarted' || 
      message.action === 'timerPaused' || message.action === 'timerResumed' || 
      message.action === 'timerReset' || message.action === 'emergencyPassGranted') {
    checkBlockState();
  }
});
