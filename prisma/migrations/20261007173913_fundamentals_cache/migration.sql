-- CreateTable
CREATE TABLE "Fundamentals" (
    "symbol" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "profile" JSONB,
    "source" TEXT NOT NULL DEFAULT 'finnhub',
    "status" TEXT NOT NULL DEFAULT 'ok',
    "error" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fundamentals_pkey" PRIMARY KEY ("symbol")
);

-- CreateIndex
CREATE INDEX "Fundamentals_fetchedAt_idx" ON "Fundamentals"("fetchedAt");
