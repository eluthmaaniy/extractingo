# Extractingo on Coolify

Frontend-only static SPA. No database, no Supabase, no auth.

## Live identity

| Piece | Value |
| --- | --- |
| Domain | `https://extractingo.scoutier.com.ng` |
| VPS | `147.93.85.240` |
| Coolify | `https://coolify.uipostutme.com` — project **Extractingo** only |
| Build pack | **Railpack**, static `dist/`, port **80** |
| Git | `eluthmaaniy/extractingo` branch `main` |

Do not attach this hostname to the Scoutier SPA container. Do not add Postgres or a Docker network shared with Scoutier / Shopidict / Eltemur.

## Local

```bash
npm ci
npm run dev
```

Dev server: `http://localhost:8080`. Confirm extract, Gmail-only, copy/download, and dark mode before any Coolify or DNS change.

## Coolify

1. Create Coolify project **Extractingo** (own project, like Eltemur).
2. Application from GitHub, **Railpack**, publish directory `dist`, port `80`, SPA `try_files` from `nginx/spa.conf`.
3. DNS: `A extractingo.scoutier.com.ng → 147.93.85.240`.
4. Let’s Encrypt on that hostname.
5. Push `main` to deploy. Use **Deploy**, not only Restart, after nginx changes.

## Family comparison

| Product | Pack | Backend | Domain |
| --- | --- | --- | --- |
| Scoutier | Railpack static :80 | Self-hosted Supabase | scoutier.com.ng |
| Shopidict | Railpack static :80 | Own Supabase | shopidict.com |
| Eltemur | Dockerfile Next :3000 | None | eltemur.com |
| Extractingo | Railpack static :80 | None | extractingo.scoutier.com.ng |
