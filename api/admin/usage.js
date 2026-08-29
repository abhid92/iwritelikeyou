const { requireAdmin } = require("../../lib/auth");
const { get }          = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  const params   = new URL(req.url, "http://x").searchParams;
  const clientId = params.get("client_id");
  const from     = params.get("from");
  const to       = params.get("to");

  let q = "usage?order=created_at.desc&limit=500&select=*";
  if (clientId) q += `&client_id=eq.${clientId}`;
  if (from)     q += `&created_at=gte.${from}`;
  if (to)       q += `&created_at=lte.${to}`;

  const { data } = await get(q);
  const rows = Array.isArray(data) ? data : [];

  // Aggregate per client
  const summary = {};
  rows.forEach(r => {
    if (!summary[r.client_id]) summary[r.client_id] = { client_id: r.client_id, generations: 0, tokens_in: 0, tokens_out: 0 };
    summary[r.client_id].generations++;
    summary[r.client_id].tokens_in  += r.tokens_in  || 0;
    summary[r.client_id].tokens_out += r.tokens_out || 0;
  });

  return res.status(200).json({ usage: rows, summary: Object.values(summary) });
};
