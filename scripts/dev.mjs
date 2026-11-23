// Local development only. The deployed Worker uses Sites-authenticated identity and R2.
import { createServer } from "node:http";
import worker from "../dist/server/index.js";
class LocalBucket {
  objects = new Map();
  async get(key) {
    const item = this.objects.get(key);
    return item
      ? { etag: item.etag, json: async () => structuredClone(item.value) }
      : null;
  }
  async put(key, text, options) {
    const previous = this.objects.get(key);
    const condition = options.onlyIf;
    if (condition.etagMatches && previous?.etag !== condition.etagMatches)
      return null;
    if (condition.etagDoesNotMatch === "*" && previous) return null;
    const item = { etag: crypto.randomUUID(), value: JSON.parse(text) };
    this.objects.set(key, item);
    return item;
  }
}
const env = { BUCKET: new LocalBucket() };
const portIndex = process.argv.indexOf("--port");
const port = Number(process.argv[portIndex + 1] && portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || 5173);
createServer(async (req, res) => {
  try {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const headers = new Headers(
      Object.entries(req.headers).flatMap(([key, v]) =>
        v ? [[key, Array.isArray(v) ? v.join(",") : v]] : [],
      ),
    );
    headers.set("oai-authenticated-user-id", "local-developer");
    headers.set("oai-authenticated-user-email", "developer@example.com");
    headers.set("oai-authenticated-user-full-name", "Local Developer");
    const body = Buffer.concat(buffers);
    const response = await worker.fetch(
      new Request(
        "http://" + (req.headers.host || "localhost:" + port) + req.url,
        { method: req.method, headers, body: body.length ? body : undefined },
      ),
      env,
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end("Local preview error.");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(
    "Local demo: http://localhost:" +
      port +
      " — test data resets when this process stops.",
  ),
);
