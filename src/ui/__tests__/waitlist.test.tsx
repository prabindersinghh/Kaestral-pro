import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { store } from "../../state/store";
import { WaitlistModal } from "../WaitlistModal";

const html = (el: React.ReactElement) => { try { return renderToStaticMarkup(el); } catch { return ""; } };

describe("Pro / AI-features waitlist", () => {
  beforeEach(() => { store.openWaitlist(false); store.settings.waitlistJoined = false; });

  it("modal is closed by default (renders nothing)", () => {
    expect(html(<WaitlistModal />)).toBe("");
  });

  it("opens to an email-capture form", () => {
    store.openWaitlist(true);
    const out = html(<WaitlistModal />);
    expect(out).toMatch(/AI generation is coming/);
    expect(out).toMatch(/waitlist/i);
    expect(out).toMatch(/type="email"/);
  });

  it("joinWaitlist marks joined and falls back to mailto when no endpoint is set", async () => {
    const r = await store.joinWaitlist("test@example.com");
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("mailto"); // no VITE_WAITLIST_URL in tests
    expect(store.settings.waitlistJoined).toBe(true);
  });
});
