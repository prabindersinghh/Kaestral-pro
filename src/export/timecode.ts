// Source-timecode math for XMEML export. Ported verbatim from XMLExporter.swift:95-121.
// Pure + unit-tested against the Swift XMLExporterTimecodeTests vectors.

export interface SourceTimecode {
  frame: number;
  quanta: number;
  dropFrame: boolean;
}

export interface TimecodeTags {
  base: number;
  ntsc: boolean;
  frame: number;
  dropFrame: boolean;
  string: string;
}

/** Frame count → SMPTE string; drop-frame (29.97/59.94) uses ';' separators and skips dropped frames. */
export function formatTimecode(frame: number, fps: number, dropFrame: boolean): string {
  if (fps <= 0) return "00:00:00:00";
  let f = frame;
  if (dropFrame) {
    const drop = Math.round(fps * 0.066666); // 2 @ 30, 4 @ 60
    const d = Math.floor(f / (fps * 600));
    const m = f % (fps * 600);
    f += drop * 9 * d + (m > drop ? drop * Math.floor((m - drop) / (fps * 60)) : 0);
  }
  const sep = dropFrame ? ";" : ":";
  const ff = f % fps;
  const ss = Math.floor(f / fps) % 60;
  const mm = Math.floor(f / (fps * 60)) % 60;
  const hh = Math.floor(f / (fps * 3600));
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${p2(hh)}${sep}${p2(mm)}${sep}${p2(ss)}${sep}${p2(ff)}`;
}

/**
 * The <timecode> values to emit for a file. A tmcd timecode runs at its own rate, so when present
 * it — not the video rate — drives the rate/format. Absent → fall back to the video rate and a dummy 0.
 */
export function timecodeTags(source: SourceTimecode | null, videoTimebase: number, videoNtsc: boolean): TimecodeTags {
  const base = source?.quanta ?? videoTimebase;
  const dropFrame = source?.dropFrame ?? (videoNtsc && videoTimebase % 30 === 0);
  const ntsc = dropFrame ? true : videoNtsc;
  const frame = source?.frame ?? 0;
  return { base, ntsc, frame, dropFrame, string: formatTimecode(frame, base, dropFrame) };
}
