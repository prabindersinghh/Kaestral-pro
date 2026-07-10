import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { store } from "../../state/store";
import { MediaPanel } from "../MediaPanel";
import { GenerationPanel } from "../GenerationPanel";

// Generation is a HIDDEN future paid-tier feature. The shipping UI must render NO generation surface.
// We render the real components to HTML and assert the Generate button/panel are absent by default,
// and only appear once the hidden dev flag is enabled.
function html(el: React.ReactElement): string {
  try { return renderToStaticMarkup(el); } catch { return ""; }
}

describe("generation UI is hidden by default (paid-tier feature)", () => {
  beforeEach(() => { store.enableGenDev(false); store.openGenerate(false); });

  it("defaults to OFF", () => {
    expect(store.settings.genDevMode).toBe(false);
  });

  it("the Media panel shows NO Generate button by default", () => {
    const out = html(<MediaPanel />);
    expect(out).not.toMatch(/Generate/);
    expect(out).toMatch(/Import/); // sanity: the panel did render (Import button present)
  });

  it("the Generation panel renders nothing by default", () => {
    store.openGenerate(true); // no-op while the flag is off
    expect(store.settings.showGenerate).toBe(false);
    expect(html(<GenerationPanel />)).toBe("");
  });

  it("openGenerate is a no-op unless the dev flag is on", () => {
    store.openGenerate(true);
    expect(store.settings.showGenerate).toBe(false);
  });

  it("enabling the hidden dev flag reveals the Generate button (for internal testing)", () => {
    store.enableGenDev(true);
    const out = html(<MediaPanel />);
    expect(out).toMatch(/Generate/); // now visible for the tester
    store.enableGenDev(false); // reset
  });
});
