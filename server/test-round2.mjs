import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 90000 } });
const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const tools = [{
  functionDeclarations: [
    { name: 'search_ukk_documentation', description: 'Mencari dokumentasi.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } }
  ]
}];
const sys = 'Kamu pembimbing. Gunakan tools. Singkat.';
const q = 'Di bagian mana cara dstnat port 9090 di mikrotik?';

try {
  // Round 1
  const r1 = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: q }] }],
    config: { systemInstruction: sys, tools, temperature: 0.4, maxOutputTokens: 4096 }
  });
  const calls = r1.functionCalls || [];
  console.log('round1 calls:', calls.length, calls[0] && calls[0].name);

  // Round 2: kirim kembali functionCall + functionResponse (bentuk server)
  const contents = [
    { role: 'user', parts: [{ text: q }] },
    { role: 'model', parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args } })) },
    { role: 'user', parts: calls.map((c) => ({ functionResponse: { name: c.name, response: { result: { results: [{ step: 'contoh step dstnat', anchor: 'sub-2-3' }] } } } })) },
    { role: 'user', parts: [{ text: 'Jawab sekarang berdasarkan hasil tools.' }] }
  ];
  const r2 = await ai.models.generateContent({
    model,
    contents,
    config: { systemInstruction: sys, tools, temperature: 0.4, maxOutputTokens: 4096 }
  });
  console.log('round2 OK calls:', (r2.functionCalls||[]).length, 'finishReason:', r2.candidates?.[0]?.finishReason, 'usage:', JSON.stringify(r2.usageMetadata||{}));
  console.log('round2 text:', JSON.stringify((r2.text||'').slice(0, 200)));
} catch (e) {
  console.log('ERR status:', e.status ?? '(none)');
  console.log('ERR msg:', String(e.message).slice(0, 900));
}
