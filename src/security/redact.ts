const secretKeyPattern = /private.?key|authorization|api.?key|secret|signer/i;
const inlineSecretPattern = /(private.?key|authorization|api.?key|secret|signer)=([^&\s]+)/gi;

function sanitizeString(value: string): string {
  const sanitizedInline = value.replace(inlineSecretPattern, '$1=[REDACTED]');
  try {
    const url = new URL(sanitizedInline);
    for (const key of url.searchParams.keys()) {
      if (secretKeyPattern.test(key)) url.searchParams.set(key, '[REDACTED]');
    }
    return url.toString();
  } catch {
    return sanitizedInline;
  }
}

function visit(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (value instanceof Error) {
    return {
      message: sanitizeString(value.message),
      name: value.name,
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) return value.map((item) => visit(item, seen));

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return `[${value.constructor?.name ?? 'OBJECT'}]`;
  }

  const output: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!descriptor.enumerable) continue;
    if (!('value' in descriptor)) {
      output[key] = '[ACCESSOR]';
    } else if (secretKeyPattern.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = visit(descriptor.value, seen);
    }
  }
  return output;
}

export function redact(value: unknown): unknown {
  return visit(value, new WeakSet());
}
