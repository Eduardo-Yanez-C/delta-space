const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcPath = path.join(root, "dist/modules/implantation-design/implantation-design.service.js");
const outPath = path.join(root, "src/modules/implantation-design/implantation-design.service.ts");

let s = fs.readFileSync(srcPath, "utf8");
const start = s.indexOf("const UPLOADS_DIR");
const endMarker = "exports.ImplantationDesignService = ImplantationDesignService = __decorate";
const end = s.indexOf(endMarker);
if (start < 0 || end < 0) throw new Error("markers not found");
let body = s.slice(start, end);
body = body.replace(
  /let ImplantationDesignService = class ImplantationDesignService \{/,
  "@Injectable()\nexport class ImplantationDesignService {",
);
body = body.replace(/common_1\.(\w+)/g, "$1");
body = body.replace(/\(0, crypto_1\.randomUUID\)\(\)/g, "randomUUID()");

const header = `import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { FvStudyService } from "../fv-study/fv-study.service";
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + "\n" + body.trimEnd() + "\n", "utf8");
console.log("Wrote", outPath);
