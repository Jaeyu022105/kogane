#!/usr/bin/env bun
/**
 * scripts/launcher.ts
 *
 * Kogane Restaurant Workstation POS - Automated Turnkey Launcher
 *
 * 1-Click End-to-End Orchestrator:
 * 1. Hardware & Network Auto-Detection (Ethernet/Wi-Fi scanning, RFC 1918 LAN IPv4)
 * 2. Windows Defender Firewall Port 3000 Inbound Automation (Safe UAC elevation)
 * 3. Database & Workstation Prep (Auto-creates 5 starter stations if fresh)
 * 4. Production Bundle Compilation (.output verification)
 * 5. Production Server Launch on 0.0.0.0:3000
 * 6. Browser Auto-Open to Counter / Admin Desk
 * 7. Interactive Terminal Dashboard with Clickable Links and UTF-8 Mobile QR Code
 * 8. Optional Cloudflare Quick Tunnel for remote/cellular mobile access
 */

import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  detectLanIp,
  checkPortAvailability,
  getPidOnPort,
  isKoganeResponding,
  ensureFirewallRule,
  ensureDatabaseReady,
  openBrowser,
  formatDashboard,
} from './lib/launcher-core';
import { initializeDatabase } from './db-reset';

// Ensure ~/.bun/bin is on PATH if present
const userBunBin = join(process.env.USERPROFILE || '', '.bun', 'bin');
if (existsSync(userBunBin) && !process.env.PATH?.includes(userBunBin)) {
  process.env.PATH = `${userBunBin};${process.env.PATH || ''}`;
}

// Process arguments
const args = process.argv.slice(2);

function getArgValue(flag: string): string | null {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
}

const hasFlag = (flag: string) => args.includes(flag);

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
  Kogane Restaurant Workstation POS - Automated Launcher

  Usage:
    bun run scripts/launcher.ts [options]
    kogane.exe [options]

  Options:
    --port <port>        Port to listen on (default: 3000 or $PORT)
    --host <host>        Host to listen on (default: 0.0.0.0 or $HOST)
    --ip <ip>            Override local LAN IPv4 address manually
    --db <path>          Custom SQLite database file path (e.g. kogane.db)
    --no-open            Do not automatically open default web browser
    --tunnel             Start Cloudflare quick tunnel for remote phone access
    --invert-qr          Invert QR code colors (for light-theme terminal windows)
    --reset-db           Reset and re-seed the SQLite database before start
    --dev                Run in Nuxt development mode instead of production
    --help, -h           Show this help message
  `);
  process.exit(0);
}

const PORT = parseInt(getArgValue('--port') || process.env.PORT || '3000', 10);
const HOST = getArgValue('--host') || process.env.HOST || '0.0.0.0';
const OVERRIDE_IP = getArgValue('--ip');
const CUSTOM_DB = getArgValue('--db');
const NO_OPEN = hasFlag('--no-open');
const ENABLE_TUNNEL = hasFlag('--tunnel') || process.env.KOGANE_TUNNEL === 'true';
const INVERT_QR = hasFlag('--invert-qr');
const RESET_DB = hasFlag('--reset-db');
const DEV_MODE = hasFlag('--dev');

let serverProcess: ChildProcess | null = null;
let tunnelInstance: { close: () => Promise<void>; getURL: () => Promise<string> } | null = null;
let currentTunnelUrl: string | null = null;

function resolveServerRunner(): { command: string; argsPrefix: string[] } {
  // 1. System PATH bun
  try {
    execSync('bun -v', { stdio: 'ignore' });
    return { command: 'bun', argsPrefix: ['run'] };
  } catch {}

  // 2. User profile .bun
  const userBun = join(process.env.USERPROFILE || '', '.bun', 'bin', 'bun.exe');
  if (existsSync(userBun)) {
    return { command: userBun, argsPrefix: ['run'] };
  }

  // 3. LocalAppData bun
  const localAppBun = join(process.env.LOCALAPPDATA || '', 'bun', 'bin', 'bun.exe');
  if (existsSync(localAppBun)) {
    return { command: localAppBun, argsPrefix: ['run'] };
  }

  // 4. If current process is bun
  if (process.execPath.toLowerCase().endsWith('bun.exe') || process.execPath.toLowerCase().endsWith('bun')) {
    return { command: process.execPath, argsPrefix: ['run'] };
  }

  // 5. Fallback: warn and default to bun
  console.warn('[!] Notice: Bun runtime not detected on default PATH. Attempting bun run...');
  return { command: 'bun', argsPrefix: ['run'] };
}

async function cleanup() {
  console.log('\n[*] Shutting down Kogane Restaurant Server...');
  if (tunnelInstance) {
    try {
      await tunnelInstance.close();
    } catch {}
  }
  if (serverProcess && !serverProcess.killed) {
    try {
      if (process.platform === 'win32' && serverProcess.pid) {
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/T', '/F'], { stdio: 'ignore' });
      } else {
        serverProcess.kill('SIGINT');
      }
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function main() {
  console.clear();
  console.log('\n============================================================');
  console.log('  KOGANE RESTAURANT POS - AUTOMATED 1-CLICK TURNKEY LAUNCH');
  console.log('============================================================\n');

  const runner = resolveServerRunner();

  // STEP 1: Network & Hardware Auto-Detection
  console.log('[1/5] Scanning network adapters & hardware...');
  const netResult = detectLanIp(undefined, OVERRIDE_IP || undefined);
  const lanIp = netResult.primaryIp;
  const adapterName = netResult.adapterName;

  console.log(`      • Active Adapter:    ${adapterName}`);
  console.log(`      • Local LAN IPv4:    ${lanIp}`);
  if (netResult.gatewayIp) {
    console.log(`      • Default Gateway:   ${netResult.gatewayIp}`);
  }

  // Test port availability
  const portResult = await checkPortAvailability(PORT, HOST);
  if (!portResult.available) {
    console.log(`      [!] Port ${PORT} is currently in use.`);
    const procInfo = await getPidOnPort(PORT);
    if (procInfo) {
      const { pid, processName } = procInfo;
      console.log(`      [!] PID ${pid}${processName ? ` (${processName})` : ''} is occupying port ${PORT}.`);
      const isKogane = await isKoganeResponding(`http://127.0.0.1:${PORT}`);
      if (isKogane) {
        console.log(`      [*] Detected running Kogane instance. Recycling process for clean launch...`);
      } else {
        console.log(`      [*] Terminating previous listener on port ${PORT}...`);
      }
      try {
        spawn('taskkill', ['/pid', pid.toString(), '/F'], { stdio: 'ignore' });
        await new Promise((r) => setTimeout(r, 800));
      } catch {}
    }

    // Re-verify port availability
    const recheck = await checkPortAvailability(PORT, HOST);
    if (!recheck.available) {
      console.error(`\n[FATAL] Port ${PORT} could not be freed. Please close conflicting apps and retry.`);
      process.exit(1);
    }
  }
  console.log(`      [✓] Port ${PORT} is ready.`);

  // STEP 2: Firewall Automation
  console.log('\n[2/5] Verifying Windows Defender Firewall...');
  const fwResult = await ensureFirewallRule(PORT, 'Kogane LAN Port 3000');
  const firewallStatus = fwResult.alreadyExisted
    ? 'Inbound Allowed (Existing Rule)'
    : fwResult.success
    ? 'Inbound Allowed (Configured)'
    : 'Manual config required';
  console.log(`      [✓] Firewall Status: ${firewallStatus}`);
  if (!fwResult.success && process.platform === 'win32') {
    console.log(`      [i] Notice: ${fwResult.message}`);
  }

  // STEP 3: Database & Workstation Verification
  console.log('\n[3/5] Verifying local database & starter workstations...');
  if (RESET_DB) {
    console.log('      [*] Resetting database (--reset-db requested)...');
    initializeDatabase({ dbPath: CUSTOM_DB || undefined, forceReset: true, silent: true });
  }

  const dbResult = ensureDatabaseReady(CUSTOM_DB || undefined);
  console.log(`      • Database File:     ${dbResult.path}`);
  console.log(`      • Workstations:      ${dbResult.workstationCount} registered stations ready`);
  if (dbResult.isFresh) {
    console.log(`      [✓] Fresh database initialized with 5 starter workstations.`);
  } else {
    console.log(`      [✓] Database healthy and validated.`);
  }

  // STEP 4: Production Build Verification & Server Startup
  console.log('\n[4/5] Preparing server engine...');
  const prodEntry = join(process.cwd(), '.output', 'server', 'index.mjs');
  const hasProdBuild = existsSync(prodEntry);

  if (!hasProdBuild && !DEV_MODE) {
    console.log('      [*] Production build not found. Compiling optimized bundle...');
    const buildProcess = spawn(runner.command, [...runner.argsPrefix, 'build'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: false,
    });

    const buildSuccess = await new Promise<boolean>((resolve) => {
      buildProcess.on('exit', (code) => resolve(code === 0));
      buildProcess.on('error', () => resolve(false));
    });

    if (!buildSuccess) {
      console.error('      [!] Build failed. Falling back to development mode server.');
    }
  }

  const useProduction = existsSync(prodEntry) && !DEV_MODE;
  console.log(`      [*] Starting ${useProduction ? 'optimized production server' : 'development server'}...`);

  const serverEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: PORT.toString(),
    NITRO_PORT: PORT.toString(),
    HOST,
    NITRO_HOST: HOST,
    NODE_ENV: useProduction ? 'production' : 'development',
    DEV_MODE: 'true',
    SQLITE_DB_PATH: dbResult.path,
    NUXT_PUBLIC_SHARE_ORIGIN: `http://${lanIp}:${PORT}`,
  };

  if (useProduction) {
    serverProcess = spawn(runner.command, [...runner.argsPrefix, prodEntry], {
      cwd: process.cwd(),
      env: serverEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
  } else {
    serverProcess = spawn(runner.command, [...runner.argsPrefix, '--bun', 'nuxt', 'dev', '--host', HOST, '--port', PORT.toString()], {
      cwd: process.cwd(),
      env: serverEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
  }

  serverProcess.stdout?.on('data', () => {});
  serverProcess.stderr?.on('data', () => {});

  serverProcess.on('error', (err) => {
    console.error(`\n[FATAL] Server process error: ${err.message}`);
    cleanup();
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n[FATAL] Server exited with code ${code}`);
      cleanup();
    }
  });

  // Wait for server to respond to HTTP probe
  console.log('      [*] Waiting for server to become responsive...');
  const probeUrl = `http://127.0.0.1:${PORT}`;
  let serverReady = false;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const res = await fetch(probeUrl).catch(() => null);
      if (res && (res.status === 200 || res.status === 302 || res.status === 404)) {
        serverReady = true;
        break;
      }
    } catch {}
  }

  if (!serverReady) {
    console.error('\n[FATAL] Server did not become ready within 25 seconds.');
    cleanup();
  }
  console.log('      [✓] Server is online and accepting connections.');

  // STEP 5: Cloudflare Tunnel (Optional)
  if (ENABLE_TUNNEL) {
    console.log('\n[+] Starting Cloudflare Quick Tunnel for remote phone access...');
    try {
      const { startTunnel } = await import('untun');
      const tunnel = await startTunnel({
        port: PORT,
        acceptCloudflareNotice: true,
      });
      if (tunnel) {
        tunnelInstance = tunnel;
        currentTunnelUrl = await tunnel.getURL();
        console.log(`      [✓] Cloudflare Tunnel active: ${currentTunnelUrl}`);
      }
    } catch (err: unknown) {
      console.log(`      [!] Could not start Cloudflare tunnel: ${(err as Error).message}`);
    }
  }

  // STEP 6: Auto-Open Default Browser
  if (!NO_OPEN) {
    console.log(`\n[5/5] Launching default browser to http://localhost:${PORT}...`);
    await openBrowser(`http://localhost:${PORT}`);
  }

  const renderDashboardScreen = () => {
    console.clear();
    const dashboard = formatDashboard({
      port: PORT,
      lanIp,
      adapterName,
      firewallStatus,
      dbPath: dbResult.path,
      workstationCount: dbResult.workstationCount,
      engineMode: useProduction ? 'production' : 'development',
      tunnelUrl: currentTunnelUrl,
      invertQr: INVERT_QR,
    });
    console.log(dashboard);
  };

  renderDashboardScreen();

  // Keep process alive and handle optional interactive keyboard shortcuts
  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', async (key: string) => {
        const k = key.toLowerCase();
        // Ctrl+C or 'q' exits
        if (key === '\u0003' || k === 'q') {
          await cleanup();
        }
        // 'b' opens homepage
        if (k === 'b') {
          console.log('\n[*] Re-opening counter/homepage in browser...');
          await openBrowser(`http://localhost:${PORT}`);
        }
        // Workstation direct shortcuts: 1..5
        if (k === '1') {
          console.log('\n[*] Opening Front Counter (Cashier) in browser...');
          await openBrowser(`http://localhost:${PORT}/terminal/cashier-register-001`);
        } else if (k === '2') {
          console.log('\n[*] Opening Kitchen Queue (KDS) in browser...');
          await openBrowser(`http://localhost:${PORT}/terminal/kitchen-display-001`);
        } else if (k === '3') {
          console.log('\n[*] Opening Stock Room (Inventory) in browser...');
          await openBrowser(`http://localhost:${PORT}/terminal/inventory-manager-001`);
        } else if (k === '4') {
          console.log('\n[*] Opening Menu Catalog in browser...');
          await openBrowser(`http://localhost:${PORT}/terminal/d047d7294f03036a4f3fe94fa3be66d0`);
        } else if (k === '5') {
          console.log('\n[*] Opening Finance Console in browser...');
          await openBrowser(`http://localhost:${PORT}/terminal/reports-viewer-001`);
        }
        // 't' toggles Cloudflare tunnel
        if (k === 't') {
          if (tunnelInstance) {
            console.log('\n[*] Closing Cloudflare Tunnel...');
            try {
              await tunnelInstance.close();
            } catch {}
            tunnelInstance = null;
            currentTunnelUrl = null;
            renderDashboardScreen();
          } else {
            console.log('\n[*] Starting Cloudflare Quick Tunnel...');
            try {
              const { startTunnel } = await import('untun');
              const tunnel = await startTunnel({
                port: PORT,
                acceptCloudflareNotice: true,
              });
              if (tunnel) {
                tunnelInstance = tunnel;
                currentTunnelUrl = await tunnel.getURL();
                renderDashboardScreen();
              }
            } catch (err: unknown) {
              console.error(`[!] Failed to start tunnel: ${(err as Error).message}`);
            }
          }
        }
        // 'r' redraws dashboard
        if (k === 'r') {
          renderDashboardScreen();
        }
      });
    } catch {}
  }
}

main().catch((err) => {
  console.error('\n[FATAL] Unhandled launcher error:', err);
  process.exit(1);
});
