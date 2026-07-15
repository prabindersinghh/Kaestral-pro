# Contributing to Kaestral

Thanks for your interest in improving Kaestral — the AI-operated video editor for Windows. Contributions
of all kinds are welcome: bug fixes, features, docs, tests, and translations.

Kaestral is licensed **GPLv3**. By contributing, you agree your contributions are licensed under the
same terms.

## Ways to contribute

- 🐛 **Report a bug** — open an [Issue](https://github.com/prabindersinghh/Kaestral-pro/issues) with steps
  to reproduce, what you expected, and what happened (screenshots/logs help).
- 💡 **Propose a feature** — start a thread in
  [Discussions](https://github.com/prabindersinghh/Kaestral-pro/discussions) so we can align before you
  build.
- 🔧 **Send a pull request** — see the workflow below.
- 🌍 **Translate** — add a localized README under `docs/readme/README.<lang>.md` (see the language row in
  the main [README](./README.md)).

## Prerequisites

- **Node.js** (18+) and npm
- **Rust** + the Tauri 2 toolchain (only needed to build/run the desktop app)
- **FFmpeg + ffprobe** on your PATH

## Set up

```bash
git clone https://github.com/prabindersinghh/Kaestral-pro
cd Kaestral-pro
npm install
```

Useful commands:

```bash
npm run tauri dev   # run the desktop app
npm run dev         # run just the frontend (Vite)
npm run mcp         # run the MCP server directly (dev)
npm test            # full test suite (Vitest) — includes real Remotion renders (~4 min)
npm run typecheck   # strict TypeScript (tsc --noEmit)
npm run build       # production frontend build
```

## Pull-request workflow

1. **Branch** off `main`: `git checkout -b fix/short-description`.
2. **Make focused changes.** Match the existing style — the frontend uses inline styles referencing the
   tokens in `src/ui/theme.ts` (no CSS framework); user-facing errors go through `src/ui/errors.ts`
   (never surface a raw stack trace).
3. **Add or update tests** for behavior you change. New MCP tool behavior, format changes, and render
   changes should be covered.
4. **Verify before pushing:**
   ```bash
   npm run typecheck   # must be clean (exit 0)
   npm test            # must pass
   ```
5. **Open the PR** against `main` with a clear description of *what* changed and *why*. Link any related
   issue.

## Conventions

- **Commits:** clear, present-tense summaries (e.g. `fix(mcp): …`, `feat(motion): …`, `docs: …`).
- **The MCP tool names + schemas are a contract** (`src/mcp/toolDefs.ts`). Changing a tool's name or
  required inputs is a deliberate, reviewed act — prefer additive, optional changes.
- **Anything the LLM emits is validated data, never executed code** — closed enums, clamped numbers,
  bounded arrays. Don't introduce `eval`/dynamic execution from model input. See
  [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
- **Local-first is an invariant** — don't add code that uploads user media/projects. On-device is the
  point.
- Keep the desktop UI and the MCP server driving the **same** engine — no UI-only editing paths.

## Where things live

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full map. Quick orientation:
`src/engine/` (edit core) · `src/mcp/` (server + tools) · `src/gen/sceneSpec.ts` +
`remotion/src/compositions/Generative.tsx` (motion) · `src/ui/` (desktop UI) · `landing/` (marketing
site) · `docs/` (docs).

## Code of conduct

Be respectful and constructive. We want Kaestral's community to be a welcoming place for creators and
developers of every level.

## License

By contributing you agree that your contributions are licensed under the **GPLv3**, consistent with the
project. See [LICENSE](./LICENSE) and [NOTICE.md](./NOTICE.md).
