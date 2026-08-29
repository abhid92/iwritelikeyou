const { requireAdmin } = require("../../lib/auth");
const { get, upsert }  = require("../../lib/supabase");
const { encrypt, decrypt } = require("../../lib/crypto");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const params   = new URL(req.url, "http://x").searchParams;
  const clientId = params.get("client_id") || (req.body || {}).client_id;
  if (!clientId) return res.status(400).json({ error: "client_id required" });

  if (req.method === "GET") {
    const { data } = await get(`client_ai_config?client_id=eq.${clientId}&select=provider,model,api_key_encrypted,updated_at`);
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return res.status(200).json({ provider: "anthropic", model: "", apiKeySet: false });
    return res.status(200).json({
      provider:  row.provider,
      model:     row.model,
      apiKeySet: !!row.api_key_encrypted,
      updatedAt: row.updated_at,
    });
  }

  if (req.method === "PUT") {
    const { provider, model, apiKey } = req.body || {};
    const row = { client_id: clientId, updated_at: new Date().toISOString() };
    if (provider) row.provider = provider;
    if (model)    row.model    = model;
    if (apiKey)   row.api_key_encrypted = encrypt(apiKey);
    await upsert("client_ai_config?on_conflict=client_id", row);
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
