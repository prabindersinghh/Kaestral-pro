import { useEffect, useReducer, useRef } from "react";
import { store, useEditorVersion } from "../state/store";
import { theme } from "../ui/theme";
import { drawFrame } from "./draw";
import { BrowserFrameSource } from "./browserFrameSource";

export function CanvasPreview() {
  useEditorVersion();
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  const ref = useRef<HTMLCanvasElement>(null);
  const fsRef = useRef<BrowserFrameSource | null>(null);
  if (!fsRef.current) {
    fsRef.current = new BrowserFrameSource(
      (mediaRef) => store.mediaSrcFor(mediaRef),
      store.timeline.fps,
      forceRender,
    );
  }

  const { timeline } = store;
  const W = timeline.width;
  const H = timeline.height;
  const frame = store.view.currentFrame;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;
    drawFrame(ctx, timeline, {
      width: W, height: H, frame,
      mediaName: (r) => store.media.asset(r)?.name ?? r,
      frameSource: fsRef.current ?? undefined,
    });
  });

  return (
    <canvas
      ref={ref}
      style={{
        aspectRatio: String(W / H),
        maxHeight: "100%",
        maxWidth: "100%",
        height: "min(60vh, 100%)",
        background: "#000",
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
      }}
    />
  );
}
