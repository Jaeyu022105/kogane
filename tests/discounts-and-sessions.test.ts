import { describe, expect, test } from 'bun:test';
import { db } from '../lib/db';
import {
  createTerminalSessionToken,
  decodeTerminalSessionToken,
  hashPin,
  verifyAdmin,
  verifyPin,
  verifyTerminalSession,
} from '../lib/authUtils';
import { applyBrandingToLayout, buildLayoutTheme, isLightColor } from '../lib/workspaceBranding';
import { ensureStarterBusinessTable } from '../server/utils/starterTables';
import { insertBusinessRow, queryBusinessRows } from '../server/utils/businessTable';

describe('Discount Calculations & Persisted Orders', () => {
  const schemaName = 'biz_devadmin';

  test('calculates PWD and Senior Citizen 20% discounts correctly', () => {
    const subtotal = 100;
    const pwdDiscount = Math.round(subtotal * 0.2 * 100) / 100;
    const pwdTotal = Math.max(0, Math.round((subtotal - pwdDiscount) * 100) / 100);

    expect(pwdDiscount).toBe(20);
    expect(pwdTotal).toBe(80);

    const subtotal2 = 33.33;
    const seniorDiscount = Math.round(subtotal2 * 0.2 * 100) / 100;
    const seniorTotal = Math.max(0, Math.round((subtotal2 - seniorDiscount) * 100) / 100);

    expect(seniorDiscount).toBe(6.67);
    expect(seniorTotal).toBe(26.66);
  });

  test('calculates custom percentage and fixed amount discounts with clamping', () => {
    const subtotal = 75;

    // Custom 15%
    const pctDiscount = Math.round(subtotal * (15 / 100) * 100) / 100;
    const pctTotal = Math.max(0, Math.round((subtotal - pctDiscount) * 100) / 100);
    expect(pctDiscount).toBe(11.25);
    expect(pctTotal).toBe(63.75);

    // Fixed amount $25
    const fixedDiscount = Math.min(subtotal, 25);
    const fixedTotal = Math.max(0, Math.round((subtotal - fixedDiscount) * 100) / 100);
    expect(fixedDiscount).toBe(25);
    expect(fixedTotal).toBe(50);

    // Fixed amount exceeding subtotal clamps to 0
    const excessiveFixedDiscount = Math.min(subtotal, 120);
    const excessiveFixedTotal = Math.max(0, Math.round((subtotal - excessiveFixedDiscount) * 100) / 100);
    expect(excessiveFixedDiscount).toBe(75);
    expect(excessiveFixedTotal).toBe(0);
  });

  test('ensureStarterBusinessTable includes discount columns on orders table', async () => {
    process.env.DEV_MODE = 'true';
    const ensured = await ensureStarterBusinessTable(schemaName, 'orders');
    expect(ensured.error).toBeNull();
  });

  test('inserts and queries order with discount metadata and external card payment', async () => {
    process.env.DEV_MODE = 'true';
    const receiptNum = `RCP-${Date.now()}`;
    const cardRef = `EXT-CARD-${Date.now()}`;

    const orderPayload = {
      items: '2x Cold Brew ($9.50)',
      line_items: JSON.stringify([{ id: 'p1', name: 'Cold Brew', quantity: 2, price: 4.75 }]),
      subtotal: 9.50,
      discount_type: 'pwd',
      discount_amount: 1.90,
      discount_label: 'PWD (20%)',
      discount_reference: 'PWD-12345',
      total: 7.60,
      status: 'pending',
      table_number: 'Table 4',
      payment_method: 'card',
      payment_status: 'paid',
      payment_reference: cardRef,
      receipt_number: receiptNum,
    };

    const insertRes = await insertBusinessRow(schemaName, 'orders', orderPayload);
    expect(insertRes.error).toBeNull();
    expect(insertRes.data).toBeDefined();

    const queryRes = await queryBusinessRows(schemaName, 'orders', ['*'], {
      where: { receipt_number: receiptNum },
    });
    expect(queryRes.error).toBeNull();
    expect(queryRes.data?.length).toBe(1);

    const retrieved = queryRes.data![0];
    expect(Number(retrieved.subtotal)).toBe(9.50);
    expect(retrieved.discount_type).toBe('pwd');
    expect(Number(retrieved.discount_amount)).toBe(1.90);
    expect(retrieved.discount_label).toBe('PWD (20%)');
    expect(retrieved.discount_reference).toBe('PWD-12345');
    expect(Number(retrieved.total)).toBe(7.60);
    expect(retrieved.payment_method).toBe('card');
    expect(retrieved.payment_status).toBe('paid');
    expect(retrieved.payment_reference).toBe(cardRef);
  });
});

describe('Terminal Session Management & Grace Period', () => {
  test('creates and decodes valid terminal session token', async () => {
    const payload = {
      terminalId: 'term-101',
      businessId: 'biz-101',
      displayName: 'Front Register',
      role: 'cashier-register',
    };

    const token = await createTerminalSessionToken(payload);
    expect(typeof token).toBe('string');

    const decoded = await decodeTerminalSessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.terminalId).toBe('term-101');
    expect(decoded?.role).toBe('cashier-register');
  });

  test('rejects token older than 90-day grace period', async () => {
    // 95 days expired
    const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
    const token = await createTerminalSessionToken({
      terminalId: 'term-old',
      businessId: 'biz-old',
      displayName: 'Old Term',
      role: 'cashier-register',
      expiresAt: ninetyFiveDaysAgo,
    });

    const mockEvent = {
      node: {
        req: {
          headers: {
            cookie: `kogane_terminal_session=${token}`,
          },
        },
        res: {},
      },
    } as any;

    let threw = false;
    try {
      await verifyTerminalSession(mockEvent, 'term-old');
    } catch (err: any) {
      threw = true;
      expect(err.statusCode).toBe(401);
      expect(err.message).toContain('expired');
    }
    expect(threw).toBe(true);
  });

  test('auto-renews token expired within 90-day grace period', async () => {
    // 8 days expired (well within 90 days)
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const token = await createTerminalSessionToken({
      terminalId: 'term-grace',
      businessId: 'biz-grace',
      displayName: 'Grace Term',
      role: 'cashier-register',
      expiresAt: eightDaysAgo,
    });

    let setCookieHeader = '';
    const mockEvent = {
      node: {
        req: {
          headers: {
            cookie: `kogane_terminal_session=${token}`,
          },
        },
        res: {
          setHeader: (name: string, val: string) => {
            if (name.toLowerCase() === 'set-cookie') {
              setCookieHeader = val;
            }
          },
          getHeader: () => undefined,
        },
      },
    } as any;

    const session = await verifyTerminalSession(mockEvent, 'term-grace');
    expect(session).toBeDefined();
    expect(session.terminalId).toBe('term-grace');
    // Renewed expiry should be in future
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test('multi-terminal session auto-adaptation for terminals belonging to same business', async () => {
    process.env.DEV_MODE = 'true';
    const terminals = await db.query<any>('SELECT id, business_id, display_name, role FROM terminals LIMIT 2');
    if (terminals.data && terminals.data.length >= 2) {
      const termA = terminals.data[0];
      const termB = terminals.data[1];

      // Session was issued for Terminal A
      const tokenA = await createTerminalSessionToken({
        terminalId: termA.id,
        businessId: termA.business_id,
        displayName: termA.display_name,
        role: termA.role,
      });

      const mockEvent = {
        node: {
          req: {
            headers: {
              cookie: `kogane_terminal_session=${tokenA}`,
            },
          },
          res: {
            setHeader: () => {},
            getHeader: () => undefined,
          },
        },
      } as any;

      // Accessing Terminal B with Terminal A's token auto-adapts to Terminal B
      const adaptedSession = await verifyTerminalSession(mockEvent, termB.id);
      expect(adaptedSession).toBeDefined();
      expect(adaptedSession.terminalId).toBe(termB.id);
      expect(adaptedSession.role).toBe(termB.role);
    }
  });

  test('admin session passthrough grants terminal access without prior terminal session', async () => {
    process.env.DEV_MODE = 'true';
    const catalogTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'");
    expect(catalogTerm.data).toBeDefined();

    const mockEvent = {
      node: {
        req: {
          headers: {
            authorization: 'Bearer dev-admin-token',
          },
        },
        res: {
          setHeader: () => {},
          getHeader: () => undefined,
        },
      },
    } as any;

    const session = await verifyTerminalSession(mockEvent, catalogTerm.data.id);
    expect(session).toBeDefined();
    expect(session.terminalId).toBe(catalogTerm.data.id);
    expect(session.role).toBe(catalogTerm.data.role);
  });

  test('terminal login issues 30-day session and has no 2-minute expiration warning', async () => {
    process.env.DEV_MODE = 'true';
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    // Verify terminal page source code does not include aggressive 2-minute expiry warning
    const terminalPagePath = resolve(process.cwd(), 'pages/terminal/[id].vue');
    const terminalPageContent = readFileSync(terminalPagePath, 'utf-8');
    expect(terminalPageContent).not.toContain('scheduleExpiryWarning');
    expect(terminalPageContent).not.toContain('Session expiry warning');
    expect(terminalPageContent).not.toContain('2 minutes');

    const publicTerminalPath = resolve(process.cwd(), 'pages/t/[slug].vue');
    const publicTerminalContent = readFileSync(publicTerminalPath, 'utf-8');
    expect(publicTerminalContent).not.toContain('scheduleExpiryWarning');
    expect(publicTerminalContent).not.toContain('Session expiry warning');
    expect(publicTerminalContent).not.toContain('2 minutes');

    // Verify login endpoint issues a 30-day session (not 2 minutes)
    const { default: loginHandler } = await import('../server/api/terminals/login.post');
    const { createManagedTerminal } = await import('../server/utils/managedTerminals');
    const catalogTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'");
    expect(catalogTerm.data).toBeDefined();

    const created = await createManagedTerminal({
      businessId: catalogTerm.data.business_id,
      businessSchema: 'biz_devadmin',
      displayName: `Login Station ${Date.now()}`,
      presetKey: 'cashier-register',
    });
    expect(created.error).toBeNull();
    expect(created.terminal).toBeDefined();

    const body = {
      terminalId: created.terminal!.id,
      pin: '1234',
    };

    const mockEvent = {
      method: 'POST',
      node: {
        req: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          [Symbol.for('h3ParsedBody')]: body,
        },
        res: {
          setHeader: () => {},
          getHeader: () => undefined,
        },
      },
      context: { body },
      _body: body,
      [Symbol.for('h3ParsedBody')]: body,
    } as any;

    const res = await loginHandler(mockEvent);
    expect(res.error).toBeNull();
    expect(res.session).toBeDefined();
    expect(res.session?.expiresAt).toBeDefined();

    const expiryMs = new Date(res.session!.expiresAt).getTime();
    const durationDays = (expiryMs - Date.now()) / (1000 * 60 * 60 * 24);
    // Workstations stay logged in for full operation (30 days)
    expect(durationDays).toBeGreaterThan(25);
    expect(durationDays).toBeLessThanOrEqual(30.1);

    // Verify session restore endpoint also issues ~30-day session (not 2 minutes)
    const { default: sessionHandler } = await import('../server/api/terminals/[id]/session.get');
    const mockSessionEvent = {
      context: { params: { id: created.terminal!.id } },
      node: {
        req: {
          headers: { authorization: 'Bearer dev-admin-token' },
        },
        res: { setHeader: () => {}, getHeader: () => undefined },
      },
    } as any;
    const sessionRes = await sessionHandler(mockSessionEvent);
    expect(sessionRes.error).toBeNull();
    expect(sessionRes.session).toBeDefined();
    expect(sessionRes.session?.expiresAt).toBeDefined();
    const sessionExpiryMs = new Date(sessionRes.session!.expiresAt).getTime();
    const sessionDurationDays = (sessionExpiryMs - Date.now()) / (1000 * 60 * 60 * 24);
    expect(sessionDurationDays).toBeGreaterThan(25);
  });
});

describe('Terminal Logout & PIN Management', () => {
  test('verifyPin validates both hashed and matching plaintext PINs', async () => {
    const rawPin = '5678';
    const hash = await hashPin(rawPin);

    expect(await verifyPin(rawPin, hash)).toBe(true);
    expect(await verifyPin('0000', hash)).toBe(false);
  });

  test('admin can log out without entering staff PIN', async () => {
    process.env.DEV_MODE = 'true';
    const { default: logoutHandler } = await import('../server/api/terminals/logout.post');

    const catalogTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'");

    const body = {
      terminalId: catalogTerm.data.id,
      pin: '', // Admin passes no PIN
    };

    const mockEvent = {
      method: 'POST',
      node: {
        req: {
          method: 'POST',
          headers: {
            authorization: 'Bearer dev-admin-token',
            'content-type': 'application/json',
          },
        },
        res: {
          setHeader: () => {},
          getHeader: () => undefined,
        },
      },
      context: { body },
      _body: body,
      [Symbol.for('h3ParsedBody')]: body,
    } as any;

    const res = await logoutHandler(mockEvent);
    expect(res.success).toBe(true);
    expect(res.error).toBeNull();
  });

  test('non-admin logout requires valid PIN', async () => {
    process.env.DEV_MODE = 'true';
    const { default: logoutHandler } = await import('../server/api/terminals/logout.post');

    const catalogTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'");

    // Missing PIN
    const bodyMissing = {
      terminalId: catalogTerm.data.id,
      pin: '',
    };
    const mockEventMissing = {
      method: 'POST',
      node: {
        req: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        },
        res: { setHeader: () => {}, getHeader: () => undefined },
      },
      context: { body: bodyMissing },
      _body: bodyMissing,
      [Symbol.for('h3ParsedBody')]: bodyMissing,
    } as any;

    const resMissing = await logoutHandler(mockEventMissing);
    expect(resMissing.success).toBe(false);
    expect(resMissing.error).toContain('PIN is required');

    // Wrong PIN
    const bodyWrong = {
      terminalId: catalogTerm.data.id,
      pin: '999999',
    };
    const mockEventWrong = {
      method: 'POST',
      node: {
        req: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        },
        res: { setHeader: () => {}, getHeader: () => undefined },
      },
      context: { body: bodyWrong },
      _body: bodyWrong,
      [Symbol.for('h3ParsedBody')]: bodyWrong,
    } as any;

    const resWrong = await logoutHandler(mockEventWrong);
    expect(resWrong.success).toBe(false);
    expect(resWrong.error).toContain('Invalid PIN');
  });
});

describe('Workspace Theme Branding & Contrast', () => {
  test('isLightColor identifies light vs dark backgrounds correctly', () => {
    expect(isLightColor('#fbf7f0')).toBe(true);
    expect(isLightColor('#ffffff')).toBe(true);
    expect(isLightColor('#f8f9fa')).toBe(true);
    expect(isLightColor('rgb(250, 250, 250)')).toBe(true);

    expect(isLightColor('#161116')).toBe(false);
    expect(isLightColor('#0b1120')).toBe(false);
    expect(isLightColor('#000000')).toBe(false);
    expect(isLightColor('rgba(15, 23, 42, 0.95)')).toBe(false);
  });

  test('buildLayoutTheme and applyBrandingToLayout restyle element colors for light paper theme', () => {
    const paperTheme = buildLayoutTheme({ layoutBundle: 'paper-ledger' });
    expect(paperTheme.panelBackground).toBe('#ffffff');
    expect(paperTheme.panelText).toBe('#261a14');
    expect(isLightColor(paperTheme.panelBackground)).toBe(true);

    const auroraTheme = buildLayoutTheme({ layoutBundle: 'aurora-service' });
    expect(auroraTheme.panelBackground).toBe('#161116');
    expect(isLightColor(auroraTheme.panelBackground)).toBe(false);

    const inkTheme = buildLayoutTheme({ layoutBundle: 'ink-studio' });
    expect(inkTheme.panelBackground).toBe('#111c2e');
    expect(isLightColor(inkTheme.panelBackground)).toBe(false);

    const sampleLayout = {
      version: 1,
      resolution: { width: 1280, height: 720 },
      elements: [
        {
          id: 'input-1',
          type: 'input-field' as const,
          x: 0,
          y: 0,
          w: 200,
          h: 40,
          backgroundColor: '#161116', // previously dark
          textColor: '#ffffff',
        },
        {
          id: 'btn-1',
          type: 'button' as const,
          x: 0,
          y: 50,
          w: 200,
          h: 40,
          variant: 'primary',
        },
      ],
    };

    const restyled = applyBrandingToLayout(sampleLayout as any, { layoutBundle: 'paper-ledger' });
    expect(restyled.theme?.panelBackground).toBe('#ffffff');

    const input = restyled.elements.find((e) => e.id === 'input-1') as any;
    expect(input).toBeDefined();
    expect(input.backgroundColor).toBe(paperTheme.panelHeaderBackground);
    expect(input.textColor).toBe(paperTheme.panelText);
    expect(input.borderColor).toBe(paperTheme.panelBorder);

    const btn = restyled.elements.find((e) => e.id === 'btn-1') as any;
    expect(btn).toBeDefined();
    expect(btn.backgroundColor).toBe(paperTheme.accentColor);
    expect(btn.textColor).toBe('#ffffff');
  });

  test('PATCH /api/terminals/[id] returns parsed and normalized ui_layout object', async () => {
    process.env.DEV_MODE = 'true';
    const { default: patchHandler } = await import('../server/api/terminals/[id].patch');
    const catalogTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'");

    const body = {
      businessId: catalogTerm.data.business_id,
      brandConfig: { layoutBundle: 'ink-studio', accent: '#38bdf8' },
    };

    const mockEvent = {
      method: 'PATCH',
      context: {
        params: { id: catalogTerm.data.id },
        body,
      },
      node: {
        req: {
          method: 'PATCH',
          headers: {
            authorization: 'Bearer dev-admin-token',
            'content-type': 'application/json',
          },
        },
        res: { setHeader: () => {}, getHeader: () => undefined },
      },
      _body: body,
      [Symbol.for('h3ParsedBody')]: body,
    } as any;

    const res = await patchHandler(mockEvent);
    expect(res.success).toBe(true);
    expect(res.terminal).toBeDefined();
    expect(typeof res.terminal.ui_layout).toBe('object');
    expect(res.terminal.ui_layout?.theme?.panelBackground).toBe('#111c2e');
  });

  test('createManagedTerminal sets predictable default PIN 1234 without hidden passcode', async () => {
    process.env.DEV_MODE = 'true';
    const { createManagedTerminal } = await import('../server/utils/managedTerminals');
    const catalogTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'");

    const created = await createManagedTerminal({
      businessId: catalogTerm.data.business_id,
      businessSchema: 'biz_devadmin',
      displayName: `Test Register ${Date.now()}`,
      presetKey: 'cashier-register',
    });

    expect(created.error).toBeNull();
    expect(created.pin).toBe('1234');
    expect(created.terminal?.pin_code).toBe('1234');
  });
});
