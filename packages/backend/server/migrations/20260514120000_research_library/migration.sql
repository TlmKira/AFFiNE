-- CreateTable
CREATE TABLE "research_feed_subscriptions" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "url" TEXT NOT NULL,
    "type" VARCHAR NOT NULL,
    "title" VARCHAR,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "refresh_interval_minutes" INTEGER NOT NULL DEFAULT 360,
    "last_sync_at" TIMESTAMPTZ(3),
    "next_sync_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "research_feed_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_feed_items" (
    "id" VARCHAR NOT NULL,
    "subscription_id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "fingerprint" VARCHAR NOT NULL,
    "title" TEXT NOT NULL,
    "authors" JSONB NOT NULL DEFAULT '[]',
    "url" TEXT,
    "doi" VARCHAR,
    "arxiv_id" VARCHAR,
    "abstract" TEXT,
    "published_at" TIMESTAMPTZ(3),
    "raw" JSONB NOT NULL,
    "imported_doc_id" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "research_feed_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "research_feed_subscriptions_workspace_id_idx" ON "research_feed_subscriptions"("workspace_id");

-- CreateIndex
CREATE INDEX "research_feed_subscriptions_enabled_next_sync_at_idx" ON "research_feed_subscriptions"("enabled", "next_sync_at");

-- CreateIndex
CREATE UNIQUE INDEX "research_feed_subscriptions_workspace_id_url_key" ON "research_feed_subscriptions"("workspace_id", "url");

-- CreateIndex
CREATE INDEX "research_feed_items_subscription_id_idx" ON "research_feed_items"("subscription_id");

-- CreateIndex
CREATE INDEX "research_feed_items_workspace_id_published_at_idx" ON "research_feed_items"("workspace_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "research_feed_items_workspace_id_fingerprint_key" ON "research_feed_items"("workspace_id", "fingerprint");

-- AddForeignKey
ALTER TABLE "research_feed_subscriptions" ADD CONSTRAINT "research_feed_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_feed_items" ADD CONSTRAINT "research_feed_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "research_feed_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_feed_items" ADD CONSTRAINT "research_feed_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
