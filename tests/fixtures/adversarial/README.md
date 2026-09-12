# Adversarial policy cases

The policy suite constructs each malicious response from the reviewed fixture and changes exactly
one field: recipient, chain ID, router, bridge tool, intermediate asset/address (including symbol
spoofing by an unreviewed address), approval amount, source amount, selector/calldata, native value,
expiry, or calldata shape. Keeping mutations in `tests/support/route-builders.ts` avoids maintaining
opaque transaction blobs while preserving one-field-at-a-time regression coverage.
