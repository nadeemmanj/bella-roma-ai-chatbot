# 🍝 Bella Roma — Demo Restaurant Agent

Yeh tumhara **pehla REAL agent** hai! Is mein wohi cheezein hain jo tum ne course mein seekhi:
- **Step 2 (Loop):** `server.js` mein `for` loop — dekho → socho → karo → check ↻
- **Step 3 (Tools):** `get_menu`, `get_restaurant_info`, `book_table`
- **Step 4 (Memory):** `sessions` — har visitor ki baat yaad rakhta hai
- **"Training":** `SYSTEM_PROMPT` — agent ka behavior yahin se tay hota hai

## Chalane ka tareeqa (Windows PowerShell)

```powershell
cd bella-roma-demo
npm install
# .env.example ko copy kar ke ".env" banao, us mein apni Gemini API key dalo
# (key: https://aistudio.google.com → "Get API Key" — FREE hai)
node server.js
```

Phir browser mein kholo: **http://localhost:3000**

## Test karo (yeh "testing" hai!)

1. "Show me the menu" → menu aana chahiye (tool: get_menu)
2. "What are your opening hours?" → timing (tool: get_restaurant_info)
3. "I want to book a table" → agent naam/date/time/guests puchega, phir book karega (tool: book_table) → reference number milega
4. "Who is the president of France?" → agent mana karega (sirf restaurant ki baat!)
5. Bookings dekho: http://localhost:3000/api/bookings

## Client ko pitch mein kaise dikhana hai

1. Apne PC par `node server.js` chalao
2. Client ko screen share par http://localhost:3000 dikhao (ya apne phone par kholo)
3. Kaho: *"Dekho — aapke customers aise sawal puchenge, aur yeh agent khud jawab dega, table bhi book karega. Aapki website par bilkul aise lagega."*


## Zaroori baatein

- `.env` file **kabhi GitHub par mat dalna** — API key leak ho jayegi!
- Yeh **demo** hai: bookings sirf memory mein rehti hain (server restart = sab gaya). Real client ke liye bookings uske email/database mein jayengi — woh Phase 2 hai.
- Data chhota hai is liye **RAG nahi** lagaya (yaad hai Step 3 wali baat? 😉)
