# All For One Swap

All For One Swap is a local TypeScript CLI for consolidating small, reviewed EVM balances into one approved native coin, USDC, or USDT destination. It discovers assets, compares eligible LI.FI routes by estimated net USD output, and applies local allowlists and transaction-decoding checks before anything can be signed.

> **Mainnet software warning:** Swaps and bridges can lose funds through contract exploits, provider errors, market movement, configuration mistakes, or user error. This project reduces several obvious risks but cannot establish the safety of a token, route, DEX, bridge, aggregator, RPC, or smart contract. Start with a new, dedicated wallet containing only a small amount you can afford to lose.

For a step-by-step guide in Vietnamese, open the **[Vietnamese usage tutorial](tutorial.html)**.

## What it does

The CLI follows a deliberate `plan → review → execute → resume` workflow:

1. `plan` reads balances and requests route estimates without asking for a private key.
2. You inspect the discovered assets, warnings, selected tools, fees, minimum output, and skip reasons.
3. `execute` refreshes every eligible route, validates it again, asks for an explicit confirmation, and only then opens a masked private-key prompt.
4. `resume` reconciles journaled transactions and continues interrupted work without blindly submitting the same source transaction again.

Routes are ranked by their estimated output after incremental gas and explicit fees. “Best” means the best eligible LI.FI response observed at planning time—not a guarantee of globally optimal execution or future delivery.

## Safety model

- Planning is read-only and never needs a signer.
- The private key is accepted only from an interactive masked terminal prompt after you type `EXECUTE`.
- The key is not accepted through CLI flags or plan files and is never intentionally written to disk.
- The derived signer address must match the wallet address stored in the plan.
- Source and destination assets, chain IDs, protocol tools, entrypoints, spenders, selectors, recipients, values, deadlines, and minimum outputs are checked against local policy.
- Unknown tokens and unsupported transfer behaviors are skipped by default.
- ERC-20 approvals use the exact planned amount. Legacy USDT allowances are reset to zero first when required.
- Routes execute sequentially and state changes are written to an atomic journal.
- A bridge is not considered complete from an aggregator status alone; destination-chain receipt and balance evidence are also required.
- Secrets and known credentials are redacted from reported provider errors as defense in depth.

These controls are not scam detection and do not prove that an allowlisted protocol remains uncompromised. Registry entries must still be reviewed against primary sources before mainnet use.

## Supported scope

| Chain key | Chain | Native destination | Stablecoin destinations |
|---|---|---:|---|
| `ethereum` | Ethereum | ETH | USDC, USDT |
| `optimism` | Optimism | ETH | USDC |
| `bsc` | BNB Smart Chain | BNB | None in this release |
| `polygon` | Polygon PoS | POL | USDC |
| `base` | Base | ETH | USDC |
| `arbitrum` | Arbitrum One | ETH | USDC |

Native ETH, BNB, and POL are legitimate destination assets on their respective chains. Stablecoin destinations are limited to the exact official contracts pinned in `src/config/assets.ts`; arbitrary token addresses are rejected. Official USDT is currently enabled only on Ethereum.

The source allowlist contains 23 pinned native or high-liquidity asset entries across the six chains. Indexed discovery may see additional balances, but an unknown asset does not become eligible automatically.

The route boundary is intentionally narrow:

- **Aggregator:** LI.FI supplies prices, candidate routes, transaction data, and bridge status.
- **Bridge:** Across is the only enabled bridge.
- **DEX tools:** 1inch and Odos are the only enabled exchange tools.
- **Disabled:** Stargate remains disabled until it has equivalent local calldata decoding and validation coverage.

## Requirements

- Node.js 22 or newer
- npm
- Native gas on every source chain that will submit a transaction
- A dedicated low-value EVM wallet for the first mainnet run
- Optional Alchemy API key and custom RPC endpoints

## Installation

Clone the repository, enter its directory, then install and verify it:

```bash
npm install
npm run check
```

`npm run check` runs TypeScript checking, the Vitest suite, and the production build.

## Configuration

The CLI does **not** automatically load `.env`. Export variables in the current shell or load them with a secrets manager before starting the command. Never store a funded wallet private key in `.env`, shell history, CI variables, command arguments, log collectors, or issue reports.

Available variables from `.env.example`:

| Variable | Required | Purpose |
|---|---:|---|
| `ALCHEMY_API_KEY` | No | Enables indexed portfolio discovery. Without it, discovery scans only the pinned asset registry over RPC. |
| `LIFI_API_KEY` | No | Reserved in the environment schema. The current LI.FI adapters do not attach it and use public endpoints. |
| `ETHEREUM_RPC_URL` | No | Overrides the pinned public Ethereum RPC. |
| `OPTIMISM_RPC_URL` | No | Overrides the pinned public Optimism RPC. |
| `BSC_RPC_URL` | No | Overrides the pinned public BSC RPC. |
| `POLYGON_RPC_URL` | No | Overrides the pinned public Polygon RPC. |
| `BASE_RPC_URL` | No | Overrides the pinned public Base RPC. |
| `ARBITRUM_RPC_URL` | No | Overrides the pinned public Arbitrum RPC. |

Example with placeholder values:

```bash
export ALCHEMY_API_KEY="your-alchemy-api-key"
export BASE_RPC_URL="https://your-base-rpc.example"
```

Custom RPC endpoints take precedence over the public endpoints pinned in `src/config/chains.ts`. Every RPC is checked against the expected chain ID before its data is trusted.

## Usage

### 1. Build

```bash
npm run build
```

### 2. Start the interactive wizard

The recommended beginner workflow is:

```bash
node dist/cli.js
```

The wizard asks for:

1. `English` or `Tiếng Việt` for wizard-owned prompts;
2. the public EVM wallet address to scan—not a private key;
3. one of the six supported target chains;
4. a registry-approved target token filtered for that chain;
5. minimum net USD, defaulting to `0.25`;
6. plan and journal paths, defaulting to `plan.json` and `journal.json`.

It creates and displays the read-only plan before asking `Execute this plan now? (y/N)`. The default is **No**. Depending on the result, the wizard will either:

- save the plan and stop because no route is executable;
- save the plan and stop so you can review it;
- delegate the saved plan to the existing executor after you explicitly choose Yes.

Choosing Yes does not bypass the safety gate. You must still type the exact word `EXECUTE`; only then does the masked private-key prompt appear. The derived signer address must match the public wallet address entered at the start. Pressing `Ctrl+C` at a prompt cancels safely.

### 3. Review the plan

Do not approve execution until you have inspected `plan.json` and the console report for:

- discovery mode and any missing or failed chains;
- exact source and destination chain/token contracts;
- source amounts and preserved native-gas reserves;
- route tool IDs (`across`, `1inch`, or `odos` only);
- estimated gas, explicit fees, net USD output, and minimum receive;
- expiry time and skipped reason codes.

`ALLOWLIST_ONLY` means no indexed token discovery was used. `PARTIAL` means at least one chain could not be fully checked; absence from that plan is not proof of a zero balance. Investigate warnings before execution.

### 4. Simulation before broadcast

Simulation is a hard gate, not a success prediction. Each transaction candidate must pass `eth_call` and `estimateGas` before that candidate is broadcast. A failed simulation blocks the affected transaction.

For an ERC-20 route that needs allowance, every approval candidate is simulated before its approval transaction is sent. The swap or bridge may require that allowance to exist first, so it is simulated again after the approval is mined and before the route transaction is broadcast. If that final simulation fails, the approval may already exist on-chain, but the swap or bridge transaction is not sent.

A successful simulation only reflects the RPC state observed at that moment. State, price, nonce, liquidity, gas, or protocol conditions can change before mining, and bridge delivery cannot be guaranteed.

### 5. Explicit commands for automation

The existing argument-based workflow remains available. Create a read-only plan:

The following example consolidates eligible balances into USDC on Base and skips routes whose estimated net result is below USD 0.25:

```bash
node dist/cli.js plan \
  --wallet 0xYourAddress \
  --target-chain base \
  --target-token USDC \
  --min-net-usd 0.25 \
  --out plan.json
```

Use `--json` if you want the strict plan schema on standard output. The plan is still written atomically to the path selected by `--out`.

Then execute it from a trusted interactive terminal:

```bash
node dist/cli.js execute --plan plan.json --journal journal.json
```

The CLI refreshes the complete executable batch and rejects changed tools, assets, amounts, expired quotes, or reduced output below policy. It then asks:

```text
Execute N routes? Type EXECUTE to continue
```

Only after that exact confirmation does the masked private-key prompt appear. Run this command in a trusted interactive terminal. Stop if the refreshed batch differs from what you reviewed or if any address is unexpected.

### 6. Resume safely

If the process exits, a receipt is still pending, or a bridge needs more observation time, preserve the original plan, journal, and generated `.ready` sidecar and run:

```bash
node dist/cli.js resume \
  --plan plan.json \
  --journal journal.json \
  --timeout-seconds 600
```

`BRIDGE_PENDING` is a resumable state, not a signal to replay calldata manually. Resume checks existing hashes and destination evidence before continuing.

## Plan and journal files

- `plan.json` is a strict, versioned, secret-free snapshot of discovery results, policy, selected routes, skip reasons, and a deterministic plan ID.
- `journal.json` records monotonic route states and transaction hashes so execution can be reconciled after interruption.
- `journal.json.ready` preserves routes that were refreshed and ready around execution/resume boundaries.

Keep these files private even though they do not contain the private key: wallet addresses, balances, transaction history, and strategy details are sensitive metadata. Do not edit them by hand.

## Architecture

```text
RPC / Alchemy ──► discovery ──► local asset policy
                                      │
LI.FI routes ──► normalization ──► route + calldata validation
                                      │
                               net-output planning
                                      │
                            plan → execute → journal
                                      │
                          bridge monitor → resume
```

Provider adapters normalize external data before it reaches planning. Deterministic registries and policy modules form the trust boundary. The signer is created only inside execution, after refreshed routes pass validation and the operator confirms the batch.

## Verification

Run the complete local gate:

```bash
npm run check
```

Run the read-only network smoke test when validating current mainnet providers and registries:

```bash
npm run smoke:mainnet
```

The smoke test performs network reads and quote checks but must not be treated as permission to execute mainnet transactions. Registry maintainers should also follow the primary-source review process in [docs/registry-sources.md](docs/registry-sources.md).

## Limitations

- The software cannot establish that any route, token, bridge, DEX, aggregator, or RPC is safe.
- The allowlist is deliberately small and becomes stale unless maintained.
- Unknown or unsupported tokens are skipped rather than sold.
- Route selection considers eligible LI.FI responses at a point in time; prices, gas, liquidity, and delivery conditions can change.
- Public RPCs can be rate-limited, unavailable, or inconsistent.
- `LIFI_API_KEY` is not yet wired into request headers; current LI.FI requests use public access.
- Small balances may be uneconomic after gas and bridge fees.
- Cross-chain completion can take longer than the configured observation timeout.
- This is mainnet-capable software, not financial advice or a custodial recovery service.

## Further reading

- [Vietnamese usage tutorial](tutorial.html)
- [Operations and mainnet safety](docs/operations.md)
- [Registry sources and review policy](docs/registry-sources.md)
