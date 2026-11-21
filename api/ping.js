const { get } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  await get("client_prompts?limit=1&select=client_id");
  return res.status(200).json({ ok: true, ts: new Date().toISOString() });
};
