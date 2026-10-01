#!/bin/bash
# <xbar.title>Signal Strength</xbar.title>
# <xbar.desc>Coloured dot in the menu bar showing current download speed.</xbar.desc>
# <xbar.dependencies>curl</xbar.dependencies>
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
#
# SwiftBar plugin: shows connection quality as a coloured dot in the macOS
# menu bar. The ".5s." in the filename sets how often SwiftBar runs it.
# See menubar/README.md for setup.
#
# Measures speed like the web app: times a download of the same ~150 KB file.
# Runs on its own; it doesn't record anything or talk to the app.

# Keep in sync with Config.speedTest.testUrl in js/Config.js
TEST_URL='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
# Seconds. Must stay under the refresh interval in the filename.
TIMEOUT=4
# Mbps. Keep in sync with Config.speedThresholds in js/Config.js
GOOD=5
MODERATE=1

GREEN='#4CAF50'
YELLOW='#FFC107'
ORANGE='#FF9800'
LIGHT_GREY='#BDBDBD'
DARK_GREY='#616161'

# Decimal points must be '.', whatever the system locale
export LC_ALL=C

# Prints the menu bar dot and the dropdown line beneath it.
show() {
  echo "●| color=$1"
  echo '---'
  echo "$2"
}

# Succeeds when $1 >= $2 (bash can't compare decimals itself).
at_least() {
  awk -v a="$1" -v b="$2" 'BEGIN { exit !(a >= b) }'
}

# No default route means the local network itself is gone (Wi-Fi off,
# tether unplugged), as opposed to connected with no upstream signal.
# Checks the output so it doesn't depend on route's exit status.
if ! route -n get default 2>/dev/null | grep -q 'interface:'; then
  show "$DARK_GREY" 'Disconnected'
  exit 0
fi

# curl still reports what it got when it times out, so a very slow link
# reads as slow rather than as no signal.
read -r bytes seconds < <(
  curl --silent --fail --output /dev/null --max-time "$TIMEOUT" \
    --header 'Cache-Control: no-cache' \
    --write-out '%{size_download} %{time_total}' \
    "$TEST_URL?_t=$(date +%s)"
)

if ! at_least "${bytes:-0}" 1 || ! at_least "${seconds:-0}" 0.000001; then
  show "$LIGHT_GREY" 'No signal'
  exit 0
fi

mbps=$(awk -v b="$bytes" -v t="$seconds" 'BEGIN { print b * 8 / t / 1000000 }')

if at_least "$mbps" "$GOOD"; then
  colour=$GREEN
elif at_least "$mbps" "$MODERATE"; then
  colour=$YELLOW
else
  colour=$ORANGE
fi

show "$colour" "$(printf '%.1f' "$mbps") Mbps"
