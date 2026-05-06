-- Límite mensual de tokens (asistente suite) y registro de consumo por llamada al modelo.
ALTER TABLE "User" ADD COLUMN "suiteAgentMonthlyTokenLimit" INTEGER;

CREATE TABLE "SuiteAgentUsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL DEFAULT '',
    "roundIndex" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "SuiteAgentUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SuiteAgentUsageLog_userId_createdAt_idx" ON "SuiteAgentUsageLog"("userId", "createdAt");
