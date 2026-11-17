const http = require("node:http");

// Development-only bridge: the phone uses the Metro origin for both its JS
// bundle and authenticated API requests, including streamed media uploads.
function createApiProxy(next, apiOrigin = "http://127.0.0.1:3001") {
  const target = new URL(apiOrigin);
  if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)) {
    throw new Error("The Metro API proxy must target a local HTTP backend.");
  }
  return (req, res, nextMiddleware) => {
    if (!/^\/api(?:\/|\?|$)/.test(req.url ?? "")) return next(req, res, nextMiddleware);
    const upstream = http.request({
      hostname: target.hostname,
      port: target.port || 80,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: target.host },
    }, (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    });
    upstream.setTimeout(30_000, () => upstream.destroy(new Error("API timeout")));
    upstream.on("error", () => {
      if (res.headersSent) return res.destroy();
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "The local API server is unavailable. Start the API server and try again." }));
    });
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  };
}

module.exports = { createApiProxy };
