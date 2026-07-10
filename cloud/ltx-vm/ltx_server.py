# Maestro LTX-2 server — the thin HTTP wrapper that runs ON the GCP GPU VM.
# Maestro POSTs a prompt here; this runs LTX-2 and returns a video URL that Maestro downloads and
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
# Run under systemd (see maestro-ltx.service) so it auto-starts on every boot.

import os, threading, time, uuid, subprocess, traceback
from pathlib import Path
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

# --- config (env-overridable) ---
PORT = int(os.environ.get("LTX_PORT", "8000"))
TOKEN = os.environ.get("LTX_TOKEN", "")                       # shared secret; Maestro sends it as a Bearer token
ACTIVITY_FILE = os.environ.get("LTX_ACTIVITY_FILE", "/var/run/ltx_last_activity")
OUT_DIR = Path(os.environ.get("LTX_OUT_DIR", "/opt/ltx/out")); OUT_DIR.mkdir(parents=True, exist_ok=True)
GCS_BUCKET = os.environ.get("LTX_GCS_BUCKET", "")             # optional: gs://bucket — results survive VM stop
PUBLIC_BASE = os.environ.get("LTX_PUBLIC_BASE", "")           # e.g. http://EXTERNAL_IP:8000 (used when no bucket)
CHECKPOINT = os.environ.get("LTX_CHECKPOINT", "ltx-2.3-22b-distilled-1.1")
QUANT = os.environ.get("LTX_QUANT", "fp8-cast")               # passed to the pipeline in load_pipeline()

app = FastAPI(title="Maestro LTX-2 server")
_jobs: dict[str, dict] = {}
_pipeline = None
_ready = threading.Event()


def touch_activity():
    try:
        Path(ACTIVITY_FILE).write_text(str(int(time.time())))
    except Exception:
        pass


def load_pipeline():
    """Load LTX-2 into VRAM ONCE at startup. Fill in the real import for the checkpoint you downloaded.
    Kept isolated so the rest of the server is testable without the GPU."""
    global _pipeline
    # Example shape (adapt to the LTX-2 repo's pipeline API you cloned):
    #   from ltx_video.pipelines import LTXPipeline
    #   _pipeline = LTXPipeline.from_pretrained(CHECKPOINT, quantization=os.environ.get("LTX_QUANT", "fp8-cast"))
    #   _pipeline.to("cuda")
    _pipeline = ("LTX", CHECKPOINT)  # placeholder so /health can flip; replace with the real load
    _ready.set()
    print(f"[ltx] model loaded: {CHECKPOINT}", flush=True)


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


def _run_job(job_id: str, req: GenReq):
    try:
        out = OUT_DIR / f"{job_id}.mp4"
        # ---- REAL INFERENCE GOES HERE ----
        # video = _pipeline.generate(prompt=req.prompt, num_frames=int(req.seconds*24), steps=req.steps,
        #                            aspect_ratio=req.aspect_ratio, seed=req.seed)
        # video.save(out)
        # For image kind, save a single frame as .png instead.
        # Placeholder that FAILS loudly if the real inference isn't wired, so nothing silently "succeeds":
        if _pipeline == ("LTX", CHECKPOINT):
            raise RuntimeError("LTX inference not wired yet — edit _run_job() to call your LTX-2 pipeline.")
        url = _publish(out)
        _jobs[job_id] = {"status": "done", "url": url}
    except Exception as e:
        _jobs[job_id] = {"status": "error", "error": f"{e}\n{traceback.format_exc()[:500]}"}


def _publish(path: Path) -> str:
    """Return a URL Maestro can download. Prefer GCS (survives VM stop); else serve from this box."""
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


if __name__ == "__main__":
    touch_activity()
    threading.Thread(target=load_pipeline, daemon=True).start()  # load in the background; /health flips when ready
    uvicorn.run(app, host="0.0.0.0", port=PORT)
