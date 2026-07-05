// Транскрибация голосовых сообщений через OpenAI Whisper API.
// Node 18+ имеет глобальные fetch/FormData/Blob — доп. зависимостей не нужно.

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function transcribe(buffer, filename = 'voice.oga') {
  const form = new FormData();
  form.append('file', new Blob([buffer]), filename);
  form.append('model', 'whisper-1');
  form.append('language', 'ru');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.text;
}

module.exports = { isConfigured, transcribe };
