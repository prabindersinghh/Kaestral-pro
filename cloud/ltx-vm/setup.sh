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

# --- MANUAL STEP: clone LTX-2 + download the distilled checkpoint onto the PERSISTENT disk ---
# so it's cached across stop/start. Then wire _run_job() in ltx_server.py to call the pipeline.
cat <<'NOTE'

  NEXT (manual, one time):
    git clone https://github.com/Lightricks/LTX-Video /opt/ltx/LTX-Video
    /opt/ltx/venv/bin/pip install -e /opt/ltx/LTX-Video
    # download ltx-2.3-22b-distilled-1.1 into /opt/ltx (see the repo README for the exact command)
    # then edit /opt/ltx/ltx_server.py:  load_pipeline()  and  _run_job()  to call the real pipeline.

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
