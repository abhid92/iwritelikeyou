const URL  = () => process.env.SUPABASE_URL;
const KEY  = () => process.env.SUPABASE_ANON_KEY;
const hdrs = (extra = {}) => ({
  apikey: KEY(), Authorization: `Bearer ${KEY()}`,
  "Content-Type": "application/json", ...extra,
});

async function sb(path, opts = {}) {
  const r = await fetch(`${URL()}/rest/v1/${path}`, { headers: hdrs(), ...opts });
  const text = await r.text();
  try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
  catch { return { ok: r.ok, status: r.status, data: text }; }
}

const get    = (path) => sb(path);
const post   = (path, body, prefer = "return=representation") =>
  sb(path, { method: "POST", headers: hdrs({ Prefer: prefer }), body: JSON.stringify(body) });
const patch  = (path, body) =>
  sb(path, { method: "PATCH", headers: hdrs({ Prefer: "return=representation" }), body: JSON.stringify(body) });
const upsert = (path, body) =>
  sb(path, { method: "POST", headers: hdrs({ Prefer: "resolution=merge-duplicates,return=representation" }), body: JSON.stringify(body) });
const del    = (path) => sb(path, { method: "DELETE" });

module.exports = { get, post, patch, upsert, del };
