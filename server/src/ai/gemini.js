const fetch = require('node-fetch');

// Free-tier model at Google AI Studio (https://ai.google.dev) — override via
// GEMINI_MODEL if the free-tier model name/quota changes on Google's side.
// Verified working with real free-tier quota as of this writing:
// gemini-2.5-flash, gemini-2.5-flash-lite, gemini-flash-latest.
// gemini-2.0-flash returned 0 quota on this project — do not use it.
const DEFAULT_MODEL = 'gemini-2.5-flash';

function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function generateReply(systemPrompt, history) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: history.map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text) {
    throw new Error('Gemini API returned no text (possibly blocked by safety filters)');
  }
  return text;
}

module.exports = { isConfigured, generateReply };
