// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Config } from '../js/Config.js';

const SCRIPT = join(import.meta.dirname, '..', 'menubar', 'signal-strength.5s.sh');
const { good, moderate } = Config.speedThresholds;

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

  it('shows green at the good threshold', () => {
    expect(run(download(good))).toEqual({ dot: '●| color=#4CAF50', detail: `${good.toFixed(1)} Mbps` });
  });

  it('shows yellow just below the good threshold', () => {
    expect(run(download(good - 0.01)).dot).toBe('●| color=#FFC107');
  });

  it('shows yellow at the moderate threshold', () => {
    expect(run(download(moderate)).dot).toBe('●| color=#FFC107');
  });

  it('shows orange below the moderate threshold', () => {
    expect(run(download(moderate - 0.01)).dot).toBe('●| color=#FF9800');
  });

  it('measures a download that timed out part-way as slow, not as no signal', () => {
    const result = run({ STUB_BYTES: '70000', STUB_SECONDS: '4.0', STUB_CURL_EXIT: '28' });
    expect(result).toEqual({ dot: '●| color=#FF9800', detail: '0.1 Mbps' });
  });

  it('shows light grey when nothing downloads', () => {
    const result = run({ STUB_BYTES: '0', STUB_SECONDS: '0.2', STUB_CURL_EXIT: '7' });
    expect(result).toEqual({ dot: '●| color=#BDBDBD', detail: 'No signal' });
  });

  it('shows dark grey without testing when there is no network', () => {
    const result = run({ ...download(good), STUB_NO_ROUTE: '1' });
    expect(result).toEqual({ dot: '●| color=#616161', detail: 'Disconnected' });
    expect(() => readFileSync(join(stubDir, 'curl-args'))).toThrow();
  });

  it('downloads the same file as the app, within the refresh interval', () => {
    run(download(good));
    const args = readFileSync(join(stubDir, 'curl-args'), 'utf8').split('\n');

    expect(args.find(arg => arg.startsWith('https://'))).toMatch(`${Config.speedTest.testUrl}?_t=`);
    const refreshSeconds = Number(SCRIPT.match(/\.(\d+)s\.sh$/)[1]);
    expect(Number(args[args.indexOf('--max-time') + 1])).toBeLessThan(refreshSeconds);
  });
});
