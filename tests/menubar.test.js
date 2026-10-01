// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Config } from '../js/Config.js';
import { DataPoint } from '../js/models/DataPoint.js';
import { formatSpeed } from '../js/utils/formatters.js';

const SCRIPT = join(import.meta.dirname, '..', 'menubar', 'signal-strength.5s.sh');

/**
 * What the web app shows for a reading, as menu bar output: the map marker
 * colour and the speed text.
 * @param {number|null} measuredMbps - Raw speed, before the app rounds it
 * @param {string} [connectionType]
 * @returns {{dot: string, detail: string}}
 */
function appShows(measuredMbps, connectionType = 'unknown') {
  // SpeedTestService rounds to 2 decimals before storing
  const speedMbps = measuredMbps === null ? null : Math.round(measuredMbps * 100) / 100;
  const point = new DataPoint({
    timestamp: Date.now(), latitude: null, longitude: null, accuracy: null, speedMbps, connectionType
  });
  return { dot: `●| color=${point.getColor()}`, detail: formatSpeed(speedMbps, connectionType) };
}

// Runs the plugin with stand-in `route` and `curl` commands on PATH, so each
// test controls whether there's a network and what the download reports.
describe('menu bar plugin', () => {
  let stubDir;

  beforeEach(() => {
    stubDir = mkdtempSync(join(tmpdir(), 'menubar-'));
    // Prints the default route's interface like macOS, or an error when there
    // is none. Exits 0 either way, so the plugin can't lean on the exit status.
    writeFileSync(join(stubDir, 'route'), [
      '#!/bin/bash',
      'if [ -n "$STUB_NO_ROUTE" ]; then echo "route: writing to routing socket: not in table" >&2',
      'else printf "   route to: default\\n  interface: en0\\n"; fi',
      ''
    ].join('\n'), { mode: 0o755 });
    writeFileSync(join(stubDir, 'curl'), [
      '#!/bin/bash',
      'printf "%s\\n" "$@" > "$STUB_DIR/curl-args"',
      'printf "%s %s" "$STUB_BYTES" "$STUB_SECONDS"',
      'exit "${STUB_CURL_EXIT:-0}"',
      ''
    ].join('\n'), { mode: 0o755 });
  });

  afterEach(() => {
    rmSync(stubDir, { recursive: true, force: true });
  });

  /**
   * Runs the plugin and splits its output into the menu bar line and dropdown.
   * @returns {{dot: string, detail: string}}
   */
  function run(env) {
    const output = execFileSync('bash', [SCRIPT], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, STUB_DIR: stubDir, ...env }
    });
    const [dot, separator, detail] = output.trimEnd().split('\n');
    expect(separator).toBe('---');
    return { dot, detail };
  }

  // 125,000 bytes in one second is exactly 1 Mbps
  const download = (mbps, extra = {}) => ({ STUB_BYTES: String(mbps * 125000), STUB_SECONDS: '1', ...extra });

  // Either side of each threshold, plus the app's rounding and number format
  it.each([0.5, 0.99, 1, 1.5, 1.99, 1.996, 2, 4.2, 12.5, 150])(
    'shows the same colour and speed as the app at %s Mbps',
    (mbps) => {
      expect(run(download(mbps))).toEqual(appShows(mbps));
    }
  );

  it('treats a download that timed out part-way as no signal, like the app', () => {
    const result = run({ STUB_BYTES: '70000', STUB_SECONDS: '4.0', STUB_CURL_EXIT: '28' });
    expect(result).toEqual(appShows(null, 'no-signal'));
  });

  it('shows no signal when nothing downloads', () => {
    const result = run({ STUB_BYTES: '0', STUB_SECONDS: '0.2', STUB_CURL_EXIT: '7' });
    expect(result).toEqual(appShows(null, 'no-signal'));
  });

  it('shows disconnected without testing when there is no network', () => {
    const result = run({ ...download(5), STUB_NO_ROUTE: '1' });
    expect(result).toEqual(appShows(null, 'disconnected'));
    expect(() => readFileSync(join(stubDir, 'curl-args'))).toThrow();
  });

  it('downloads the same file as the app, within the refresh interval', () => {
    run(download(5));
    const args = readFileSync(join(stubDir, 'curl-args'), 'utf8').split('\n');

    expect(args.find(arg => arg.startsWith('https://'))).toMatch(`${Config.speedTest.testUrl}?_t=`);
    const refreshSeconds = Number(SCRIPT.match(/\.(\d+)s\.sh$/)[1]);
    expect(Number(args[args.indexOf('--max-time') + 1])).toBeLessThan(refreshSeconds);
  });
});
