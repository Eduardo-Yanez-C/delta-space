-- Organigrama: nodos jerárquicos y conexiones libres (misma semántica que Software de Mejora).

CREATE TABLE "OrganizationNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "category" TEXT,
    "parentId" TEXT,
    "linkToId" TEXT,
    "photoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "OrganizationNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrganizationNode_linkToId_fkey" FOREIGN KEY ("linkToId") REFERENCES "OrganizationNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OrganizationNode_parentId_idx" ON "OrganizationNode"("parentId");
CREATE INDEX "OrganizationNode_linkToId_idx" ON "OrganizationNode"("linkToId");

CREATE TABLE "OrganizationCustomEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "strokeWidth" REAL NOT NULL DEFAULT 2,
    "dashPattern" TEXT,
    "midOffsetX" REAL NOT NULL DEFAULT 0,
    "midOffsetY" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizationCustomEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "OrganizationNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationCustomEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "OrganizationNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrganizationCustomEdge_fromNodeId_toNodeId_key" ON "OrganizationCustomEdge"("fromNodeId", "toNodeId");
CREATE INDEX "OrganizationCustomEdge_fromNodeId_idx" ON "OrganizationCustomEdge"("fromNodeId");
CREATE INDEX "OrganizationCustomEdge_toNodeId_idx" ON "OrganizationCustomEdge"("toNodeId");
