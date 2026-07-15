// Help → "Connect your AI" — the three MCP clients that drive Kaestral's LOCAL server, each with a
// copy-able snippet, plus the in-app option and an honest ChatGPT note. Opened from the title-bar Help
// (?) — read-only reference. Matches ShortcutsModal's shell.

import { useState } from "react";
import { store, useEditorVersion } from "../state/store";
import { theme } from "./theme";

type Snippet = { title: string; sub: string; code: string; note?: string };

const CLIENTS: Snippet[] = [
  {
    title: "Claude Code",
    sub: "Free with your Claude plan · one command",
    code: "claude mcp add kaestral -- npx kaestral",
    note: "Then run `claude` and prompt it. Claude Code spawns Kaestral itself over stdio — no server to start.",
  },
  {
    title: "Cursor",
    sub: "Add to ~/.cursor/mcp.json (or project .cursor/mcp.json)",
    code: '{\n  "mcpServers": {\n    "kaestral": { "command": "npx", "args": ["kaestral"] }\n  }\n}',
    note: "Restart Cursor (or toggle it in Settings → MCP). Kaestral's ~50 tools appear in the tool list.",
  },
  {
    title: "Claude Desktop",
    sub: "Settings → Developer → Edit Config  ·  %APPDATA%\\Claude\\claude_desktop_config.json",
    code: '{\n  "mcpServers": {\n    "kaestral": { "command": "npx", "args": ["kaestral"] }\n  }\n}',
    note: "Save and fully restart Claude Desktop. One-click alternative: double-click the kaestral.mcpb from the Releases page.",
  },
];

function CopyRow({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: theme.space.sm, marginTop: theme.space.sm }}>
      <pre style={{ flex: 1, margin: 0, background: theme.color.base, border: `1px solid ${theme.color.borderSubtle}`, borderRadius: theme.radius.sm, padding: "8px 10px", fontFamily: theme.font.mono, fontSize: theme.fontSize.sm, color: theme.color.textPrimary, overflowX: "auto", whiteSpace: "pre" }}>{code}</pre>
      <button onClick={copy} style={{ flex: "0 0 auto", alignSelf: "flex-start", background: theme.color.accent, color: theme.color.onAccent, border: "none", borderRadius: theme.radius.sm, padding: "8px 12px", fontSize: theme.fontSize.sm, fontWeight: 600, cursor: "pointer" }}>{copied ? "✓" : "Copy"}</button>
    </div>
  );
}

export function ConnectHelp() {
  useEditorVersion();
  if (!store.settings.showConnectHelp) return null;

  return (
    <div
      onClick={() => store.openConnectHelp(false)}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 220, padding: theme.space.lg }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 620, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto", background: theme.color.surface, border: `1px solid ${theme.color.borderPrimary}`, borderRadius: theme.radius.mdLg, boxShadow: "0 24px 60px rgba(0,0,0,0.6)", fontFamily: theme.font.ui }}
      >
        <div style={{ position: "sticky", top: 0, height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${theme.space.lg}px`, borderBottom: `1px solid ${theme.color.borderPrimary}`, background: theme.color.raised }}>
          <span style={{ fontSize: theme.fontSize.mdLg, fontWeight: 600 }}>Connect your AI</span>
          <button onClick={() => store.openConnectHelp(false)} style={{ background: "transparent", border: "none", color: theme.color.textSecondary, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: theme.space.lg }}>
          <div style={{ fontSize: theme.fontSize.smMd, color: theme.color.textSecondary, lineHeight: 1.6, marginBottom: theme.space.lg }}>
            Kaestral runs as a <b>local</b> MCP server (<span style={{ fontFamily: theme.font.mono }}>npx kaestral</span>). Any MCP client that starts a local server can drive it — here are the three that work today.
            <span style={{ display: "block", marginTop: 6, color: theme.color.textTertiary, fontSize: theme.fontSize.xs }}>Requires Node.js/npm and FFmpeg + ffprobe on your PATH. (The Windows installer bundles all of this.)</span>
          </div>

          {CLIENTS.map((c) => (
            <div key={c.title} style={{ marginBottom: theme.space.lg, paddingBottom: theme.space.md, borderBottom: `1px solid ${theme.color.borderSubtle}` }}>
              <div style={{ fontSize: theme.fontSize.md, fontWeight: 650 }}>{c.title}</div>
              <div style={{ fontSize: theme.fontSize.xs, color: theme.color.textTertiary, fontFamily: theme.font.mono, marginTop: 2 }}>{c.sub}</div>
              <CopyRow code={c.code} />
              {c.note && <div style={{ fontSize: theme.fontSize.xs, color: theme.color.textMuted, marginTop: theme.space.sm, lineHeight: 1.55 }}>{c.note}</div>}
            </div>
          ))}

          <div style={{ marginBottom: theme.space.lg }}>
            <div style={{ fontSize: theme.fontSize.md, fontWeight: 650 }}>Or: in-app chat (no MCP client)</div>
            <div style={{ fontSize: theme.fontSize.smMd, color: theme.color.textSecondary, marginTop: 4, lineHeight: 1.55 }}>
              Prefer to stay in this window? Open <b>Settings → Connect AI</b>, paste your Anthropic API key, and chat right here.
            </div>
            <button onClick={() => { store.openConnectHelp(false); store.openSettings(true); }} style={{ marginTop: theme.space.sm, background: theme.color.prominent, color: theme.color.textPrimary, border: `1px solid ${theme.color.borderPrimary}`, borderRadius: theme.radius.sm, padding: "8px 14px", fontSize: theme.fontSize.smMd, fontWeight: 600, cursor: "pointer" }}>Open Connect AI settings →</button>
          </div>

          <div style={{ fontSize: theme.fontSize.xs, color: theme.color.textMuted, lineHeight: 1.6, borderLeft: `2px solid ${theme.color.warning}`, paddingLeft: theme.space.md }}>
            <b>ChatGPT?</b> ChatGPT's connectors require a hosted/remote MCP server, and Kaestral is local-first — your footage never leaves your machine — so use Claude Code, Cursor, or Claude Desktop. Cloud / ChatGPT support is on the roadmap.
          </div>
        </div>
      </div>
    </div>
  );
}
