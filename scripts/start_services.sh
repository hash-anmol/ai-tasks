#!/bin/bash
# Run this script in a screen/tmux session to keep it running 24/7

echo "Starting OpenClaw services..."

# Wait for sudo password if needed
sudo -v

# Keep tailscale funnel running
while true; do
    sudo tailscale funnel 18789
    echo "Funnel 18789 stopped, restarting..."
    sleep 2
done &
while true; do
    sudo tailscale funnel 18791
    echo "Funnel 18791 stopped, restarting..."
    sleep 2
done &

# Keep voice API running
while true; do
    python3 /home/anmol/.openclaw/workspace/ai-tasks/scripts/local_voice_api.py
    echo "Voice API stopped, restarting..."
    sleep 2
done &

echo "All services started!"
wait
