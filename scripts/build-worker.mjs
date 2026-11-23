import fs from "node:fs";
import path from "node:path";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};
const assets = {};
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else
      assets["/" + path.relative("dist/client", file).replaceAll("\\", "/")] = {
        type: types[path.extname(file)] || "application/octet-stream",
        body: fs.readFileSync(file).toString("base64"),
      };
  }
}
walk("dist/client");
fs.mkdirSync("dist/server", { recursive: true });
fs.writeFileSync(
  "dist/server/index.js",
  "const ASSETS=" +
    JSON.stringify(assets) +
    ";\n" +
    fs.readFileSync("server/worker.js", "utf8"),
);
