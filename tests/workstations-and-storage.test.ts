import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { sanitizeStoragePath, useStorage } from '../lib/storage';
import {
  TERMINAL_PERMISSION_PRESETS,
  presetByKey,
  isActionAllowed,
} from '../lib/permissions';
import {
  getStationName,
  inferStarterTerminals,
  layoutVariantsForPreset,
  defaultLayoutVariantForPreset,
  TERMINAL_LAYOUT_VARIANTS,
} from '../lib/starterWorkstations';
import { starterTableNamesForPreset } from '../server/utils/starterTables';
import { BUILDER_PRESETS } from '../lib/builderPresets';

describe('Storage path sanitization and adapters', () => {
  test('sanitizeStoragePath strips leading slashes and prevents path traversal', () => {
    expect(sanitizeStoragePath('avatars/pic.png')).toBe('avatars/pic.png');
    expect(sanitizeStoragePath('/public/avatars/pic.png')).toBe('public/avatars/pic.png');
    expect(sanitizeStoragePath('///a//b///c.png')).toBe('a/b/c.png');

    expect(() => sanitizeStoragePath('../escape.png')).toThrow();
    expect(() => sanitizeStoragePath('avatars/../etc/passwd')).toThrow();
    expect(() => sanitizeStoragePath('')).toThrow();
  });

  test('useStorage returns DevStorageAdapter when DEV_MODE is true or Supabase is not configured', () => {
    const originalDevMode = process.env.DEV_MODE;
    const originalUrl = process.env.SUPABASE_URL;
    const originalKey = process.env.SUPABASE_SERVICE_KEY;

    try {
      process.env.DEV_MODE = 'true';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;

      const storage = useStorage();
      expect(storage).toBeDefined();
      expect(typeof storage.upload).toBe('function');
      expect(typeof storage.read).toBe('function');
    } finally {
      process.env.DEV_MODE = originalDevMode;
      if (originalUrl) process.env.SUPABASE_URL = originalUrl;
      if (originalKey) process.env.SUPABASE_SERVICE_KEY = originalKey;
    }
  });
});

describe('Workstations presets and visibility', () => {
  test('all 5 official workstations exist with correct preset keys', () => {
    const expectedKeys = [
      'cashier-register',
      'catalog-registrar',
      'inventory-manager',
      'kitchen-display',
      'reports-viewer',
    ];

    const keys = TERMINAL_PERMISSION_PRESETS.map((p) => p.key);
    expect(keys).toEqual(expectedKeys);

    for (const key of expectedKeys) {
      const preset = presetByKey(key);
      expect(preset).toBeDefined();
      expect(preset!.label.length).toBeGreaterThan(0);
      expect(preset!.description.length).toBeGreaterThan(0);
    }
  });

  test('builder presets correspond to the 5 official workstation layouts', () => {
    const builderPresetIds = BUILDER_PRESETS.map((p) => p.id);
    expect(builderPresetIds).toContain('cashier-station');
    expect(builderPresetIds).toContain('catalog-station');
    expect(builderPresetIds).toContain('inventory-station');
    expect(builderPresetIds).toContain('kitchen-station');
    expect(builderPresetIds).toContain('reports-station');
  });

  test('starterTableNamesForPreset provisions required business tables', () => {
    expect(starterTableNamesForPreset('cashier-register')).toEqual(['products', 'orders']);
    expect(starterTableNamesForPreset('catalog-registrar')).toEqual(['products']);
    expect(starterTableNamesForPreset('inventory-manager')).toEqual(['inventory']);
    expect(starterTableNamesForPreset('kitchen-display')).toEqual(['orders']);
    expect(starterTableNamesForPreset('reports-viewer')).toEqual([]);
  });

  test('inferStarterTerminals provides all relevant stations for restaurant with orders & inventory', () => {
    const terminals = inferStarterTerminals('restaurant', ['orders', 'inventory']);
    const keys = terminals.map((t) => t.presetKey);

    expect(keys).toContain('cashier-register');
    expect(keys).toContain('catalog-registrar');
    expect(keys).toContain('inventory-manager');
    expect(keys).toContain('kitchen-display');
    expect(keys).toContain('reports-viewer');
  });

  test('layout variants exist for each workstation preset', () => {
    for (const preset of TERMINAL_PERMISSION_PRESETS) {
      const variants = layoutVariantsForPreset(preset.key);
      expect(variants.length).toBeGreaterThan(0);

      const defaultVariant = defaultLayoutVariantForPreset(preset.key);
      expect(defaultVariant).toBe(variants[0].id);
    }
  });
});
