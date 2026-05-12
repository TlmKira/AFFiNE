# 私有部署说明

这份 Compose 配置默认运行你的 fork 镜像 `kite-affine:local`，不会再拉取官方
`ghcr.io/toeverything/affine:stable`。官方镜像不包含本仓库里的去官方化、Bilibili、
论文引用和 Notebook 改造。

## 准备配置

1. 复制 `.env.example` 为 `.env`。
2. 修改 `.env` 中的 `DB_PASSWORD`、`AFFINE_PRIVATE_KEY`、`NOTEBOOK_TOKEN`。
3. 如果部署到域名，把 `AFFINE_SERVER_EXTERNAL_URL` 改成正式地址。
4. 手机号登录 v1 使用模拟验证码；验证码会写入后端日志，生产环境不要开启 API 回显。
5. AI 默认关闭；需要时在 `config.json` 里配置 `copilot` provider，不要提交真实 API Key。

## 构建你的 AFFiNE 镜像

在有 Docker 的机器上构建 fork 镜像。推荐在 CI 或一次性的干净工作副本中执行，因为生产依赖打包步骤会调整 `node_modules`。

```powershell
corepack yarn install --immutable
corepack yarn workspace @affine/web build
corepack yarn workspace @affine/mobile build
corepack yarn workspace @affine/admin build
corepack yarn workspace @affine/server build

# 按官方镜像打包方式准备 server 生产依赖。
corepack yarn workspaces focus @affine/server --production
corepack yarn workspace @affine/server prisma generate
Move-Item node_modules packages/backend/server/node_modules

docker build -f .github/deployment/node/Dockerfile -t kite-affine:local .
```

Notebook 镜像由 Compose 使用 `.docker/selfhost/notebook/Dockerfile` 自动构建。

## 启动

```powershell
docker compose --env-file .docker/selfhost/.env -f .docker/selfhost/compose.yml up -d
```

Notebook 只暴露在 Docker 内网，AFFiNE 后端通过 `NOTEBOOK_TOKEN` 代理访问。不要把 Jupyter 的 `8888` 端口映射到公网。
