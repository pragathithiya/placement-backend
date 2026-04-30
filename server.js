const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { Groq } = require('groq-sdk');
const { getDb } = require('./db');
const { appendToSheet } = require('./googleSheets');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Welcome Route
app.get('/', (req, res) => {
  res.send('🚀 Placement AI Backend is running successfully!');
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// MULTER CONFIG

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`)
});
const upload = multer({ storage });

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_INSTRUCTIONS = `Analyze this Job Description or Visiting Card and return data ONLY in this JSON format:
{
  "company_name": "string",
  "job_role": "string",
  "location": "string",
  "duration": "string",
  "stipend": "string",
  "salary": "string",
  "mode": "On-site" | "Remote" | "Hybrid" | "Work from Home",
  "benefits": "string",
  "skills": "string",
  "hr_name": "string",
  "hr_phone": "string",
  "experience": "string",
  "qualification": "string"
}

CRITICAL RULES:
1. If you see "Manvin" OR if it mentions "Full Stack Developer" without a company name, you MUST use these exact values:
   - company_name: "Manvin"
   - job_role: "Full Stack Developer"
   - duration: "6 Months"
   - stipend: "Unpaid"
   - mode: "Hybrid"

2. For any other case, extract the actual values. For "mode", map it to one of: "On-site", "Remote", "Hybrid", or "Work from Home".
3. For Visiting Cards, map the person's name to "hr_name" and their phone to "hr_phone".
4. Return ONLY the JSON object. No conversation.`;

const CARD_SYSTEM_INSTRUCTIONS = `Analyze this Registration Card or Visiting Card and return data ONLY in this JSON format:
{
  "name": "string",
  "designation": "string",
  "company_name": "string",
  "email": "string",
  "phone": "string",
  "website": "string",
  "address": "string",
  "card_type": "Registration" | "Visiting"
}

CRITICAL RULES:
1. Extract the person's name, their designation/role, and the company they represent.
2. Ensure phone and email are captured accurately.
3. Determine if it is a "Registration" card or a "Visiting" card.
4. Return ONLY the JSON object. No conversation.`;

// --- ROUTES ---

// 1. Analyze Placement (Image or Text)
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const rawText = req.body.text;

    if (!file && !rawText) {
      return res.status(400).json({ error: "No file or text provided" });
    }

    const id = uuidv4();
    let imagePath = "";
    let analyzeContent = [];

    if (file) {
      const buffer = fs.readFileSync(file.path);
      imagePath = `/uploads/${file.filename}`;
      analyzeContent = [
        { type: "text", text: SYSTEM_INSTRUCTIONS },
        {
          type: "image_url",
          image_url: { url: `data:${file.mimetype};base64,${buffer.toString("base64")}` },
        },
      ];
    } else {
      analyzeContent = [
        { type: "text", text: `${SYSTEM_INSTRUCTIONS}\n\nAnalyze this text:\n${rawText}` }
      ];
    }

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: analyzeContent }],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    let content = completion.choices[0]?.message?.content || "{}";
    content = content.replace(/```json\n?|```/g, "").trim();
    const extraction = JSON.parse(content);
    const companyName = extraction.company_name || extraction.company || "Unknown";

    const db = getDb();
    await db.prepare(`
      INSERT INTO placements (id, image_path, company_name, extracted_data)
      VALUES ($1, $2, $3, $4)
    `).run([id, imagePath, companyName, JSON.stringify(extraction)]);

    // Append to Google Sheets
    await appendToSheet(extraction, 'placement');

    res.json({ id, companyName, extraction, imagePath, sheetUrl: process.env.SHEET_VIEW_URL });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 1.1 Analyze Card (Registration or Visiting Card)
app.post('/api/analyze-card', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const rawText = req.body.text;

    if (!file && !rawText) {
      return res.status(400).json({ error: "No card image or text provided" });
    }

    const id = uuidv4();
    let imagePath = "";
    let analyzeContent = [];

    if (file) {
      const buffer = fs.readFileSync(file.path);
      imagePath = `/uploads/${file.filename}`;
      analyzeContent = [
        { type: "text", text: CARD_SYSTEM_INSTRUCTIONS },
        {
          type: "image_url",
          image_url: { url: `data:${file.mimetype};base64,${buffer.toString("base64")}` },
        },
      ];
    } else {
      analyzeContent = [
        { type: "text", text: `${CARD_SYSTEM_INSTRUCTIONS}\n\nAnalyze this card text:\n${rawText}` }
      ];
    }

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: analyzeContent }],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    let content = completion.choices[0]?.message?.content || "{}";
    content = content.replace(/```json\n?|```/g, "").trim();
    const extraction = JSON.parse(content);

    // Append to Google Sheets (Cards Sheet)
    console.log("Extraction complete, sending to Google Sheets...");
    await appendToSheet(extraction, 'card');

    res.json({ 
      id, 
      extraction, 
      imagePath, 
      sheetUrl: process.env.SHEET_CARDS_VIEW_URL 
    });
  } catch (error) {
    console.error("Card Analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Fetch History
app.get('/api/placements', async (req, res) => {
  try {
    const db = getDb();
    const placements = await db.prepare("SELECT * FROM placements ORDER BY created_at DESC").all();
    res.json(placements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Create Manual Placement
app.post('/api/placements', async (req, res) => {
  try {
    const { id, company_name, extraction } = req.body;
    const db = getDb();
    await db.prepare(`
      INSERT INTO placements (id, image_path, company_name, extracted_data)
      VALUES ($1, $2, $3, $4)
    `).run([id, "", company_name, JSON.stringify(extraction)]);

    // Sync to Google Sheets for Manual Input
    await appendToSheet(extraction, 'placement');

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get Single Placement
app.get('/api/placements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const placement = await db.prepare("SELECT * FROM placements WHERE id = $1").get([id]);
    if (!placement) return res.status(404).json({ error: "Not found" });
    res.json({ placement });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Update Placement
app.patch('/api/placements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, extraction } = req.body;
    const db = getDb();
    await db.prepare(`
      UPDATE placements SET company_name = $1, extracted_data = $2 WHERE id = $3
    `).run([company_name, JSON.stringify(extraction), id]);

    // Sync to Google Sheets for Updates (Appends as a new record)
    await appendToSheet(extraction, 'placement');

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Chat Assistant
app.post('/api/chat', async (req, res) => {
  try {
    const { placementId, message } = req.body;
    const db = getDb();
    let context = "";
    if (placementId) {
      const placement = await db.prepare("SELECT extracted_data FROM placements WHERE id = $1").get([placementId]);
      if (placement) context = `Context: ${placement.extracted_data}\n\n`;
    }

    const historyData = await db.prepare("SELECT role, content FROM messages WHERE placement_id = $1 ORDER BY created_at ASC").all([placementId]);
    const messages = [
      { role: "system", content: `${context}Instructions: Answer professionaly and concisely.` },
      ...historyData.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.3,
    });

    const reply = completion.choices[0]?.message?.content || "Error";
    await db.prepare("INSERT INTO messages (id, placement_id, role, content) VALUES ($1, $2, $3, $4)").run([uuidv4(), placementId, "user", message]);
    await db.prepare("INSERT INTO messages (id, placement_id, role, content) VALUES ($1, $2, $3, $4)").run([uuidv4(), placementId, "assistant", reply]);

    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});

// Restart trigger
