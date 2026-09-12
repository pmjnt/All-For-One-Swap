# All For One Swap — MVP Design

## 1. Purpose

All For One Swap is a local TypeScript CLI that consolidates small EVM wallet balances into one approved asset on a chosen destination chain. It discovers assets, filters untrusted tokens, compares swap and bridge routes, and executes only routes whose estimated net output remains economically worthwhile after all costs.

The CLI is non-custodial. The private key is entered through a masked local prompt only during execution, remains in process memory, is never sent to an API, and is never written to the plan, journal, configuration, command history, or logs.

This tool reduces exposure to scam tokens and unapproved protocols through strict allowlists. It cannot prove that an approved token, DEX, bridge, RPC, or aggregator will never be compromised. Every mainnet execution retains smart-contract, bridge, market, RPC, and key-handling risk.

## 2. MVP Scope

### Supported chains

The source and destination registry contains exactly these mainnets:

- Ethereum
- Arbitrum One
- Base
- OP Mainnet
- Polygon PoS
- BNB Smart Chain

### Approved destination assets

- Native ETH on Ethereum, Arbitrum, Base, and OP Mainnet.
- Native POL on Polygon PoS.
- Native BNB on BNB Smart Chain.
- Native USDC contracts published by Circle for each supported chain.
- USDT only on a chain and contract explicitly published as supported by Tether. The MVP does not infer authenticity from the `USDT` symbol and does not treat bridge-wrapped variants as official USDT.

Destination assets are selected by registry identifier, not an arbitrary contract address. Wrapped native assets such as WETH and WBNB are outside the initial destination registry.

### Source assets

Automatic execution is limited to source contracts in the local reviewed asset registry. The initial seed set is:

- The six supported chains' native coins.
- Issuer-verified USDC and USDT where officially supported.
- WETH or WBNB where the wrapped-native contract is officially documented.
- WBTC, DAI, LINK, UNI, and AAVE only on chain-specific deployments whose exact contract address has authoritative project documentation. At release review time, a source entry must also produce a valid $1-equivalent probe quote through allowlisted protocols with no more than 1% quoted price impact; this is a release gate, not a runtime trust signal.

A symbol in this list is not enough for inclusion. Each chain/address pair is reviewed separately and pinned in the release registry with its authoritative source, decimals, supported transfer behavior, and review date. If a project does not publish an authoritative deployment for a supported chain, that chain/address pair is absent. Runtime aggregator token lists cannot add executable assets.

Unknown contracts, spam airdrops, NFTs, LP positions, staked positions, rebasing tokens, fee-on-transfer tokens, and tokens with unsupported transfer behavior are reported but never approved, transferred, or swapped.

### Non-goals

- Solana, Cosmos, Bitcoin, non-EVM chains, testnets, and arbitrary EVM networks.
- A hosted service, web interface, remote signer, scheduled daemon, or backend custody.
- Automatic gas funding or bridging gas into a chain with insufficient native balance.
- Arbitrary destination addresses or arbitrary destination token contracts.
- Building a DEX router, bridge, indexer, price oracle, or routing algorithm from scratch.
- Claiming that allowlisted protocols are risk-free.

## 3. User Experience

Planning and execution are separate commands:

```bash
all-for-one plan \
  --target-chain base \
  --target-token USDC \
  --min-net-usd 0.25

all-for-one execute plan.json

all-for-one resume plan.json
```

`plan` is read-only and asks for a public wallet address. It prints every discovered asset with its classification, proposed route, estimated costs, minimum output, and skip reason. It writes a versioned `plan.json` containing no secret.

`execute` revalidates the plan and refreshes every quote before asking for a private key. It shows all material changes, asks for one explicit batch confirmation, and then executes routes sequentially. The derived signer address must equal the address stored in the plan.

`resume` reads the public journal, checks transaction receipts and destination balances on-chain, and continues only from the first incomplete safe step. It never resubmits a step already observed as submitted or confirmed.

Private keys are not accepted in command arguments, environment variables, config files, plan files, or standard input redirection. Interactive TTY input is required for mainnet execution. API keys may be stored in local environment variables and must be redacted from output.

The signer releases all key references when execution ends, but JavaScript runtimes cannot guarantee physical memory zeroization. Users must run the CLI on a trusted, malware-free machine and should prefer a dedicated low-value wallet until hardware-wallet support exists outside this MVP.

## 4. Architecture

The CLI uses small modules with explicit interfaces:

- `wallet`: masked key input, address derivation, local signing, and secret redaction boundaries.
- `chains`: chain IDs, native assets, RPC endpoints, confirmation policy, and gas-reserve policy.
- `assets`: reviewed source and destination contracts keyed by chain ID and address.
- `discovery`: provider-backed portfolio discovery plus allowlist-only RPC fallback.
- `pricing`: normalized USD valuations and confidence/source metadata.
- `routing`: provider-neutral route and quote interfaces.
- `policy`: deterministic validation of tokens, protocols, transaction targets, spenders, recipients, amounts, deadlines, slippage, and approvals.
- `planner`: route comparison, cost accounting, skip decisions, and immutable plan creation.
- `executor`: simulation, signing, submission, receipt handling, and sequential state transitions.
- `journal`: atomic persistence of public execution state for idempotent resume.
- `reporter`: human-readable tables, JSON output, explorer links, and redacted diagnostics.

The dependency direction is inward: provider adapters return normalized candidates; only the local policy and planner decide whether a candidate is executable. API responses are untrusted input.

## 5. Initial Providers and Fallbacks

### Route provider

The first `RouteProvider` adapter uses the LI.FI route/quote API for same-chain swaps and cross-chain routes. The adapter requests multiple candidates, restricts allowed exchanges and bridges where the API supports filtering, and retrieves fresh transaction data immediately before execution. Local policy validation remains mandatory even when the upstream filter is used.

The design does not use a provider SDK to sign or submit transactions. The CLI receives candidate transaction data, validates it locally, and submits through `viem` only after confirmation.

### Discovery provider

When `ALCHEMY_API_KEY` is present, the first `PortfolioProvider` adapter uses Alchemy's multi-chain token-balance API. Partial per-network failures are preserved as warnings and retried through the chain's RPC path; an HTTP success does not imply that every requested chain succeeded.

Without an indexer API key, discovery queries native balances and every source contract in the local registry via public RPC. This fallback is intentionally incomplete: it cannot enumerate every ERC-20 ever associated with the wallet. The report prominently states `DISCOVERY_MODE=ALLOWLIST_ONLY`.

### Pricing

USD values carry a source and observation time. Provider-reported USD estimates may help rank candidates but are not trusted alone. Final economic checks use the fresh route output, estimated approval/source gas, explicit fees not already reflected in the quoted output, and a current native-gas USD value. The normalized quote records which fees are already deducted so the planner cannot subtract them twice. Missing or stale prices make a route non-executable rather than assuming a value.

Provider interfaces permit later adapters without changing policy, planning, or execution.

## 6. Trust and Allowlist Model

Three independent registries are version-controlled:

1. `chains`: exact chain IDs and network metadata.
2. `assets`: exact token contracts, decimals, issuer evidence, supported behavior, and review date.
3. `protocols`: exact router, approval-spender, bridge, and helper contracts by chain.

All registries deny by default. Names and symbols are display metadata only. Contract addresses and chain IDs define identity.

The protocol registry is narrower than the aggregator's complete tool list. A route using an unknown DEX, bridge, router, executor, approval target, or intermediate token is rejected even if its quoted output is higher. Registry changes require code review, source evidence, test fixtures, and a new release; the CLI does not download and trust live allowlist updates.

## 7. Planning Flow

1. Validate the destination chain/asset pair against the registry.
2. Discover balances on all six chains and report partial failures.
3. Read native gas balances and reserve requirements.
4. Classify each holding as approved, unknown, unsupported, zero, missing price, insufficient gas, or route candidate.
5. Request route candidates only for approved source assets.
6. Normalize route steps and validate every contract and intermediate asset against local policy.
7. Estimate all approval, swap, bridge, and destination costs with a configured buffer.
8. Calculate `netOutputUsd = quotedDestinationOutputUsd - incrementalGasUsd - nonDeductedExplicitFeesUsd`. Fees already reflected in the quoted destination amount are not subtracted again.
9. Accept a route only when `netOutputUsd` meets `--min-net-usd`, price impact and slippage stay within policy, and the wallet retains the chain's native gas reserve.
10. Select the highest valid net output; otherwise record a stable skip reason.
11. Persist a versioned plan with quote timestamps, policy version, registry version, assumptions, and no secret.

"Optimal" means best net output among candidates returned by configured providers that also pass local policy at that observation time. It is not a guarantee of the globally best route or final market price.

## 8. Execution Flow

1. Load and schema-validate the plan.
2. Verify the plan's wallet address, policy version, registry version, and destination.
3. Refresh balances, nonce, gas estimates, native prices, and all quotes.
4. Re-run policy and profitability checks. Abort before the first write if any planned route changed materially or became invalid.
5. Display the refreshed batch, differences from the saved plan, maximum spend, minimum receive amounts, and gas reserve.
6. Request one explicit confirmation.
7. Prompt for the private key through a masked interactive TTY and verify the derived address.
8. For ERC-20 input, issue only the exact required allowance to the approved spender. Unlimited approval is forbidden. If an existing allowance must first be reset to zero, include that transaction and its cost in the refreshed profitability calculation.
9. Simulate each transaction against the intended chain immediately before signing.
10. Submit one step at a time, atomically journal its hash, and wait for the configured source confirmation threshold.
11. For cross-chain steps, record `BRIDGE_PENDING` and poll the provider status plus destination-chain evidence. A timeout never triggers an automatic resubmission.
12. Continue only when the current route reaches its safe next state. On an unexpected revert or invariant violation, stop the entire batch.
13. Produce a final reconciliation report from on-chain balances and receipts.

Native source assets are never swept to zero. The spendable amount is balance minus the calculated reserve and buffer. A route is skipped if that remainder is not economically useful.

## 9. Transaction Validation

Before signing, the validator must establish all of the following:

- RPC-reported chain ID equals the planned chain ID.
- `from` and recipient equal the planned wallet address.
- Transaction `to`, approval spender, routers, bridges, and helper contracts are allowlisted for that chain.
- Input and output token addresses equal the plan.
- Input amount does not exceed the refreshed approved amount.
- Native `value` matches the decoded route purpose and stays within the maximum spend.
- Allowance is exact and never unlimited.
- Minimum output, deadline, slippage, price impact, gas limit, and fee fields remain within policy.
- Intermediate tokens and route steps are allowed.
- Contract bytecode exists at every required contract address.
- Local decoding understands the call shape; opaque or unsupported calldata is rejected.
- `eth_call` simulation succeeds from the signer address at current state.

The default maximum slippage is 1%. Users may configure a lower value. The MVP does not allow a value above its compiled policy ceiling.

## 10. Persistent Data and State Machine

Plans and journals contain public blockchain data only. Writes use a temporary file plus atomic rename to avoid corrupting state during termination.

Each asset route has one of these states:

- `SKIPPED`: never executable, with a machine-readable reason.
- `READY`: validated and included in the confirmed batch.
- `SUBMITTED`: a transaction hash is journaled.
- `CONFIRMED`: the current source-chain step is confirmed.
- `BRIDGE_PENDING`: source settlement is confirmed and destination settlement is unresolved.
- `COMPLETED`: destination balance/receipt evidence satisfies the route.
- `FAILED`: a terminal failure was observed and requires manual review.

Allowed transitions are monotonic. Resume consults on-chain evidence before any transition or submission. It does not turn an unresolved timeout into `FAILED` and does not treat provider status alone as proof of settlement.

## 11. Error Handling

- Stale quote, changed balance, changed nonce, excessive gas, missing price, policy mismatch, or failed simulation aborts before execution.
- RPC failover is permitted only after verifying chain ID and rereading relevant state. A different quote is never substituted silently.
- API rate limits and partial discovery results appear in the report. Missing data is not interpreted as a zero balance.
- A reverted or unexpectedly decoded transaction stops the full batch. The CLI never spends again through an alternative route automatically.
- A bridge timeout remains pending and instructs the user to monitor or resume. It never causes a duplicate bridge transaction.
- `SIGINT` stops before the next signature, flushes the public journal, and reports any already submitted transaction.
- Error and debug serializers redact secrets, authorization headers, query-string API keys, and raw signer objects.

## 12. Testing Strategy

### Unit and property tests

- Fixed-point amount conversion, decimals, USD calculations, gas reserves, buffers, slippage, expiry, route ranking, and state transitions.
- Boundary cases around zero, minimum net USD, maximum integer sizes, price staleness, and balance changes.
- Property tests ensure accepted routes cannot spend more than plan maxima or transition backward.

### Adversarial fixtures

Recorded malicious provider responses cover wrong recipient, wrong chain ID, unknown router, unknown bridge, unknown intermediate token, unlimited approval, symbol spoofing, altered calldata, excessive native value, expired quote, and unsupported opaque call shapes. Every fixture must be rejected before signing.

### Provider contract tests

Recorded LI.FI and Alchemy responses validate normalization and schema-drift behavior. Unknown response fields are tolerated where safe; missing security-critical fields fail closed. Alchemy partial-network errors remain visible.

### EVM integration tests

A local EVM or pinned fork covers native/ERC-20 balances, exact allowance, allowance reset, simulation, nonce handling, reverts, receipts, atomic journal writes, interruption, and idempotent resume. CI never contains a funded private key and never sends a mainnet transaction.

### Operational verification

- Read-only mainnet `plan` smoke tests use public addresses.
- Release candidates use a separate low-value canary wallet for each allowlisted route/protocol.
- Automated log scanning verifies that private keys, API keys, authorization headers, and signer objects never appear.

## 13. Acceptance Criteria

The MVP is complete when it can:

- Produce an explicit complete/partial discovery report across all six chains.
- Select native coin, official USDC, or officially supported USDT as the destination according to the registry.
- Refuse every unregistered source token and protocol contract.
- Produce a reproducible plan with costs, minimum outputs, assumptions, and skip reasons.
- Revalidate the complete batch and obtain one explicit confirmation before requesting the private key.
- Reject every adversarial transaction fixture before signing.
- Execute accepted routes sequentially with exact allowances and gas reserves.
- Track bridge settlement without duplicate submission.
- Resume safely after interruption using on-chain evidence.
- Reconcile each asset to a terminal or explicitly pending state without leaking secrets.

## 14. Authoritative Registry Sources

Registry entries must link to issuer or protocol documentation. Initial authoritative references include:

- Circle USDC contract addresses: <https://developers.circle.com/stablecoins/usdc-contract-addresses>
- Tether supported protocols: <https://tether.to/en/supported-protocols/>
- Polygon POL documentation: <https://docs.polygon.technology/pos/concepts/tokens/pol>
- BNB Smart Chain documentation: <https://docs.bnbchain.org/bnb-smart-chain/developers/quick-guide/>
- LI.FI endpoint specifications: <https://docs.li.fi/agents/reference/endpoint-specs>
- LI.FI route request documentation: <https://docs.li.fi/sdk/request-routes>
- Alchemy token balances by wallet: <https://www.alchemy.com/docs/data/portfolio-apis/portfolio-api-endpoints/portfolio-api-endpoints/get-token-balances-by-address>

The implementation pins reviewed registry contents in the release. Runtime API metadata never overrides them.
