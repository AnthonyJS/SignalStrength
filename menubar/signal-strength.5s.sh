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
# Measures and colours speed like the web app: times a download of the same
# ~150 KB file and uses the same colours as its map markers.
# Runs on its own; it doesn't record anything or talk to the app.

# Keep in sync with Config.speedTest.testUrl in js/Config.js
TEST_URL='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
# Seconds. Must stay under the refresh interval in the filename.
TIMEOUT=4
# Mbps and colours. Keep in sync with DataPoint.getQuality() and
# DataPoint.getColor() in js/models/DataPoint.js
GOOD=2
MODERATE=1

GREEN='#4CAF50'
YELLOW='#FFC107'
RED='#f44336'
GREY='#9E9E9E'
DARK_GREY='#424242'

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

# Like the app, a download that fails or doesn't finish in time is no signal
if ! result=$(
  curl --silent --fail --output /dev/null --max-time "$TIMEOUT" \
    --header 'Cache-Control: no-cache' \
    --write-out '%{size_download} %{time_total}' \
    "$TEST_URL?_t=$(date +%s)"
); then
  show "$GREY" 'No signal'
  exit 0
fi

read -r bytes seconds <<< "$result"
# Rounded to 2 decimals before classifying, as the app does
mbps=$(awk -v b="$bytes" -v t="$seconds" 'BEGIN { printf "%.2f", b * 8 / t / 1000000 }')

if at_least "$mbps" "$GOOD"; then
  colour=$GREEN
elif at_least "$mbps" "$MODERATE"; then
  colour=$YELLOW
else
  colour=$RED
fi

# Same format as the app: whole numbers from 10 Mbps, one decimal below
speed=$(awk -v m="$mbps" 'BEGIN { if (m >= 10) printf "%d", int(m + 0.5); else printf "%.1f", int(m * 10 + 0.5) / 10 }')
show "$colour" "$speed Mbps"
