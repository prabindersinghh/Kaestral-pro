// Keyframe animation lanes (Inspector/Keyframes/KeyframesLane.swift). When a clip is selected, one
// lane per animatable property shows diamonds at each keyframe's timeline position (clip-relative
// frame + clip.startFrame). Click an empty lane to add a keyframe (sampled value at that frame);
// drag a diamond to move its frame; click a diamond to delete it. Wired to set_keyframes.

import { useRef, useState } from "react";
import { store } from "../../state/store";
import { theme } from "../theme";
import type { AnimatableProperty } from "../../model/enums";
import type { Clip } from "../../model/types";

export const LANE_HEIGHT = 22;

const VISUAL_PROPS: AnimatableProperty[] = ["opacity", "position", "scale", "rotation", "crop"];
const AUDIO_PROPS: AnimatableProperty[] = ["volume"];
const LABEL: Record<AnimatableProperty, string> = {
  opacity: "Opacity", position: "Position", scale: "Scale", rotation: "Rotation", crop: "Crop", volume: "Volume",
};

export function laneProps(clip: Clip): AnimatableProperty[] {
  return clip.mediaType === "audio" ? AUDIO_PROPS : clip.mediaType === "text" ? ["opacity", "position", "scale", "rotation"] : VISUAL_PROPS;
}

/** Labels for the fixed header column (aligns 1:1 with the content lanes). */
export function KeyframeLaneLabels({ clip }: { clip: Clip }) {
  return (
    <div style={{ borderTop: `1px solid ${theme.color.borderPrimary}` }}>
      <div style={{ height: LANE_HEIGHT, display: "flex", alignItems: "center", padding: `0 ${theme.space.mdLg}px`, background: theme.color.raised }}>
        <span style={{ fontSize: theme.fontSize.xxs, textTransform: "uppercase", letterSpacing: 0.6, color: theme.color.textTertiary }}>Keyframes</span>
      </div>
      {laneProps(clip).map((p) => (
        <div key={p} style={{ height: LANE_HEIGHT, display: "flex", alignItems: "center", padding: `0 ${theme.space.mdLg}px`, borderTop: `1px solid ${theme.color.borderSubtle}`, background: theme.color.base }}>
          <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textSecondary }}>{LABEL[p]}</span>
        </div>
      ))}
    </div>
  );
}

/** The lanes themselves, drawn in the scrollable content aligned to the ppf x-axis. */
export function KeyframeLaneContent({ clip, ppf, width, top }: { clip: Clip; ppf: number; width: number; top: number }) {
  const props = laneProps(clip);
  return (
    <div style={{ position: "absolute", left: 0, top, width, borderTop: `1px solid ${theme.color.borderPrimary}` }}>
      <div style={{ height: LANE_HEIGHT, background: theme.color.raised, borderBottom: `1px solid ${theme.color.borderSubtle}` }} />
      {props.map((p) => (
        <Lane key={p} clip={clip} property={p} ppf={ppf} />
      ))}
    </div>
  );
}

function Lane({ clip, property, ppf }: { clip: Clip; property: AnimatableProperty; ppf: number }) {
  const kfs = store.keyframesOf(clip, property);
  const drag = useRef<{ from: number; moved: boolean } | null>(null);
  const [, force] = useState(0);

  const addAt = (clientX: number, e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const frame = Math.round((clientX - rect.left) / ppf);
    store.select(clip.id);
    store.stampKeyframe(property, frame);
  };

  return (
    <div
      onPointerDown={(e) => { if (e.target === e.currentTarget) addAt(e.clientX, e); }}
      style={{ position: "relative", height: LANE_HEIGHT, borderBottom: `1px solid ${theme.color.borderSubtle}`, background: theme.color.base, cursor: "copy" }}
    >
      {/* baseline + connecting line */}
      <div style={{ position: "absolute", left: clip.startFrame * ppf, right: 0, top: "50%", width: clip.durationFrames * ppf, height: 1, background: kfs.length > 1 ? "rgba(245,239,228,0.35)" : "transparent" }} />
      {kfs.map((k) => {
        const x = (clip.startFrame + k.frame) * ppf;
        return (
          <div
            key={k.frame}
            title={`${LABEL[property]} @ ${k.frame}f — drag to move, click to delete`}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = { from: k.frame, moved: false };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
              const toFrame = Math.round((e.clientX - rect.left) / ppf) - clip.startFrame;
              if (toFrame !== drag.current.from) {
                drag.current.moved = true;
                store.moveKeyframe(clip.id, property, drag.current.from, toFrame);
                drag.current.from = Math.max(0, Math.min(clip.durationFrames - 1, toFrame));
                force((n) => n + 1);
              }
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              const d = drag.current;
              drag.current = null;
              if (d && !d.moved) store.deleteKeyframe(clip.id, property, d.from);
            }}
            style={{
              position: "absolute", left: x - 5, top: LANE_HEIGHT / 2 - 5, width: 10, height: 10,
              background: theme.color.accent, border: "1px solid rgba(0,0,0,0.5)",
              transform: "rotate(45deg)", cursor: "ew-resize", zIndex: 2,
            }}
          />
        );
      })}
    </div>
  );
}
