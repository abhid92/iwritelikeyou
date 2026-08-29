const { requireClient } = require("../lib/auth");
const { get }           = require("../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  const user = requireClient(req, res);
  if (!user) return;

  const params = new URL(req.url, "http://x").searchParams;
  const from  = params.get("from") || "";
  const to    = params.get("to")   || "";

  let q = `usage?client_id=eq.${user.clientId}&order=created_at.desc&limit=200&select=*`;
  if (from) q += `&created_at=gte.${from}`;
  if (to)   q += `&created_at=lte.${to}`;

  const { data } = await get(q);
  return res.status(200).json({ usage: Array.isArray(data) ? data : [] });
};
