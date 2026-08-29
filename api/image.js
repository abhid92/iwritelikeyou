const { requireClient } = require("../lib/auth");
const { getPrompt }     = require("../lib/ai");
const { getAiConfig }   = require("../lib/ai");
const { decrypt }       = require("../lib/crypto");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const user = requireClient(req, res);
  if (!user) return;

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  const styleGuide = await getPrompt(user.clientId, "imagePrompt") ||
    "Calm wellness setting, soft natural tones, minimal composition, no people, no text, photorealistic.";
  const fullPrompt = `${prompt}. ${styleGuide}`;

  // Try OpenAI DALL-E from client's AI config if provider is openai
  const config = await getAiConfig(user.clientId);
  const openaiKey = config?.provider === "openai" && config?.api_key_encrypted
    ? decrypt(config.api_key_encrypted) : null;

  if (openaiKey) {
    try {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "dall-e-3", prompt: fullPrompt, n: 1, size: "1024x1024", quality: "standard" }),
      });
      const d = await r.json();
      if (r.ok && d.data?.[0]?.url) return res.status(200).json({ url: d.data[0].url, source: "dalle" });
    } catch {}
  }

  // Fallback: Pollinations
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&nologo=true&model=flux&seed=${Date.now()}`;
  return res.status(200).json({ url, source: "pollinations" });
};
