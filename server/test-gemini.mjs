// Diagnostik langsung: panggil Gemini minimal tanpa tools
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const t0 = Date.now();
try {
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    contents: [{ role: 'user', parts: [{ text: 'Jawab satu kata: halo' }] }]
  });
  console.log('latency:', ((Date.now() - t0) / 1000) + 's');
  console.log('text:', (res.text || '').slice(0, 100));
} catch (e) {
  console.log('latency:', ((Date.now() - t0) / 1000) + 's');
  console.log('error name:', e.name);
  console.log('error msg:', String(e.message).slice(0, 300));
}
