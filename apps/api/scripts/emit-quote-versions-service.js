const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcPath = path.join(root, "dist/modules/quotes/versions/quote-versions.service.js");
const outPath = path.join(root, "src/modules/quotes/versions/quote-versions.service.ts");

let s = fs.readFileSync(srcPath, "utf8");
const start = s.indexOf("const DEFAULT_VAT_PERCENT");
const endMarker = "exports.QuoteVersionsService = QuoteVersionsService = __decorate";
const end = s.indexOf(endMarker);
if (start < 0 || end < 0) throw new Error("markers not found");
let body = s.slice(start, end);

body = body.replace(
  /exports\.ADICIONALES_MAIN_ITEM_NAME =/,
  "export const ADICIONALES_MAIN_ITEM_NAME =",
);
body = body.replace(
  /let QuoteVersionsService = class QuoteVersionsService \{/,
  "@Injectable()\nexport class QuoteVersionsService {",
);

body = body.replace(/common_1\.(\w+)/g, "$1");
body = body.replace(/client_1\.Prisma/g, "Prisma");
body = body.replace(/\(0, quote_access_helper_1\.(\w+)\)/g, "quoteAccess.$1");
body = body.replace(/\(0, quote_margin_economics_helper_1\.(\w+)\)/g, "quoteMarginEconomics.$1");
body = body.replace(/\(0, role_constants_1\.(\w+)\)/g, "roleConstants.$1");

body = body.replace(/exports\.ADICIONALES_MAIN_ITEM_NAME/g, "ADICIONALES_MAIN_ITEM_NAME");

const header = `import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as roleConstants from "../../auth/role-constants";
import * as quoteAccess from "../quote-access.helper";
import * as quoteMarginEconomics from "../quote-margin-economics.helper";
import { PrismaService } from "../../../infra/prisma/prisma.service";
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + "\n" + body.trimEnd() + "\n", "utf8");
console.log("Wrote", outPath);
