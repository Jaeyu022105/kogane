import { describe, expect, test } from 'bun:test';
import {
  ALL_TERMINAL_PERMISSION_PRESETS,
  INDUSTRY_PERMISSION_PRESETS,
  isActionAllowed,
  inferPermissionPreset,
  presetByKey,
  presetsForIndustry,
  type PermissionPresetKey,
} from '../lib/permissions';
import {
  ALL_BUILDER_PRESETS,
  INDUSTRY_BUILDER_PRESETS,
} from '../lib/builderPresets';
import { STATION_OBJECTS } from '../lib/stationObjects';
import {
  defaultLayoutVariantForPreset,
  getStationName,
  inferStarterTerminals,
  layoutVariantsForPreset,
} from '../lib/starterWorkstations';
import {
  STARTER_BUSINESS_TABLES,
  ensureStarterBusinessTables,
  starterTableNamesForPreset,
} from '../server/utils/starterTables';
import { buildCreateTableSql } from '../lib/schemaUtils';
import { createManagedTerminal } from '../server/utils/managedTerminals';
import { createAdminSessionToken } from '../lib/authUtils';
import { createTestAdminToken, createTestTerminalToken } from './helpers/sessions';
import { db } from '../lib/db';
import eventHandler from '../server/api/runtime/event.post';
import onboardHandler from '../server/api/businesses/onboard.post';

function makePostEvent(url: string, body: unknown, cookie: string, extraHeaders: Record<string, string> = {}) {
  const hdrs = {
    ...(cookie ? { cookie } : {}),
    'content-type': 'application/json',
    ...extraHeaders,
  };
  return {
    method: 'POST',
    path: url,
    node: {
      req: {
        method: 'POST',
        url,
        headers: hdrs,
        body,
        [Symbol.for('h3ParsedBody')]: body,
      },
      res: {},
    },
    headers: new Headers(hdrs),
    context: { body },
    _body: body,
  } as any;
}

describe('Specialized Terminals for All 8 Industries', () => {
  test('every non-restaurant industry receives dedicated operational starter terminals (never reports-only)', () => {
    const industryCases: Array<{ type: string; features: string[]; expectedKeys: PermissionPresetKey[] }> = [
      {
        type: 'logistics',
        features: ['deliveries', 'customers', 'staff'],
        expectedKeys: ['dispatch-console', 'service-directory', 'reports-viewer'],
      },
      {
        type: 'logistics',
        features: ['inventory', 'orders', 'staff'],
        expectedKeys: ['dispatch-console', 'inventory-manager', 'service-directory', 'reports-viewer'],
      },
      {
        type: 'accounting',
        features: ['invoices', 'expenses', 'customers'],
        expectedKeys: ['billing-ledger', 'service-directory', 'reports-viewer'],
      },
      {
        type: 'accounting',
        features: ['staff', 'expenses'],
        expectedKeys: ['billing-ledger', 'service-directory', 'reports-viewer'],
      },
      {
        type: 'retail',
        features: ['inventory', 'orders', 'customers'],
        expectedKeys: ['cashier-register', 'catalog-registrar', 'inventory-manager', 'service-directory', 'reports-viewer'],
      },
      {
        type: 'clinic',
        features: ['appointments', 'customers', 'staff'],
        expectedKeys: ['appointment-desk', 'service-directory', 'reports-viewer'],
      },
      {
        type: 'clinic',
        features: ['appointments', 'customers', 'invoices'],
        expectedKeys: ['appointment-desk', 'service-directory', 'billing-ledger', 'reports-viewer'],
      },
      {
        type: 'services',
        features: ['invoices', 'customers', 'expenses'],
        expectedKeys: ['billing-ledger', 'service-directory', 'reports-viewer'],
      },
      {
        type: 'services',
        features: ['staff', 'customers', 'invoices', 'expenses'],
        expectedKeys: ['billing-ledger', 'service-directory', 'reports-viewer'],
      },
      {
        type: 'education',
        features: ['appointments', 'customers', 'invoices'],
        expectedKeys: ['appointment-desk', 'service-directory', 'billing-ledger', 'reports-viewer'],
      },
      {
        type: 'education',
        features: ['customers', 'staff', 'expenses'],
        expectedKeys: ['service-directory', 'billing-ledger', 'reports-viewer'],
      },
      {
        type: 'other',
        features: ['customers', 'staff'],
        expectedKeys: ['service-directory', 'reports-viewer'],
      },
      {
        type: 'other',
        features: [],
        expectedKeys: ['service-directory', 'reports-viewer'],
      },
    ];

    for (const c of industryCases) {
      const terminals = inferStarterTerminals(c.type, c.features);
      const keys = terminals.map((t) => t.presetKey);

      for (const expected of c.expectedKeys) {
        expect(keys).toContain(expected);
      }
      // Every industry must have at least one non-reports operational terminal
      expect(keys.some((k) => k !== 'reports-viewer')).toBe(true);
    }
  });

  test('presetsForIndustry prioritizes relevant specialized workstations per business type', () => {
    expect(presetsForIndustry('logistics')[0].key).toBe('dispatch-console');
    expect(presetsForIndustry('accounting')[0].key).toBe('billing-ledger');
    expect(presetsForIndustry('clinic')[0].key).toBe('appointment-desk');
    expect(presetsForIndustry('retail')[0].key).toBe('cashier-register');
    expect(presetsForIndustry('other')[0].key).toBe('service-directory');

    expect(getStationName('logistics', 'dispatch-console')).toBe('Dispatch & Delivery Console');
    expect(getStationName('accounting', 'billing-ledger')).toBe('Billing & Bookkeeping Desk');
    expect(getStationName('clinic', 'appointment-desk')).toBe('Patient Intake & Triage Desk');
    expect(getStationName('services', 'appointment-desk')).toBe('Booking & Job Queue Desk');
    expect(getStationName('education', 'service-directory')).toBe('Student & Faculty Registry');
    expect(getStationName('retail', 'service-directory')).toBe('Clienteling & Loyalty Desk');
    expect(getStationName('other', 'service-directory')).toBe('Workspace Operations Hub');
  });

  test('all industry builder presets stay within 1280x720 bounds with zero overlaps and have layout variants', () => {
    expect(INDUSTRY_PERMISSION_PRESETS.length).toBe(4);
    expect(INDUSTRY_BUILDER_PRESETS.length).toBe(4);
    expect(ALL_TERMINAL_PERMISSION_PRESETS.length).toBe(9);
    expect(ALL_BUILDER_PRESETS.length).toBe(9);

    for (const preset of ALL_TERMINAL_PERMISSION_PRESETS) {
      const variants = layoutVariantsForPreset(preset.key);
      expect(variants.length).toBeGreaterThanOrEqual(2);
      expect(defaultLayoutVariantForPreset(preset.key)).toBe(variants[0].id);

      const recommended = STATION_OBJECTS.filter((obj) => obj.recommendedFor.includes(preset.key));
      expect(recommended.length).toBeGreaterThan(0);
    }

    for (const bp of INDUSTRY_BUILDER_PRESETS) {
      const elements = bp.layout.elements;
      expect(elements.length).toBeGreaterThan(3);

      for (const el of elements) {
        expect(el.position.x).toBeGreaterThanOrEqual(0);
        expect(el.position.y).toBeGreaterThanOrEqual(0);
        expect(el.position.x + el.position.width).toBeLessThanOrEqual(1280);
        expect(el.position.y + el.position.height).toBeLessThanOrEqual(720);
      }

      // Pairwise non-overlapping check for interactive widgets (ignoring subtitle below title only if needed, checking exact overlap)
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const a = elements[i].position;
          const b = elements[j].position;
          const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
          const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
          expect(overlapX && overlapY).toBe(false);
        }
      }
    }
  });

  test('starter business tables compile to valid SQLite DDL for every industry preset', () => {
    const requiredTables = [
      'products',
      'orders',
      'inventory',
      'customers',
      'staff',
      'appointments',
      'invoices',
      'expenses',
      'deliveries',
    ];
    for (const name of requiredTables) {
      const def = STARTER_BUSINESS_TABLES[name];
      expect(def).toBeDefined();
      const sql = buildCreateTableSql(def, 'biz_test_industry');
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS biz_test_industry_${name}`);
    }

    expect(starterTableNamesForPreset('dispatch-console')).toEqual(['deliveries']);
    expect(starterTableNamesForPreset('billing-ledger')).toEqual(['invoices', 'expenses']);
    expect(starterTableNamesForPreset('appointment-desk')).toEqual(['appointments', 'customers']);
    expect(starterTableNamesForPreset('service-directory')).toEqual(['customers', 'staff']);
  });

  test('least-privilege permissions & inference hold for specialized industry presets', () => {
    const dispatch = presetByKey('dispatch-console')!;
    expect(inferPermissionPreset(dispatch.permissions)?.key).toBe('dispatch-console');
    expect(isActionAllowed(dispatch.permissions, { type: 'insert', table: 'deliveries', payload: {} })).toBe(true);
    expect(isActionAllowed(dispatch.permissions, { type: 'update', table: 'deliveries', rowId: '1', payload: { status: 'delivered' } })).toBe(true);
    expect(isActionAllowed(dispatch.permissions, { type: 'delete', table: 'deliveries', rowId: '1' })).toBe(false);
    expect(isActionAllowed(dispatch.permissions, { type: 'insert', table: 'invoices', payload: {} })).toBe(false);

    const billing = presetByKey('billing-ledger')!;
    expect(inferPermissionPreset(billing.permissions)?.key).toBe('billing-ledger');
    expect(isActionAllowed(billing.permissions, { type: 'insert', table: 'invoices', payload: {} })).toBe(true);
    expect(isActionAllowed(billing.permissions, { type: 'insert', table: 'expenses', payload: {} })).toBe(true);
    expect(isActionAllowed(billing.permissions, { type: 'update', table: 'deliveries', rowId: '1', payload: {} })).toBe(false);

    const appt = presetByKey('appointment-desk')!;
    expect(inferPermissionPreset(appt.permissions)?.key).toBe('appointment-desk');
    expect(isActionAllowed(appt.permissions, { type: 'insert', table: 'appointments', payload: {} })).toBe(true);
    expect(isActionAllowed(appt.permissions, { type: 'insert', table: 'customers', payload: {} })).toBe(true);
    expect(isActionAllowed(appt.permissions, { type: 'insert', table: 'invoices', payload: {} })).toBe(false);

    const dir = presetByKey('service-directory')!;
    expect(inferPermissionPreset(dir.permissions)?.key).toBe('service-directory');
    expect(isActionAllowed(dir.permissions, { type: 'insert', table: 'customers', payload: {} })).toBe(true);
    expect(isActionAllowed(dir.permissions, { type: 'insert', table: 'staff', payload: {} })).toBe(true);
    expect(isActionAllowed(dir.permissions, { type: 'insert', table: 'orders', payload: {} })).toBe(false);
  });

  test('end-to-end terminal provisioning & runtime execution across logistics, accounting, clinic, and directory', async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const schemaName = `biz_ind_${suffix}`;
    const userRes = await db.insert<{ id: string }>('users', {
      email: `ind-${suffix}@example.com`,
      full_name: 'Industry Owner',
      password_hash: 'hash',
    });
    expect(userRes.error).toBeNull();

    const bizRes = await db.insert<{ id: string; schema_name: string }>('businesses', {
      name: `Ind Biz ${suffix}`,
      admin_user_id: userRes.data!.id,
      schema_name: schemaName,
      country: 'US',
      currency: 'USD',
      currency_symbol: '$',
    });
    expect(bizRes.error).toBeNull();
    const businessId = bizRes.data!.id;

    // Provision all specialized tables for this test business
    const tablesRes = await ensureStarterBusinessTables(schemaName, [
      'deliveries',
      'invoices',
      'expenses',
      'appointments',
      'customers',
      'staff',
    ]);
    expect(tablesRes.error).toBeNull();

    // Provision specialized terminals with custom variants
    const dispatchRes = await createManagedTerminal({
      businessId,
      businessSchema: schemaName,
      displayName: 'Dispatch Hub',
      presetKey: 'dispatch-console',
      layoutVariant: 'route-board',
    });
    expect(dispatchRes.error).toBeNull();
    const dispatchTerm = dispatchRes.terminal as { id: string; role: string };
    expect(dispatchTerm.role).toBe('Dispatch & Delivery Console');

    const billingRes = await createManagedTerminal({
      businessId,
      businessSchema: schemaName,
      displayName: 'Bookkeeping Desk',
      presetKey: 'billing-ledger',
      layoutVariant: 'expense-audit',
    });
    expect(billingRes.error).toBeNull();
    const billingTerm = billingRes.terminal as { id: string; role: string };

    const clinicRes = await createManagedTerminal({
      businessId,
      businessSchema: schemaName,
      displayName: 'Triage Desk',
      presetKey: 'appointment-desk',
      layoutVariant: 'triage-board',
    });
    expect(clinicRes.error).toBeNull();
    const clinicTerm = clinicRes.terminal as { id: string; role: string };

    const dirRes = await createManagedTerminal({
      businessId,
      businessSchema: schemaName,
      displayName: 'Student Registry',
      presetKey: 'service-directory',
      layoutVariant: 'roster-board',
    });
    expect(dirRes.error).toBeNull();
    const dirTerm = dirRes.terminal as { id: string; role: string };

    // 1. Dispatch terminal inserts a waybill and advances status
    const dispatchToken = await createTestTerminalToken({
      terminalId: dispatchTerm.id,
      businessId,
      role: dispatchTerm.role,
      displayName: 'Dispatch Hub',
    });
    const dispatchCookie = `kogane_terminal_session=${dispatchToken}`;

    const waybillResp = await eventHandler(makePostEvent('/api/runtime/event', {
      events: [{
        inpoint_id: dispatchTerm.id,
        business_id: businessId,
        element_id: 'dispatch-submit',
        trigger: 'click',
        action: { type: 'insert', table: 'deliveries' },
        payload: {
          tracking_code: `TRK-${suffix}`,
          origin: 'Hub North',
          destination: '42 Market St',
          driver_name: 'Alex',
          status: 'pending',
        },
      }],
    }, dispatchCookie));
    expect(waybillResp.results[0].ok).toBe(true);
    const deliveryId = (waybillResp.results[0].data as { id: string }).id;

    // Cross-table write forbidden: Dispatch CANNOT insert invoices
    const forbiddenInv = await eventHandler(makePostEvent('/api/runtime/event', {
      events: [{
        inpoint_id: dispatchTerm.id,
        business_id: businessId,
        element_id: 'dispatch-submit',
        trigger: 'click',
        action: { type: 'insert', table: 'invoices' },
        payload: { invoice_number: 'BAD', client_name: 'X', issue_date: '2026-11-12', total_amount: 10, paid: 0 },
      }],
    }, dispatchCookie));
    expect(forbiddenInv.results[0].ok).toBe(false);

    // Dispatch updates delivery status
    const deliverUpdate = await eventHandler(makePostEvent('/api/runtime/event', {
      events: [{
        inpoint_id: dispatchTerm.id,
        business_id: businessId,
        element_id: 'dispatch-table',
        trigger: 'click',
        action: { type: 'update', table: 'deliveries', rowId: deliveryId },
        payload: { status: 'delivered' },
      }],
    }, dispatchCookie));
    expect(deliverUpdate.results[0].ok).toBe(true);
    expect((deliverUpdate.results[0].data as { status: string }).status).toBe('delivered');

    // 2. Billing terminal inserts invoice + expense and marks invoice paid
    const billingToken = await createTestTerminalToken({
      terminalId: billingTerm.id,
      businessId,
      role: billingTerm.role,
      displayName: 'Bookkeeping Desk',
    });
    const billingCookie = `kogane_terminal_session=${billingToken}`;

    const invResp = await eventHandler(makePostEvent('/api/runtime/event', {
      events: [{
        inpoint_id: billingTerm.id,
        business_id: businessId,
        element_id: 'billing-inv-submit',
        trigger: 'click',
        action: { type: 'insert', table: 'invoices' },
        payload: {
          invoice_number: `INV-${suffix}`,
          client_name: 'Acme Clinic',
          issue_date: '2026-11-12',
          due_date: '2026-11-26',
          total_amount: 450,
          paid: 0,
        },
      }],
    }, billingCookie));
    expect(invResp.results[0].ok).toBe(true);

    const expResp = await eventHandler(makePostEvent('/api/runtime/event', {
      events: [{
        inpoint_id: billingTerm.id,
        business_id: businessId,
        element_id: 'billing-exp-submit',
        trigger: 'click',
        action: { type: 'insert', table: 'expenses' },
        payload: {
          description: 'Courier Fuel',
          category: 'Operations',
          amount: 85.5,
          expense_date: '2026-11-12',
        },
      }],
    }, billingCookie));
    expect(expResp.results[0].ok).toBe(true);

    // 3. Appointment terminal books a patient/session and updates check-in
    const clinicToken = await createTestTerminalToken({
      terminalId: clinicTerm.id,
      businessId,
      role: clinicTerm.role,
      displayName: 'Triage Desk',
    });
    const clinicCookie = `kogane_terminal_session=${clinicToken}`;

    const apptResp = await eventHandler(makePostEvent('/api/runtime/event', {
      events: [{
        inpoint_id: clinicTerm.id,
        business_id: businessId,
        element_id: 'appt-submit',
        trigger: 'click',
        action: { type: 'insert', table: 'appointments' },
        payload: {
          customer_name: 'Jamie Lee',
          staff_id: 'Dr. Santos',
          scheduled_at: '2026-11-12 14:00',
          duration_min: 30,
          status: 'scheduled',
          notes: 'Annual checkup',
        },
      }],
    }, clinicCookie));
    expect(apptResp.results[0].ok).toBe(true);

    // 4. Directory terminal adds student/client + staff
    const dirToken = await createTestTerminalToken({
      terminalId: dirTerm.id,
      businessId,
      role: dirTerm.role,
      displayName: 'Student Registry',
    });
    const dirCookie = `kogane_terminal_session=${dirToken}`;

    const custResp = await eventHandler(makePostEvent('/api/runtime/event', {
      events: [{
        inpoint_id: dirTerm.id,
        business_id: businessId,
        element_id: 'dir-cust-submit',
        trigger: 'click',
        action: { type: 'insert', table: 'customers' },
        payload: { full_name: 'Sam Rivera', phone: '555-0102', email: `sam-${suffix}@example.com`, notes: 'Grade 10' },
      }],
    }, dirCookie));
    expect(custResp.results[0].ok).toBe(true);

    const staffResp = await eventHandler(makePostEvent('/api/runtime/event', {
      events: [{
        inpoint_id: dirTerm.id,
        business_id: businessId,
        element_id: 'dir-staff-submit',
        trigger: 'click',
        action: { type: 'insert', table: 'staff' },
        payload: { full_name: 'Prof. Reyes', role: 'Math Tutor', phone: '555-0199', active: 1 },
      }],
    }, dirCookie));
    expect(staffResp.results[0].ok).toBe(true);

    // Silence unused import warning if needed
    expect(typeof createAdminSessionToken).toBe('function');
  });

  test('POST /api/businesses/onboard provisions tailored industry terminals, businessType palette, and SQLite tables for non-restaurant industries', async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const adminRes = await db.insert<{ id: string }>('users', {
      email: `onboard-clinic-${suffix}@example.com`,
      full_name: 'Clinic Admin',
      password_hash: 'hash',
    });
    expect(adminRes.error).toBeNull();
    const token = await createTestAdminToken({
      userId: adminRes.data!.id,
      email: `onboard-clinic-${suffix}@example.com`,
      role: 'admin',
    });

    const features = ['appointments', 'customers', 'invoices'];
    const schemaDef = {
      tables: features
        .map((f) => STARTER_BUSINESS_TABLES[f])
        .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    };
    const onboardRes = await onboardHandler(
      makePostEvent('/api/businesses/onboard', {
        businessName: `Harbor Clinic ${suffix}`,
        businessType: 'clinic',
        features,
        schemaDef,
        country: 'US',
        currency: 'USD',
        currencySymbol: '$',
      }, '', { authorization: `Bearer ${token}` }),
    );

    expect(onboardRes.error).toBeNull();
    expect(onboardRes.business).toBeTruthy();

    const palette = JSON.parse(String((onboardRes.business as any).color_palette));
    expect(palette.businessType).toBe('clinic');

    const { data: terminals, error: termErr } = await db.query<{ display_name: string; role: string; permissions: string; ui_layout: string }>(
      'SELECT display_name, role, permissions, ui_layout FROM terminals WHERE business_id = ?',
      [(onboardRes.business as any).id],
    );
    expect(termErr).toBeNull();
    const roles = new Set((terminals ?? []).map((t) => inferPermissionPreset(t.permissions || t.role)?.key));
    expect(roles.has('appointment-desk')).toBe(true);
    expect(roles.has('service-directory')).toBe(true);
    expect(roles.has('billing-ledger')).toBe(true);
    expect(roles.has('reports-viewer')).toBe(true);
    for (const t of terminals ?? []) {
      const parsedLayout = JSON.parse(t.ui_layout);
      expect(parsedLayout.elements.length).toBeGreaterThan(0);
    }
  });
});
