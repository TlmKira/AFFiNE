# Fast test server deployment

This file is for short-lived test servers. The goal is to avoid compiling the
AFFiNE fork on every new server.

## Best option: publish prebuilt images

Build once, push once, then every test server only pulls images.

Suggested image names:

```text
ghcr.io/<github-user-or-org>/kite-affine:<git-sha>
ghcr.io/<github-user-or-org>/kite-affine-notebook:<git-sha>
```

On the test server, set these in `.docker/selfhost/.env`:

```env
AFFINE_IMAGE=ghcr.io/<github-user-or-org>/kite-affine:<git-sha>
NOTEBOOK_IMAGE=ghcr.io/<github-user-or-org>/kite-affine-notebook:<git-sha>
```

Then start:

```bash
docker compose --env-file .docker/selfhost/.env -f .docker/selfhost/compose.yml pull
docker compose --env-file .docker/selfhost/.env -f .docker/selfhost/compose.yml up -d
```

## Minimal server bootstrap

```bash
apt-get update
apt-get install -y ca-certificates curl git openssl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Create swap on small test servers:

```bash
fallocate -l 6G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
printf 'vm.swappiness=20\n' >/etc/sysctl.d/99-affine-swap.conf
sysctl --system
```

Create config:

```bash
mkdir -p /opt/affine-data/config /opt/affine-data/storage /opt/affine-data/notebook
openssl ecparam -name prime256v1 -genkey -noout \
  -out /opt/affine-data/config/private.key
cp .docker/selfhost/config.example.json /opt/affine-data/config/config.json
```

Use absolute paths in `.env`:

```env
DB_DATA_LOCATION=/opt/affine-data/postgres/pgdata
UPLOAD_LOCATION=/opt/affine-data/storage
CONFIG_LOCATION=/opt/affine-data/config
NOTEBOOK_WORKDIR_LOCATION=/opt/affine-data/notebook
AFFINE_PRIVATE_KEY=
```

## If you cannot use a registry

Build the images once, save them, then upload the tar files to the next server:

```bash
docker save kite-affine:local | gzip > kite-affine-local.tar.gz
docker save kite-affine-notebook:local | gzip > kite-affine-notebook-local.tar.gz
```

On the new server:

```bash
gunzip -c kite-affine-local.tar.gz | docker load
gunzip -c kite-affine-notebook-local.tar.gz | docker load
docker compose --env-file .docker/selfhost/.env -f .docker/selfhost/compose.yml up -d
```

This still avoids rebuilding from source.
