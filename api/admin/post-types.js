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
    const { data } = await get(`client_post_types?client_id=eq.${clientId}&order=sort_order.asc&select=*`);
    return res.status(200).json({ postTypes: Array.isArray(data) ? data : [] });
  }

  if (req.method === "PUT") {
    const { postTypes } = req.body || {};
    if (!Array.isArray(postTypes)) return res.status(400).json({ error: "postTypes array required" });
    const rows = postTypes.map((pt, i) => ({
      client_id:   clientId,
      value:       pt.value,
      label:       pt.label,
      description: pt.description || "",
      enabled:     pt.enabled !== false,
      sort_order:  i,
    }));
    await upsert("client_post_types?on_conflict=client_id,value", rows);
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
