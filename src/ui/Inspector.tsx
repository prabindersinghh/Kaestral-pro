// Inspector — ported to Palmier's InspectorView structure: uppercase section headers (LEVELS,
// PLAYBACK, TRANSFORM, COLOR) with `[icon] Label ........ value` rows and a right-aligned trailing
// control. Volume is shown in dB (VolumeScale), fades in seconds, speed in ×.

import { useState } from "react";
import { store, useEditorVersion } from "../state/store";
import { theme, clipColor, sectionLabelStyle } from "./theme";
import { BLEND_MODES, type AnimatableProperty } from "../model/enums";
import { endFrame } from "../model/helpers";
import type { Clip } from "../model/types";

const round = (n: number, p = 100) => Math.round(n * p) / p;

// VolumeScale (InspectorView.swift): linear amplitude ↔ dB, floor = mute.
const FLOOR_DB = -60;
const dbFromLinear = (v: number) => (v <= 0.001 ? -Infinity : 20 * Math.log10(v));
const linearFromDb = (db: number) => (db <= FLOOR_DB ? 0 : Math.pow(10, db / 20));
const fmtDb = (v: number) => { const d = dbFromLinear(v); return d === -Infinity ? "−∞ dB" : `${d >= 0 ? "+" : ""}${d.toFixed(1)} dB`; };

function colorParam(clip: Clip, type: string, param: string, def: number): number {
  return clip.effects?.find((e) => e.type === type)?.params[param]?.value ?? def;
}

export function Inspector() {
  useEditorVersion();
  const clip = store.selectedClip;
  const fps = store.timeline.fps;

  return (
    <div style={{ width: 280, flex: "0 0 auto", background: theme.color.surface, borderLeft: `1px solid ${theme.color.borderPrimary}`, overflowY: "auto", fontFamily: theme.font.ui, display: "flex", flexDirection: "column" }}>
      <div style={{ height: theme.timeline.panelHeaderHeight, display: "flex", alignItems: "center", padding: `0 ${theme.space.lg}px`, borderBottom: `1px solid ${theme.color.borderPrimary}`, background: theme.color.raised, flex: "0 0 auto" }}>
        <span style={sectionLabelStyle}>Inspector</span>
      </div>

      {!clip ? (
        <div style={{ color: theme.color.textMuted, fontSize: theme.fontSize.smMd, padding: theme.space.lg }}>Select a clip to edit its properties.</div>
      ) : (
        <div style={{ padding: theme.space.lg, display: "flex", flexDirection: "column", gap: theme.space.lgXl }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: theme.space.smMd, marginBottom: theme.space.xs }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: clipColor(clip.mediaType) }} />
              <span style={{ fontSize: theme.fontSize.md, fontWeight: 600 }}>{clip.mediaType === "text" ? clip.textContent || "Text" : store.media.asset(clip.mediaRef)?.name ?? clip.mediaRef}</span>
            </div>
            <div style={{ fontSize: theme.fontSize.xs, color: theme.color.textMuted, fontFamily: theme.font.mono, paddingLeft: 18 }}>
              {clip.startFrame}–{endFrame(clip)}f · {round(clip.durationFrames / fps, 100)}s{clip.mediaType !== "text" ? ` · trim ${clip.trimStartFrame}/${clip.trimEndFrame}` : ""}
            </div>
          </div>

          {(clip.mediaType === "audio" || clip.mediaType === "video") && (
            <Section title="Levels">
              <SliderRow icon="♪" label="Volume" value={clip.volume} display={fmtDb(clip.volume)}
                min={FLOOR_DB} max={6} step={0.5} toSlider={dbFromLinear} fromSlider={linearFromDb}
                onInput={(v) => store.editSelected({ volume: v })} />
              <NumRow icon="◹" label="Fade In" value={round(clip.fadeInFrames / fps, 100)} suffix=" s" step={0.05} min={0}
                onCommit={(s) => store.editSelected({ fadeInFrames: s * fps })} />
              <NumRow icon="◺" label="Fade Out" value={round(clip.fadeOutFrames / fps, 100)} suffix=" s" step={0.05} min={0}
                onCommit={(s) => store.editSelected({ fadeOutFrames: s * fps })} />
            </Section>
          )}

          {clip.mediaType !== "text" && (
            <Section title="Playback">
              <NumRow icon="⏱" label="Speed" value={round(clip.speed, 100)} suffix="×" step={0.05} min={0.1}
                onCommit={(v) => store.editSelected({ speed: v })} />
            </Section>
          )}

          {clip.mediaType !== "audio" && (
            <Section title="Compositing">
              <SliderRow icon="◐" label="Opacity" value={clip.opacity} display={`${Math.round(clip.opacity * 100)}%`}
                min={0} max={1} step={0.01} onInput={(v) => store.editSelected({ opacity: v })} />
              {(clip.mediaType === "video" || clip.mediaType === "image") && (
                <Row icon="◑" label="Blend">
                  <select value={clip.blendMode ?? "normal"} onChange={(e) => store.editSelected({ blendMode: e.target.value as Clip["blendMode"] })} style={selectStyle}>
                    {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Row>
              )}
            </Section>
          )}

          {clip.mediaType !== "audio" && (
            <Section title="Transform">
              <NumRow icon="↔" label="Center X" value={round(clip.transform.centerX, 1000)} step={0.01} onCommit={(v) => store.editSelected({ transform: { centerX: v } })} />
              <NumRow icon="↕" label="Center Y" value={round(clip.transform.centerY, 1000)} step={0.01} onCommit={(v) => store.editSelected({ transform: { centerY: v } })} />
              <NumRow icon="⤢" label="Width" value={round(clip.transform.width, 1000)} step={0.01} onCommit={(v) => store.editSelected({ transform: { width: v } })} />
              <NumRow icon="⤡" label="Height" value={round(clip.transform.height, 1000)} step={0.01} onCommit={(v) => store.editSelected({ transform: { height: v } })} />
              <NumRow icon="⟳" label="Rotation" value={round(clip.transform.rotation, 10)} suffix="°" step={1} onCommit={(v) => store.editSelected({ transform: { rotation: v } })} />
            </Section>
          )}

          {(clip.mediaType === "video" || clip.mediaType === "image") && (
            <Section title="Color">
              <SliderRow icon="☀" label="Exposure" value={colorParam(clip, "color.exposure", "ev", 0)} display={round(colorParam(clip, "color.exposure", "ev", 0), 100).toString()} min={-3} max={3} step={0.05} onInput={(v) => store.applyColor({ exposure: v })} />
              <SliderRow icon="◗" label="Contrast" value={colorParam(clip, "color.contrast", "amount", 1)} display={round(colorParam(clip, "color.contrast", "amount", 1), 100).toString()} min={0.5} max={1.5} step={0.01} onInput={(v) => store.applyColor({ contrast: v })} />
              <SliderRow icon="✦" label="Saturation" value={colorParam(clip, "color.saturation", "amount", 1)} display={round(colorParam(clip, "color.saturation", "amount", 1), 100).toString()} min={0} max={2} step={0.01} onInput={(v) => store.applyColor({ saturation: v })} />
              <SliderRow icon="🌡" label="Temp" value={colorParam(clip, "color.temperature", "temperature", 6500)} display={`${Math.round(colorParam(clip, "color.temperature", "temperature", 6500))}K`} min={2000} max={11000} step={100} onInput={(v) => store.applyColor({ temperature: v })} />
            </Section>
          )}

          <Section title="Keyframes">
            {clip.mediaType === "audio"
              ? <KfRow clip={clip} property="volume" name="Volume" />
              : (["opacity", "position", "scale", "rotation", "crop"] as AnimatableProperty[]).map((p) => (
                  <KfRow key={p} clip={clip} property={p} name={p[0].toUpperCase() + p.slice(1)} />
                ))}
          </Section>
        </div>
      )}
    </div>
  );
}

// --- row primitives (InspectorRow.swift: [icon] Label .... trailing) ---

const selectStyle: React.CSSProperties = {
  background: theme.color.base, color: theme.color.textPrimary, border: `1px solid ${theme.color.borderPrimary}`,
  borderRadius: theme.radius.sm, padding: "3px 6px", fontSize: theme.fontSize.smMd, fontFamily: theme.font.ui, width: 120,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...sectionLabelStyle, marginBottom: theme.space.smMd }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: theme.space.smMd }}>{children}</div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: theme.space.smMd }}>
      <span style={{ width: 16, fontSize: theme.fontSize.sm, color: theme.color.textSecondary, textAlign: "center", flex: "0 0 auto" }}>{icon}</span>
      <span style={{ fontSize: theme.fontSize.smMd, fontWeight: 500, color: theme.color.textPrimary, flex: "0 0 auto" }}>{label}</span>
      <div style={{ flex: 1 }} />
      {children}
    </div>
  );
}

function NumRow({ icon, label, value, onCommit, step = 1, min, max, suffix = "" }: { icon: string; label: string; value: number; onCommit: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <Row icon={icon} label={label}>
      <input
        type="number" defaultValue={value} step={step} min={min} max={max} key={value}
        onBlur={(e) => onCommit(Number(e.target.value))}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        style={{ background: theme.color.base, color: theme.color.textPrimary, border: `1px solid ${theme.color.borderSubtle}`, borderRadius: theme.radius.sm, padding: "3px 6px", fontSize: theme.fontSize.smMd, width: 62, textAlign: "right", fontFamily: theme.font.mono }}
      />
      {suffix && <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textMuted, width: 16 }}>{suffix.trim()}</span>}
    </Row>
  );
}

function SliderRow({ icon, label, value, display, min, max, step, onInput, toSlider, fromSlider }: {
  icon: string; label: string; value: number; display: string; min: number; max: number; step: number;
  onInput: (v: number) => void; toSlider?: (v: number) => number; fromSlider?: (v: number) => number;
}) {
  const sv = toSlider ? toSlider(value) : value;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: theme.space.smMd }}>
        <span style={{ width: 16, fontSize: theme.fontSize.sm, color: theme.color.textSecondary, textAlign: "center", flex: "0 0 auto" }}>{icon}</span>
        <span style={{ fontSize: theme.fontSize.smMd, fontWeight: 500, color: theme.color.textPrimary }}>{label}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textTertiary, fontFamily: theme.font.mono }}>{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={Number.isFinite(sv) ? sv : min}
        onChange={(e) => onInput(fromSlider ? fromSlider(Number(e.target.value)) : Number(e.target.value))}
        style={{ width: "100%", accentColor: theme.color.accent, marginLeft: 24 }}
      />
    </div>
  );
}

function KfRow({ clip, property, name }: { clip: Clip; property: AnimatableProperty; name: string }) {
  const [hover, setHover] = useState(false);
  const key = ({ opacity: "opacityTrack", position: "positionTrack", scale: "scaleTrack", rotation: "rotationTrack", crop: "cropTrack", volume: "volumeTrack" } as const)[property];
  const track = clip[key] as { keyframes: unknown[] } | undefined;
  const count = track?.keyframes.length ?? 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: theme.space.smMd }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ width: 16, textAlign: "center", color: count > 0 ? theme.color.accent : theme.color.textMuted, fontSize: theme.fontSize.sm }}>◆</span>
      <span style={{ fontSize: theme.fontSize.smMd, fontWeight: 500 }}>{name}</span>
      <div style={{ flex: 1 }} />
      {count > 0 && hover && (
        <button title="Clear keyframes" onClick={() => store.clearKeyframes(property)} style={{ background: "transparent", color: theme.color.textMuted, border: "none", cursor: "pointer", fontSize: theme.fontSize.sm }}>✕</button>
      )}
      {count > 0 && <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textTertiary, fontFamily: theme.font.mono }}>{count}</span>}
      <button
        title={`Stamp ${name} keyframe at playhead`}
        onClick={() => store.stampKeyframe(property)}
        style={{ background: theme.color.raised, color: theme.color.textSecondary, border: `1px solid ${theme.color.borderSubtle}`, borderRadius: theme.radius.sm, cursor: "pointer", fontSize: theme.fontSize.sm, padding: "2px 8px" }}
      >
        +
      </button>
    </div>
  );
}
