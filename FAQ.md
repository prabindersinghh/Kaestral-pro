# Kaestral — FAQ

### Is Kaestral free?
Yes. **Kaestral (Basic) is free and open source (GPLv3), forever.** The full AI-operated editor — all
50 MCP tools, word-level editing, bespoke motion graphics, multi-track timeline, color, and export — is
included at no cost. Download it, use it, build on it.

### What are Pro and Max?
- **Pro (coming — waitlist open):** generative power on top of the editor — AI video & image
  **generation** (prompt → a real clip on your timeline), **translation & dubbing** (Hindi + regional
  Indian languages, and beyond), temporally-consistent **AI upscaling**, and advanced generative motion
  (PixiJS particles & shaders).
- **Max (coming):** something bigger — details under wraps.

Pro and Max pricing is announced closer to launch. Join the waitlist from the app's **✨ Pro** button or
the [pricing page](https://kaestral.com/pricing.html). Basic stays free regardless.

### What platform does it run on?
**Windows 10 and Windows 11 (x64).** macOS is on the roadmap — Kaestral is Windows-first by design (the
AI-native editor category has been macOS-only; Kaestral brings it to the ~70% of creators on Windows).

### How is it different from the upstream editor (Palmier Pro)?
Kaestral is a GPLv3 Windows port of the upstream macOS editor, with real additions:
- It runs on **Windows** (the upstream is macOS-only).
- It has **perception the upstream doesn't**: on-device frame **vision** (the AI actually sees your
  footage), transcription, beat/silence detection, and palette extraction.
- It has a deep **bespoke motion-graphics** surface (`compose_motion` + a master motion-designer skill)
  so a connected LLM art-directs original films, not templates.
- It's driven by the **Claude Code you already have**, over MCP, with a one-command connect.

(Attribution to the upstream is retained as required by the GPLv3 — see the README's *License & credit*
and [NOTICE.md](./NOTICE.md).)

### Does my data stay on my device?
**Yes — Kaestral is local-first. Your video and project files never leave your machine.** Transcription
(whisper), frame vision, beat detection, palette extraction, and rendering all run **locally**. No
account is required. The only data that ever leaves your device:
- your **AI prompts** — sent to Anthropic **only if** you use the in-app chat with your own API key
  (using Claude Code instead keeps that between you and Claude);
- your **email** — **only if** you choose to join the Pro/Max waitlist.

### How do I connect Claude?
One command — Claude Code spawns Kaestral itself over stdio (no separate server, no port):
```bash
claude mcp add kaestral -- npx kaestral
claude
```
Then just ask, e.g. *"cut the silent parts of demo.mp4, add captions, and export it."* Prefer to run the
engine yourself? Use `npx kaestral --http` + `claude mcp add --transport http kaestral http://127.0.0.1:19789/mcp`.
No Claude subscription? Use **in-app chat** instead: open the app → **Connect AI** → paste your Anthropic
API key.

**Prerequisites for `npx kaestral`:** Node/npm and **FFmpeg + ffprobe** on your PATH; the whisper model
(~142 MB) downloads on first use. The Windows installer bundles all of this, so the desktop app needs
none of it.

### Do I need an API key or a paid plan to use it?
No, not for Basic editing itself. You connect an AI to *drive* it — either **Claude Code** (free with a
Claude plan) or **in-app chat** (your own Anthropic API key, small per-use cost). The editor and all its
tools are free.

### Where do I get help or report a bug?
[GitHub Discussions](https://github.com/prabindersinghh/Kaestral-pro/discussions) for questions and
ideas, [Issues](https://github.com/prabindersinghh/Kaestral-pro/issues) for bugs, and Discord (invite
coming). See the README's *Community & support* section.
