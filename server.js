// server.js — "Bella Roma" demo restaurant agent
// Course mapping: Step 2 (loop) + Step 3 (tools) ka asal code!
// Run:  npm install  →  node server.js  →  open http://localhost:3000
// v2: Vercel deploy ke liye — app export + guarded listen.
//     Local par (npm start) koi farq nahi — wese hi chalega jese pehle.

import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
app.use(express.json());
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------
// FAKE restaurant data (DEMO ONLY) — real client ke liye yahan
// uska menu / timing / address likhna hai.
// ---------------------------------------------------------------
const RESTAURANT = {
  name: 'Bella Roma',
  address: 'Hauptstraße 12, 10827 Berlin (demo address)',
  phone: '+49 30 12345678',
  hours: 'Mon–Fri 12:00–22:00, Sat–Sun 13:00–23:00',
  menu: [
    ['Margherita Pizza', '€9.50'],
    ['Pepperoni Pizza', '€11.00'],
    ['Quattro Formaggi Pizza', '€12.50'],
    ['Lasagna della Casa', '€13.00'],
    ['Spaghetti Carbonara', '€12.00'],
    ['Tiramisu', '€6.00'],
    ['Panna Cotta', '€5.50'],
    ['Espresso', '€3.00'],
    ['Fresh Lemonade', '€4.00'],
  ],
};

// ---------------------------------------------------------------
// TOOLS — agent ke "haath" (Step 3). Har tool aik simple JS function.
// ---------------------------------------------------------------
const bookings = []; // demo ke liye memory mein; real client mein database/email

function get_menu() {
  return 'MENU — Bella Roma:\n' +
    RESTAURANT.menu.map(([item, price]) => `- ${item}: ${price}`).join('\n');
}

function get_restaurant_info() {
  return `${RESTAURANT.name}\nAddress: ${RESTAURANT.address}\nPhone: ${RESTAURANT.phone}\nHours: ${RESTAURANT.hours}`;
}

function book_table({ name, date, time, guests }) {
  const missing = [];
  if (!name) missing.push('name');
  if (!date) missing.push('date');
  if (!time) missing.push('time');
  if (!guests) missing.push('number of guests');
  if (missing.length > 0) {
    return `Cannot book yet — still need: ${missing.join(', ')}. Ask the customer for these, one by one, politely.`;
  }
  const ref = 'BR-' + Math.floor(1000 + Math.random() * 9000);
  bookings.push({ ref, name, date, time, guests });
  return `Table booked! Reference: ${ref} — ${guests} guest(s), ${date} at ${time}, under the name "${name}". Tell the customer their reference number.`;
}

const TOOLS = { get_menu, get_restaurant_info, book_table };

// Gemini ko batate hain ke tools kaise dikhte hain (function declarations)
const functionDeclarations = [
  {
    name: 'get_menu',
    description: 'Get the full restaurant menu with prices. Use when the customer asks about food, dishes, menu or prices.',
  },
  {
    name: 'get_restaurant_info',
    description: 'Get address, phone number and opening hours. Use for location/hours/contact questions.',
  },
  {
    name: 'book_table',
    description: 'Book a table. You MUST have all four: name, date, time, number of guests. If anything is missing, ask the customer first — do NOT call with missing info.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Customer full name' },
        date: { type: Type.STRING, description: 'Date like 2026-11-02' },
        time: { type: Type.STRING, description: 'Time like 19:30' },
        guests: { type: Type.STRING, description: 'Number of guests, e.g. 4' },
      },
      required: ['name', 'date', 'time', 'guests'],
    },
  },
];

// ---------------------------------------------------------------
// SYSTEM PROMPT — agent ki "training" ka sab se bara hissa.
// Yahi woh jagah hai jahan agent ka behavior tay hota hai.
// ---------------------------------------------------------------
const SYSTEM_PROMPT = `You are "Roma", the friendly AI assistant of Bella Roma, an Italian restaurant in Berlin.
Today's date is ${new Date().toISOString().slice(0, 10)}.

RULES (follow strictly):
1. Answer ONLY about the restaurant: menu, prices, hours, location, reservations.
2. If asked anything else, politely say you can only help with restaurant matters.
3. NEVER invent menu items or prices — always use the get_menu tool.
4. For reservations: collect name, date, time and number of guests FIRST (ask politely for whatever is missing), THEN call book_table.
5. Keep answers short, warm and friendly (2-4 lines). This is a demo for a restaurant owner.`;

// ---------------------------------------------------------------
// Agent setup
// ---------------------------------------------------------------
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sessions = {}; // sessionId -> chat history (short-term memory, Step 4!)

app.post('/api/chat', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY missing! Put it in the .env file.' });
    }
    const { sessionId, message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    if (!sessions[sessionId]) sessions[sessionId] = [];
    const history = sessions[sessionId];
    history.push({ role: 'user', parts: [{ text: message }] });

    // ===== THE AGENT LOOP (Step 2): dekho → socho → karo → check ↻ =====
    let reply = '';
    for (let round = 0; round < 5; round++) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: history,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations }],
        },
      });

      const calls = response.functionCalls;
      if (calls && calls.length > 0) {
        // Model wants tools → run them, feed results back, loop again
        //
        // IMPORTANT (official docs: ai.google.dev "thought signatures"):
        // Model ka ASAL content wapas bhejo — is mein thought_signature hota hai.
        // Khud se functionCall dobara banana MANA hai, API reject kar deti hai.
        const modelContent = response.candidates?.[0]?.content;
        if (modelContent) {
          history.push(modelContent);
        } else {
          history.push({ role: 'model', parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args || {} } })) });
        }
        const responseParts = [];
        for (const call of calls) {
          const fn = TOOLS[call.name];
          let result;
          try {
            result = fn ? fn(call.args || {}) : `Unknown tool: ${call.name}`;
          } catch (e) {
            result = `Tool error: ${e.message}`;
          }
          responseParts.push({
            functionResponse: { name: call.name, response: { result: String(result) } },
          });
        }
        // Nayi Gemini API mein function ka jawab 'user' role mein bhejna hota hai
        // ('function' role purani API ka tha — ab hata diya gaya hai)
        history.push({ role: 'user', parts: responseParts });
        continue;
      }

      // No tool needed → final answer
      reply = response.text || '(no reply)';
      history.push({ role: 'model', parts: [{ text: reply }] });
      break;
    }

    res.json({ reply });
  } catch (err) {
    // 429 = free daily quota finished. Client demo mein kachra JSON nahi,
    // saaf message dikhao taake professional lage.
    let msg = err.message || 'Something went wrong';
    if (/429|quota|rate.?limit/i.test(msg)) {
      msg = 'Daily free demo limit reached. Please try again tomorrow.';
    }
    res.status(500).json({ error: msg });
  }
});

app.get('/api/bookings', (req, res) => res.json(bookings)); // demo: sab bookings dekho

export default app;

// Local par (npm start) server wese hi chalega jese pehle.
// Vercel par (VERCEL=1) listen nahi karte — Vercel khud function chalata hai.
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🍝 Bella Roma demo agent running: http://localhost:${PORT}`);
  });
}
