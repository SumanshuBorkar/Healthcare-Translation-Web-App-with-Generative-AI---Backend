// server.js - Optimized for CORS and Groq API
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Groq = require("groq-sdk");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. INITIALIZE GROQ
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// 2. CORS MIDDLEWARE (MUST BE FIRST)
// Using a function to dynamically allow the origin hitting the server
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      // or specific localhost origins
      if (
        !origin ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  })
);

// 3. SECURITY HEADERS (RECONFIGURED)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Disable for dev to prevent script blocks
  })
);

// 4. DATA PARSING
app.use(express.json());

// 5. RATE LIMITING (APPLIED AFTER CORS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// --- ROUTES ---

const languageNames = {
  "en-US": "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
};

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", groqApiConfigured: !!process.env.GROQ_API_KEY });
});

// Translation Endpoint
app.post("/api/translate", async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;

    if (!text || !sourceLang || !targetLang) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const sourceLanguage = languageNames[sourceLang] || sourceLang;
    const targetLanguage = languageNames[targetLang] || targetLang;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a professional medical translator. Translate from ${sourceLanguage} to ${targetLanguage}. Return ONLY the translation.`,
        },
        { role: "user", content: text },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
    });

    const translatedText = chatCompletion.choices[0]?.message?.content?.trim();

    res.json({
      translatedText,
      sourceLang,
      targetLang,
      model: chatCompletion.model,
      usage: chatCompletion.usage,
    });
  } catch (error) {
    console.error("API Error:", error.message);
    res
      .status(500)
      .json({ error: "Translation failed", details: error.message });
  }
});

// Models List
app.get("/api/models", async (req, res) => {
  try {
    const models = await groq.models.list();
    res.json({ models: models.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    res.status(403).json({ error: "CORS Error: Origin not allowed" });
  } else {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server ready at http://localhost:${PORT}`);
  console.log(`👉 CORS configured for localhost:5173\n`);
});
