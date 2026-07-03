// Enums ported from Models/ClipType.swift, Keyframe.swift, BlendMode.swift,
// TextStyle.swift, TextAnimation.swift, VideoLayout.swift. Raw string values are
// the serialized contract — do not rename.

export type ClipType = "video" | "audio" | "image" | "text" | "lottie";
export const CLIP_TYPES: readonly ClipType[] = ["video", "audio", "image", "text", "lottie"];

/** ClipType.isVisual (ClipType.swift:30) */
export function isVisual(t: ClipType): boolean {
  return t === "video" || t === "image" || t === "text" || t === "lottie";
}

/** ClipType.isCompatible(with:) (ClipType.swift:34) */
export function isCompatible(a: ClipType, b: ClipType): boolean {
  return a === b || (isVisual(a) && isVisual(b));
}

// ClipType(fileExtension:) (ClipType.swift:38). Lowercase, no leading dot.
const EXTENSION_TO_TYPE: Readonly<Record<string, ClipType>> = {
  mov: "video", mp4: "video", m4v: "video",
  mp3: "audio", wav: "audio", aac: "audio", m4a: "audio",
  aiff: "audio", aif: "audio", aifc: "audio", flac: "audio",
  png: "image", jpg: "image", jpeg: "image", tiff: "image", heic: "image", webp: "image",
  json: "lottie", lottie: "lottie",
};

export function clipTypeFromExtension(ext: string): ClipType | undefined {
  return EXTENSION_TO_TYPE[ext.toLowerCase().replace(/^\./, "")];
}

export type Interpolation = "linear" | "hold" | "smooth";
export const INTERPOLATIONS: readonly Interpolation[] = ["linear", "hold", "smooth"];

export type BlendMode =
  | "normal" | "darken" | "multiply" | "colorBurn" | "lighten" | "screen" | "colorDodge"
  | "overlay" | "softLight" | "hardLight" | "difference" | "exclusion"
  | "hue" | "saturation" | "color" | "luminosity";
export const BLEND_MODES: readonly BlendMode[] = [
  "normal", "darken", "multiply", "colorBurn", "lighten", "screen", "colorDodge",
  "overlay", "softLight", "hardLight", "difference", "exclusion",
  "hue", "saturation", "color", "luminosity",
];

export type TextAlignment = "left" | "center" | "right";
export const TEXT_ALIGNMENTS: readonly TextAlignment[] = ["left", "center", "right"];

export type TextAnimationPreset =
  | "none"
  | "fadeIn" | "popIn" | "slideUp" | "typewriter"
  | "wordReveal" | "wordSlide" | "wordPop" | "wordCycle" | "highlightPop" | "highlightBlock";
export const TEXT_ANIMATION_PRESETS: readonly TextAnimationPreset[] = [
  "none",
  "fadeIn", "popIn", "slideUp", "typewriter",
  "wordReveal", "wordSlide", "wordPop", "wordCycle", "highlightPop", "highlightBlock",
];

/** Animatable property names used by set_keyframes (Keyframe.swift:77). */
export type AnimatableProperty = "opacity" | "position" | "scale" | "rotation" | "crop" | "volume";

/** VideoLayout raw values (VideoLayout.swift:21) — for apply_layout (Stage C). */
export const VIDEO_LAYOUTS = [
  "full", "side_by_side", "top_bottom",
  "pip_bottom_right", "pip_bottom_left", "pip_top_right", "pip_top_left",
  "grid_2x2", "main_sidebar", "three_up",
] as const;
export type VideoLayout = (typeof VIDEO_LAYOUTS)[number];
export type LayoutFit = "fill" | "fit";
