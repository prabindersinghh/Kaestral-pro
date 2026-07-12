#!/usr/bin/env bash
# Kaestral LTX idle watchdog — the PRIMARY credit guard. Runs ON the GPU VM every ~5 min (systemd
# timer). Stops the VM when BOTH are true: the GPU has been idle AND no /generate|/jobs request has
# arrived for IDLE_LIMIT_MIN minutes. Because it runs on the VM and calls `instances stop` itself, it
# protects your $300 even if Kaestral crashes, the laptop sleeps, or the network drops mid-batch.
#
# Requires: the VM created with --scopes=cloud-platform and its service account holding
# roles/compute.instanceAdmin.v1 (compute.instances.stop). Trust order of the layered guards:
#   this watchdog  >  --max-run-duration (GCP hard cap)  >  nightly stop schedule  >  budget alert.
set -euo pipefail

IDLE_LIMIT_MIN="${LTX_IDLE_LIMIT_MIN:-15}"          # stop after this many idle minutes
ACTIVITY_FILE="${LTX_ACTIVITY_FILE:-/var/run/ltx_last_activity}"
GPU_BUSY_UTIL="${LTX_GPU_BUSY_UTIL:-5}"             # >this% GPU util counts as "working"

now=$(date +%s)

# 1) GPU utilisation — if the card is working, we are NOT idle.
util=0
if command -v nvidia-smi >/dev/null 2>&1; then
  util=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d ' ' || echo 0)
  util=${util:-0}
fi

# 2) Minutes since the last request (the LTX server touches ACTIVITY_FILE on every call).
if [[ -f "$ACTIVITY_FILE" ]]; then
  last=$(cat "$ACTIVITY_FILE" 2>/dev/null || echo 0)
else
  last=0            # no activity file yet → treat as long-idle so a stuck boot still stops
fi
idle_min=$(( (now - last) / 60 ))

echo "[idle-stop] gpu_util=${util}% idle_min=${idle_min} limit=${IDLE_LIMIT_MIN}"

if (( util <= GPU_BUSY_UTIL )) && (( idle_min >= IDLE_LIMIT_MIN )); then
  echo "[idle-stop] IDLE for ${idle_min}m and GPU quiet — stopping this VM to save credits."
  ZONE=$(curl -s -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/zone" | awk -F/ '{print $NF}')
  NAME=$(curl -s -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/name")
  # `--quiet` so it doesn't prompt; runs as the VM's own service account.
  gcloud compute instances stop "$NAME" --zone="$ZONE" --quiet
fi
