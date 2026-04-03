require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const key = process.env.GEMINI_API_KEY;
if (!key) { console.log('ERROR: No GEMINI_API_KEY found in .env file!'); process.exit(1); }

console.log('Testing key:', key.slice(0, 10) + '...');

const models = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.0-pro',
];

async function test() {
  const genAI = new GoogleGenerativeAI(key);
  for (const name of models) {
    try {
      const model = genAI.getGenerativeModel({ model: name });
      const result = await model.generateContent('Say OK');
      console.log(`✅ WORKS: ${name} → "${result.response.text().trim()}"`);
    } catch(e) {
      const msg = e.message?.includes('429') ? '429 quota' :
                  e.message?.includes('404') ? '404 not found' :
                  e.message?.includes('400') ? '400 bad request' :
                  e.message?.slice(0, 60);
      console.log(`❌ FAIL:  ${name} → ${msg}`);
    }
  }
}

test().then(() => process.exit(0));
