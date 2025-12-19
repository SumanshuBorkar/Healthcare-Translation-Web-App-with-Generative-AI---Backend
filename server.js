const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Groq = require("groq-sdk");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});



const allowedOrigins = [
  "http://localhost:5173",
  "https://healthcare-translation-web-app-with-six.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

app.options("/api/*", cors());

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

app.use(express.json());


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);



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

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", groqApiConfigured: !!process.env.GROQ_API_KEY });
});

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

app.get("/api/models", async (req, res) => {
  try {
    const models = await groq.models.list();
    res.json({ models: models.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`\n🚀 Server ready at http://localhost:${PORT}`);
  console.log(`👉 CORS configured for localhost:5173\n`);
});
