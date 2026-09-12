# Registry sources

The executable registries deny by default. A symbol never establishes identity; chain ID plus checksummed contract address does.

Reviewed on 2026-09-12:

- USDC addresses: Circle's [contract registry](https://developers.circle.com/stablecoins/usdc-contract-addresses). Circle currently publishes addresses for Ethereum, Arbitrum, Base, OP Mainnet, and Polygon PoS among the six supported chains. No BNB Smart Chain USDC entry is enabled.
- USDT: Tether's [supported protocols](https://tether.to/en/supported-protocols/). Only Ethereum USD₮ has a published contract among the six supported chains. BNB Smart Chain lists XAU₮ but does not publish a USD₮ contract, so Binance-Peg USDT is not enabled.
- Native POL: [Polygon documentation](https://docs.polygon.technology/pos/concepts/tokens/pol).
- Native BNB and WBNB: [BNB Chain quick guide](https://docs.bnbchain.org/bnb-smart-chain/developers/quick-guide/) and [benchmark references](https://docs.bnbchain.org/bnb-smart-chain/benchmark/design-reference/).
- WETH identities: official chain documentation, Polygon mapped-token documentation, and LI.FI's [agent integration reference](https://docs.li.fi/agents/overview).
- Ethereum WBTC, DAI, LINK, UNI, and AAVE: official BitGo, Sky, Chainlink, Uniswap, and Aave documentation linked directly from each registry entry.
- LI.FI Diamond address: [LI.FI smart-contract addresses](https://docs.li.fi/introduction/lifi-architecture/smart-contract-addresses).
- LI.FI function ABIs and deployment records: [official contract types](https://github.com/lifinance/lifi-contract-types/blob/main/dist/diamond.json) and [contracts repository](https://github.com/lifinance/contracts/tree/main/deployments).

The pinned selectors correspond to Across V4 and Stargate V2 bridge-only and swap-then-bridge functions plus the six GenericSwapFacet V3 single/multiple, ERC-20/native same-chain variants. Execution remains disabled until the decoder verifies each outer call and every nested DEX call against the route and protocol registries.
