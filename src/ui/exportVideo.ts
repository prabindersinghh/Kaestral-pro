// UI → app video export. Serializes the live project and invokes the Tauri `export_video` command
// (which runs the Node render CLI → FFmpeg). In the plain browser preview (no Tauri), it throws a
// clear message pointing at the MCP export path instead.

import { invoke } from "@tauri-apps/api/core";
import { store } from "../state/store";
import { encodeTimeline } from "../model/codec";
import { encodeManifest } from "../model/media";

export interface ExportResult {
  outputPath: string;
  frames: number;
  width: number;
  height: number;
  codec: string;
}

export async function exportVideoFromUI(codec = "H.264", resolution = "1080p", fileName = "kaestral-export.mp4"): Promise<ExportResult> {
  const projectJson = JSON.stringify({
    timeline: encodeTimeline(store.timeline),
    media: encodeManifest(store.media.toManifest()),
  });
  try {
    const raw = await invoke<string>("export_video", { projectJson, outPath: fileName, codec, resolution });
    return JSON.parse(raw) as ExportResult;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/tauri|invoke|not.*function|undefined/i.test(msg)) {
      throw new Error("Video export runs in the Kaestral desktop app. In the browser preview, export via the MCP export_project tool.");
    }
    throw new Error(`Export failed: ${msg}`);
  }
}
