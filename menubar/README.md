# Menu bar signal dot (macOS)

A [SwiftBar](https://swiftbar.app) plugin that shows your current connection
quality as a coloured dot in the Mac menu bar, updated every 5 seconds. Click
the dot to see the measured speed.

It runs its own speed test (the same ~150 KB download the web app uses), so it
works without the app open. It doesn't record journeys or show on the map.

The colours and ranges are the same as the markers on the app's map
(`DataPoint` in `js/models/DataPoint.js`):

| Dot | Meaning |
|---|---|
| 🟢 Green | 2 Mbps or more |
| 🟡 Yellow | 1–2 Mbps |
| 🔴 Red | Under 1 Mbps |
| Grey | No signal: still connected to Wi-Fi or tethering, but the test failed or didn't finish in time |
| Dark grey | Disconnected: no network connection at all |

## Setup

1. Install SwiftBar:
   ```bash
   brew install --cask swiftbar
   ```
2. Open SwiftBar. When it asks for a plugin folder, create and choose one,
   e.g. `~/SwiftBarPlugins`.
3. From the repo root, link the script into that folder:
   ```bash
   ln -s "$PWD/menubar/signal-strength.5s.sh" ~/SwiftBarPlugins/
   ```
   Linking (rather than copying) means `git pull` keeps it up to date.

The dot appears within a few seconds. The script also works with
[xbar](https://xbarapp.com).

## Things to know

- **Data use:** each test downloads ~150 KB, which is about **108 MB an hour**
  every hour SwiftBar is running. On a metered connection, pause it from the
  SwiftBar menu when you don't need it.
- **Don't run it while the app is recording.** The two tests compete for
  bandwidth, so each will sometimes read slower than the real speed.
- **Changing the interval:** the `.5s.` in the filename sets how often it
  runs. To change it, rename the file (e.g. `.10s.`), re-link it, and keep
  `TIMEOUT` in the script below the new interval.
