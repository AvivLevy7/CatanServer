# Deploying Catan

Two independently deployable pieces:

| Piece | Path | Image | Config |
|---|---|---|---|
| Backend (ASP.NET Core 9 + SignalR) | `/` | `Dockerfile` | `ALLOWED_ORIGINS`, `PORT` |
| Frontend (React/Vite, served by Nginx) | `/clientapp` | `clientapp/Dockerfile` | `VITE_API_URL` (build-time) |

## 1. Backend

Environment variables:

- `ALLOWED_ORIGINS` – comma-separated list of frontend origins allowed by CORS, e.g.
  `https://catan.onrender.com,https://catan.example.com`. Required: SignalR uses
  credentials, so a wildcard is not possible.
- `PORT` – injected automatically by Render/Railway; the container also listens on `8080`
  by default (`ASPNETCORE_HTTP_PORTS`).
- `ASPNETCORE_ENVIRONMENT` – already `Production` in the image.

The container listens on plain HTTP; TLS is terminated by the platform. `/health` returns
`200 {"status":"ok"}` for liveness probes.

> SignalR uses WebSockets. All three platforms below support them; if you put the API behind
> your own proxy, forward `Upgrade`/`Connection` headers and raise the idle timeout.

## 2. Frontend

`VITE_API_URL` is compiled into the bundle by `vite build`, so supply it **at build time**:

- Docker: `--build-arg VITE_API_URL=https://<your-api-host>`
- Static hosting (Render Static Site, Netlify, Vercel, Azure Static Web Apps): set
  `VITE_API_URL` in the build environment, build command `npm ci && npm run build`,
  publish directory `dist`, and add a SPA rewrite `/* -> /index.html`.
- Or edit `clientapp/.env.production`.

Leave `VITE_API_URL` empty in development; the Vite proxy handles `/hubs`.

## 3. Platform notes

### Render
1. *New ? Web Service* from this repo, **Docker** runtime, root `/`. Add `ALLOWED_ORIGINS`.
2. *New ? Static Site* (or Web Service with Docker, root `clientapp`). Set `VITE_API_URL`
   to the URL from step 1, then add the static site's URL to `ALLOWED_ORIGINS` and redeploy
   the API.

### Railway
Create two services from the same repo, setting the **Root Directory** to `/` and
`clientapp` respectively. Railway detects the Dockerfiles. Configure the same variables.

### Azure (Container Apps)
```bash
az acr build -r <registry> -t catan-api:latest .
az acr build -r <registry> -t catan-client:latest --build-arg VITE_API_URL=https://<api-fqdn> clientapp
az containerapp create -n catan-api  --image <registry>.azurecr.io/catan-api:latest  --target-port 8080 --ingress external --env-vars ALLOWED_ORIGINS=https://<client-fqdn>
az containerapp create -n catan-client --image <registry>.azurecr.io/catan-client:latest --target-port 80 --ingress external
```
Enable *Session affinity* on the API container app if you scale beyond one replica, since
rooms are kept in memory.

## 4. Local rehearsal

```bash
docker compose up --build
# client http://localhost:8081, api http://localhost:8080
```

## Caveats

- Game state is in-memory: a single API instance only, and a restart ends all games.
- Scale-out would need the Azure SignalR Service / Redis backplane plus shared room storage.
