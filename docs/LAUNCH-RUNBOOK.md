# Kaestral 1.0.0 — Launch Runbook

The exact, in-order commands to take Kaestral 1.0.0 live. Everything the automated build
produced is already committed; this runbook is the set of steps that require **your** accounts,
secrets, and GitHub/npm/Vercel access — which an automated agent cannot do for you.

Do the steps in order. Each block is copy-pasteable.

---

## 0. Prerequisites (once)

- GitHub repo **renamed** from `Maestro-pro` → `Kaestral-pro` (Settings → rename on github.com).
  Every link in the app, package, and landing already points at `prabindersinghh/Kaestral-pro`.
- npm account logged in: `npm whoami` (else `npm login`).
- Vercel CLI: `npm i -g vercel` then `vercel login`.
- `gh` CLI logged in (optional but easiest for releases): `gh auth status` (else `gh auth login`).
- FFmpeg + ffprobe on PATH (already confirmed on this machine).

---

## 1. One-time updater signing key (required before the FIRST signed release)

Full detail in `docs/UPDATER-SETUP.md`. Short version:

```bash
npm run tauri signer generate -- -w ~/.tauri/kaestral-updater.key
```

- Set + save the key password (password manager).
- Copy the printed **public key** → paste into `src-tauri/tauri.conf.json` at
  `plugins.updater.pubkey` (replace `PLACEHOLDER_PUBLIC_KEY_SEE_UPDATER_SETUP_MD`), then commit.
- Keep `~/.tauri/kaestral-updater.key` **secret** — never commit it.

Set these in the shell you build from (so artifacts get signed):

```powershell
# PowerShell
$env:TAURI_SIGNING_PRIVATE_KEY = "$HOME\.tauri\kaestral-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-key-password"
```

> You can ship the 1.0.0 installer WITHOUT signing (users install it manually), but the
> in-app auto-updater won't verify future updates until the pubkey is real. Recommended: do the
> key step now so 1.0.0 → 1.1.0 auto-update works for everyone who installs 1.0.0.

---

## 2. Build the 1.0.0 installer

```bash
npm run tauri build
```

Produces (NSIS):

- `src-tauri/target/release/bundle/nsis/Kaestral_1.0.0_x64-setup.exe`  ← the installer
- `src-tauri/target/release/bundle/nsis/Kaestral_1.0.0_x64-setup.exe.sig`  ← signature (only if signing env vars set)

Smoke-test it: run the installer on a clean Windows user, launch Kaestral, confirm onboarding
appears, the sample project plays, and Settings → About shows **Kaestral 1.0.0**.

---

## 3. Publish the MCP package to npm  (enables `npx kaestral`)

The root package IS the npm package (name `kaestral`, bin `kaestral` → stdio MCP server).

```bash
# from the project root
npm run bundle:server         # rebuilds dist-server/ (also runs automatically via prepublishOnly)
npm publish --access public
```

- If the name `kaestral` is taken, publish scoped instead: set `"name": "@prabindersinghh/kaestral"`
  in package.json, re-run `npm publish --access public`, and update the connect command everywhere
  to `npx @prabindersinghh/kaestral`.
- Verify it works from a clean machine:
  ```bash
  claude mcp add kaestral -- npx kaestral
  # then in Claude Code:  /mcp   → kaestral should list ~50 tools
  ```
  (This is the one-command stdio connect. HTTP alternative: `npx kaestral --http` then
  `claude mcp add --transport http kaestral http://127.0.0.1:19789/mcp`.)

---

## 4. Create the GitHub release (so the landing Download button works)

The landing "Download" button points at `…/Kaestral-pro/releases/latest` — it works as soon as a
release exists with the installer attached.

```bash
gh release create v1.0.0 \
  --repo prabindersinghh/Kaestral-pro \
  --title "Kaestral 1.0.0" \
  --notes "First public release — the AI-operated video editor for Windows." \
  "src-tauri/target/release/bundle/nsis/Kaestral_1.0.0_x64-setup.exe"
```

If you did the signing step, also publish the updater manifest so 1.0.0 users can later auto-update:

```bash
node scripts/make-latest-json.mjs 1.0.0 src-tauri/target/release/bundle/nsis/Kaestral_1.0.0_x64-setup.exe.sig
gh release upload v1.0.0 latest.json --repo prabindersinghh/Kaestral-pro
```

---

## 5. Deploy the landing page to Vercel + kaestral.com

```bash
cd landing
vercel --prod
```

- First run links/creates the Vercel project (accept the prompts; root = the `landing/` dir; it's
  a static site, no build command — `vercel.json` is already configured).
- Attach the domain in the Vercel dashboard: Project → Settings → Domains → add `kaestral.com`
  (and `www.kaestral.com`), then set the DNS records Vercel shows at your registrar.
- **Enable Analytics**: Vercel dashboard → the project → Analytics → Enable. This makes
  `/_vercel/insights/script.js` resolve (it 404s until enabled) and starts collecting the
  `download_click` and `pro_waitlist_submit` events already wired into the page.
- Verify live: open https://kaestral.com — Download button → the GitHub release; submit a test
  email in the Pro waitlist → it should land in your Formspree dashboard (endpoint
  `formspree.io/f/xrenbavp`).

---

## 6. (Optional, post-launch) Submit to the MCP registry

See `docs/MCP-REGISTRY.md` for the prepared submission (server name, description, npm package,
connect command, tool categories). Verify the `server.json` field names against the current
`modelcontextprotocol/registry` schema before submitting.

---

## Publishing a future update (v1.1.0, v1.2.0, …)

Full detail in `docs/UPDATER-SETUP.md` §2. Short version:

```bash
# 1. bump version in package.json + src-tauri/tauri.conf.json + src-tauri/Cargo.toml (keep in sync)
# 2. build (signing env vars set)
npm run tauri build
# 3. release + installer
gh release create v1.1.0 --repo prabindersinghh/Kaestral-pro --title "Kaestral 1.1.0" \
  --notes "…" "src-tauri/target/release/bundle/nsis/Kaestral_1.1.0_x64-setup.exe"
# 4. updater manifest
node scripts/make-latest-json.mjs 1.1.0 src-tauri/target/release/bundle/nsis/Kaestral_1.1.0_x64-setup.exe.sig
gh release upload v1.1.0 latest.json --repo prabindersinghh/Kaestral-pro
# 5. republish npm package if the MCP tools/server changed
npm publish --access public
# 6. redeploy landing only if it changed:  cd landing && vercel --prod
```

Existing 1.0.0 users' apps hit the `releases/latest/download/latest.json` endpoint, verify the
signature against the baked-in pubkey, download, install, and relaunch — no manual step for them.
