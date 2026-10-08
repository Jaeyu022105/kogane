import { describe, expect, test, beforeEach } from 'bun:test';
import {
  hashPasswordSync,
  verifyPasswordSync,
  createAdminSessionToken,
  decodeAdminSessionToken,
  verifyAdmin,
  verifyPin,
} from '../lib/authUtils';
import { db } from '../lib/db';
import signupHandler from '../server/api/auth/signup.post';
import loginHandler from '../server/api/auth/login.post';
import changePasswordHandler from '../server/api/auth/change-password.post';
import meHandler from '../server/api/auth/me.get';
import logoutHandler from '../server/api/auth/logout.post';

function createMockEvent(opts: {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  const method = opts.method ?? 'POST';
  const body = opts.body;
  return {
    method,
    node: {
      req: {
        method,
        headers: {
          'content-type': 'application/json',
          ...(opts.headers ?? {}),
        },
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
}

describe('Authentication & Password Security Engine', () => {
  beforeEach(() => {
    process.env.DEV_MODE = 'true';
    delete process.env.SUPABASE_URL;
  });

  test('PBKDF2 password hashing generates secure salts and verifiable hashes', () => {
    const password = 'RestaurantSecretPass2026!';
    const hash1 = hashPasswordSync(password);
    const hash2 = hashPasswordSync(password);

    // Format check
    expect(hash1.startsWith('pbkdf2$100000$')).toBe(true);
    expect(hash2.startsWith('pbkdf2$100000$')).toBe(true);

    // Unique random salt per hash
    expect(hash1).not.toBe(hash2);

    // Verification
    expect(verifyPasswordSync(password, hash1)).toBe(true);
    expect(verifyPasswordSync(password, hash2)).toBe(true);
    expect(verifyPasswordSync('WrongPassword', hash1)).toBe(false);
    expect(verifyPasswordSync('', hash1)).toBe(false);
  });

  test('PBKDF2 verification rejects tampered or malformed hashes safely', () => {
    expect(verifyPasswordSync('test', '')).toBe(false);
    expect(verifyPasswordSync('test', 'not-a-valid-hash')).toBe(false);
    expect(verifyPasswordSync('test', 'pbkdf2$bad')).toBe(false);
    expect(verifyPasswordSync('test', 'pbkdf2$100000$1234$5678')).toBe(false);
  });

  test('Admin HMAC session tokens sign and verify with expiration enforcement', async () => {
    const payload = {
      userId: 'usr_chef_123',
      email: 'chef@bistro.com',
      role: 'admin' as const,
      fullName: 'Chef Antoine',
    };

    const token = await createAdminSessionToken(payload);
    expect(token).toBeDefined();
    expect(token.includes('.')).toBe(true);

    // Verify valid token decodes correctly
    const decoded = await decodeAdminSessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe('usr_chef_123');
    expect(decoded?.email).toBe('chef@bistro.com');
    expect(decoded?.fullName).toBe('Chef Antoine');

    // Tampered token must fail verification
    const [body, sig] = token.split('.');
    const tamperedToken = `${body}tampered.${sig}`;
    expect(await decodeAdminSessionToken(tamperedToken)).toBeNull();

    // Expired token must be rejected
    const expiredToken = await createAdminSessionToken({
      ...payload,
      expiresAt: new Date(Date.now() - 10000).toISOString(),
    });
    expect(await decodeAdminSessionToken(expiredToken)).toBeNull();
  });

  test('verifyAdmin authenticates signed admin tokens and preserves test runner backwards compatibility', async () => {
    // 1. Backwards compatibility for dev-admin-token
    const devEvent = createMockEvent({
      headers: { authorization: 'Bearer dev-admin-token' },
    });
    const devAuth = await verifyAdmin(devEvent);
    expect(devAuth.userId).toBe('dev-admin');

    // 2. Verified signed admin token
    const signedToken = await createAdminSessionToken({
      userId: 'usr_owner_456',
      email: 'owner@napoli.com',
      role: 'admin',
    });
    const signedEvent = createMockEvent({
      headers: { authorization: `Bearer ${signedToken}` },
    });
    const signedAuth = await verifyAdmin(signedEvent);
    expect(signedAuth.userId).toBe('usr_owner_456');
    expect(signedAuth.email).toBe('owner@napoli.com');

    // 3. Missing authorization header throws 401
    const noAuthEvent = createMockEvent({ headers: {} });
    expect(verifyAdmin(noAuthEvent)).rejects.toThrow();

    // 4. Invalid or forged token throws 401
    const invalidEvent = createMockEvent({
      headers: { authorization: 'Bearer forged-invalid-token' },
    });
    expect(verifyAdmin(invalidEvent)).rejects.toThrow();
  });

  test('POST /api/auth/signup validates inputs, stores hashed password, and issues session', async () => {
    const uniqueEmail = `owner_${Date.now()}@restaurant.com`;

    // 1. Validation: missing fields
    const emptyEvent = createMockEvent({ body: {} });
    const emptyRes = await signupHandler(emptyEvent);
    expect(emptyRes.error).toBe('Email is required');
    expect(emptyRes.session).toBeNull();

    // 2. Validation: short password
    const shortPassEvent = createMockEvent({
      body: { email: uniqueEmail, password: '123' },
    });
    const shortPassRes = await signupHandler(shortPassEvent);
    expect(shortPassRes.error).toContain('at least 6 characters');

    // 3. Successful signup
    const validEvent = createMockEvent({
      body: {
        email: uniqueEmail,
        password: 'SecureRestaurantPassword1!',
        fullName: 'Mario Rossi',
        username: 'mario',
      },
    });
    const signupRes = await signupHandler(validEvent);
    expect(signupRes.error).toBeNull();
    expect(signupRes.session).not.toBeNull();
    expect(signupRes.session?.email).toBe(uniqueEmail);
    expect(signupRes.session?.fullName).toBe('Mario Rossi');
    expect(signupRes.session?.token).toBeDefined();

    // Ensure raw password is NOT stored in the database!
    const { data: storedUser } = await db.queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = ?',
      [uniqueEmail],
    );
    expect(storedUser).toBeDefined();
    expect(storedUser?.password_hash).not.toBe('SecureRestaurantPassword1!');
    expect(storedUser?.password_hash.startsWith('pbkdf2$')).toBe(true);
    expect(verifyPasswordSync('SecureRestaurantPassword1!', storedUser!.password_hash)).toBe(true);

    // 4. Duplicate email rejection
    const duplicateEvent = createMockEvent({
      body: {
        email: uniqueEmail,
        password: 'AnotherPassword123',
      },
    });
    const duplicateRes = await signupHandler(duplicateEvent);
    expect(duplicateRes.error).toContain('already exists');
    expect(duplicateRes.session).toBeNull();
  });

  test('POST /api/auth/login verifies password hash and rejects wrong credentials', async () => {
    const testEmail = `chef_${Date.now()}@bistro.com`;
    const testPassword = 'MySecretKitchenPassword88!';

    // Register user first
    await signupHandler(createMockEvent({
      body: {
        email: testEmail,
        password: testPassword,
        fullName: 'Chef Luigi',
      },
    }));

    // 1. Reject empty email/password
    const missingRes = await loginHandler(createMockEvent({
      body: { email: testEmail, password: '' },
    }));
    expect(missingRes.error).toContain('required');

    // 2. Reject wrong password
    const wrongPassRes = await loginHandler(createMockEvent({
      body: { email: testEmail, password: 'WrongPassword123' },
    }));
    expect(wrongPassRes.error).toBe('Invalid email or password');
    expect(wrongPassRes.session).toBeNull();

    // 3. Reject unregistered email
    const nonExistentRes = await loginHandler(createMockEvent({
      body: { email: 'nonexistent@randomdomain.com', password: 'AnyPassword123' },
    }));
    expect(nonExistentRes.error).toBe('Invalid email or password');
    expect(nonExistentRes.session).toBeNull();

    // 4. Successful login with matching password
    const successRes = await loginHandler(createMockEvent({
      body: { email: testEmail, password: testPassword },
    }));
    expect(successRes.error).toBeNull();
    expect(successRes.session).not.toBeNull();
    expect(successRes.session?.email).toBe(testEmail);
    expect(successRes.session?.fullName).toBe('Chef Luigi');
    expect(successRes.session?.token).toBeDefined();

    // 5. Case-insensitive email login
    const upperCaseRes = await loginHandler(createMockEvent({
      body: { email: testEmail.toUpperCase(), password: testPassword },
    }));
    expect(upperCaseRes.error).toBeNull();
    expect(upperCaseRes.session?.email).toBe(testEmail);
  });

  test('Workstation PIN verification validates PIN 1234 across all provisioned terminals', async () => {
    const starterIds = [
      'd047d7294f03036a4f3fe94fa3be66d0',
      'cashier-register-001',
      'kitchen-display-001',
      'inventory-manager-001',
      'reports-viewer-001',
    ];
    for (const termId of starterIds) {
      const { data: term } = await db.queryOne<{ id: string; display_name: string; pin_hash: string }>(
        'SELECT id, display_name, pin_hash FROM terminals WHERE id = ?',
        [termId],
      );
      expect(term).not.toBeNull();
      const isValid = await verifyPin('1234', term!.pin_hash);
      expect(isValid).toBe(true);
      const isInvalid = await verifyPin('9999', term!.pin_hash);
      expect(isInvalid).toBe(false);
    }
  });

  test('POST /api/auth/change-password validates credentials and updates password hash', async () => {
    const testEmail = `manager_${Date.now()}@restaurant.com`;
    const initialPassword = 'InitialManagerPassword123!';
    const newPassword = 'NewSecretManagerPassword456!';

    // Register user
    const signupRes = await signupHandler(createMockEvent({
      body: {
        email: testEmail,
        password: initialPassword,
        fullName: 'Store Manager',
      },
    }));
    const token = signupRes.session?.token;
    expect(token).toBeDefined();

    const authHeaders = { authorization: `Bearer ${token}` };

    // 1. Missing password fields
    const missingRes = await changePasswordHandler(createMockEvent({
      headers: authHeaders,
      body: { currentPassword: '', newPassword: '' },
    }));
    expect(missingRes.error).toContain('required');

    // 2. Short new password (< 6 chars)
    const shortRes = await changePasswordHandler(createMockEvent({
      headers: authHeaders,
      body: { currentPassword: initialPassword, newPassword: '123' },
    }));
    expect(shortRes.error).toContain('at least 6 characters');

    // 3. Mismatching confirmation password
    const mismatchRes = await changePasswordHandler(createMockEvent({
      headers: authHeaders,
      body: { currentPassword: initialPassword, newPassword: 'validPassword123', confirmPassword: 'differentPassword' },
    }));
    expect(mismatchRes.error).toContain('do not match');

    // 4. Incorrect current password
    const wrongCurrentRes = await changePasswordHandler(createMockEvent({
      headers: authHeaders,
      body: { currentPassword: 'WrongCurrentPassword!', newPassword },
    }));
    expect(wrongCurrentRes.error).toBe('Current password is incorrect');

    // 5. Successful password change
    const successChangeRes = await changePasswordHandler(createMockEvent({
      headers: authHeaders,
      body: {
        currentPassword: initialPassword,
        newPassword,
        confirmPassword: newPassword,
      },
    }));
    expect(successChangeRes.success).toBe(true);
    expect(successChangeRes.error).toBeNull();

    // 6. Old password can NO LONGER log in!
    const oldLoginRes = await loginHandler(createMockEvent({
      body: { email: testEmail, password: initialPassword },
    }));
    expect(oldLoginRes.session).toBeNull();
    expect(oldLoginRes.error).toBe('Invalid email or password');

    // 7. New password logs in successfully!
    const newLoginRes = await loginHandler(createMockEvent({
      body: { email: testEmail, password: newPassword },
    }));
    expect(newLoginRes.error).toBeNull();
    expect(newLoginRes.session).not.toBeNull();
    expect(newLoginRes.session?.email).toBe(testEmail);
  });

  test('GET /api/auth/me returns authenticated admin user profile', async () => {
    // 1. Dev admin token profile
    const devEvent = createMockEvent({
      method: 'GET',
      headers: { authorization: 'Bearer dev-admin-token' },
    });
    const devMe = await meHandler(devEvent);
    expect(devMe.error).toBeNull();
    expect(devMe.user.id).toBe('dev-admin');

    // 2. Signed session token profile
    const token = await createAdminSessionToken({
      userId: 'usr_patron_1',
      email: 'patron@kogane.dev',
      role: 'admin',
      fullName: 'Owner Patron',
    });
    const signedEvent = createMockEvent({
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    const signedMe = await meHandler(signedEvent);
    expect(signedMe.error).toBeNull();
    expect(signedMe.user.id).toBe('usr_patron_1');
  });

  test('POST /api/auth/logout succeeds cleanly', async () => {
    const logoutRes = await logoutHandler(createMockEvent({}));
    expect(logoutRes.success).toBe(true);
  });
});
