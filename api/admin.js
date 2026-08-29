const { requireAdmin } = require("../lib/auth");
const { get, post, patch, upsert } = require("../lib/supabase");
const { encrypt } = require("../lib/crypto");
const bcrypt = require("bcryptjs");

function getClientId(req) {
  const params = new URL(req.url, "http://x").searchParams;
  return params.get("client_id") || (req.body || {}).client_id || null;
}

function genPassword(len = 12) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function handleClients(req, res) {
  if (req.method === "GET") {
    const params = new URL(req.url, "http://x").searchParams;
    const id = params.get("client_id");
    if (id) {
      const { data } = await get(`clients?client_id=eq.${id}&select=*&limit=1`);
      const client = Array.isArray(data) ? data[0] : null;
      return res.status(client ? 200 : 404).json(client ? { client } : { error: "Not found" });
    }
    const { data } = await get("clients?order=created_at.desc&select=*,client_channels(channel_id,enabled)");
    const clients = (Array.isArray(data) ? data : []).map(c => ({
      ...c,
      active_channels: (c.client_channels || []).filter(ch => ch.enabled).length,
    }));
    return res.status(200).json({ clients });
  }
  if (req.method === "POST") {
    const { client_id, name, brand_title, tagline, about_text, logo_url, primary_color, accent_color, bg_color } = req.body || {};
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
}

async function handleUsers(req, res) {
  if (req.method === "GET") {
    const params = new URL(req.url, "http://x").searchParams;
    const clientId = params.get("client_id");
    if (!clientId) return res.status(400).json({ error: "?client_id= required" });
    const { data } = await get(`client_users?client_id=eq.${clientId}&select=id,username,created_at,last_login`);
    return res.status(200).json({ users: Array.isArray(data) ? data : [] });
  }
  if (req.method === "POST") {
    const { client_id, username } = req.body || {};
    if (!client_id || !username) return res.status(400).json({ error: "client_id and username required" });
    const password = genPassword();
    const hash = await bcrypt.hash(password, 10);
    const { data, ok } = await post("client_users", { client_id, username, password_hash: hash });
    if (!ok) return res.status(400).json({ error: data?.message || "Could not create user" });
    return res.status(201).json({ username, password, note: "Save this password — it won't be shown again." });
  }
  if (req.method === "PUT") {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: "username required" });
    const password = genPassword();
    const hash = await bcrypt.hash(password, 10);
    const { ok, data } = await patch(`client_users?username=eq.${encodeURIComponent(username)}`, { password_hash: hash });
    if (!ok) return res.status(400).json({ error: data?.message || "Could not reset" });
    return res.status(200).json({ username, password, note: "Save this password — it won't be shown again." });
  }
  return res.status(405).end();
}

async function handleChannels(req, res) {
  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: "client_id required" });
  if (req.method === "GET") {
    const { data } = await get(`client_channels?client_id=eq.${clientId}&order=sort_order.asc&select=*`);
    return res.status(200).json({ channels: Array.isArray(data) ? data : [] });
  }
  if (req.method === "PUT") {
    const { channels } = req.body || {};
    if (!Array.isArray(channels)) return res.status(400).json({ error: "channels array required" });
    const rows = channels.map((ch, i) => ({
      client_id: clientId, channel_id: ch.id, label: ch.label, short_code: ch.short,
      color: ch.color || "#000000", channel_type: ch.type || "post", post_url: ch.postUrl || null,
      word_options: ch.wordOptions || [], sort_order: i, enabled: ch.enabled !== false,
    }));
    const { data, ok } = await upsert("client_channels?on_conflict=client_id,channel_id", rows);
    return res.status(ok ? 200 : 400).json(ok ? { channels: data } : { error: data });
  }
  if (req.method === "PATCH") {
    const { channel_id, enabled } = req.body || {};
    if (!channel_id) return res.status(400).json({ error: "channel_id required" });
    const { data, ok } = await patch(`client_channels?client_id=eq.${clientId}&channel_id=eq.${channel_id}`, { enabled });
    return res.status(ok ? 200 : 400).json(ok ? { channel: data[0] } : { error: data });
  }
  return res.status(405).end();
}

async function handlePostTypes(req, res) {
  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: "client_id required" });
  if (req.method === "GET") {
    const { data } = await get(`client_post_types?client_id=eq.${clientId}&order=sort_order.asc&select=*`);
    return res.status(200).json({ postTypes: Array.isArray(data) ? data : [] });
  }
  if (req.method === "PUT") {
    const { postTypes } = req.body || {};
    if (!Array.isArray(postTypes)) return res.status(400).json({ error: "postTypes array required" });
    const rows = postTypes.map((pt, i) => ({
      client_id: clientId, value: pt.value, label: pt.label,
      description: pt.description || "", enabled: pt.enabled !== false, sort_order: i,
    }));
    await upsert("client_post_types?on_conflict=client_id,value", rows);
    return res.status(200).json({ success: true });
  }
  return res.status(405).end();
}

async function handlePrompts(req, res) {
  const clientId = getClientId(req);
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
}

async function handleAiConfig(req, res) {
  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: "client_id required" });
  if (req.method === "GET") {
    const { data } = await get(`client_ai_config?client_id=eq.${clientId}&select=provider,model,api_key_encrypted,updated_at`);
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return res.status(200).json({ provider: "anthropic", model: "", apiKeySet: false });
    return res.status(200).json({ provider: row.provider, model: row.model, apiKeySet: !!row.api_key_encrypted, updatedAt: row.updated_at });
  }
  if (req.method === "PUT") {
    const { provider, model, api_key } = req.body || {};
    const row = { client_id: clientId, updated_at: new Date().toISOString() };
    if (provider) row.provider = provider;
    if (model)    row.model    = model;
    if (api_key)  row.api_key_encrypted = encrypt(api_key);
    await upsert("client_ai_config?on_conflict=client_id", row);
    return res.status(200).json({ success: true });
  }
  return res.status(405).end();
}

async function handleUsage(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const params = new URL(req.url, "http://x").searchParams;
  const clientId = params.get("client_id");
  const from = params.get("from");
  const to   = params.get("to");
  let q = "usage?order=created_at.desc&limit=500&select=*";
  if (clientId) q += `&client_id=eq.${clientId}`;
  if (from)     q += `&created_at=gte.${from}`;
  if (to)       q += `&created_at=lte.${to}`;
  const { data } = await get(q);
  const rows = Array.isArray(data) ? data : [];
  const summary = {};
  rows.forEach(r => {
    if (!summary[r.client_id]) summary[r.client_id] = { client_id: r.client_id, generations: 0, tokens_in: 0, tokens_out: 0 };
    summary[r.client_id].generations++;
    summary[r.client_id].tokens_in  += r.tokens_in  || 0;
    summary[r.client_id].tokens_out += r.tokens_out || 0;
  });
  return res.status(200).json({ usage: rows, summary: Object.values(summary) });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const parts = new URL(req.url, "http://x").pathname.split("/").filter(Boolean);
  const resource = parts[2];

  if (resource === "clients")    return handleClients(req, res);
  if (resource === "users")      return handleUsers(req, res);
  if (resource === "channels")   return handleChannels(req, res);
  if (resource === "post-types") return handlePostTypes(req, res);
  if (resource === "prompts")    return handlePrompts(req, res);
  if (resource === "ai-config")  return handleAiConfig(req, res);
  if (resource === "usage")      return handleUsage(req, res);

  return res.status(404).json({ error: "Unknown admin resource" });
};
