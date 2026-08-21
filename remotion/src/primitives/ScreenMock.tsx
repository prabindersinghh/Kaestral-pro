import { Img, interpolate, spring } from "remotion";
import type { PrimitiveProps } from "./types";
import { TOKENS } from "./tokens";

// THE primitive for "show the product working" (binding critique #7): a browser/app window chrome
// — traffic-light dots, a URL bar (`props.url`), dark instrument-panel chrome matching HeroDemo's
// command-bar look (rgba(18,17,22,0.92) fill, white hairline border, deep drop shadow, mono type)
// — wrapping a content area. If `props.src` is given, the real screenshot renders inside via the
// same bare-absolute-path `<Img>` technique as Image.tsx. Spring entrance (scale+translateY
// overshoot, never a hard cut), matching the rest of the primitive layer's physics.
//
// `props.frame` selects the device chrome: "browser" (default — the window above), "phone" (a
// phone body with a dynamic-island pill, for app screenshots in 9:16 social films), or "plain"
// (just the bordered card, no bar). Unknown values fall back to "browser".

const CHROME_BG = "rgba(18,17,22,0.92)";
const BAR_BG = "rgba(255,255,255,0.05)";

export const ScreenMock: React.FC<PrimitiveProps> = ({ props, frame, fps, width, height, opacity, blur, position, enter }) => {
  const src = typeof props.src === "string" ? props.src : "";
  const url = typeof props.url === "string" ? props.url : "";
  const frameKind = props.frame === "phone" || props.frame === "plain" ? props.frame : "browser";
  // Phones are narrow objects; default to a slimmer box than the browser window.
  const boxW = typeof props.width === "number" ? props.width * width : width * (frameKind === "phone" ? 0.34 : 0.56);

  const delay = enter?.delay ?? 0;
  const local = frame - delay;
  const p = spring({ frame: local, fps, config: { damping: 15, mass: 0.8 } });
  // TASK 5 FIX (per-property `animate` "sole driver" contract) — pin ONLY the piece
  // `layer.animate.<prop>` actually owns, independent of the other (see Text.tsx's fuller comment).
  const animOpacity = enter?.neutralizeOpacity ? 1 : p;
  const translateY = enter?.neutralizePosition ? 0 : interpolate(p, [0, 1], [26, 0]);
  const scale = (enter?.neutralizePosition || enter?.neutralizeScale) ? 1 : interpolate(p, [0, 1], [0.94, 1]);

  const chromeH = Math.round(boxW * 0.072);
  // Placeholder content aspect (no src yet): a 16:10-ish window for browser/plain, a 19.5:9 phone.
  const contentAspect = frameKind === "phone" ? 19.5 / 9 : 9 / 16;

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        width: boxW,
        maxHeight: height * (frameKind === "phone" ? 0.86 : 0.78), // never overflow the frame
        opacity: opacity * animOpacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${scale})`,
        borderRadius: frameKind === "phone" ? boxW * 0.13 : 14,
        overflow: "hidden",
        border: frameKind === "phone" ? `${Math.max(3, boxW * 0.02)}px solid ${CHROME_BG}` : `1px solid ${TOKENS.white}`,
        outline: frameKind === "phone" ? `1px solid ${TOKENS.white}` : undefined,
        boxShadow: "0 40px 120px -20px rgba(0,0,0,0.8), 0 4px 18px rgba(0,0,0,0.45)",
        background: TOKENS.black,
      }}
    >
      {frameKind === "browser" && (
        /* chrome bar: traffic-light dots + URL pill */
        <div
          style={{
            height: chromeH,
            minHeight: 34,
            background: CHROME_BG,
            borderBottom: `1px solid ${TOKENS.white}`,
            display: "flex",
            alignItems: "center",
            gap: chromeH * 0.4,
            padding: `0 ${chromeH * 0.55}px`,
          }}
        >
          <div style={{ display: "flex", gap: chromeH * 0.22, flex: "none" }}>
            <div style={{ width: chromeH * 0.28, height: chromeH * 0.28, borderRadius: "50%", background: "#e5484d" }} />
            <div style={{ width: chromeH * 0.28, height: chromeH * 0.28, borderRadius: "50%", background: "#f0b429" }} />
            <div style={{ width: chromeH * 0.28, height: chromeH * 0.28, borderRadius: "50%", background: TOKENS.green }} />
          </div>
          {url && (
            <div
              style={{
                flex: 1,
                background: BAR_BG,
                borderRadius: chromeH * 0.35,
                height: chromeH * 0.56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: TOKENS.fontMono,
                fontSize: Math.max(11, chromeH * 0.34),
                color: TOKENS.ink2,
                letterSpacing: 0.3,
              }}
            >
              {url}
            </div>
          )}
        </div>
      )}

      {/* content area (phone: the dynamic-island pill floats OVER the screenshot, like a real device) */}
      <div style={{ position: "relative", width: "100%", aspectRatio: src ? undefined : `${1 / contentAspect}`, lineHeight: 0, background: TOKENS.slate2 }}>
        {src ? (
          <Img src={src} style={{ display: "block", width: "100%", height: "auto" }} />
        ) : (
          <div style={{ width: "100%", paddingTop: `${contentAspect * 100}%` }} />
        )}
        {frameKind === "phone" && (
          <div
            style={{
              position: "absolute",
              top: boxW * 0.035,
              left: "50%",
              transform: "translateX(-50%)",
              width: boxW * 0.3,
              height: boxW * 0.062,
              borderRadius: boxW * 0.031,
              background: CHROME_BG,
              border: `1px solid rgba(255,255,255,0.10)`,
            }}
          />
        )}
      </div>
    </div>
  );
};
