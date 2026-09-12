# Operations and mainnet safety

## Release review

Before each release, verify every chain ID, public RPC, asset contract, decimals value, LI.FI
Diamond address, approved spender, tool ID, ABI shape, and function selector against its primary
source URL in `src/config`. Run both the offline registry check and the read-only mainnet smoke
check. A changed address or selector is a deny-by-default event, not an automatic update.

For non-stable source assets, repeat the documented `$1` notional liquidity probe. The quote must
remain within the configured 1% price-impact/slippage ceiling. Record the review date and do not
silently widen the limit to make a route pass.

## Canary procedure

1. Use a newly created, dedicated wallet containing only a small amount you can lose.
2. Run `plan`; inspect discovery mode, warnings, exact contract addresses, route tools, net output,
   minimum receive, and skipped reason codes.
3. Test one same-chain or direct bridge route before attempting a batch.
4. Keep enough native gas on every source chain. Never import a treasury or long-lived production
   key into the canary.
5. Type `EXECUTE` only when the refreshed batch still matches the reviewed plan.

Production private keys are prohibited in CI, fixtures, `.env`, shell history, log collectors, and
issue reports. CI may use public addresses and deterministic test-only keys with no funds.

## Bridge pending

`DONE` from an aggregator is not accepted by itself. Completion requires a successful destination
transaction receipt and an increase over the route-specific destination balance snapshot recorded
immediately before source submission. Use:

```bash
node dist/cli.js resume --plan plan.json --journal journal.json --timeout-seconds 600
```

A timeout remains `BRIDGE_PENDING`; it must not trigger a second source transaction. Preserve both
`journal.json` and the `.ready` sidecar. Investigate the source hash in the chain explorer and the
bridge's official support channel. Never “unstick” it by manually replaying calldata.

## RPC/provider incident

Stop execution when chain ID verification, balance reads, nonce reads, simulation, gas estimation,
receipt lookup, or price freshness fails. Planning may report `PARTIAL`, but missing chains are not
proof of zero balance. Compare at least one independent official explorer/RPC before changing a
registry or resuming.

## Suspected log leak

Stop the process, isolate the logs, revoke the affected API key, and move funds if a private key may
have been exposed. Do not paste raw provider errors into tickets. The reporter redacts known secret
fields, but redaction is defense in depth—not permission to log secrets.
