import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const tools = [{
  functionDeclarations: [
    {
      name: 'search_ukk_documentation',
      description: 'Mencari dokumentasi.',
      parameters: {
        type: 'OBJECT',
        properties: { query: { type: 'STRING' } },
        required: ['query']
      }
    }
  ]
}];

const t0 = Date.now();
try {
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: 'catalog: cara konfigurasi dstnat port 9090 di mikrotik — pakai tools ya' }] }],
    config: {
      systemInstruction: 'Kamu asisten. Gunakan tools bila perlu.',
      tools,
      temperature: 0.4
    }
  });
  console.log('latency:', ((Date.now() - t0) / 1000) + 's');
  console.log('functionCalls:', JSON.stringify(res.functionCalls, null, 1));
  console.log('text:', (res.text || '').slice(0, 200));
} catch (e) {
  console.log('latency:', ((Date.now() - t0) / 1000) + 's');
  console.log('status:', e.status ?? '(none)');
  console.log('error:', String(e.message).slice(0, 600));
}
