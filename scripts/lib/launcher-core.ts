/**
 * scripts/lib/launcher-core.ts
 *
 * Core automation routines for Kogane Turnkey Launcher:
 * - Hardware & Network LAN auto-detection
 * - Port binding verification & PID detection
 * - Windows Defender Firewall rule automation (non-fatal, UAC fallback)
 * - Database health verification & starter workstation auto-initialization
 * - Terminal QR Code generation (compact UTF-8 blocks)
 * - Interactive Terminal Dashboard formatting
 * - Default browser auto-launch
 * - Optional Cloudflare Quick Tunnel integration
 */

import os from 'node:os';
import net from 'node:net';
import { exec, execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderUnicodeCompact } from 'uqr';
import { initializeDatabase, STARTER_WORKSTATIONS } from '../db-reset';
import { resolveSqliteDbPath } from '../../lib/db-sqlite';

export interface NetworkInterfaceCandidate {
  name: string;
  address: string;
  family: string;
  mac: string;
  internal: boolean;
  score: number;
  isPrivate: boolean;
}

export interface LanDetectionResult {
  primaryIp: string;
  adapterName: string;
  isLoopback: boolean;
  gatewayIp?: string;
  allCandidates: NetworkInterfaceCandidate[];
}

export interface PortCheckResult {
  available: boolean;
  inUse: boolean;
  code?: string;
  occupyingPid?: number | null;
}

export interface FirewallRuleResult {
  success: boolean;
  alreadyExisted: boolean;
  message: string;
}

export interface DatabasePrepResult {
  ready: boolean;
  path: string;
  isFresh: boolean;
  workstationCount: number;
  adminEmail: string;
}

export interface DashboardConfig {
  port: number;
  lanIp: string;
  adapterName: string;
  firewallStatus: string;
  dbPath: string;
  workstationCount: number;
  engineMode: 'production' | 'development';
  tunnelUrl?: string | null;
  invertQr?: boolean;
}

/**
 * Checks if an IPv4 address is in RFC 1918 private address space:
 * - 10.0.0.0/8
 * - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 * - 192.168.0.0/16
 */
export function isPrivateIpv4(ip: string): boolean {
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('10.')) return true;

  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts[0] === 172) {
    return parts[1] >= 16 && parts[1] <= 31;
  }
  return false;
}

/**
 * Checks if an adapter name represents a virtual, VPN, or tunnel interface.
 */
export function isVirtualAdapter(name: string): boolean {
  const lower = name.toLowerCase();
  const virtualKeywords = [
    'vethernet',
    'hyper-v',
    'wsl',
    'tailscale',
    'zerotier',
    'docker',
    'virtualbox',
    'vmware',
    'host-only',
    'loopback',
    'pseudo',
    'teredo',
    'isatap',
    'bluetooth',
    'vpn',
    'virtual',
    'tap',
    'tun',
    'wireguard',
    'nordlynx',
    'openvpn',
    'fortinet',
    'anyconnect',
    'cisco',
    'pcap',
    'npcap',
    'bridge',
    'container',
    'sandbox',
  ];
  return virtualKeywords.some((keyword) => lower.includes(keyword));
}

/**
 * Queries the active default gateway route on Windows (via fast `route print 0.0.0.0`).
 * Identifies the interface IP currently handling traffic to the local Wi-Fi / Ethernet router.
 */
export function getDefaultGatewayRoute(): { ip: string; gateway: string; metric: number } | null {
  if (process.platform !== 'win32') return null;
  try {
    const out = execSync('route print 0.0.0.0', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const matches = [...out.matchAll(/\s+0\.0\.0\.0\s+0\.0\.0\.0\s+(\S+)\s+(\S+)\s+(\d+)/g)];
    if (matches.length === 0) return null;
    const routes = matches.map((m) => ({
      gateway: m[1],
      ip: m[2],
      metric: parseInt(m[3], 10),
    }));
    routes.sort((a, b) => a.metric - b.metric);
    const valid = routes.find(
      (r) => !r.ip.startsWith('127.') && !r.ip.startsWith('169.254.') && r.ip !== '0.0.0.0'
    );
    return valid || routes[0] || null;
  } catch {
    return null;
  }
}

/**
 * Computes a reliability score for a network candidate.
 * Physical Ethernet and Wi-Fi adapters connected to the active default gateway rank highest.
 */
export function scoreNetworkCandidate(
  name: string,
  ip: string,
  mac: string,
  isDefaultGateway = false
): number {
  let score = 0;
  const lower = name.toLowerCase();

  // 1. IP range scoring
  if (ip.startsWith('192.168.')) {
    score += 50;
  } else if (ip.startsWith('10.')) {
    score += 48;
  } else if (isPrivateIpv4(ip)) {
    score += 45;
  }

  // 2. Active default gateway route bonus (confirmed connection to router)
  if (isDefaultGateway) {
    score += 200;
  }

  // 3. Adapter name preference
  if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('wlan')) {
    score += 35;
  } else if (lower.includes('ethernet') || lower.includes('eth') || lower.includes('local area connection')) {
    score += 30;
  }

  // 4. Virtual / tunnel adapter strong penalty
  if (isVirtualAdapter(name)) {
    score -= 1000;
  }

  // 5. VirtualBox default host-only subnet penalty
  if (ip.startsWith('192.168.56.')) {
    score -= 200;
  }

  // 6. Valid non-empty physical MAC bonus
  if (mac && mac !== '00:00:00:00:00:00') {
    score += 10;
  }

  return score;
}

/**
 * Scans active network adapters and returns the best LAN IPv4 address.
 * Automatically ignores loopback (127.0.0.1) and APIPA (169.254.x.x).
 * Supports preferredIp override.
 */
export function detectLanIp(
  customInterfaces?: Record<string, Array<{ address: string; family: string | number; internal: boolean; mac: string }>>,
  preferredIp?: string
): LanDetectionResult {
  const ifaces = customInterfaces || (os.networkInterfaces() as Record<string, Array<{ address: string; family: string | number; internal: boolean; mac: string }>>);
  const candidates: NetworkInterfaceCandidate[] = [];

  // Query default gateway IP (Windows route print 0.0.0.0) if not in custom mock test
  const defaultGateway = !customInterfaces ? getDefaultGatewayRoute() : null;
  const gatewayIp = defaultGateway?.ip;

  for (const [name, details] of Object.entries(ifaces || {})) {
    if (!details) continue;

    for (const iface of details) {
      // Must be IPv4
      const isIpv4 = iface.family === 'IPv4' || (iface.family as unknown) === 4;
      if (!isIpv4) continue;

      // Ignore loopback
      if (iface.internal || iface.address.startsWith('127.')) continue;

      // Ignore APIPA link-local (169.254.x.x) and unspecified
      if (iface.address.startsWith('169.254.') || iface.address === '0.0.0.0') continue;

      const isDefGw = Boolean(gatewayIp && iface.address === gatewayIp);
      let score = scoreNetworkCandidate(name, iface.address, iface.mac, isDefGw);

      // If operator specified a preferred IP, grant top priority
      if (preferredIp && iface.address === preferredIp) {
        score += 10000;
      }

      candidates.push({
        name,
        address: iface.address,
        family: 'IPv4',
        mac: iface.mac,
        internal: iface.internal,
        score,
        isPrivate: isPrivateIpv4(iface.address),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    return {
      primaryIp: candidates[0].address,
      adapterName: candidates[0].name,
      isLoopback: false,
      gatewayIp: defaultGateway?.gateway,
      allCandidates: candidates,
    };
  }

  // Fallback to local loopback if no physical network adapter is connected
  return {
    primaryIp: preferredIp || '127.0.0.1',
    adapterName: 'Loopback (Offline)',
    isLoopback: true,
    allCandidates: [],
  };
}

/**
 * Checks whether a given TCP port is available on 0.0.0.0.
 */
export async function checkPortAvailability(port: number, host = '0.0.0.0'): Promise<PortCheckResult> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve({
          available: false,
          inUse: true,
          code: 'EADDRINUSE',
        });
      } else {
        resolve({
          available: false,
          inUse: false,
          code: err.code,
        });
      }
    });

    server.once('listening', () => {
      server.close(() => {
        resolve({
          available: true,
          inUse: false,
        });
      });
    });

    server.listen(port, host);
  });
}

/**
 * Finds the PID and process name of the process listening on a port.
 */
export async function getPidOnPort(port: number): Promise<{ pid: number; processName?: string } | null> {
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      // 1. Fast netstat check
      exec(`cmd /c "netstat -ano -p tcp | findstr /R /C:\":${port} \" "`, (err, stdout) => {
        let pid: number | null = null;
        if (!err && stdout.trim()) {
          for (const line of stdout.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.includes('LISTENING')) {
              const tokens = trimmed.split(/\s+/);
              const lastToken = tokens[tokens.length - 1];
              const parsed = parseInt(lastToken, 10);
              if (!Number.isNaN(parsed) && parsed > 0) {
                pid = parsed;
                break;
              }
            }
          }
        }

        // 2. PowerShell fallback if netstat didn't match
        if (!pid) {
          try {
            const psOut = execSync(
              `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1)"`,
              { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
            ).trim();
            const parsed = parseInt(psOut, 10);
            if (!Number.isNaN(parsed) && parsed > 0) {
              pid = parsed;
            }
          } catch {}
        }

        if (!pid) {
          return resolve(null);
        }

        // 3. Resolve executable name via tasklist
        try {
          const taskOut = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
          });
          const match = taskOut.match(/^"([^"]+)"/);
          const processName = match ? match[1] : undefined;
          resolve({ pid, processName });
        } catch {
          resolve({ pid });
        }
      });
    });
  }

  // POSIX fallback
  return new Promise((resolve) => {
    exec(`lsof -i :${port} -t`, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
      } else {
        const pid = parseInt(stdout.trim().split('\n')[0], 10);
        resolve(Number.isNaN(pid) ? null : { pid });
      }
    });
  });
}

/**
 * Probes an HTTP origin to see if a Kogane server is responding.
 */
export async function isKoganeResponding(origin: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${origin}/api/terminals/cashier-register-001/meta`, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);
    if (!res) return false;

    if (res.status === 200) {
      const data = await res.json().catch(() => null) as { businessName?: string } | null;
      return Boolean(data && data.businessName);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Verifies and configures Windows Defender Firewall inbound rule for port 3000.
 * Language-independent: works reliably on English, Spanish, French, German, Asian Windows installations.
 * Checks if named rule exists OR if port 3000 is already unblocked inbound.
 * If administrator elevation is needed, triggers UAC without failing or crashing.
 */
export async function ensureFirewallRule(port = 3000, ruleName = 'Kogane LAN Port 3000'): Promise<FirewallRuleResult> {
  if (process.platform !== 'win32') {
    return {
      success: true,
      alreadyExisted: true,
      message: 'Non-Windows operating system; firewall rule skipped.',
    };
  }

  // 1. Language-independent check: rule existence or port unblocked
  const checkRule = (): boolean => {
    // 1A. Check named rule via netsh exit code (0 = rule found)
    try {
      execSync(`netsh advfirewall firewall show rule name="${ruleName}"`, {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return true;
    } catch {}

    // 1B. Check named rule via PowerShell (language-neutral)
    try {
      const psNamed = execSync(
        `powershell -NoProfile -Command "(Get-NetFirewallRule -DisplayName '${ruleName}' -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' }) -ne $null"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (psNamed.toLowerCase() === 'true') {
        return true;
      }
    } catch {}

    // 1C. Check if port is already unblocked inbound by any rule
    try {
      const psPortAllowed = execSync(
        `powershell -NoProfile -Command "(Get-NetFirewallPortFilter -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq '${port}' -and $_.Protocol -eq 'TCP' } | Get-NetFirewallRule -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' }) -ne $null"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (psPortAllowed.toLowerCase() === 'true') {
        return true;
      }
    } catch {}

    return false;
  };

  if (checkRule()) {
    return {
      success: true,
      alreadyExisted: true,
      message: `Inbound firewall rule "${ruleName}" is already active for port ${port}.`,
    };
  }

  // 2. Try adding rule directly
  try {
    execSync(`netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=TCP localport=${port}`, {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    if (checkRule()) {
      return {
        success: true,
        alreadyExisted: false,
        message: `Successfully configured inbound firewall rule "${ruleName}" on TCP port ${port}.`,
      };
    }
  } catch {
    // Permission denied, elevation needed
  }

  // 3. Request elevation via PowerShell UAC helper (non-blocking / safe)
  try {
    execSync(
      `powershell -NoProfile -Command "Start-Process netsh -ArgumentList 'advfirewall firewall add rule name=\\\"${ruleName}\\\" dir=in action=allow protocol=TCP localport=${port}' -Verb RunAs -Wait"`,
      { stdio: ['ignore', 'ignore', 'ignore'] }
    );
    if (checkRule()) {
      return {
        success: true,
        alreadyExisted: false,
        message: `Firewall rule "${ruleName}" configured successfully with Administrator elevation.`,
      };
    }
  } catch {
    // User clicked 'No' or prompt timed out
  }

  return {
    success: false,
    alreadyExisted: false,
    message: `Firewall rule could not be configured automatically. If remote tablets cannot connect, run scripts\\allow-lan-port-3000.bat as Administrator.`,
  };
}

/**
 * Checks and prepares the SQLite database.
 * If fresh or missing, automatically creates platform tables, admin user, and 5 starter workstations.
 */
export function ensureDatabaseReady(customPath?: string): DatabasePrepResult {
  const targetPath = customPath || resolveSqliteDbPath();
  const fileExisted = existsSync(targetPath);

  const initResult = initializeDatabase({
    dbPath: targetPath,
    forceReset: false,
    silent: true,
  });

  // Count active terminals
  let workstationCount = 5;
  try {
    const { Database } = require('bun:sqlite');
    const db = new Database(targetPath, { readonly: true });
    const count = db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM terminals').get()?.count ?? 5;
    workstationCount = count;
    db.close();
  } catch {
    workstationCount = STARTER_WORKSTATIONS.length;
  }

  return {
    ready: true,
    path: targetPath,
    isFresh: !fileExisted || initResult.isFresh,
    workstationCount,
    adminEmail: initResult.adminEmail,
  };
}

/**
 * Renders a crisp UTF-8 block QR code for the terminal.
 */
export function generateTerminalQr(url: string, options: { border?: number; invert?: boolean; indent?: number } = {}): string {
  const border = options.border ?? 2;
  const invert = options.invert ?? false;
  const indent = ' '.repeat(options.indent ?? 4);

  const rawQr = renderUnicodeCompact(url, {
    border,
    invert,
  });

  return rawQr
    .split('\n')
    .map((line) => indent + line)
    .join('\n');
}

/**
 * Automatically launches the default web browser to the given URL.
 */
export async function openBrowser(url: string): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      exec(`cmd /c start "" "${url}"`);
      return true;
    } else if (process.platform === 'darwin') {
      exec(`open "${url}"`);
      return true;
    } else {
      exec(`xdg-open "${url}"`);
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Formats the rich console dashboard for restaurant deployment.
 */
export function formatDashboard(config: DashboardConfig): string {
  const port = config.port;
  const lanIp = config.lanIp;
  const lanUrl = `http://${lanIp}:${port}`;
  const localUrl = `http://localhost:${port}`;
  const isLoopback = lanIp === '127.0.0.1' || lanIp === 'localhost';

  const localQr = generateTerminalQr(isLoopback ? localUrl : lanUrl, {
    border: 2,
    invert: config.invertQr ?? false,
    indent: 6,
  });

  const tunnelQr = config.tunnelUrl
    ? generateTerminalQr(config.tunnelUrl, {
        border: 2,
        invert: config.invertQr ?? false,
        indent: 6,
      })
    : null;

  const divider = '─'.repeat(78);
  const doubleDivider = '═'.repeat(78);

  const lines = [
    '',
    '  ╔════════════════════════════════════════════════════════════════════════════╗',
    '  ║                                                                            ║',
    '  ║     ██╗  ██╗ ██████╗   ██████╗  █████╗  ███╗   ██╗ ███████╗                ║',
    '  ║     ██║ ██╔╝██╔═══██╗ ██╔════╝ ██╔══██╗ ████╗  ██║ ██╔════╝                ║',
    '  ║     █████╔╝ ██║   ██║ ██║  ███╗███████║ ██╔██╗ ██║ █████╗                  ║',
    '  ║     ██╔═██╗ ██║   ██║ ██║   ██║██╔══██║ ██║╚██╗██║ ██╔══╝                  ║',
    '  ║     ██║  ██╗╚██████╔╝ ╚██████╔╝██║  ██║ ██║ ╚████║ ███████╗                ║',
    '  ║     ╚═╝  ╚═╝ ╚═════╝   ╚═════╝ ╚═╝  ╚═╝ ╚═╝  ╚═══╝ ╚══════╝                ║',
    '  ║                                                                            ║',
    '  ║             KOGANE RESTAURANT WORKSTATION POS & LOCAL CLOUD                ║',
    '  ╚════════════════════════════════════════════════════════════════════════════╝',
    '',
    `  ${doubleDivider}`,
    '    HARDWARE & NETWORK SYSTEM STATUS',
    `  ${divider}`,
    `    [✓] Network Adapter:      ${config.adapterName}`,
    `    [✓] Local LAN IPv4:       ${config.lanIp}`,
    `    [✓] Windows Firewall:     ${config.firewallStatus}`,
    `    [✓] Local Database:       ${config.dbPath} (${config.workstationCount} workstations ready)`,
    `    [✓] Production Engine:    Nitro Production Server (Listening on 0.0.0.0:${port})`,
    `  ${doubleDivider}`,
    '    STATION ACCESS URLS (CLICKABLE IN TERMINAL)',
    `  ${divider}`,
    `    Counter / Admin PC:       ${localUrl}`,
    `    Local Network (LAN):      ${lanUrl}`,
  ];

  if (config.tunnelUrl) {
    lines.push(`    Cloudflare Tunnel:        ${config.tunnelUrl}`);
  }

  lines.push(
    '',
    '    DIRECT WORKSTATION LINKS (TABLETS & PHONES):',
    `      [1] Front Counter (Cashier):  ${lanUrl}/terminal/cashier-register-001`,
    `      [2] Kitchen Queue (KDS):      ${lanUrl}/terminal/kitchen-display-001`,
    `      [3] Stock Room (Inventory):   ${lanUrl}/terminal/inventory-manager-001`,
    `      [4] Menu Catalog (Desk):      ${lanUrl}/terminal/d047d7294f03036a4f3fe94fa3be66d0`,
    `      [5] Finance Console (Owner):  ${lanUrl}/terminal/reports-viewer-001`,
    '',
    '    DEFAULT CREDENTIALS:',
    '      • Admin Login:              admin@kogane.dev  (Password: admin123)',
    '      • Workstation PIN:          1234',
    `  ${doubleDivider}`,
  );

  if (tunnelQr && config.tunnelUrl) {
    lines.push(
      '    MOBILE & TABLET DEPLOYMENT (POINT PHONE CAMERA TO SCAN)',
      `  ${divider}`,
      '',
      '    [1/2] LOCAL RESTAURANT WI-FI (iPads, Android tablets, order stations on LAN):',
      `          Target URL: ${isLoopback ? localUrl : lanUrl}`,
      '',
      localQr,
      '',
      '    [2/2] REMOTE CELLULAR / INTERNET (Cloudflare Tunnel - 4G/5G / Remote Phones):',
      `          Target URL: ${config.tunnelUrl}`,
      '',
      tunnelQr,
      '',
      '    Open the Camera app on any iPhone, iPad, or Android to connect immediately.',
      `  ${doubleDivider}`,
    );
  } else {
    lines.push(
      '    MOBILE & TABLET DEPLOYMENT (POINT PHONE CAMERA TO SCAN)',
      `  ${divider}`,
      '',
      '    LOCAL RESTAURANT WI-FI (Tablets & Phones on this Network):',
      `    Target URL: ${isLoopback ? localUrl : lanUrl}`,
      '',
      localQr,
      '',
      `    ${isLoopback ? '[!] Offline Mode: Connected locally only.' : 'Open the Camera app on any iPhone, iPad, or Android on this Wi-Fi.'}`,
      "    [i] Need cellular phone access outside Wi-Fi? Press 't' or pass --tunnel for Cloudflare QR.",
      `  ${doubleDivider}`,
    );
  }

  lines.push(
    '    INTERACTIVE KEYBOARD CONTROLS (TYPE IN THIS WINDOW):',
    '      • [1] - [5]  : Open specific Station in default browser',
    `      • [b]        : Open Counter / Homepage (${localUrl})`,
    '      • [t]        : Start / stop Cloudflare Quick Tunnel for remote phones',
    '      • [r]        : Refresh / redraw dashboard screen',
    '      • [q] / ^C   : Clean shutdown',
    `  ${doubleDivider}`,
    '  Server is running. Press [q] or Ctrl+C at any time to shut down.',
    ''
  );

  return lines.join('\n');
}
