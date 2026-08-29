const { get } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  const clientId = req.query?.c || new URL(req.url, "http://x").searchParams.get("c");
  if (!clientId) return res.status(400).json({ error: "Missing ?c= parameter" });

  const [clientRes, channelsRes, postTypesRes] = await Promise.all([
    get(`clients?client_id=eq.${clientId}&select=*`),
    get(`client_channels?client_id=eq.${clientId}&enabled=eq.true&order=sort_order.asc&select=*`),
    get(`client_post_types?client_id=eq.${clientId}&enabled=eq.true&order=sort_order.asc&select=*`),
  ]);

  const client = Array.isArray(clientRes.data) ? clientRes.data[0] : null;
  if (!client) return res.status(404).json({ error: "Client not found" });
  if (!client.is_active) return res.status(403).json({ error: "Client inactive" });

  return res.status(200).json({
    clientId:     client.client_id,
    clientName:   client.name,
    brandTitle:   client.brand_title,
    tagline:      client.tagline,
    aboutText:    client.about_text,
    logoUrl:      client.logo_url,
    primaryColor: client.primary_color,
    accentColor:  client.accent_color,
    bgColor:      client.bg_color,
    demoMode:     client.demo_mode,
    channels:     Array.isArray(channelsRes.data) ? channelsRes.data.map(ch => ({
      id:          ch.channel_id,
      label:       ch.label,
      short:       ch.short_code,
      color:       ch.color,
      type:        ch.channel_type,
      postUrl:     ch.post_url,
      wordOptions: ch.word_options,
    })) : [],
    postTypes: Array.isArray(postTypesRes.data) ? postTypesRes.data.map(pt => ({
      value:       pt.value,
      label:       pt.label,
      description: pt.description,
    })) : [],
  });
};
