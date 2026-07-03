// Single source of design tokens — mirrors the macOS app's rule that all styling routes through
// one theme module (AppTheme). Timeline layout constants come from Utilities/Constants.swift
// (Layout / Defaults / Snap / Zoom); the accent mirrors AppTheme.Accent.primary (warm off-white).

import type { ClipType } from "../model/enums";

export const theme = {
  color: {
    bg: "#0b0b0d",
    surface: "#141417",
    panel: "#17171b",
    trackBg: "#1c1c22",
    trackBgAlt: "#171720",
    trackHeader: "#101014",
    ruler: "#0e0e11",
    rulerTick: "#4a4a52",
    border: "#2a2a30",
    borderStrong: "#3a3a42",
    text: "#e7e7ea",
    textDim: "#9a9aa2",
    textFaint: "#63636b",
    accent: "#f5efe4",
    playhead: "#ff5d5d",
    selection: "#ffffff",
    clip: {
      video: "#3b6fe0",
      image: "#8a5cf6",
      audio: "#18b26b",
      text: "#e0a63b",
      lottie: "#e05c9e",
    } satisfies Record<ClipType, string>,
  },
  timeline: {
    pixelsPerFrame: 4.0, // Defaults.pixelsPerFrame
    rulerHeight: 24, // Layout.rulerHeight
    trackHeight: 50, // Layout.trackHeight
    dropZoneHeight: 60, // Layout.dropZoneHeight
    headerWidth: 100, // Layout.trackHeaderWidth
    trimHandleWidth: 4, // Trim.handleWidth
    clipRadius: 3, // Trim.clipCornerRadius
    insertThreshold: 10, // Layout.insertThreshold
  },
  snap: {
    thresholdPixels: 8.0, // Snap.thresholdPixels
    stickyMultiplier: 1.5, // Snap.stickyMultiplier
    playheadMultiplier: 1.5, // Snap.playheadMultiplier
  },
  zoom: {
    min: 0.05, // Zoom.min
    max: 40.0, // Zoom.max
    floor: 0.0001, // Zoom.floor
    stepFactor: 1.25, // Zoom.toolbarStepFactor
  },
  space: { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { sm: 4, md: 6, lg: 10 },
  font: {
    ui: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, "Cascadia Code", "Geist Mono", monospace',
  },
} as const;

export function clipColor(type: ClipType): string {
  return theme.color.clip[type] ?? theme.color.clip.video;
}
