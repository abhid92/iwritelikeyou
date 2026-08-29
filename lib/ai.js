const { get }     = require("./supabase");
const { decrypt } = require("./crypto");

async function getAiConfig(clientId) {
  const { data } = await get(`client_ai_config?client_id=eq.${clientId}&select=provider,api_key_encrypted,model`);
  return Array.isArray(data) ? data[0] : null;
}

async function getPrompt(clientId, key) {
  const { data } = await get(`client_prompts?client_id=eq.${clientId}&key=eq.${key}&select=value`);
  return Array.isArray(data) && data[0] ? data[0].value : "";
}

async function callAI(clientId, userMessage, overrideSystemPrompt) {
  const config = await getAiConfig(clientId);
  if (!config?.api_key_encrypted) throw new Error("AI not configured for this client.");

  const apiKey   = decrypt(config.api_key_encrypted);
  const provider = config.provider || "anthropic";
  const model    = config.model;
  const sysPrompt = overrideSystemPrompt || await getPrompt(clientId, "systemPrompt");

  if (provider === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: model || "claude-sonnet-4-6", max_tokens: 6000, system: sysPrompt, messages: [{ role: "user", content: userMessage }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "Anthropic error");
    return { content: d.content, usage: d.usage, provider, model: d.model };
  }

  if (provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || "gpt-4o", max_tokens: 6000, messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userMessage }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "OpenAI error");
    return {
      content: [{ type: "text", text: d.choices?.[0]?.message?.content || "" }],
      usage: { input_tokens: d.usage?.prompt_tokens, output_tokens: d.usage?.completion_tokens },
      provider, model: d.model,
    };
  }

  if (provider === "gemini") {
    const m = model || "gemini-1.5-pro";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 6000 },
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "Gemini error");
    return {
      content: [{ type: "text", text: d.candidates?.[0]?.content?.parts?.[0]?.text || "" }],
      usage: { input_tokens: d.usageMetadata?.promptTokenCount, output_tokens: d.usageMetadata?.candidatesTokenCount },
      provider, model: m,
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

module.exports = { callAI, getAiConfig, getPrompt };
