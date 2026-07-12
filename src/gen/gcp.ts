// GCP GPU VM lifecycle for the gcp-ltx provider — start / stop / status, driven from Kaestral's
// server via the `gcloud` CLI (installed during the GCP setup). This is the FAST-PATH control the
// user clicks; it is NOT the credit safety net — the on-VM idle watchdog is (it stops the box even
// if Kaestral/PC is gone). Start = boot the VM → wait for its external IP → poll the LTX /health until
// ready → hand back the baseUrl. Stop = a clean shutdown that halts GPU/vCPU billing within seconds.

import { spawn } from "node:child_process";

export interface GpuConfig {
  project: string;
  zone: string;      // e.g. us-central1-a
  instance: string;  // e.g. ltx-gpu
  port: number;      // LTX server port, e.g. 8000
  token?: string;    // shared secret; sent to the LTX server as a Bearer token
}

export type GpuStatus = "stopped" | "starting" | "ready" | "stopping" | "error";
export interface GpuState { status: GpuStatus; baseUrl?: string; detail?: string }

/** Injectable so the orchestration is testable without a real gcloud/GCP. */
export interface GcpRunner {
  run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }>;
  health(url: string): Promise<boolean>;
  sleep(ms: number): Promise<void>;
}

const realRunner: GcpRunner = {
  run: (args) => new Promise((resolve) => {
    const p = spawn("gcloud", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    p.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    p.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    p.on("error", (e) => resolve({ code: 127, stdout: "", stderr: String(e) }));
    p.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  }),
  health: async (url) => { try { const r = await fetch(url, { signal: AbortSignal.timeout(4000) }); return r.ok; } catch { return false; } },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

const gbase = (c: GpuConfig) => [`--project=${c.project}`, `--zone=${c.zone}`];

/** External IP of the instance, or "" if not assigned yet. */
async function externalIp(c: GpuConfig, r: GcpRunner): Promise<string> {
  const res = await r.run(["compute", "instances", "describe", c.instance, ...gbase(c), "--format=value(networkInterfaces[0].accessConfigs[0].natIP)"]);
  return res.code === 0 ? res.stdout.trim() : "";
}

/** RUNNING / TERMINATED / STAGING / STOPPING / ... or "" on error. */
export async function vmPowerState(c: GpuConfig, r: GcpRunner = realRunner): Promise<string> {
  const res = await r.run(["compute", "instances", "describe", c.instance, ...gbase(c), "--format=value(status)"]);
  return res.code === 0 ? res.stdout.trim() : "";
}

/** Start the VM and wait until its LTX server answers /health. Returns the ready baseUrl. */
export async function startVm(c: GpuConfig, r: GcpRunner = realRunner, onStep?: (s: string) => void): Promise<string> {
  onStep?.("starting the GPU VM…");
  const start = await r.run(["compute", "instances", "start", c.instance, ...gbase(c)]);
  if (start.code !== 0 && !/already|running/i.test(start.stderr)) {
    throw new Error(`gcloud start failed: ${start.stderr.slice(0, 200) || "is gcloud installed and logged in?"}`);
  }
  // wait for an external IP
  let ip = "";
  for (let i = 0; i < 30 && !ip; i++) { ip = await externalIp(c, r); if (!ip) await r.sleep(3000); }
  if (!ip) throw new Error("The VM started but has no external IP. Check it has an access config / ephemeral IP.");
  const baseUrl = `http://${ip}:${c.port}`;
  onStep?.(`VM up at ${ip} — waiting for the model to load…`);
  // poll /health (model load into VRAM is ~2–4 min cold)
  for (let i = 0; i < 90; i++) {
    if (await r.health(`${baseUrl}/health`)) { onStep?.("GPU ready."); return baseUrl; }
    await r.sleep(5000);
  }
  throw new Error("The GPU booted but the LTX server never became ready (7.5 min). SSH in and check `systemctl status kaestral-ltx`.");
}

/** Stop the VM — halts GPU/vCPU billing within seconds (boot disk with the model cache is kept). */
export async function stopVm(c: GpuConfig, r: GcpRunner = realRunner): Promise<void> {
  const res = await r.run(["compute", "instances", "stop", c.instance, ...gbase(c)]);
  if (res.code !== 0 && !/already|terminated|stopp/i.test(res.stderr)) {
    throw new Error(`gcloud stop failed: ${res.stderr.slice(0, 200)}`);
  }
}

/** Map GCP power state → our GpuState (baseUrl filled when RUNNING + reachable). */
export async function gpuState(c: GpuConfig, r: GcpRunner = realRunner): Promise<GpuState> {
  const power = await vmPowerState(c, r);
  if (power === "") return { status: "error", detail: "Can't reach gcloud/GCP. Is gcloud installed and logged in (gcloud auth login)?" };
  if (power !== "RUNNING") return { status: power === "STOPPING" ? "stopping" : power === "STAGING" || power === "PROVISIONING" ? "starting" : "stopped" };
  const ip = await externalIp(c, r);
  if (!ip) return { status: "starting" };
  const baseUrl = `http://${ip}:${c.port}`;
  return { status: (await r.health(`${baseUrl}/health`)) ? "ready" : "starting", baseUrl };
}
