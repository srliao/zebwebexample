# Deployment Guide

## Prerequisites

- **Docker** and **Docker Compose** (v2+) installed on the host machine.
- A **Cloudflare account** with a zone (domain) managed by Cloudflare.
- (Optional) [Task](https://taskfile.dev) for convenience commands.

---

## 1. Cloudflare Tunnel Setup

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Zero Trust** → **Networks** → **Tunnels**.
2. Click **Create a tunnel**, choose **Cloudflared** as the connector, and give it a name.
3. Copy the **tunnel token** shown on the next screen.
4. Continue to the **Public Hostnames** tab (see step 3 below before saving).

---

## 2. Configure Your Environment

```bash
cp .env.example .env
```

Edit `.env` and paste the tunnel token:

```
CLOUDFLARE_TUNNEL_TOKEN=<your-token-here>
```

The `TELNET_ADDR` variable defaults to `zebedee-mud.org:7000`; override it if needed.

---

## 3. Public Hostname Routing

In the Cloudflare dashboard (Tunnel → Public Hostnames), add a hostname that forwards traffic to the proxy container. The tunnel and proxy share Docker's default bridge network, so use `http://proxy:8080` as the service URL.

**Option A — Same domain as your Pages site** (e.g. `mud.example.com`):

| Field | Value |
|---|---|
| Subdomain | `mud` |
| Domain | `example.com` |
| Path | `/ws` |
| Service | `http://proxy:8080` |

Cloudflare routes `/ws` through the tunnel; all other paths are served by Pages.

**Option B — Separate subdomain** (e.g. `ws.mud.example.com`):

| Field | Value |
|---|---|
| Subdomain | `ws.mud` |
| Domain | `example.com` |
| Path | *(leave empty)* |
| Service | `http://proxy:8080` |

Then set `VITE_WS_URL=wss://ws.mud.example.com/ws` in the Cloudflare Pages build environment (see step 5).

---

## 4. Running the Stack

```bash
# Build the proxy image and start both containers in the background
task docker:up
# or without Task:
docker compose up -d --build

# Follow live logs
task docker:logs
# or:
docker compose logs -f
```

Expected output:
- **proxy**: `listening on :8080`
- **cloudflared**: `Registered tunnel connection`

To stop:

```bash
task docker:down
# or:
docker compose down
```

---

## 5. Cloudflare Pages — Auto-Deploy from GitHub

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select your repository.
3. Set the build configuration:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `web`
4. (Option B only) Under **Environment variables**, add:
   - `VITE_WS_URL` = `wss://ws.mud.example.com/ws`
5. Click **Save and Deploy**.

Pages will automatically redeploy on every push to the production branch.

---

## 6. Verification

1. `docker compose build` completes without errors; image is roughly 20 MB.
2. After `task docker:up`, both containers report healthy in `docker compose ps`.
3. Open your Pages URL in a browser — the terminal should connect and the MUD session should appear.
