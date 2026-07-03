import { useRef, useState } from "react";
import { store, useEditorVersion } from "../state/store";
import { theme, clipColor } from "./theme";
import type { ClipType } from "../model/enums";

function fmtDuration(seconds: number): string {
  if (!seconds) return "—";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const inTauri = (): boolean => "__TAURI_INTERNALS__" in globalThis;

export function MediaPanel() {
  useEditorVersion();
  const assets = store.media.assets;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const importPaths = async (paths: string[]) => {
    for (const p of paths) {
      setBusy(p.split(/[/\\]/).pop() ?? p);
      try { await store.bridge?.importPath(p); } catch (e) { setBusy(`Failed: ${e instanceof Error ? e.message : e}`); return; }
    }
    setBusy(null);
  };

  const importFiles = async (files: FileList | File[]) => {
    for (const f of files) {
      setBusy(f.name);
      try { await store.bridge?.importFile(f); } catch (e) { setBusy(`Failed: ${e instanceof Error ? e.message : e}`); return; }
    }
    setBusy(null);
  };

  const onImportClick = async () => {
    if (inTauri()) {
      try {
        const dialog = await import("@tauri-apps/plugin-dialog");
        const picked = await dialog.open({
          multiple: true,
          filters: [{ name: "Media", extensions: ["mp4", "mov", "m4v", "mp3", "wav", "aac", "m4a", "flac", "png", "jpg", "jpeg", "tiff", "webp"] }],
        });
        if (picked) await importPaths(Array.isArray(picked) ? picked : [picked]);
        return;
      } catch {
        /* fall through to the browser input */
      }
    }
    fileRef.current?.click();
  };

  return (
    <div style={{ width: 224, flex: "0 0 auto", background: theme.color.panel, borderRight: `1px solid ${theme.color.border}`, padding: theme.space.md, overflowY: "auto", fontFamily: theme.font.ui }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: theme.space.sm }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: theme.color.textFaint }}>Media</span>
        <button
          onClick={onImportClick}
          title="Import media files (or drag files anywhere into the window)"
          style={{ background: theme.color.surface, color: theme.color.text, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}
        >
          ＋ Import
        </button>
        <input
          ref={fileRef} type="file" multiple accept="video/*,audio/*,image/*" style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.length) void importFiles(e.target.files); e.target.value = ""; }}
        />
      </div>
      {busy && <div style={{ fontSize: 11, color: theme.color.textDim, marginBottom: theme.space.sm, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Importing {busy}…</div>}
      {!store.bridge?.connected && (
        <div style={{ fontSize: 10, color: "#e0a63b", marginBottom: theme.space.sm }}>
          Project server offline — import & Claude sync unavailable. Run: npm run mcp
        </div>
      )}
      {assets.length === 0 && <div style={{ color: theme.color.textFaint, fontSize: 12 }}>No media. Click ＋ Import or drop files here.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {assets.map((a) => (
          <div
            key={a.id}
            title={`Add ${a.name} at playhead`}
            onClick={() => store.addMediaToTimeline(a.id)}
            style={{
              display: "flex", alignItems: "center", gap: theme.space.sm, padding: "6px 8px", borderRadius: theme.radius.sm,
              background: theme.color.surface, border: `1px solid ${theme.color.border}`, cursor: "pointer",
            }}
          >
            <span style={{ width: 26, height: 26, borderRadius: theme.radius.sm, background: clipColor(a.type as ClipType), flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
              {a.type[0].toUpperCase()}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: theme.color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
              <div style={{ fontSize: 10, color: theme.color.textFaint, fontFamily: theme.font.mono }}>{a.type} · {fmtDuration(a.duration)}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: theme.space.md, fontSize: 10, color: theme.color.textFaint }}>Click an asset to add it at the playhead. Drop files anywhere to import.</div>
    </div>
  );
}
