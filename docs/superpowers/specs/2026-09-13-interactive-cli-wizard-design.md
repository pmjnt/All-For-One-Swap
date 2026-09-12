# Interactive CLI Wizard Design

## Objective

Add a bilingual interactive wizard for operators who run `node dist/cli.js` without a subcommand,
while preserving the existing non-interactive `plan`, `execute`, and `resume` command contracts.
The wizard must reuse the existing planning, policy, simulation, execution, and journaling paths; it
must not introduce a second transaction pipeline or weaken any signing gate.

## Entry points and compatibility

Running the CLI without a subcommand starts the wizard:

```bash
node dist/cli.js
```

These existing interfaces remain unchanged for scripts and advanced users:

```bash
node dist/cli.js plan --wallet 0xYourAddress --target-chain base --target-token USDC --min-net-usd 0.25 --out plan.json
node dist/cli.js execute --plan plan.json --journal journal.json
node dist/cli.js resume --plan plan.json --journal journal.json --timeout-seconds 600
```

Commander help requests and explicit subcommands must never open the wizard.

## Wizard flow

The wizard prompts in this order:

1. Select `English` or `Tiếng Việt`. The choice applies only to the current wizard process and is
   not persisted.
2. Enter a public EVM wallet address. Validate it immediately and retry invalid input.
3. Select one of the six supported destination chains from the live chain registry.
4. Select a destination token filtered from destination-enabled registry entries on that chain.
5. Enter minimum net USD, defaulting to `0.25`; accept only finite, non-negative decimal input.
6. Enter the plan path, defaulting to `plan.json`, and the journal path, defaulting to
   `journal.json`; reject blank values.
7. Run the same read-only planning path as the explicit `plan` command, save the plan atomically,
   and render the existing complete plan report.
8. If no route is `READY`, explain that nothing can be executed and exit without requesting a
   private key.
9. Ask whether to execute now, with `No` as the default. Selecting `No` preserves the plan and
   exits successfully.
10. Selecting `Yes` delegates to the existing execution path. The operator must still type the
    exact word `EXECUTE`; only afterward may the existing masked private-key prompt appear.

The plan stage asks only for the public wallet address. The private key is never requested during
discovery or route planning. The signer address derived during execution must match the wallet
stored in the plan.

## Architecture and component boundaries

Create `src/cli/wizard.ts` as the interaction and orchestration boundary. It owns bilingual message
catalogs, prompt sequencing, registry-derived selection choices, retryable input validation, and
the decision to stop after planning or delegate to execution. Prompt functions and orchestration
dependencies are injected so tests do not require a real TTY, network, key, or transaction.

Extract the live planning dependency assembly currently embedded in `src/cli.ts` into a focused
factory in the planning CLI module or a small adjacent module. Both the explicit `plan` Commander
action and the wizard call the same `runPlan` function with the same live providers. Execution is
likewise delegated to the existing `executeWithLiveProviders` function; the wizard must not
duplicate confirmation, private-key, simulation, approval, broadcast, or journal logic.

Update `src/cli.ts` so an empty argument list invokes the wizard, while any explicit command or
help flag continues through Commander. `buildCli()` remains independently testable and command
names remain `plan`, `execute`, and `resume`.

## Language behavior

Only wizard-owned prompts and wizard summaries are bilingual. Existing detailed plan reporting,
provider errors, execution confirmation, and lower-level error messages remain in their current
language to avoid a broad unrelated localization refactor. The language selector itself presents
both language names. No locale file or setting is written to disk.

## Simulation and transaction safety

Simulation is a hard broadcast gate, not a prediction score. The existing execution preflight must
successfully complete `eth_call` and `estimateGas` for a transaction candidate before that
candidate is broadcast. A failed simulation or gas estimate blocks that transaction and must never
be bypassed, downgraded to a warning, or automatically retried by sending it for real.

For an ERC-20 route that needs allowance, each approval candidate is simulated before its approval
transaction is broadcast. The downstream swap or bridge may revert during preflight until the exact
allowance exists, so it is simulated again after the mined approval and before the route transaction
is broadcast. If that second simulation fails, the approval may already exist on-chain, but the
swap or bridge transaction is not broadcast. This sequencing and its limitation must be stated
accurately in the wizard documentation.

The wizard may summarize preflight outcomes that the execution path exposes, but it must not claim
a probability of success. A successful simulation only proves that the call was executable against
the RPC's observed state at that moment; nonce, quote, liquidity, gas, protocol, or chain state may
change before mining, and cross-chain delivery cannot be guaranteed.

All existing safety properties remain mandatory:

- route refresh and policy validation before confirmation;
- exact `EXECUTE` confirmation before private-key input;
- masked private-key entry and signer-address matching;
- allowlisted assets, tools, entrypoints, selectors, recipients, and spenders;
- exact ERC-20 approvals and legacy USDT zero-reset behavior;
- sequential transaction submission and atomic journal transitions;
- receipt and destination-balance evidence for bridge completion;
- idempotent resume without blind source-transaction replay.

## Cancellation and errors

Invalid wallet, minimum USD, or blank paths produce a localized validation message and repeat only
that prompt. Provider, planning, policy, simulation, execution, or persistence failures retain
their existing fail-closed behavior and surface a concise error without exposing secrets.

`Ctrl+C` or the prompt library's cancellation signal exits without starting new work after the
cancel point. If a plan was already written, it remains available. If execution has already created
a journal entry or submitted a transaction, the journal and `.ready` sidecar remain authoritative
for `resume`; the wizard must not delete or overwrite recovery data.

If discovery is `PARTIAL`, the existing warning is displayed and the execute-now prompt still
defaults to `No`. The wizard does not treat missing-chain data as proof of zero balance. If the
chosen journal path already exists, execution follows the current journal safety rules instead of
silently replacing transaction history.

## Documentation

Update `README.md` and `tutorial.html` so the interactive wizard is the primary beginner workflow.
Keep the full argument-based commands documented for automation and recovery. Explain clearly that
the first wallet prompt expects a public address, while the masked private key appears only after a
reviewed plan, an affirmative execute-now choice, and the exact `EXECUTE` safety confirmation.

Document simulation as a required pre-broadcast check with limited temporal validity, not as a
guarantee or success percentage.

## Testing and verification

Add deterministic unit and CLI tests covering:

- no-subcommand invocation starts the wizard, while help and existing subcommands do not;
- English and Vietnamese prompt catalogs and language selection;
- registry-derived six-chain choices and destination-token filtering, including BSC showing only
  BNB and Base showing ETH and USDC;
- retry behavior for invalid wallet, negative/non-finite minimum USD, and blank paths;
- default values for minimum USD, plan path, and journal path;
- a saved plan with no `READY` routes never offers execution or requests a signer;
- the default execute-now answer preserves the plan and does not call execution;
- an affirmative answer delegates the saved plan and chosen journal path to the existing executor;
- cancellation exits without execution;
- a failed approval simulation results in zero approval broadcasts, and a failed route simulation
  results in zero broadcasts of that swap or bridge candidate;
- existing Commander command names, flags, and behavior remain compatible.

Run the complete project gate with `npm run check`. Perform a terminal-level smoke test of the
wizard using a public address and cancel before execution; no funded key or real transaction is
permitted in tests or smoke verification.

## Out of scope

- Persisting language, wallet, or path preferences.
- Replacing the explicit subcommands or changing their required options.
- Localizing every existing report and provider error.
- Adding a GUI, wallet connection, seed-phrase input, or private-key CLI flag.
- Inventing a transaction success probability.
- Changing supported chains, tokens, DEX tools, bridges, plan schemas, or journal schemas.
