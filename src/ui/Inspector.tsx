import { store, useEditorVersion } from "../state/store";
import { theme, clipColor } from "./theme";
import { BLEND_MODES, type AnimatableProperty } from "../model/enums";
import { endFrame } from "../model/helpers";
import type { Clip } from "../model/types";

const label: React.CSSProperties = { fontSize: 11, color: theme.color.textDim, width: 62, flex: "0 0 auto" };
const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: theme.space.sm, marginBottom: theme.space.xs };
const inputStyle: React.CSSProperties = {
  background: theme.color.bg, color: theme.color.text, border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.sm, padding: "3px 6px", fontSize: 12, width: "100%", fontFamily: theme.font.mono,
};

function Num({ value, step = 1, min, max, onCommit }: { value: number; step?: number; min?: number; max?: number; onCommit: (v: number) => void }) {
  return (
    <input
      type="number" defaultValue={round(value)} step={step} min={min} max={max} style={inputStyle}
      key={round(value)}
      onBlur={(e) => onCommit(Number(e.target.value))}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}
function Range({ value, min, max, step, onInput }: { value: number; min: number; max: number; step: number; onInput: (v: number) => void }) {
  return <input type="range" value={value} min={min} max={max} step={step} style={{ width: "100%" }} onChange={(e) => onInput(Number(e.target.value))} />;
}
const round = (n: number) => Math.round(n * 1000) / 1000;

function colorParam(clip: Clip, type: string, param: string, def: number): number {
  return clip.effects?.find((e) => e.type === type)?.params[param]?.value ?? def;
}

function KfRow({ clip, property, name }: { clip: Clip; property: AnimatableProperty; name: string }) {
  const key = ({ opacity: "opacityTrack", position: "positionTrack", scale: "scaleTrack", rotation: "rotationTrack", crop: "cropTrack", volume: "volumeTrack" } as const)[property];
  const track = clip[key] as { keyframes: unknown[] } | undefined;
  const count = track?.keyframes.length ?? 0;
  return (
    <div style={{ ...rowStyle, marginBottom: 2 }}>
      <span style={label}>{name}</span>
      <button
        title={`Stamp ${name} keyframe at playhead`}
        onClick={() => store.stampKeyframe(property)}
        style={{ background: count > 0 ? theme.color.accent : theme.color.surface, color: count > 0 ? "#111" : theme.color.text, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, cursor: "pointer", fontSize: 11, padding: "2px 6px" }}
      >
        ◆ {count > 0 ? count : ""}
      </button>
      {count > 0 && (
        <button title="Clear" onClick={() => store.clearKeyframes(property)} style={{ background: theme.color.surface, color: theme.color.textDim, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>✕</button>
      )}
    </div>
  );
}

export function Inspector() {
  useEditorVersion();
  const clip = store.selectedClip;

  return (
    <div style={{ width: 264, flex: "0 0 auto", background: theme.color.panel, borderLeft: `1px solid ${theme.color.border}`, padding: theme.space.md, overflowY: "auto", fontFamily: theme.font.ui }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: theme.color.textFaint, marginBottom: theme.space.sm }}>Inspector</div>
      {!clip ? (
        <div style={{ color: theme.color.textFaint, fontSize: 12 }}>Select a clip to edit its properties.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: theme.space.sm, marginBottom: theme.space.md }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: clipColor(clip.mediaType) }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{clip.mediaType === "text" ? clip.textContent || "Text" : store.media.asset(clip.mediaRef)?.name ?? clip.mediaRef}</span>
          </div>
          <div style={{ fontSize: 11, color: theme.color.textDim, fontFamily: theme.font.mono, marginBottom: theme.space.md }}>
            {clip.startFrame}–{endFrame(clip)}f · {clip.durationFrames}f{clip.mediaType !== "text" ? ` · trim ${clip.trimStartFrame}/${clip.trimEndFrame}` : ""}
          </div>

          {clip.mediaType !== "text" && (
            <Section title="Timing">
              <Row name="Speed"><Num value={clip.speed} step={0.05} min={0.1} onCommit={(v) => store.editSelected({ speed: v })} /></Row>
            </Section>
          )}

          {(clip.mediaType === "audio" || clip.mediaType === "video") && (
            <Section title="Audio">
              <Row name="Volume"><Range value={clip.volume} min={0} max={1} step={0.01} onInput={(v) => store.editSelected({ volume: v })} /></Row>
            </Section>
          )}

          {clip.mediaType !== "audio" && (
            <Section title="Video">
              <Row name="Opacity"><Range value={clip.opacity} min={0} max={1} step={0.01} onInput={(v) => store.editSelected({ opacity: v })} /></Row>
              {(clip.mediaType === "video" || clip.mediaType === "image") && (
                <Row name="Blend">
                  <select value={clip.blendMode ?? "normal"} onChange={(e) => store.editSelected({ blendMode: e.target.value as Clip["blendMode"] })} style={inputStyle}>
                    {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Row>
              )}
            </Section>
          )}

          {clip.mediaType !== "audio" && (
            <Section title="Transform">
              <Row name="Center X"><Num value={clip.transform.centerX} step={0.01} onCommit={(v) => store.editSelected({ transform: { centerX: v } })} /></Row>
              <Row name="Center Y"><Num value={clip.transform.centerY} step={0.01} onCommit={(v) => store.editSelected({ transform: { centerY: v } })} /></Row>
              <Row name="Width"><Num value={clip.transform.width} step={0.01} onCommit={(v) => store.editSelected({ transform: { width: v } })} /></Row>
              <Row name="Height"><Num value={clip.transform.height} step={0.01} onCommit={(v) => store.editSelected({ transform: { height: v } })} /></Row>
              <Row name="Rotation"><Num value={clip.transform.rotation} step={1} onCommit={(v) => store.editSelected({ transform: { rotation: v } })} /></Row>
            </Section>
          )}

          {(clip.mediaType === "video" || clip.mediaType === "image") && (
            <Section title="Color">
              <Row name="Exposure"><Range value={colorParam(clip, "color.exposure", "ev", 0)} min={-3} max={3} step={0.05} onInput={(v) => store.applyColor({ exposure: v })} /></Row>
              <Row name="Contrast"><Range value={colorParam(clip, "color.contrast", "amount", 1)} min={0.5} max={1.5} step={0.01} onInput={(v) => store.applyColor({ contrast: v })} /></Row>
              <Row name="Saturation"><Range value={colorParam(clip, "color.saturation", "amount", 1)} min={0} max={2} step={0.01} onInput={(v) => store.applyColor({ saturation: v })} /></Row>
              <Row name="Temp"><Range value={colorParam(clip, "color.temperature", "temperature", 6500)} min={2000} max={11000} step={100} onInput={(v) => store.applyColor({ temperature: v })} /></Row>
            </Section>
          )}

          <Section title="Keyframes (◆ stamps at playhead)">
            {clip.mediaType === "audio"
              ? <KfRow clip={clip} property="volume" name="Volume" />
              : (["opacity", "position", "scale", "rotation", "crop"] as AnimatableProperty[]).map((p) => (
                  <KfRow key={p} clip={clip} property={p} name={p[0].toUpperCase() + p.slice(1)} />
                ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: theme.space.md }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: theme.color.textFaint, marginBottom: theme.space.xs, borderBottom: `1px solid ${theme.color.border}`, paddingBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return <div style={rowStyle}><span style={label}>{name}</span><div style={{ flex: 1 }}>{children}</div></div>;
}
