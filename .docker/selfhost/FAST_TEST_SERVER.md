# Fast test server deployment

This file is for short-lived test servers. The goal is to avoid compiling the
AFFiNE fork on every new server.

## Best option: publish prebuilt images

Build once, push once, then every test server only pulls images.

Recommended flow:

1. Commit and push your fork changes.
2. Open GitHub Actions and run `Build self-host images`.
3. Leave `image_tag` empty to use the short Git SHA, or enter a tag such as
   `test-20260513`.
4. Copy the deployment command from the workflow summary.
5. Run it on the test server.

Example command from the server:

```bash
cd /opt/affine-fork
git fetch origin feature/graduate-toolkit
git checkout feature/graduate-toolkit
git pull --ff-only origin feature/graduate-toolkit
bash .docker/selfhost/deploy-ghcr.sh --owner tlmkira --tag <image-tag>
```

The deploy script updates only these two lines in `.docker/selfhost/.env`:

```env
AFFINE_IMAGE=ghcr.io/tlmkira/kite-affine:<image-tag>
NOTEBOOK_IMAGE=ghcr.io/tlmkira/kite-affine-notebook:<image-tag>
```

It does not modify database passwords, Notebook tokens, private keys, storage
paths, or persisted data.

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

If GHCR packages are private, log in on the server first:

```bash
echo '<github-token>' | docker login ghcr.io -u '<github-user>' --password-stdin
```

For fastest temporary-server testing, set both GHCR packages to Public.

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
