# Kaestral LTX-2 server — the thin HTTP wrapper that runs ON the GCP GPU VM.
# Kaestral POSTs a prompt here; this runs LTX-2 and returns a video URL that Kaestral downloads and
# drops on the timeline (same contract as Fal/Replicate). There is NO official LTX-2 API server, so
# this is our own small FastAPI wrapper. It is deliberately simple and defensive about credits:
# every request stamps an activity file so the on-VM idle watchdog never stops the box mid-batch.
#
# Endpoints:
#   GET  /health        -> 200 only AFTER the model is loaded (the client polls this)
#   POST /generate      -> {jobId}          (async; a clip can take minutes on an L4)
#   GET  /jobs/{jobId}   -> {status, url?}   (status: running | done | error)
#   GET  /media/{name}  -> serves the MP4 if you didn't configure a GCS bucket
#
# Run under systemd (see kaestral-ltx.service) so it auto-starts on every boot.

import os, sys, threading, time, uuid, subprocess, traceback
from pathlib import Path
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

# --- config (env-overridable) ---
PORT = int(os.environ.get("LTX_PORT", "8000"))
TOKEN = os.environ.get("LTX_TOKEN", "")                       # shared secret; Kaestral sends it as a Bearer token
ACTIVITY_FILE = os.environ.get("LTX_ACTIVITY_FILE", "/var/run/ltx_last_activity")
OUT_DIR = Path(os.environ.get("LTX_OUT_DIR", "/opt/ltx/out")); OUT_DIR.mkdir(parents=True, exist_ok=True)
GCS_BUCKET = os.environ.get("LTX_GCS_BUCKET", "")             # optional: gs://bucket — results survive VM stop
PUBLIC_BASE = os.environ.get("LTX_PUBLIC_BASE", "")           # e.g. http://EXTERNAL_IP:8000 (used when no bucket)
CHECKPOINT = os.environ.get("LTX_CHECKPOINT", "ltx-2.3-22b-distilled-fp8")
QUANT = os.environ.get("LTX_QUANT", "fp8-cast")              # L4 (Ada) fp8; a big GPU can use bf16

# LTX-2 (v2.3) inference is run as a CLI subprocess against the official repo — the robust default
# (the diffusers pipeline module paths move between releases). The 24GB L4 REQUIRES the fp8 checkpoint;
# the bf16 22B OOMs. See docs/GCP-LTX-GUIDE.md for the exact `hf download` commands.
LTX_REPO = os.environ.get("LTX_REPO", "/opt/ltx/LTX-2")
MODELS_DIR = os.environ.get("LTX_MODELS_DIR", "/opt/ltx/models")
CKPT_FILE = os.environ.get("LTX_CKPT_FILE", f"{MODELS_DIR}/ltx-2.3/ltx-2.3-22b-distilled-fp8.safetensors")
UPSCALER = os.environ.get("LTX_UPSCALER", f"{MODELS_DIR}/ltx-2.3/ltx-2.3-spatial-upscaler-x2-1.1.safetensors")
GEMMA_ROOT = os.environ.get("LTX_GEMMA_ROOT", f"{MODELS_DIR}/gemma-3-12b")
FPS = float(os.environ.get("LTX_FPS", "24"))
CPU_OFFLOAD = os.environ.get("LTX_OFFLOAD", "cpu")           # keep on 24GB L4; set "" on a big GPU

app = FastAPI(title="Kaestral LTX-2 server")
_jobs: dict[str, dict] = {}
_pipeline = None
_ready = threading.Event()


def touch_activity():
    try:
        Path(ACTIVITY_FILE).write_text(str(int(time.time())))
    except Exception:
        pass


def load_pipeline():
    """Validate the repo + weights so /health only reports ready when a real generation could
    succeed. CLI mode holds no persistent VRAM (each job is its own subprocess) — robust against a
    spot preemption and diffusers-version churn."""
    global _pipeline
    missing = [p for p in (LTX_REPO, CKPT_FILE, GEMMA_ROOT) if not Path(p).exists()]
    if missing:
        raise RuntimeError(
            "LTX-2 not fully installed — missing: " + ", ".join(missing) +
            ". Run the model download in docs/GCP-LTX-GUIDE.md (git clone Lightricks/LTX-2 + hf download the fp8 checkpoint, upscaler, and gemma-3-12b)."
        )
    _pipeline = ("LTX-2.3-CLI", CHECKPOINT)  # validated sentinel (NOT a placeholder)
    _ready.set()
    print(f"[ltx] ready (CLI mode): {CKPT_FILE}", flush=True)


class GenReq(BaseModel):
    kind: str = "video"
    prompt: str
    seconds: float = 5
    aspect_ratio: str = "16:9"
    seed: int | None = None
    steps: int = 8


def _auth(authorization: str | None):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="bad token")


def _dims(aspect: str) -> tuple[int, int]:
    """LTX-2 wants width/height divisible by 32."""
    if aspect == "9:16":
        return 704, 1280
    if aspect == "1:1":
        return 768, 768
    return 1280, 704  # 16:9 ≈ 720p


def _snap_frames(seconds: float, fps: float) -> int:
    """LTX-2 num_frames must be 8*k + 1."""
    n = max(1, round(seconds * fps))
    return round((n - 1) / 8) * 8 + 1


def _run_job(job_id: str, req: GenReq):
    """Run one real LTX-2 generation via the repo CLI. Image = a single frame → PNG."""
    try:
        is_image = req.kind == "image"
        w, h = _dims(req.aspect_ratio)
        num_frames = 1 if is_image else _snap_frames(req.seconds, FPS)
        mp4 = OUT_DIR / f"{job_id}.mp4"
        cmd = [
            sys.executable, "-m", "ltx_pipelines.distilled",
            "--distilled-checkpoint-path", CKPT_FILE,
            "--spatial-upsampler-path", UPSCALER,
            "--gemma-root", GEMMA_ROOT,
            "--prompt", req.prompt,
            "--height", str(h), "--width", str(w),
            "--num-frames", str(num_frames),
            "--seed", str(req.seed if req.seed is not None else 42),
            "--quantization", QUANT,
            "--output-path", str(mp4),
        ]
        if CPU_OFFLOAD:
            cmd += ["--offload", CPU_OFFLOAD]
        # Flag spellings are young/version-dependent — confirm once with:
        #   cd $LTX_REPO && python -m ltx_pipelines.distilled --help
        subprocess.run(cmd, check=True, cwd=LTX_REPO)

        if is_image:
            png = OUT_DIR / f"{job_id}.png"
            subprocess.run(["ffmpeg", "-y", "-i", str(mp4), "-frames:v", "1", str(png)], check=True)
            url = _publish(png)
        else:
            url = _publish(mp4)
        _jobs[job_id] = {"status": "done", "url": url}
    except Exception as e:
        _jobs[job_id] = {"status": "error", "error": f"{e}\n{traceback.format_exc()[:500]}"}


def _publish(path: Path) -> str:
    """Return a URL Kaestral can download. Prefer GCS (survives VM stop); else serve from this box."""
    if GCS_BUCKET:
        dest = f"{GCS_BUCKET}/{path.name}"
        subprocess.run(["gsutil", "-q", "cp", str(path), dest], check=True)
        subprocess.run(["gsutil", "-q", "acl", "ch", "-u", "AllUsers:R", dest], check=False)
        return f"https://storage.googleapis.com/{GCS_BUCKET.replace('gs://','')}/{path.name}"
    base = PUBLIC_BASE or f"http://localhost:{PORT}"
    return f"{base}/media/{path.name}"


@app.get("/health")
def health():
    if not _ready.is_set():
        raise HTTPException(status_code=503, detail="loading")
    return {"ok": True, "checkpoint": CHECKPOINT}


@app.post("/generate")
def generate(req: GenReq, authorization: str | None = Header(default=None)):
    _auth(authorization)
    touch_activity()                       # keep the idle watchdog at bay while a batch runs
    if not _ready.is_set():
        raise HTTPException(status_code=503, detail="model still loading")
    job_id = uuid.uuid4().hex[:12]
    _jobs[job_id] = {"status": "running"}
    threading.Thread(target=_run_job, args=(job_id, req), daemon=True).start()
    return {"jobId": job_id}


@app.get("/jobs/{job_id}")
def job(job_id: str, authorization: str | None = Header(default=None)):
    _auth(authorization)
    touch_activity()
    j = _jobs.get(job_id)
    if not j:
        raise HTTPException(status_code=404, detail="no such job")
    return j


@app.get("/media/{name}")
def media(name: str):
    p = OUT_DIR / name
    if not p.exists():
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(str(p))


def _boot():
    try:
        load_pipeline()
    except Exception as e:                      # keep /health at 503 and log why, don't crash the server
        print(f"[ltx] load failed: {e}", flush=True)


if __name__ == "__main__":
    touch_activity()
    threading.Thread(target=_boot, daemon=True).start()  # validate in the background; /health flips when ready
    uvicorn.run(app, host="0.0.0.0", port=PORT)
