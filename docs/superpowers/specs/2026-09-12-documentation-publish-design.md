# Documentation and GitHub Publishing Design

## Objective

Improve the public project documentation, add a Vietnamese offline usage tutorial, and publish the
result to GitHub without changing the CLI's runtime behavior.

## README

`README.md` will be written entirely in English for the public repository. It will cover:

- project purpose and non-custodial safety model;
- current feature set and explicit limitations;
- supported chains, source assets, destinations, bridges, and DEX routers;
- Node.js installation, build, environment configuration, and verification;
- the complete `plan → review → execute → resume` workflow with copyable commands;
- plan/journal files and stable skip states;
- architecture and security controls at a useful operator level;
- test and mainnet-smoke commands;
- a prominent relative link to `tutorial.html` for Vietnamese instructions.

The README must not imply that scam detection or protocol safety can be guaranteed. It must state
that Across is the only enabled bridge and Stargate remains disabled pending equivalent decoding.

## Vietnamese HTML tutorial

`tutorial.html` will be a single self-contained file that opens directly without a server. It will
use semantic HTML, inline CSS, and minimal inline JavaScript only for copy buttons and navigation.
It will not accept a private key, connect a wallet, call an API, or execute commands.

The tutorial will guide the operator through:

1. prerequisites and dedicated canary-wallet preparation;
2. installation and build;
3. optional Alchemy/custom RPC environment variables;
4. read-only planning;
5. reviewing discovery mode, assets, tools, fees, net output, and skip reasons;
6. interactive execution and exact approvals;
7. bridge monitoring and idempotent resume;
8. common errors and safe responses;
9. a final safety checklist.

The visual treatment will prioritize legibility and operational sequence: light neutral canvas,
deep navy text, restrained chain-blue accent, monospace command blocks, a sticky section index on
wide screens, responsive single-column layout on mobile, visible keyboard focus, and reduced-motion
support. Copy buttons will announce success without modifying command content.

## Verification

- Confirm every documented command matches Commander help and current filenames.
- Scan both artifacts for private-key examples, obsolete Stargate claims, placeholders, and broken
  relative links.
- Parse/check the HTML structure and run the full project verification gate.
- Open/render the tutorial locally for a visual review at desktop and mobile widths.

## Publishing

Commit the README and tutorial on `main`, then push to an explicitly selected GitHub repository.
The current checkout has no Git remote and the configured GitHub CLI credential is invalid, so no
repository creation or push will occur until the user authenticates and confirms the repository
destination/visibility. No force push is allowed.
