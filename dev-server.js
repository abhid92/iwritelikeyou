const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = 3334;
const ROOT = __dirname;

// Load .env.local
try {
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n").forEach(line => {
    const clean = line.replace(/#.*/,"").trim();
    const eq = clean.indexOf("=");
    if (eq > 0) process.env[clean.slice(0,eq).trim()] = clean.slice(eq+1).trim();
  });
} catch {}

const MIME = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png", ".svg":"image/svg+xml" };

function polyfill(req, res) {
  const qs  = req.url.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";
  req.query = Object.fromEntries(new URLSearchParams(qs));
  res.status = code => ({
    json: obj => { if (!res.headersSent) { res.writeHead(code, {"Content-Type":"application/json"}); res.end(JSON.stringify(obj)); } },
    end:  ()  => { if (!res.headersSent) { res.writeHead(code); res.end(); } },
  });
  res.json = obj => { if (!res.headersSent) { res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify(obj)); } };
}

async function handleApi(routePath, req, res) {
  polyfill(req, res);
  let body = "";
  req.on("data", d => { body += d; });
  await new Promise(r => req.on("end", r));
  req.body = body ? (() => { try { return JSON.parse(body); } catch { return {}; } })() : {};

  // Clear require cache (hot reload)
  const modPath = path.join(ROOT, "api", routePath + ".js");
  if (!fs.existsSync(modPath)) {
    res.writeHead(404, {"Content-Type":"application/json"}); res.end(JSON.stringify({error:"Not found"})); return;
  }
  Object.keys(require.cache).filter(k => k.startsWith(ROOT) && !k.includes("node_modules")).forEach(k => delete require.cache[k]);

  try { await require(modPath)(req, res); }
  catch (e) { if (!res.headersSent) { res.writeHead(500, {"Content-Type":"application/json"}); res.end(JSON.stringify({error:e.message})); } }
}

http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  console.log(`${req.method} ${url}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Content-Type,Authorization", "Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS" });
    return res.end();
  }

  // API routing
  if (url.startsWith("/api/")) {
    const route = url.replace("/api/","");
    return handleApi(route, req, res);
  }

  // Static files
  const candidates = [
    url === "/" ? "/index.html" : url,
    url === "/admin" ? "/admin.html" : null,
  ].filter(Boolean);

  for (const p of candidates) {
    const full = path.join(ROOT, p);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      res.writeHead(200, {"Content-Type": MIME[path.extname(full)] || "text/plain"});
      return res.end(fs.readFileSync(full));
    }
  }

  // SPA fallback
  res.writeHead(200, {"Content-Type":"text/html"});
  res.end(fs.readFileSync(path.join(ROOT, "index.html")));
}).listen(PORT, () => console.log(`\n  iWriteLikeYou dev server → http://localhost:${PORT}\n`));
