import { describe, expect, it, vi } from 'vitest';

import { redact } from '../../src/security/redact.js';

describe('redact', () => {
  it('redacts nested secrets and URL query values', () => {
    const value = redact({
      privateKey: '0xabc',
      headers: { authorization: 'Bearer secret' },
      url: 'https://example.test/path?apiKey=secret&chain=1',
    });
    const serialized = JSON.stringify(value);

    expect(serialized).not.toContain('Bearer secret');
    expect(serialized).not.toContain('0xabc');
    expect(serialized).not.toContain('apiKey=secret');
    expect(serialized).toContain('[REDACTED]');
    expect(serialized).toContain('chain=1');
  });

  it('handles circular references without invoking getters', () => {
    const getter = vi.fn(() => 'secret');
    const input: Record<string, unknown> = {};
    Object.defineProperty(input, 'computed', { enumerable: true, get: getter });
    input.self = input;

    expect(redact(input)).toEqual({ computed: '[ACCESSOR]', self: '[CIRCULAR]' });
    expect(getter).not.toHaveBeenCalled();
  });

  it('sanitizes Error objects', () => {
    const error = new Error('request failed for apiKey=secret');

    expect(JSON.stringify(redact(error))).not.toContain('secret');
  });
});
