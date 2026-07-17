# Traction Control

Traction Control is a premium Chrome extension designed to eliminate browser distractions, maintain focus, and build momentum on your tasks.

## Key Features

- **Adjustable Focus Timer**: Integrated customizable Pomodoro countdown (5m–120m focus, 1m–30m break) with interactive visual styling.
- **Distraction Nudge Screen**: Intercepts visits to blocked sites (e.g. YouTube, Twitter) during focus sessions, replacing them with a glassmorphic breathing guide overlay.
- **Draggable On-Page Widget**: Floating timer pill injected on normal web pages so you can monitor your goal status anywhere.
- **Shadow DOM Isolation**: Renders overlays and widgets in encapsulated shadow roots to prevent website CSS conflicts.
- **Decoupled Sync**: Robust storage-driven timer engine powered by Chrome Alarms.

## Installation

1. Navigate to `chrome://extensions/` in Google Chrome.
2. Toggle **Developer mode** on in the top-right.
3. Click **Load unpacked** in the top-left.
4. Select the `traction-control-extension` directory.

## Project Structure

```text
├── manifest.json       # Extension settings & permissions
├── background.js       # Background alarm manager & badge updates
├── popup.html/css/js   # UI Panel for timer settings, blocklist & statistics
├── content.js/css      # Page overlays, breathing rings & floating widgets
└── icons/              # Vector graphics assets
```
