const { requireAdmin } = require("../../lib/auth");
const { get, upsert }  = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const params   = new URL(req.url, "http://x").searchParams;
  const clientId = params.get("client_id") || (req.body || {}).client_id;
  if (!clientId) return res.status(400).json({ error: "client_id required" });

  if (req.method === "GET") {
    const { data } = await get(`client_prompts?client_id=eq.${clientId}&select=key,value,updated_at`);
    const result = {};
    (Array.isArray(data) ? data : []).forEach(r => { result[r.key] = r.value; });
    return res.status(200).json(result);
  }

  if (req.method === "PUT") {
    const { systemPrompt, imagePrompt } = req.body || {};
    const rows = [];
    if (systemPrompt !== undefined) rows.push({ client_id: clientId, key: "systemPrompt", value: systemPrompt, updated_at: new Date().toISOString() });
    if (imagePrompt  !== undefined) rows.push({ client_id: clientId, key: "imagePrompt",  value: imagePrompt,  updated_at: new Date().toISOString() });
    if (!rows.length) return res.status(400).json({ error: "Nothing to update" });
    await upsert("client_prompts?on_conflict=client_id,key", rows);
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
