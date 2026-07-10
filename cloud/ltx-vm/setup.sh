#!/usr/bin/env bash
# One-time setup you run ON the GPU VM (after SSHing in). Installs the LTX server, the idle watchdog,
# and the systemd units. Downloading the LTX-2 checkpoint is left as a clearly-marked manual step
# because it's large and its exact command depends on the repo you cloned.
set -euo pipefail

echo "== Maestro LTX VM setup =="
sudo mkdir -p /opt/ltx/out
sudo cp ltx_server.py idle-stop.sh /opt/ltx/
sudo chmod +x /opt/ltx/idle-stop.sh

# Python env + server deps (the CUDA/torch stack comes from the Deep Learning VM image).
if [[ ! -d /opt/ltx/venv ]]; then sudo python3 -m venv /opt/ltx/venv; fi
sudo /opt/ltx/venv/bin/pip install -q --upgrade pip
sudo /opt/ltx/venv/bin/pip install -q fastapi "uvicorn[standard]" pydantic

# --- MANUAL STEP: clone LTX-2 (v2.3) + download the FP8 checkpoint onto the PERSISTENT disk ---
# The server (_run_job) already calls the real LTX-2 CLI — you just need the repo + weights present.
# NOTE: use github.com/Lightricks/LTX-2 (NOT the old LTX-Video 0.9.x, which can't load a 2.3 checkpoint).
cat <<'NOTE'

  NEXT (manual, one time) — repo + weights onto /opt/ltx (cached across stop/start):
    git clone https://github.com/Lightricks/LTX-2 /opt/ltx/LTX-2
    /opt/ltx/venv/bin/pip install -e /opt/ltx/LTX-2/packages/ltx-pipelines
    sudo apt-get install -y ffmpeg           # for the image (1 frame -> PNG) path
    hf auth login
    # 24GB L4 REQUIRES the fp8 checkpoint (bf16 22B OOMs):
    hf download Lightricks/LTX-2.3-fp8 ltx-2.3-22b-distilled-fp8.safetensors --local-dir /opt/ltx/models/ltx-2.3
    hf download Lightricks/LTX-2.3 ltx-2.3-spatial-upscaler-x2-1.1.safetensors --local-dir /opt/ltx/models/ltx-2.3
    hf download google/gemma-3-12b-it-qat-q4_0-unquantized --local-dir /opt/ltx/models/gemma-3-12b
    # (filenames carry version suffixes — re-list huggingface.co/Lightricks/LTX-2.3 if one 404s,
    #  then set LTX_CKPT_FILE / LTX_UPSCALER in the service file to match.)

  Set your shared secret (must match what you paste into Maestro):
    sudo sed -i 's/CHANGE_ME_SHARED_SECRET/<your-random-token>/' /etc/systemd/system/maestro-ltx.service

NOTE

# Install systemd units.
sudo cp systemd/maestro-ltx.service systemd/maestro-idle-stop.service systemd/maestro-idle-stop.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maestro-idle-stop.timer     # the credit guard — on immediately
sudo systemctl enable maestro-ltx                        # starts on next boot; start now once wired:
echo
echo "Idle watchdog is ACTIVE (stops this VM after 15 idle min)."
echo "After you wire the LTX pipeline: sudo systemctl start maestro-ltx  &&  curl localhost:8000/health"
echo "Then STOP the VM from your PC (Maestro) or:  sudo shutdown -h now  (or gcloud compute instances stop ...)"
