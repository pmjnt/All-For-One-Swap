# Documentation and GitHub Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a complete English project README and a self-contained Vietnamese usage tutorial that accurately describe the existing CLI and its safety boundaries.

**Architecture:** `README.md` is the concise public entry point and source of project-level facts; `tutorial.html` is an offline, sequential operator guide with inline presentation and small progressive-enhancement scripts. Both documents derive commands and support claims from the current CLI and registries, and neither changes or invokes runtime behavior.

**Tech Stack:** Markdown, semantic HTML5, inline CSS, minimal vanilla JavaScript, Node.js 22+, existing npm verification scripts.

---

**Design reference:** `docs/superpowers/specs/2026-09-12-documentation-publish-design.md`

## File map

| Path | Responsibility |
|---|---|
| `README.md` | English public overview, installation, supported scope, complete command workflow, safety model, architecture, verification, and Vietnamese tutorial link |
| `tutorial.html` | Offline Vietnamese step-by-step operator tutorial, command copy controls, responsive navigation, and final safety checklist |

### Task 1: Expand the English README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Capture the current CLI contract**

Run:

```bash
npm run build
node dist/cli.js --help
node dist/cli.js plan --help
node dist/cli.js execute --help
node dist/cli.js resume --help
```

Expected: help exposes only `plan`, `execute`, and `resume`; the option names match `src/cli.ts`, including `--min-net-usd`, `--out`, `--json`, `--journal`, and `--timeout-seconds`.

- [ ] **Step 2: Replace the README with the complete English operator overview**

Write these sections in this order:

```markdown
# All For One Swap

> Mainnet software warning describing loss risk and recommending a dedicated low-value wallet.

[Vietnamese usage tutorial](tutorial.html)

## What it does
## Safety model
## Supported scope
## Requirements
## Installation
## Configuration
## Usage
### 1. Build
### 2. Create a read-only plan
### 3. Review the plan
### 4. Execute interactively
### 5. Resume safely
## Plan and journal files
## Architecture
## Verification
## Limitations
## Further reading
```

Use the exact working commands:

```bash
npm install
npm run check
npm run build
node dist/cli.js plan --wallet 0xYourAddress --target-chain base --target-token USDC --min-net-usd 0.25 --out plan.json
node dist/cli.js execute --plan plan.json --journal journal.json
node dist/cli.js resume --plan plan.json --journal journal.json --timeout-seconds 600
npm run smoke:mainnet
```

Document all `.env.example` variables, explicitly say that `.env` is not auto-loaded, and show shell `export` examples with placeholder values only. State that planning uses Alchemy indexed discovery when `ALCHEMY_API_KEY` is present and allowlist-only RPC discovery otherwise; `LIFI_API_KEY` is optional; custom RPC variables override pinned public endpoints.

State the exact support boundaries: Ethereum, Optimism, BNB Smart Chain, Polygon PoS, Base, and Arbitrum One; native assets are valid destinations; native USDC is available on the five registered Circle chains; official USDT is an Ethereum-only destination; BSC supports BNB as its destination in this release. State that LI.FI is the aggregator, Across is the only enabled bridge, 1inch and Odos are the allowed DEX tools, and Stargate remains disabled.

Explain that unknown/discovered tokens, unsupported behaviors, unapproved tools, opaque calldata, insufficient gas, uneconomic routes, and expired or changed quotes are skipped or rejected. Do not claim global optimality, scam-proofing, guaranteed bridge delivery, or guaranteed protocol safety.

- [ ] **Step 3: Scan README claims and links**

Run:

```bash
rg -n "tutorial\.html|ALCHEMY_API_KEY|LIFI_API_KEY|Across|1inch|Odos|Stargate|plan → review → execute → resume" README.md
rg -n "private[_ -]?key=.*0x|guarantee.*safe|scam[- ]proof|[T]BD|[T]ODO|[F]IXME" README.md
test -f tutorial.html
test -f docs/operations.md
test -f docs/registry-sources.md
```

Expected: the first scan finds every required subject; the unsafe/placeholder scan produces no output; relative-link targets exist after Task 2.

- [ ] **Step 4: Commit the README**

```bash
git add README.md
git commit -m "docs: expand English project guide"
```

### Task 2: Create the Vietnamese offline tutorial

**Files:**
- Create: `tutorial.html`

- [ ] **Step 1: Write the semantic document structure**

Create a valid standalone document beginning with `<!doctype html>` and `lang="vi"`. Use this landmark and section structure:

```html
<a class="skip-link" href="#noi-dung">Bỏ qua đến nội dung chính</a>
<header>…cảnh báo mainnet và liên kết README…</header>
<div class="layout">
  <nav aria-label="Mục lục hướng dẫn">…liên kết 01–09…</nav>
  <main id="noi-dung">
    <section id="chuan-bi">…</section>
    <section id="cai-dat">…</section>
    <section id="cau-hinh">…</section>
    <section id="lap-ke-hoach">…</section>
    <section id="kiem-tra">…</section>
    <section id="thuc-thi">…</section>
    <section id="tiep-tuc">…</section>
    <section id="xu-ly-loi">…</section>
    <section id="checklist">…</section>
  </main>
</div>
<footer>…liên kết README và operations runbook…</footer>
```

Write Vietnamese instructions for a dedicated canary wallet, Node.js 22+, installation, optional API/RPC configuration, `plan`, review, `execute`, and `resume`. Reuse exactly the commands listed in Task 1. Clearly explain that the page is documentation only: it does not accept a key, connect a wallet, call an API, or execute a transaction.

For plan review, explain `FULL`, `PARTIAL`, and `ALLOWLIST_ONLY` discovery implications; source/destination assets; tool IDs; estimated gas and net USD output; minimum receive; warnings and skip reasons. For execution, state that the user types `EXECUTE` before the masked key prompt, the signer address must match the planned wallet, approvals are exact, routes run sequentially, and files must be preserved. For resume, explain that `BRIDGE_PENDING` does not resubmit the source transaction.

- [ ] **Step 2: Add the responsive visual system inline**

In one `<style>` block, define CSS custom properties for an off-white canvas, white surfaces, deep navy text, muted slate text, chain-blue accent, green success, amber warning, and red danger. Use a native sans-serif stack and a native monospace stack; do not load external fonts, images, scripts, or stylesheets.

Implement a two-column desktop layout with a sticky section index, single-column layout below `840px`, legible command blocks, high-contrast warnings, visible `:focus-visible`, touch targets of at least 44px, and horizontal command scrolling. Add `@media (prefers-reduced-motion: reduce)` to disable smooth scrolling and transitions.

- [ ] **Step 3: Add copy-button progressive enhancement**

Place `data-copy` buttons next to command blocks. Add one inline script that reads only the paired `<code>` text, calls `navigator.clipboard.writeText`, changes the button label to `Đã sao chép`, announces the result through one `aria-live="polite"` region, and restores the original label after 1.5 seconds. On clipboard failure, announce that the command should be selected manually. The script must not read form inputs, access storage, request network resources, or handle secrets.

- [ ] **Step 4: Validate content and offline behavior**

Run:

```bash
rg -n "<!doctype html>|lang=\"vi\"|id=\"chuan-bi\"|id=\"cai-dat\"|id=\"cau-hinh\"|id=\"lap-ke-hoach\"|id=\"kiem-tra\"|id=\"thuc-thi\"|id=\"tiep-tuc\"|id=\"xu-ly-loi\"|id=\"checklist\"|aria-live|prefers-reduced-motion" tutorial.html
rg -n "https?://[^\"' <]+\.(js|css)|<script[^>]+src=|<link[^>]+stylesheet|private[_ -]?key.*value=|[T]BD|[T]ODO|[F]IXME" tutorial.html
```

Expected: the structure scan finds every required feature; the external-resource/secret/placeholder scan produces no output.

- [ ] **Step 5: Visually review desktop and mobile**

Serve the repository locally with:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/tutorial.html` at approximately 1440×1000 and 390×844. Expected: no horizontal page overflow, sticky navigation works on desktop, content becomes one column on mobile, keyboard focus is visible, every anchor reaches its section, and copy buttons provide visible/announced feedback.

- [ ] **Step 6: Commit the tutorial**

```bash
git add tutorial.html
git commit -m "docs: add Vietnamese usage tutorial"
```

### Task 3: Run the release documentation gate

**Files:**
- Verify: `README.md`
- Verify: `tutorial.html`

- [ ] **Step 1: Compare documented commands to CLI help**

Run:

```bash
node dist/cli.js plan --help
node dist/cli.js execute --help
node dist/cli.js resume --help
rg -n "node dist/cli\.js (plan|execute|resume)" README.md tutorial.html
```

Expected: every documented flag exists in the corresponding help output and no obsolete command appears.

- [ ] **Step 2: Run the complete project verification**

Run:

```bash
npm run check
git diff --check HEAD~2..HEAD
git status --short
```

Expected: typecheck, all tests, and build pass; the diff has no whitespace errors; the working tree is clean.

### Task 4: Publish to the selected GitHub repository

**Files:**
- Modify: local Git remote configuration only

- [ ] **Step 1: Confirm authentication and destination**

Run:

```bash
gh auth status
git remote -v
```

Expected: GitHub CLI reports an authenticated account and the intended repository URL is known. If authentication is invalid or the destination/visibility has not been explicitly selected, stop and request those inputs; do not guess or create a repository.

- [ ] **Step 2: Configure or verify `origin`**

If the user selected an existing repository, add its exact URL as `origin`. If the user explicitly requested creation, use the confirmed name and visibility with `gh repo create`, then verify `git remote -v`. Do not replace a pre-existing mismatched remote without explicit confirmation.

- [ ] **Step 3: Push main without rewriting history**

Run:

```bash
git push -u origin main
```

Expected: push succeeds and `main` tracks `origin/main`. Never use `--force` or `--force-with-lease`.
