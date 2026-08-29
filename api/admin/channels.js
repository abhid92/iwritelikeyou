const { requireAdmin } = require("../../lib/auth");
const { get, upsert, patch } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const params   = new URL(req.url, "http://x").searchParams;
  const clientId = params.get("client_id") || (req.body || {}).client_id;
  if (!clientId) return res.status(400).json({ error: "client_id required" });

  if (req.method === "GET") {
    const { data } = await get(`client_channels?client_id=eq.${clientId}&order=sort_order.asc&select=*`);
    return res.status(200).json({ channels: Array.isArray(data) ? data : [] });
  }

  // PUT: upsert full channel list for this client
  if (req.method === "PUT") {
    const { channels } = req.body || {};
    if (!Array.isArray(channels)) return res.status(400).json({ error: "channels array required" });
    const rows = channels.map((ch, i) => ({
      client_id:    clientId,
      channel_id:   ch.id,
      label:        ch.label,
      short_code:   ch.short,
      color:        ch.color || "#000000",
      channel_type: ch.type || "post",
      post_url:     ch.postUrl || null,
      word_options: ch.wordOptions || [],
      sort_order:   i,
      enabled:      ch.enabled !== false,
    }));
    const { data, ok } = await upsert("client_channels?on_conflict=client_id,channel_id", rows);
    return res.status(ok ? 200 : 400).json(ok ? { channels: data } : { error: data });
  }

  // PATCH: toggle single channel
  if (req.method === "PATCH") {
    const { channel_id, enabled } = req.body || {};
    if (!channel_id) return res.status(400).json({ error: "channel_id required" });
    const { data, ok } = await patch(`client_channels?client_id=eq.${clientId}&channel_id=eq.${channel_id}`, { enabled });
    return res.status(ok ? 200 : 400).json(ok ? { channel: data[0] } : { error: data });
  }

  return res.status(405).end();
};
