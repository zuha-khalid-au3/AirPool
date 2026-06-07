#!/usr/bin/env bash
set -euo pipefail

PORT="${AIRPOOL_BACKEND_PORT:-5000}"
PROVIDER="${TUNNEL_PROVIDER:-auto}"

print_usage_hint() {
  echo "Copy the https:// URL and run:"
  echo "  AIRPOOL_PUBLIC_API_URL=https://YOUR-PUBLIC-URL make dev-remote"
  echo ""
}

ngrok_configured() {
  command -v ngrok >/dev/null 2>&1 || return 1
  ngrok config check >/dev/null 2>&1
}

start_ngrok() {
  echo "Exposing AirPool backend on port ${PORT} via ngrok..."
  print_usage_hint
  exec ngrok http "127.0.0.1:${PORT}"
}

start_cloudflared() {
  echo "Exposing AirPool backend on port ${PORT} via Cloudflare Tunnel (no account required)..."
  print_usage_hint
  exec cloudflared tunnel --url "http://127.0.0.1:${PORT}"
}

case "$PROVIDER" in
  ngrok)
    if ! command -v ngrok >/dev/null 2>&1; then
      echo "ngrok is not installed. Run: brew install ngrok"
      exit 1
    fi
    if ! ngrok_configured; then
      echo "ngrok requires a free account and authtoken."
      echo ""
      echo "  1. Sign up: https://dashboard.ngrok.com/signup"
      echo "  2. Run: ngrok config add-authtoken YOUR_TOKEN"
      echo ""
      echo "Or use Cloudflare instead (no signup): brew install cloudflared && TUNNEL_PROVIDER=cloudflared make tunnel-backend"
      exit 1
    fi
    start_ngrok
    ;;
  cloudflared)
    if ! command -v cloudflared >/dev/null 2>&1; then
      echo "cloudflared is not installed. Run: brew install cloudflared"
      exit 1
    fi
    start_cloudflared
    ;;
  auto)
    if command -v cloudflared >/dev/null 2>&1; then
      start_cloudflared
    elif ngrok_configured; then
      start_ngrok
    elif command -v ngrok >/dev/null 2>&1; then
      echo "ngrok is installed but not authenticated (ERR_NGROK_4018)."
      echo ""
      echo "Easiest fix — use Cloudflare Tunnel (no account):"
      echo "  brew install cloudflared"
      echo "  make tunnel-backend"
      echo ""
      echo "Or configure ngrok:"
      echo "  1. Sign up: https://dashboard.ngrok.com/signup"
      echo "  2. Run: ngrok config add-authtoken YOUR_TOKEN"
      echo "  3. Run: TUNNEL_PROVIDER=ngrok make tunnel-backend"
      exit 1
    else
      echo "No tunnel tool found. Install one (Cloudflare is recommended — no signup):"
      echo "  brew install cloudflared"
      echo ""
      echo "Or, with a free ngrok account:"
      echo "  brew install ngrok"
      echo "  ngrok config add-authtoken YOUR_TOKEN"
      echo ""
      print_usage_hint
      exit 1
    fi
    ;;
  *)
    echo "Unknown TUNNEL_PROVIDER: ${PROVIDER} (use auto, cloudflared, or ngrok)"
    exit 1
    ;;
esac
