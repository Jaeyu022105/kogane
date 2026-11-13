/**
 * Client-and-server safe sanitization & expression utilities.
 * Prevents XSS, unsafe URL protocols (javascript:, data:), arbitrary script evaluation,
 * NUL-byte / binary control-character injection, and deep nesting / oversized payload DoS.
 */

const FORBIDDEN_PATH_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const MAX_FIELD_STRING_LENGTH = 65_536;
export const MAX_OBJECT_DEPTH = 10;
export const MAX_ARRAY_LENGTH = 1_000;
export const MAX_OBJECT_KEYS = 200;
export const MAX_CONDITION_TOKENS = 100;
export const MAX_CONDITION_DEPTH = 10;

/**
 * Returns true if the string contains NUL (\x00) or unsafe binary control characters.
 * When allowMultiline is true, standard whitespace (\t, \n, \r) is permitted.
 */
export function hasUnsafeControlChars(value: string, allowMultiline = false): boolean {
  if (typeof value !== 'string') return false;
  if (value.includes('\0')) return true;
  if (allowMultiline) {
    return /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/.test(value);
  }
  return /[\u0000-\u001F\u007F-\u009F]/.test(value);
}

/**
 * Strips NUL (\x00) and unsafe binary control characters from a string.
 * When allowMultiline is true, standard whitespace (\t, \n, \r) is preserved.
 */
export function stripUnsafeControlChars(value: string, allowMultiline = false): string {
  if (typeof value !== 'string') return '';
  if (allowMultiline) {
    return value.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  }
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

/**
 * Sanitizes UI text input by removing NUL/binary control characters and enforcing a max length.
 */
export function sanitizeTextInput(raw: unknown, maxLength = 2000, allowMultiline = false): string {
  if (raw == null) return '';
  const cleaned = stripUnsafeControlChars(String(raw), allowMultiline);
  return maxLength > 0 ? cleaned.slice(0, maxLength) : '';
}

export interface PayloadSanitizeOptions {
  maxDepth?: number;
  maxStringLength?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
  rejectNullBytes?: boolean;
  rejectControlChars?: boolean;
  allowMultiline?: boolean;
}

/**
 * Recursively validates and sanitizes an incoming JSON/payload value:
 * - Rejects or strips NUL (\x00) and unsafe binary control characters
 * - Rejects oversized strings, arrays, or property counts
 * - Enforces JSON nesting depth caps
 * - Rejects prototype-pollution keys and non-finite numbers
 */
export function validateAndSanitizeValue(
  value: unknown,
  depth = 0,
  options: PayloadSanitizeOptions = {},
): unknown {
  const maxDepth = options.maxDepth ?? MAX_OBJECT_DEPTH;
  const maxStringLength = options.maxStringLength ?? MAX_FIELD_STRING_LENGTH;
  const maxArrayLength = options.maxArrayLength ?? MAX_ARRAY_LENGTH;
  const maxObjectKeys = options.maxObjectKeys ?? MAX_OBJECT_KEYS;
  const allowMultiline = options.allowMultiline ?? true;

  if (value === null || value === undefined || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Invalid numeric value: must be finite');
    }
    return value;
  }

  if (typeof value === 'string') {
    if (options.rejectNullBytes && value.includes('\0')) {
      throw new Error('Payload contains disallowed NUL byte');
    }
    if (options.rejectControlChars && hasUnsafeControlChars(value, allowMultiline)) {
      throw new Error('Payload contains disallowed control characters');
    }
    const cleaned = stripUnsafeControlChars(value, allowMultiline);
    if (cleaned.length > maxStringLength) {
      throw new Error(`Field string exceeds maximum allowed length of ${maxStringLength} characters`);
    }
    return cleaned;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (depth >= maxDepth) {
      throw new Error(`Payload exceeds maximum nesting depth of ${maxDepth}`);
    }
    if (value.length > maxArrayLength) {
      throw new Error(`Array exceeds maximum allowed length of ${maxArrayLength}`);
    }
    return value.map((item) => validateAndSanitizeValue(item, depth + 1, options));
  }

  if (typeof value === 'object') {
    if (depth >= maxDepth) {
      throw new Error(`Payload exceeds maximum nesting depth of ${maxDepth}`);
    }
    const keys = Object.getOwnPropertyNames(value as Record<string, unknown>);
    if (keys.length > maxObjectKeys) {
      throw new Error(`Object exceeds maximum property count of ${maxObjectKeys}`);
    }
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      if (FORBIDDEN_PATH_KEYS.has(k)) {
        throw new Error(`Forbidden property "${k}" in payload`);
      }
      if (hasUnsafeControlChars(k, false)) {
        throw new Error('Object key contains disallowed control characters');
      }
      if (k.length > 128) {
        throw new Error('Object key exceeds maximum allowed length');
      }
      const v = (value as Record<string, unknown>)[k];
      out[k] = validateAndSanitizeValue(v, depth + 1, options);
    }
    return out;
  }

  throw new Error(`Unsupported value type "${typeof value}" in payload`);
}

/**
 * Validates and sanitizes a record object (e.g. table row values or event payload).
 */
export function validateAndSanitizeRecord(
  record: unknown,
  options: PayloadSanitizeOptions = {},
): Record<string, unknown> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Payload must be a plain object');
  }
  return validateAndSanitizeValue(record, 0, options) as Record<string, unknown>;
}

/**
 * Validate a navigation URL so only safe relative paths or http/https URLs are permitted.
 * Blocks `javascript:`, `data:`, `vbscript:`, protocol-relative `//`, and control characters.
 */
export function sanitizeNavigationUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!trimmed) return null;

  // Allow safe internal app paths (`/foo/bar`), reject protocol-relative (`//evil.com`) or `/\` tricks
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
      return null;
    }
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate an image `src` URL.
 * Permits relative paths (`/api/...`), `http:`/`https:`, and safe base64 raster data URIs.
 * Blocks `javascript:`, `vbscript:`, `data:text/html`, and `data:image/svg+xml`.
 */
export function sanitizeImageSrc(rawSrc: unknown): string {
  if (typeof rawSrc !== 'string') return '';
  const trimmed = rawSrc.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
      return '';
    }
    return trimmed;
  }

  if (/^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

type Token =
  | { type: 'ident'; value: string }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'op'; value: string }
  | { type: 'punct'; value: string };

function tokenizeCondition(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // String literal ('...' or "...")
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      let str = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          i++;
          str += input[i];
        } else {
          str += input[i];
        }
        i++;
      }
      if (input[i] !== quote) throw new Error('Unterminated string literal');
      i++;
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Three-char operators
    const three = input.slice(i, i + 3);
    if (three === '===' || three === '!==') {
      tokens.push({ type: 'op', value: three });
      i += 3;
      continue;
    }

    // Two-char operators
    const two = input.slice(i, i + 2);
    if (two === '&&' || two === '||' || two === '==' || two === '!=' || two === '<=' || two === '>=') {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }

    // Single-char operators & punctuation
    if (ch === '!' || ch === '<' || ch === '>') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')' || ch === '.' || ch === '[' || ch === ']') {
      tokens.push({ type: 'punct', value: ch });
      i++;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(input[i + 1] ?? ''))) {
      const start = i;
      if (ch === '-') i++;
      while (i < input.length && /[0-9.]/.test(input[i])) i++;
      const num = Number(input.slice(start, i));
      if (!Number.isFinite(num)) throw new Error('Invalid number');
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Identifiers
    if (/[a-zA-Z_$]/.test(ch)) {
      const start = i;
      while (i < input.length && /[a-zA-Z0-9_$-]/.test(input[i])) {
        // Note: stop before '-' unless part of bracket property? Keep '-' out of bare idents!
        if (input[i] === '-') break;
        i++;
      }
      tokens.push({ type: 'ident', value: input.slice(start, i) });
      continue;
    }

    throw new Error(`Disallowed character "${ch}" in condition`);
  }

  if (tokens.length > MAX_CONDITION_TOKENS) {
    throw new Error(`Condition exceeds maximum token count (${MAX_CONDITION_TOKENS})`);
  }

  return tokens;
}

export interface SafeConditionContext {
  inputs: Record<string, unknown>;
  session: Record<string, unknown>;
  cart: unknown[];
}

/**
 * Pure, eval-free safe condition evaluator.
 * Supports: literals, boolean ops (`&&`, `||`, `!`), comparisons (`===`, `!==`, `==`, `!=`, `<`, `<=`, `>`, `>=`),
 * parentheses, and safe property access rooted at `inputs`, `session`, and `cart`.
 * Blocks arbitrary JS execution, function calls, global objects, and prototype access.
 */
export function evaluateSafeCondition(
  condition: string | undefined,
  context: SafeConditionContext,
): boolean {
  if (!condition || !condition.trim()) return true;
  if (condition.length > 1000) return false;
  if (hasUnsafeControlChars(condition, false)) return false;

  try {
    const tokens = tokenizeCondition(condition);
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    function checkDepth(depth: number) {
      if (depth > MAX_CONDITION_DEPTH) {
        throw new Error(`Condition exceeds maximum nesting depth (${MAX_CONDITION_DEPTH})`);
      }
    }

    function parseOr(depth = 0): unknown {
      checkDepth(depth);
      let left = parseAnd(depth);
      while (peek()?.type === 'op' && peek()?.value === '||') {
        consume();
        const right = parseAnd(depth);
        left = left || right;
      }
      return left;
    }

    function parseAnd(depth = 0): unknown {
      let left = parseEquality(depth);
      while (peek()?.type === 'op' && peek()?.value === '&&') {
        consume();
        const right = parseEquality(depth);
        left = left && right;
      }
      return left;
    }

    function parseEquality(depth = 0): unknown {
      let left = parseRelational(depth);
      while (
        peek()?.type === 'op' &&
        (peek()?.value === '===' || peek()?.value === '!==' || peek()?.value === '==' || peek()?.value === '!=')
      ) {
        const op = consume().value;
        const right = parseRelational(depth);
        if (op === '===') left = left === right;
        else if (op === '!==') left = left !== right;
        else if (op === '==') left = left == right;
        else left = left != right;
      }
      return left;
    }

    function parseRelational(depth = 0): unknown {
      let left = parseUnary(depth);
      while (
        peek()?.type === 'op' &&
        (peek()?.value === '<' || peek()?.value === '<=' || peek()?.value === '>' || peek()?.value === '>=')
      ) {
        const op = consume().value;
        const right = parseUnary(depth);
        if (op === '<') left = (left as number) < (right as number);
        else if (op === '<=') left = (left as number) <= (right as number);
        else if (op === '>') left = (left as number) > (right as number);
        else left = (left as number) >= (right as number);
      }
      return left;
    }

    function parseUnary(depth = 0): unknown {
      checkDepth(depth);
      if (peek()?.type === 'op' && peek()?.value === '!') {
        consume();
        return !parseUnary(depth + 1);
      }
      return parsePrimary(depth);
    }

    function resolveProperty(obj: unknown, key: string | number): unknown {
      if (obj == null || typeof obj !== 'object') return undefined;
      const keyStr = String(key);
      if (FORBIDDEN_PATH_KEYS.has(keyStr)) {
        throw new Error(`Forbidden property "${keyStr}"`);
      }
      if (Array.isArray(obj)) {
        if (keyStr === 'length') return obj.length;
        const idx = Number(key);
        if (Number.isInteger(idx) && idx >= 0 && idx < obj.length) {
          return obj[idx];
        }
        return undefined;
      }
      if (!Object.prototype.hasOwnProperty.call(obj, keyStr)) {
        return undefined;
      }
      return (obj as Record<string, unknown>)[keyStr];
    }

    function parsePrimary(depth = 0): unknown {
      checkDepth(depth);
      const tok = peek();
      if (!tok) throw new Error('Unexpected end of condition');

      if (tok.type === 'punct' && tok.value === '(') {
        consume();
        const val = parseOr(depth + 1);
        const closing = consume();
        if (!closing || closing.type !== 'punct' || closing.value !== ')') {
          throw new Error('Missing closing parenthesis');
        }
        return val;
      }

      if (tok.type === 'string' || tok.type === 'number') {
        consume();
        return tok.value;
      }

      if (tok.type === 'ident') {
        consume();
        if (tok.value === 'true') return true;
        if (tok.value === 'false') return false;
        if (tok.value === 'null') return null;
        if (tok.value === 'undefined') return undefined;

        let current: unknown;
        if (tok.value === 'inputs') current = context.inputs ?? {};
        else if (tok.value === 'session') current = context.session ?? {};
        else if (tok.value === 'cart') current = Array.isArray(context.cart) ? context.cart : [];
        else throw new Error(`Unknown identifier "${tok.value}"`);

        // Only `.prop` and `[idxOrString]` member access allowed — no `(...)` calls
        let chainLen = 0;
        while (peek()?.type === 'punct' && (peek()?.value === '.' || peek()?.value === '[')) {
          chainLen++;
          if (chainLen > MAX_CONDITION_DEPTH) {
            throw new Error(`Property access chain exceeds maximum depth (${MAX_CONDITION_DEPTH})`);
          }
          const punct = consume();
          if (punct.value === '.') {
            const prop = consume();
            if (!prop || prop.type !== 'ident') {
              throw new Error('Expected property name after "."');
            }
            current = resolveProperty(current, prop.value);
          } else {
            const keyExpr = parseOr(depth + 1);
            const closeBracket = consume();
            if (!closeBracket || closeBracket.type !== 'punct' || closeBracket.value !== ']') {
              throw new Error('Expected "]"');
            }
            if (typeof keyExpr !== 'string' && typeof keyExpr !== 'number') {
              throw new Error('Invalid bracket accessor');
            }
            current = resolveProperty(current, keyExpr);
          }
        }

        // Explicitly reject function call syntax after member chain
        if (peek()?.type === 'punct' && peek()?.value === '(') {
          throw new Error('Function calls are not permitted');
        }

        return current;
      }

      throw new Error('Unexpected token in condition');
    }

    const result = parseOr(0);
    if (pos !== tokens.length) {
      return false;
    }
    return Boolean(result);
  } catch {
    return false;
  }
}
