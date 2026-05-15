# Deploying Loopin WebServer

The production API is the **Node.js `WebServer/`** (not `loopin-backend/`).

## Environment variables (required)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL, e.g. `https://<ref>.supabase.co` |
| `SUPABASE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | **Service role** key (server-side). Anon key is not sufficient for RPCs that bypass RLS. |
| `CORS_ORIGIN` | Your frontend origin(s), e.g. `https://www.loopin.fit` or `*` for testing |
| `PORT` | Usually set by host (e.g. Render sets automatically) |

## Optional (Solana / Bags)

| Variable | Description |
|----------|-------------|
| `SOLANA_NETWORK` | `mainnet-beta` (default) |
| `SOLANA_RPC_URL` | HTTPS RPC URL |
| `SOLANA_PRIVATE_KEY` | Base58 escrow key for prize payouts & entry-fee escrow address |
| `LOOPIN_TOKEN_MINT` | $LOOPIN mint on Bags |
| `BAGS_API_KEY` | From [dev.bags.fm](https://dev.bags.fm/) if you call Bags from the server |

## Health check

- `GET /health` — returns `database: ok` when Supabase is reachable, or `503` with `database: missing_env` / `error` if misconfigured.

## Render

Root [render.yaml](../render.yaml) is set to `rootDir: WebServer`. In the Render dashboard, set **secrets** (do not commit real keys to git). After changing env vars, **manual deploy** may be required.

## Azure

If using Azure Web Apps, add the same variables under **Configuration → Application settings**. Ensure the Supabase project is **not paused** (free tier pauses after inactivity).
