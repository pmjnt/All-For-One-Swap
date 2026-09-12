import { expect, it } from 'vitest';

import { renderFailure } from '../../src/reporting/console.js';

it('never renders secrets from nested provider errors', () => {
  const output = renderFailure({
    message: 'request failed',
    privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    config: { headers: { authorization: 'Bearer api-secret' } },
  });
  expect(output).not.toContain('aaaaaaaa');
  expect(output).not.toContain('api-secret');
  expect(output).toContain('[REDACTED]');
});
