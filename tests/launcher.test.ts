import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import net from 'node:net';
import {
  isPrivateIpv4,
  isVirtualAdapter,
  scoreNetworkCandidate,
  detectLanIp,
  checkPortAvailability,
  ensureDatabaseReady,
  generateTerminalQr,
  formatDashboard,
  ensureFirewallRule,
} from '../scripts/lib/launcher-core';
import { STARTER_WORKSTATIONS, initializeDatabase } from '../scripts/db-reset';

describe('Launcher Network & Hardware Auto-Detection', () => {
  test('isPrivateIpv4 correctly categorizes RFC 1918 addresses and rejects public/loopback/APIPA', () => {
    // RFC 1918 192.168.0.0/16
    expect(isPrivateIpv4('192.168.1.1')).toBe(true);
    expect(isPrivateIpv4('192.168.254.10')).toBe(true);

    // RFC 1918 10.0.0.0/8
    expect(isPrivateIpv4('10.0.0.1')).toBe(true);
    expect(isPrivateIpv4('10.200.5.12')).toBe(true);

    // RFC 1918 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
    expect(isPrivateIpv4('172.16.0.1')).toBe(true);
    expect(isPrivateIpv4('172.24.100.5')).toBe(true);
    expect(isPrivateIpv4('172.31.255.254')).toBe(true);
    expect(isPrivateIpv4('172.15.0.1')).toBe(false);
    expect(isPrivateIpv4('172.32.0.1')).toBe(false);

    // Public IPs
    expect(isPrivateIpv4('8.8.8.8')).toBe(false);
    expect(isPrivateIpv4('1.1.1.1')).toBe(false);
    expect(isPrivateIpv4('142.250.190.46')).toBe(false);

    // Loopback & APIPA
    expect(isPrivateIpv4('127.0.0.1')).toBe(false);
    expect(isPrivateIpv4('169.254.120.45')).toBe(false);
  });

  test('isVirtualAdapter flags Hyper-V, WSL, Docker, Tailscale, ZeroTier, VMware, WireGuard, OpenVPN TAP/TUN, and VPNs', () => {
    expect(isVirtualAdapter('vEthernet (Default Switch)')).toBe(true);
    expect(isVirtualAdapter('vEthernet (WSL)')).toBe(true);
    expect(isVirtualAdapter('Hyper-V Virtual Ethernet')).toBe(true);
    expect(isVirtualAdapter('Tailscale')).toBe(true);
    expect(isVirtualAdapter('ZeroTier One')).toBe(true);
    expect(isVirtualAdapter('Docker0')).toBe(true);
    expect(isVirtualAdapter('VMware Network Adapter VMnet1')).toBe(true);
    expect(isVirtualAdapter('VirtualBox Host-Only Ethernet Adapter')).toBe(true);
    expect(isVirtualAdapter('TAP-Windows Adapter V9')).toBe(true);
    expect(isVirtualAdapter('WireGuard Tunnel')).toBe(true);
    expect(isVirtualAdapter('NordLynx')).toBe(true);
    expect(isVirtualAdapter('OpenVPN Data Channel Offload')).toBe(true);
    expect(isVirtualAdapter('Cisco AnyConnect Secure Mobility Client')).toBe(true);

    // Physical adapters should not be flagged
    expect(isVirtualAdapter('Wi-Fi')).toBe(false);
    expect(isVirtualAdapter('WiFi')).toBe(false);
    expect(isVirtualAdapter('Ethernet')).toBe(false);
    expect(isVirtualAdapter('Local Area Connection')).toBe(false);
    expect(isVirtualAdapter('WLAN')).toBe(false);
  });

  test('scoreNetworkCandidate prefers physical LAN adapters over virtual tunnels and gives gateway bonus', () => {
    const wifiScore = scoreNetworkCandidate('Wi-Fi', '192.168.1.100', 'aa:bb:cc:dd:ee:ff');
    const ethScore = scoreNetworkCandidate('Ethernet', '192.168.1.50', 'aa:bb:cc:dd:ee:ff');
    const ethGatewayScore = scoreNetworkCandidate('Ethernet', '192.168.1.50', 'aa:bb:cc:dd:ee:ff', true);
    const vEthernetScore = scoreNetworkCandidate('vEthernet (WSL)', '172.28.16.1', '00:15:5d:01:02:03');
    const tailscaleScore = scoreNetworkCandidate('Tailscale', '100.64.0.1', '00:00:00:00:00:00');
    const virtualBoxScore = scoreNetworkCandidate('VirtualBox Host-Only Ethernet Adapter', '192.168.56.1', '0a:00:27:00:00:00');

    expect(wifiScore).toBeGreaterThan(vEthernetScore);
    expect(ethScore).toBeGreaterThan(vEthernetScore);
    expect(ethScore).toBeGreaterThan(tailscaleScore);
    expect(ethScore).toBeGreaterThan(virtualBoxScore);
    expect(ethGatewayScore).toBeGreaterThan(ethScore);
  });

  test('detectLanIp prioritizes physical Wi-Fi or Ethernet over virtual adapters', () => {
    const mockInterfaces = {
      'vEthernet (WSL)': [
        { address: '172.28.16.1', family: 'IPv4', internal: false, mac: '00:15:5d:ab:cd:ef' },
      ],
      'Wi-Fi': [
        { address: '192.168.1.120', family: 'IPv4', internal: false, mac: 'f0:2f:74:11:22:33' },
      ],
      'Loopback Pseudo-Interface 1': [
        { address: '127.0.0.1', family: 'IPv4', internal: true, mac: '00:00:00:00:00:00' },
      ],
      'APIPA Adapter': [
        { address: '169.254.10.20', family: 'IPv4', internal: false, mac: '02:00:00:00:00:00' },
      ],
    };

    const result = detectLanIp(mockInterfaces);
    expect(result.primaryIp).toBe('192.168.1.120');
    expect(result.adapterName).toBe('Wi-Fi');
    expect(result.isLoopback).toBe(false);
  });

  test('detectLanIp respects preferredIp override even among multiple interfaces', () => {
    const mockInterfaces = {
      'Wi-Fi': [
        { address: '192.168.1.120', family: 'IPv4', internal: false, mac: 'f0:2f:74:11:22:33' },
      ],
      'Ethernet 2': [
        { address: '10.0.0.55', family: 'IPv4', internal: false, mac: 'f0:2f:74:99:88:77' },
      ],
    };

    const result = detectLanIp(mockInterfaces, '10.0.0.55');
    expect(result.primaryIp).toBe('10.0.0.55');
    expect(result.adapterName).toBe('Ethernet 2');
  });

  test('detectLanIp handles offline mode by cleanly falling back to 127.0.0.1 loopback', () => {
    const mockOffline = {
      'Loopback Pseudo-Interface 1': [
        { address: '127.0.0.1', family: 'IPv4', internal: true, mac: '00:00:00:00:00:00' },
      ],
    };

    const result = detectLanIp(mockOffline);
    expect(result.primaryIp).toBe('127.0.0.1');
    expect(result.isLoopback).toBe(true);
    expect(result.allCandidates).toHaveLength(0);
  });

  test('detectLanIp automatically ignores APIPA addresses (169.254.x.x)', () => {
    const mockApipaOnly = {
      'Ethernet 2': [
        { address: '169.254.88.99', family: 'IPv4', internal: false, mac: '00:11:22:33:44:55' },
      ],
    };

    const result = detectLanIp(mockApipaOnly);
    expect(result.primaryIp).toBe('127.0.0.1');
    expect(result.isLoopback).toBe(true);
  });
});

describe('Launcher Port Availability & Inspection', () => {
  test('checkPortAvailability returns available=true for an open random high port', async () => {
    const testPort = 39182;
    const result = await checkPortAvailability(testPort);
    expect(result.available).toBe(true);
    expect(result.inUse).toBe(false);
  });

  test('checkPortAvailability returns inUse=true when a port is bound by a server', async () => {
    const testPort = 39183;
    const server = net.createServer();

    await new Promise<void>((resolve) => {
      server.listen(testPort, '0.0.0.0', () => resolve());
    });

    try {
      const result = await checkPortAvailability(testPort);
      expect(result.available).toBe(false);
      expect(result.inUse).toBe(true);
      expect(result.code).toBe('EADDRINUSE');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('Launcher Database Preparation & Workstation Setup', () => {
  const testDbPath = join(process.cwd(), 'test-launcher-temp.db');

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      try { unlinkSync(testDbPath); } catch {}
    }
  });

  afterEach(() => {
    if (existsSync(testDbPath)) {
      try { unlinkSync(testDbPath); } catch {}
    }
  });

  test('ensureDatabaseReady auto-initializes a fresh database with 5 starter workstations and menu', () => {
    expect(existsSync(testDbPath)).toBe(false);

    const result = ensureDatabaseReady(testDbPath);
    expect(result.ready).toBe(true);
    expect(result.isFresh).toBe(true);
    expect(result.workstationCount).toBeGreaterThanOrEqual(5);
    expect(result.adminEmail).toBe('admin@kogane.dev');
    expect(existsSync(testDbPath)).toBe(true);

    // Verify workstations in the SQLite database
    const { Database } = require('bun:sqlite');
    const db = new Database(testDbPath);
    const workstations = db.query<{ id: string; display_name: string; role: string; pin_code: string }, []>(
      'SELECT id, display_name, role, pin_code FROM terminals'
    ).all();

    expect(workstations.length).toBeGreaterThanOrEqual(5);

    const ids = workstations.map((w) => w.id);
    expect(ids).toContain('d047d7294f03036a4f3fe94fa3be66d0'); // Menu Catalog
    expect(ids).toContain('cashier-register-001'); // Front Counter
    expect(ids).toContain('kitchen-display-001'); // Kitchen Queue
    expect(ids).toContain('inventory-manager-001'); // Stock Room
    expect(ids).toContain('reports-viewer-001'); // Finance Console

    // PIN 1234
    for (const ws of workstations) {
      expect(ws.pin_code).toBe('1234');
    }

    // Verify starter products exist
    const products = db.query<{ name: string; price: number }, []>(
      'SELECT name, price FROM biz_devadmin_products'
    ).all();
    expect(products.length).toBeGreaterThanOrEqual(8);

    db.close();
  });

  test('ensureDatabaseReady preserves existing databases without wiping data', () => {
    // First initialize
    ensureDatabaseReady(testDbPath);

    // Second call should detect existing DB
    const secondResult = ensureDatabaseReady(testDbPath);
    expect(secondResult.ready).toBe(true);
    expect(secondResult.isFresh).toBe(false);
    expect(secondResult.workstationCount).toBeGreaterThanOrEqual(5);
  });
});

describe('Launcher Terminal QR Code & Dashboard Display', () => {
  test('generateTerminalQr renders compact UTF-8 block QR code with configurable border and indent', () => {
    const testUrl = 'http://192.168.1.16:3000';
    const qrString = generateTerminalQr(testUrl, { border: 2, indent: 4 });

    expect(qrString).toBeDefined();
    expect(typeof qrString).toBe('string');
    expect(qrString.length).toBeGreaterThan(50);

    // Check for Unicode block characters (e.g. █, ▀, ▄)
    expect(qrString).toMatch(/[█▀▄]/);

    // Check indentation of lines
    const lines = qrString.split('\n');
    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) {
      expect(line.startsWith('    ')).toBe(true);
    }
  });

  test('formatDashboard includes all station URLs, admin credentials, LAN IP, and mobile instructions', () => {
    const dashboard = formatDashboard({
      port: 3000,
      lanIp: '192.168.1.16',
      adapterName: 'Ethernet',
      firewallStatus: 'Inbound Allowed',
      dbPath: 'dev.db',
      workstationCount: 5,
      engineMode: 'production',
      tunnelUrl: 'https://kogane-test.trycloudflare.com',
    });

    // Check clickable URLs
    expect(dashboard).toContain('http://localhost:3000');
    expect(dashboard).toContain('http://192.168.1.16:3000');
    expect(dashboard).toContain('https://kogane-test.trycloudflare.com');

    // Check station direct paths
    expect(dashboard).toContain('/terminal/cashier-register-001');
    expect(dashboard).toContain('/terminal/kitchen-display-001');
    expect(dashboard).toContain('/terminal/inventory-manager-001');
    expect(dashboard).toContain('/terminal/d047d7294f03036a4f3fe94fa3be66d0');
    expect(dashboard).toContain('/terminal/reports-viewer-001');

    // Check credentials
    expect(dashboard).toContain('admin@kogane.dev');
    expect(dashboard).toContain('1234');

    // Check hardware & status information
    expect(dashboard).toContain('Ethernet');
    expect(dashboard).toContain('192.168.1.16');
    expect(dashboard).toContain('Inbound Allowed');
    expect(dashboard).toContain('5 workstations ready');

    // Check mobile QR instructions
    expect(dashboard).toContain('Camera app');
    expect(dashboard).toContain('[1/2] LOCAL RESTAURANT WI-FI');
    expect(dashboard).toContain('[2/2] REMOTE CELLULAR / INTERNET');
  });

  test('ensureFirewallRule returns without throwing errors or crashing', async () => {
    const result = await ensureFirewallRule(3000, 'Kogane LAN Port 3000');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.alreadyExisted).toBe('boolean');
    expect(typeof result.message).toBe('string');
  });

  test('getPidOnPort executes cleanly without throwing errors', async () => {
    const { getPidOnPort } = await import('../scripts/lib/launcher-core');
    const result = await getPidOnPort(3000);
    // May be null or object with pid
    if (result) {
      expect(typeof result.pid).toBe('number');
    } else {
      expect(result).toBeNull();
    }
  });
});
