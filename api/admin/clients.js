const { requireAdmin }  = require("../../lib/auth");
const { get, post, patch } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    const params = new URL(req.url, "http://x").searchParams;
    const id = params.get("client_id");
    if (id) {
      const { data } = await get(`clients?client_id=eq.${id}&select=*&limit=1`);
      const client = Array.isArray(data) ? data[0] : null;
      return res.status(client ? 200 : 404).json(client ? { client } : { error: "Not found" });
    }
    const { data } = await get("clients?order=created_at.desc&select=*");
    return res.status(200).json({ clients: Array.isArray(data) ? data : [] });
  }

  if (req.method === "POST") {
    const { client_id, name, brand_title, tagline, about_text, logo_url,
            primary_color, accent_color, bg_color } = req.body || {};
    if (!client_id || !name) return res.status(400).json({ error: "client_id and name required" });
    const { data, ok } = await post("clients", {
      client_id, name, brand_title: brand_title || name, tagline, about_text, logo_url,
      primary_color: primary_color || "#3D6B5A", accent_color: accent_color || "#B8956A", bg_color: bg_color || "#F7F3EE",
    });
    return res.status(ok ? 201 : 400).json(ok ? { client: data[0] } : { error: data });
  }

  if (req.method === "PUT") {
    const params = new URL(req.url, "http://x").searchParams;
    const id = params.get("client_id") || (req.body || {}).client_id;
    if (!id) return res.status(400).json({ error: "client_id required" });
    const allowed = ["name","brand_title","tagline","about_text","logo_url","primary_color","accent_color","bg_color","demo_mode","is_active"];
    const update = Object.fromEntries(allowed.filter(k => k in (req.body||{})).map(k => [k, req.body[k]]));
    const { data, ok } = await patch(`clients?client_id=eq.${id}`, update);
    return res.status(ok ? 200 : 400).json(ok ? { client: data[0] } : { error: data });
  }

  return res.status(405).end();
};
