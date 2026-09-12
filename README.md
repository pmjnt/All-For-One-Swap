# All For One Swap

Local TypeScript CLI for consolidating reviewed EVM assets into one approved native coin, USDC, or
USDT destination. Planning is read-only. Private keys are requested only inside an interactive,
masked terminal after a complete refresh and explicit confirmation, and are never written to disk.

> **Mainnet software warning:** This tool reduces obvious token/router/route risks; it cannot
> guarantee that LI.FI, a bridge, a DEX, an RPC, or a reviewed smart contract will never be
> compromised. Start with a dedicated low-value wallet.

## Requirements and installation

- Node.js 22 or newer
- Native gas on every source chain that will submit a transaction
- Optional `ALCHEMY_API_KEY`; without it, discovery scans only the local asset allowlist over RPC
- Optional custom RPC URLs from `.env.example`; otherwise pinned public RPC endpoints are used

```bash
npm install
npm run check
```

The CLI does not automatically load `.env`; export variables in the shell or use your own secrets
manager. Never put a production private key in an environment variable, file, command argument, CI,
or clipboard history.

## Workflow

Create a read-only plan:

```bash
npm run build
node dist/cli.js plan \
  --wallet 0xYourAddress \
  --target-chain base \
  --target-token USDC \
  --min-net-usd 0.25 \
  --out plan.json
```

Review `plan.json`, then execute from an interactive terminal:

```bash
node dist/cli.js execute --plan plan.json --journal journal.json
```

The tool refreshes every route before asking `Execute N routes? Type EXECUTE to continue`. Only
after that confirmation does it request a masked private key. ERC-20 approvals are exact; legacy
USDT allowance is reset to zero first when required.

Resume an interrupted or pending bridge without re-submitting journaled source transactions:

```bash
node dist/cli.js resume --plan plan.json --journal journal.json --timeout-seconds 600
```

## Supported scope

Chains: Ethereum, Optimism, BNB Smart Chain, Polygon PoS, Base, and Arbitrum One.

Destinations are registry entries only. Native ETH/BNB/POL are valid targets on their own chains;
native USDC is available on the supported Circle chains in the registry, and official USDT is
currently enabled on Ethereum. BSC intentionally has no stablecoin destination in this release;
BNB is its approved target. Arbitrary token contract addresses are rejected.

Source assets include native coins and a small pinned set of official/high-liquidity contracts. An
Alchemy key enables indexed discovery, but discovered unknown tokens are classified and skipped.
Without Alchemy, public/custom RPC scans only that pinned registry.

“Optimal” means the highest estimated net USD output among routes returned at that moment by LI.FI
that also pass the local asset, tool, entrypoint, selector, slippage, and minimum-output policy. It
is not a guarantee of globally best execution or future delivery.

See [docs/operations.md](docs/operations.md) before using mainnet funds.
