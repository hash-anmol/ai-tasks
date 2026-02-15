# Cloudflare Tunnel Setup for OpenClaw

## Why Cloudflare Tunnel?

| Traditional Port Forwarding | Cloudflare Tunnel |
|----------------------------|-------------------|
| Open port on router | No ports opened |
| Exposed to internet | Only Cloudflare sees it |
| Manual DDOS protection | Built-in protection |
| Your IP exposed | Your IP stays hidden |

## Setup Steps

### 1. Install cloudflared on your home server

```bash
# Download
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared

# Make executable
chmod +x cloudflared

# Install
sudo mv cloudflared /usr/local/bin/
```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This will open a browser window. Log in to Cloudflare and authorize the tunnel.

### 3. Create the tunnel

```bash
cloudflared tunnel create openclaw
```

Save the tunnel ID shown (e.g., `a1b2c3d4-...`)

### 4. Set up DNS

```bash
# Point your domain to the tunnel
cloudflared tunnel route dns openclaw openclaw.yourdomain.com
```

### 5. Run the tunnel

```bash
# Run tunnel pointing to OpenClaw
cloudflared tunnel run --url http://localhost:18789 openclaw
```

### 6. Use in AI Tasks

Update `.env.local`:
```
NEXT_PUBLIC_OPENCLAW_URL=https://openclaw.yourdomain.com
```

## Security: Add IP Restriction (Optional)

In Cloudflare Dashboard:
1. Go to your tunnel → Settings
2. Set "Access Policy" to only allow Vercel's IP ranges

## Alternative: ngrok (Quick Setup)

If you just want to test quickly:

```bash
# Install ngrok
brew install ngrok  # or download from ngrok.com

# Run with auth
ngrok http 18789 --auth="user:your-secure-password"

# You'll get a URL like https123.ngrok.io://abc
# Use that in NEXT_PUBLIC_OPENCLAW_URL
```

## Security Comparison

```
┌─────────────────┬────────────┬────────────┬────────────┐
│ Method          │ Security   │ Cost       │ Setup      │
├─────────────────┼────────────┼────────────┼────────────┤
│ Cloudflare      │ ★★★★★     │ Free       │ Medium     │
│ ngrok           │ ★★★★☆     │ Free/Paid  │ Easy       │
│ Port Forward    │ ★★☆☆☆     │ Free       │ Easy       │
└─────────────────┴────────────┴────────────┴────────────┘
```

## Summary

1. **Recommended**: Set up Cloudflare Tunnel - gives you a permanent, secure URL
2. **Quick test**: Use ngrok - gets you a temporary URL instantly
3. Both preserve your token auth from OpenClaw config
