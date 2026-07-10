import { describe, it, expect } from "vitest";
import { startVm, stopVm, gpuState, type GpuConfig, type GcpRunner } from "../gcp";

const CFG: GpuConfig = { project: "p", zone: "us-central1-a", instance: "ltx-gpu", port: 8000, token: "t" };

// A fake gcloud + health probe so the start/stop orchestration is verified without a real GCP account.
function fakeRunner(over: Partial<{ power: string; ip: string; healthyAfter: number }> = {}): GcpRunner & { calls: string[][]; healthChecks: number } {
  let power = over.power ?? "TERMINATED";
  const ip = over.ip ?? "34.10.20.30";
  let healthChecks = 0;
  const healthyAfter = over.healthyAfter ?? 1;
  const calls: string[][] = [];
  return {
    calls, get healthChecks() { return healthChecks; },
    run: async (args) => {
      calls.push(args);
      if (args.includes("start")) { power = "RUNNING"; return { code: 0, stdout: "", stderr: "" }; }
      if (args.includes("stop")) { power = "TERMINATED"; return { code: 0, stdout: "", stderr: "" }; }
      if (args.includes("describe")) {
        if (args.some((a) => a.includes("status"))) return { code: 0, stdout: power, stderr: "" };
        if (args.some((a) => a.includes("natIP"))) return { code: 0, stdout: power === "RUNNING" ? ip : "", stderr: "" };
      }
      return { code: 1, stdout: "", stderr: "unknown" };
    },
    health: async () => { healthChecks++; return healthChecks >= healthyAfter; },
    sleep: async () => undefined, // no real waiting in tests
  };
}

describe("GCP GPU lifecycle", () => {
  it("startVm boots, waits for the IP, polls health, and returns the ready baseUrl", async () => {
    const r = fakeRunner({ healthyAfter: 2 });
    const steps: string[] = [];
    const url = await startVm(CFG, r, (s) => steps.push(s));
    expect(url).toBe("http://34.10.20.30:8000");
    expect(r.calls.some((c) => c.includes("start"))).toBe(true);
    expect(r.healthChecks).toBeGreaterThanOrEqual(2); // polled until healthy
    expect(steps.some((s) => /ready/i.test(s))).toBe(true);
  });

  it("stopVm stops the instance", async () => {
    const r = fakeRunner({ power: "RUNNING" });
    await stopVm(CFG, r);
    expect(r.calls.some((c) => c.includes("stop"))).toBe(true);
  });

  it("gpuState reports stopped / starting / ready", async () => {
    expect((await gpuState(CFG, fakeRunner({ power: "TERMINATED" }))).status).toBe("stopped");
    expect((await gpuState(CFG, fakeRunner({ power: "STAGING" }))).status).toBe("starting");
    const ready = await gpuState(CFG, fakeRunner({ power: "RUNNING", healthyAfter: 1 }));
    expect(ready.status).toBe("ready");
    expect(ready.baseUrl).toBe("http://34.10.20.30:8000");
  });

  it("gpuState surfaces a clear error when gcloud is unreachable", async () => {
    const broken: GcpRunner = { run: async () => ({ code: 127, stdout: "", stderr: "not found" }), health: async () => false, sleep: async () => undefined };
    const s = await gpuState(CFG, broken);
    expect(s.status).toBe("error");
    expect(s.detail).toMatch(/gcloud/i);
  });

  it("startVm gives an actionable error if gcloud isn't installed/logged in", async () => {
    const broken: GcpRunner = { run: async () => ({ code: 127, stdout: "", stderr: "'gcloud' is not recognized" }), health: async () => false, sleep: async () => undefined };
    await expect(startVm(CFG, broken)).rejects.toThrow(/gcloud/i);
  });
});
