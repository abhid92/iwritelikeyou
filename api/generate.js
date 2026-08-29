const { requireClient } = require("../lib/auth");
const { callAI }        = require("../lib/ai");
const { post }          = require("../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const user = requireClient(req, res);
  if (!user) return;

  const { userMessage } = req.body || {};
  if (!userMessage) return res.status(400).json({ error: "userMessage required" });

  try {
    const result = await callAI(user.clientId, userMessage);

    // Log usage
    await post("usage", {
      client_id:     user.clientId,
      username:      user.username,
      theme_preview: userMessage.slice(0, 200),
      channels_used: (userMessage.match(/Generate content for: (.+)/)?.[1] || "").split(", ").filter(Boolean),
      provider:      result.provider,
      model:         result.model,
      tokens_in:     result.usage?.input_tokens  || 0,
      tokens_out:    result.usage?.output_tokens || 0,
    });

    return res.status(200).json({ content: result.content });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
