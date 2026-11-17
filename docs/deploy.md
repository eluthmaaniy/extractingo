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
| Coolify project UUID | `3f3pm0b7dpjrt8onjxdwslkv` |
| Coolify app UUID | `blywlej8ow3fzbavvgqeaftx` |

Do not attach this hostname to the Scoutier SPA container. Do not add Postgres or a Docker network shared with Scoutier / Shopidict / Eltemur.

## Local

```bash
npm ci
npm run dev
```

Dev server: `http://localhost:8080`. Confirm extract, Gmail-only, copy/download, and dark mode before any Coolify or DNS change.

## Coolify

Project **Extractingo** and app `extractingo` already exist (Railpack, `/dist`, port 80). Do not attach this hostname to the Scoutier SPA.

**Before the first Deploy:**

1. DNS: `A extractingo.scoutier.com.ng → 147.93.85.240` on the Scoutier zone.
2. Connect the GitHub repo to a Coolify GitHub App (the app was created from a public Git URL; a private repo needs `coolify-scoutier` or a dedicated Extractingo GitHub App, same pattern as Eltemur).
3. In Coolify, paste `nginx/spa.conf` as custom Nginx, **Save**, then **Deploy** (Restart is not enough).
4. Let’s Encrypt on `extractingo.scoutier.com.ng`.

## Family comparison

| Product | Pack | Backend | Domain |
| --- | --- | --- | --- |
| Scoutier | Railpack static :80 | Self-hosted Supabase | scoutier.com.ng |
| Shopidict | Railpack static :80 | Own Supabase | shopidict.com |
| Eltemur | Dockerfile Next :3000 | None | eltemur.com |
| Extractingo | Railpack static :80 | None | extractingo.scoutier.com.ng |
