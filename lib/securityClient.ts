/**
 * Client-and-server safe sanitization & expression utilities.
 * Prevents XSS, unsafe URL protocols (javascript:, data:), and arbitrary script evaluation.
 */

const FORBIDDEN_PATH_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

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

  try {
    const tokens = tokenizeCondition(condition);
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    function parseOr(): unknown {
      let left = parseAnd();
      while (peek()?.type === 'op' && peek()?.value === '||') {
        consume();
        const right = parseAnd();
        left = left || right;
      }
      return left;
    }

    function parseAnd(): unknown {
      let left = parseEquality();
      while (peek()?.type === 'op' && peek()?.value === '&&') {
        consume();
        const right = parseEquality();
        left = left && right;
      }
      return left;
    }

    function parseEquality(): unknown {
      let left = parseRelational();
      while (
        peek()?.type === 'op' &&
        (peek()?.value === '===' || peek()?.value === '!==' || peek()?.value === '==' || peek()?.value === '!=')
      ) {
        const op = consume().value;
        const right = parseRelational();
        if (op === '===') left = left === right;
        else if (op === '!==') left = left !== right;
        else if (op === '==') left = left == right;
        else left = left != right;
      }
      return left;
    }

    function parseRelational(): unknown {
      let left = parseUnary();
      while (
        peek()?.type === 'op' &&
        (peek()?.value === '<' || peek()?.value === '<=' || peek()?.value === '>' || peek()?.value === '>=')
      ) {
        const op = consume().value;
        const right = parseUnary();
        if (op === '<') left = (left as number) < (right as number);
        else if (op === '<=') left = (left as number) <= (right as number);
        else if (op === '>') left = (left as number) > (right as number);
        else left = (left as number) >= (right as number);
      }
      return left;
    }

    function parseUnary(): unknown {
      if (peek()?.type === 'op' && peek()?.value === '!') {
        consume();
        return !parseUnary();
      }
      return parsePrimary();
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

    function parsePrimary(): unknown {
      const tok = peek();
      if (!tok) throw new Error('Unexpected end of condition');

      if (tok.type === 'punct' && tok.value === '(') {
        consume();
        const val = parseOr();
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
        while (peek()?.type === 'punct' && (peek()?.value === '.' || peek()?.value === '[')) {
          const punct = consume();
          if (punct.value === '.') {
            const prop = consume();
            if (!prop || prop.type !== 'ident') {
              throw new Error('Expected property name after "."');
            }
            current = resolveProperty(current, prop.value);
          } else {
            const keyExpr = parseOr();
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

    const result = parseOr();
    if (pos !== tokens.length) {
      return false;
    }
    return Boolean(result);
  } catch {
    return false;
  }
}
