# Self-hosting this fork

This compose stack runs the custom fork image `kite-affine:local` by default.
The official AFFiNE image does not contain this fork's custom features, such as
Bilibili embeds, paper citation cards, the self-hosted Notebook block, phone
sign-in, custom themes, wallpaper background, and pricing-plan hiding.

For short-lived test servers, do not compile on the server every time. Build the
images once in CI or on a fixed build machine, push them to a registry, and let
test servers pull the prebuilt images.

## Prepare configuration

1. Copy `.env.example` to `.env`.
2. Set `DB_PASSWORD`, `NOTEBOOK_TOKEN`, and public URL values.
3. Copy `config.example.json` to `${CONFIG_LOCATION}/config.json`.
4. Create a PEM private key at `${CONFIG_LOCATION}/private.key`.
5. Do not commit real passwords, tokens, API keys, or private keys.

Generate the private key on Linux:

```bash
mkdir -p ~/.affine/self-host/config
openssl ecparam -name prime256v1 -genkey -noout \
  -out ~/.affine/self-host/config/private.key
```

`AFFINE_PRIVATE_KEY` in `.env` can stay empty. If you set it, it must be a valid
PEM private key, not a random string.

## Windows storage notes

If you use Docker Desktop on Windows, move Docker Desktop's disk image to a
large drive and point persistent directories to that drive:

```env
DB_DATA_LOCATION=F:/AFFiNEData/postgres/pgdata
UPLOAD_LOCATION=F:/AFFiNEData/storage
CONFIG_LOCATION=F:/AFFiNEData/config
NOTEBOOK_WORKDIR_LOCATION=F:/AFFiNEData/notebook
```

A full local build needs a lot of disk space. Keep at least 40-60 GB free if you
build locally. For a temporary server, use prebuilt images instead.

## Build images locally

Use this only on a machine where you are willing to spend the compile time:

```bash
corepack yarn install --immutable
corepack yarn affine web build
corepack yarn affine mobile build
corepack yarn affine admin build

# Build Linux native package if needed on the build host.
corepack yarn workspace @affine/server-native build

corepack yarn affine server build
corepack yarn config set --json supportedArchitectures.cpu '["x64", "arm64", "arm"]'
corepack yarn config set --json supportedArchitectures.libc '["glibc"]'
corepack yarn workspaces focus @affine/server --production
corepack yarn workspace @affine/server prisma generate
rm -rf packages/backend/server/node_modules
mv ./node_modules ./packages/backend/server/node_modules
rm -rf packages/backend/server/node_modules/@affine/server-native
mkdir -p packages/backend/server/node_modules/@affine
cp -a packages/backend/native packages/backend/server/node_modules/@affine/server-native

docker build -f .github/deployment/node/Dockerfile -t kite-affine:local .
docker build -f .docker/selfhost/notebook/Dockerfile -t kite-affine-notebook:local .docker/selfhost/notebook
```

## Start

```bash
docker compose --env-file .docker/selfhost/.env -f .docker/selfhost/compose.yml up -d
```

Notebook is only exposed inside the Docker network. AFFiNE talks to it through
the backend proxy and `NOTEBOOK_TOKEN`. Do not publish Jupyter port `8888` to the
public internet.

## Fast temporary-server workflow

For a new temporary Linux server:

1. Install Docker and the compose plugin.
2. Copy `.docker/selfhost/.env` and the config directory.
3. Set `AFFINE_IMAGE` and `NOTEBOOK_IMAGE` to prebuilt registry images.
4. Run `docker compose pull`.
5. Run `docker compose up -d`.

With prebuilt images, the server should pull and start instead of compiling
Rust, Node packages, and frontend bundles again.
