const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcPath = path.join(root, "dist/modules/fv-study/fv-study.service.js");
const outPath = path.join(root, "src/modules/fv-study/fv-study.service.ts");

let s = fs.readFileSync(srcPath, "utf8");
const start = s.indexOf("const DEFAULT_HSP_DAILY");
const endMarker = "exports.FvStudyService = FvStudyService = __decorate";
const end = s.indexOf(endMarker);
if (start < 0 || end < 0) throw new Error("markers not found");
let body = s.slice(start, end);

body = body.replace(
  /exports\.GENERATION_SOURCE_VALUES =/g,
  "export const GENERATION_SOURCE_VALUES =",
);
body = body.replace(/exports\.MOUNTING_TYPE_VALUES =/g, "export const MOUNTING_TYPE_VALUES =");
body = body.replace(
  /let FvStudyService = class FvStudyService \{/,
  "@Injectable()\nexport class FvStudyService {",
);

body = body.replace(/common_1\.BadRequestException/g, "BadRequestException");
body = body.replace(/common_1\.NotFoundException/g, "NotFoundException");
body = body.replace(/common_1\.ForbiddenException/g, "ForbiddenException");

body = body.replace(/\(0, role_constants_1\.(\w+)\)/g, "roleConstants.$1");
body = body.replace(/role_constants_1\.(\w+)/g, "roleConstants.$1");

body = body.replace(
  /\(0, commercial_number_1\.(\w+)\)/g,
  "cnCommercial.$1",
);

body = body.replace(
  /\(0, quote_response_mapper_1\.mapQuoteResponse\)/g,
  "mapQuoteResponse",
);

body = body.replace(
  /\(0, suggested_items_matching_1\.(\w+)\)/g,
  "suggestedItemsMatching.$1",
);

const header = `import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as roleConstants from "../auth/role-constants";
import { PrismaService } from "../../infra/prisma/prisma.service";
import * as cnCommercial from "../quotes/commercial-number";
import { mapQuoteResponse } from "../quotes/quote-response.mapper";
import { QuoteVersionsService } from "../quotes/versions/quote-versions.service";
import * as suggestedItemsMatching from "./suggested-items-matching";
`;

const footer = `
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + "\n" + body.trimEnd() + footer, "utf8");
console.log("Wrote", outPath);
