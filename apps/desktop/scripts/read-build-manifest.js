const fs = require("fs");
const path = require("path");
const { manifestPath, desktopRoot } = require("./build-paths");

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
}

/** @returns {{ winUnpacked: string, electronOutputDir?: string } | null} */
function getWinUnpackedPath() {
  const m = readManifest();
  if (m && m.winUnpacked && fs.existsSync(m.winUnpacked)) {
    return { winUnpacked: m.winUnpacked, electronOutputDir: m.electronOutputDir };
  }
  const legacy = path.join(desktopRoot, "dist", "win-unpacked");
  if (fs.existsSync(legacy)) {
    return { winUnpacked: legacy, electronOutputDir: null };
  }
  return null;
}

module.exports = {
  readManifest,
  getWinUnpackedPath,
  manifestPath,
};
