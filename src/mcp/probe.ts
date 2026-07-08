// ffprobe metadata for imported media (node-only). Real duration/dimensions/fps/audio so imports
// place with correct lengths and the UI shows true info.

import { execFile } from "node:child_process";
import { ffprobeBin } from "./env";

export interface MediaProbe {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
}

export function probeMedia(path: string, ffprobePath = ffprobeBin()): Promise<MediaProbe | null> {
  return new Promise((resolve) => {
    execFile(
      ffprobePath,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
      { maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return resolve(null);
        try {
          const j = JSON.parse(stdout) as {
            format?: { duration?: string };
            streams?: { codec_type?: string; width?: number; height?: number; r_frame_rate?: string; duration?: string }[];
          };
          const v = j.streams?.find((s) => s.codec_type === "video");
          const a = j.streams?.find((s) => s.codec_type === "audio");
          let fps: number | undefined;
          if (v?.r_frame_rate) {
            const [n, d] = v.r_frame_rate.split("/").map(Number);
            if (n > 0 && d > 0) fps = n / d;
          }
          resolve({
            duration: Number(j.format?.duration ?? v?.duration ?? 0) || 0,
            width: v?.width,
            height: v?.height,
            fps,
            hasAudio: !!a,
          });
        } catch {
          resolve(null);
        }
      },
    );
  });
}
