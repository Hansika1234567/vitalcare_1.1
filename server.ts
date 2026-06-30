import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Initialize Gemini AI client lazily to avoid crashing if API key is missing
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient() {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not set. AI features will use fallback mock responses.");
        return null;
      }
      aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
  }

  // API Route: Health assistant chat proxy
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages body. Expected an array." });
      }

      const client = getGeminiClient();
      if (!client) {
        return res.json({
          text: "I am VitalCare's AI Companion. I'm currently running in demo mode, but I can tell you that keeping a steady heart rate and staying hydrated is great for your overall health! Always consult a professional doctor for medical issues.",
          isFallback: true
        });
      }

      // Format messages into Content objects for Gemini API
      // Let's filter out system instructions if any, and set them as the systemInstruction parameter
      const formattedContents = messages.map((m: any) => {
        const parts: any[] = [{ text: m.content || "Analyze the attached file." }];
        if (m.attachment && m.attachment.mimeType && m.attachment.data) {
          parts.push({
            inlineData: {
              mimeType: m.attachment.mimeType,
              data: m.attachment.data
            }
          });
        }
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts
        };
      });

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction: "You are the VitalCare Health Assistant. Your goal is to explain health concepts in simple, clear, and plain language suitable for people with little or no formal education. You must use warm, reassuring tones, keep sentences short and easy to understand, and never use dense medical jargon without explaining it simply first. CRITICAL: You are NOT a doctor and cannot diagnose illnesses or prescribe treatments. Always include a disclaimer that this is general information, not a medical diagnosis.",
          temperature: 0.7,
        }
      });

      const responseText = response.text || "I apologize, but I couldn't generate a response. Please check your vitals and try again.";
      res.json({ text: responseText });
    } catch (error: any) {
      const isTransientOrQuotaError = error?.status === "RESOURCE_EXHAUSTED" || 
                                     error?.status === "UNAVAILABLE" ||
                                     error?.code === 429 || 
                                     error?.code === 503 ||
                                     error?.message?.includes("quota") || 
                                     error?.message?.includes("limit") ||
                                     error?.message?.includes("exhausted") ||
                                     error?.message?.includes("demand") ||
                                     error?.message?.includes("unavailable") ||
                                     error?.message?.includes("temporary");

      if (isTransientOrQuotaError) {
        console.warn("Gemini Chat API: Quota/Rate Limit/Temporary Service issue. Using smart offline fallback. Details:", error?.message || error);
      } else {
        console.warn("Gemini Chat API Warning (caught & handled):", error?.message || error);
      }

      // Generate a context-aware smart fallback response based on user keywords
      const lastUserMsg = (req.body.messages || [])
        .slice()
        .reverse()
        .find((m: any) => m.role === "user")?.content?.toLowerCase() || "";

      let fallbackText = "I am VitalCare's AI Companion. The assistant is currently in light offline mode, but remember: drinking water, eating fresh vegetables, and getting daily rest is excellent for your wellness! If you are feeling unwell, don't hesitate to reach out to your caretaker or tap the Emergency Card.";

      if (lastUserMsg.includes("sugar") || lastUserMsg.includes("diabet") || lastUserMsg.includes("glucose")) {
        fallbackText = "As your VitalCare Assistant (Offline mode), keeping a check on your sugar levels is super important! Eating fiber-rich food and staying active helps manage diabetes. Remember to discuss your recent levels with your doctor.";
      } else if (lastUserMsg.includes("pressure") || lastUserMsg.includes("bp") || lastUserMsg.includes("hypertension")) {
        fallbackText = "As your VitalCare Assistant (Offline mode), we want to make sure your heart is happy! Reducing salty food, breathing deeply, and getting gentle rest can help lower blood pressure. Please consult your physician.";
      } else if (lastUserMsg.includes("oxygen") || lastUserMsg.includes("pulse") || lastUserMsg.includes("o2")) {
        fallbackText = "As your VitalCare Assistant (Offline mode), normal oxygen levels are usually above 95%. Taking slow, deep breaths in a well-ventilated space is helpful. Let us know immediately if you feel breathless.";
      } else if (lastUserMsg.includes("temp") || lastUserMsg.includes("fever") || lastUserMsg.includes("warm")) {
        fallbackText = "As your VitalCare Assistant (Offline mode), body temperatures around 98.6°F are standard. If you have a mild fever, drink lots of water, rest, and keep the room cool. If it stays high, reach out to your doctor.";
      }

      res.json({
        text: fallbackText,
        isFallback: true
      });
    }
  });

  // API Route: AI Health Insights proxy
  app.post("/api/gemini/insights", async (req, res) => {
    const language = req.body?.language || "en";
    const defaultFallbackText = {
      en: "Your vitals look steady! Keep monitoring them daily and make sure to take any prescribed medicines on time.",
      hi: "आपके स्वास्थ्य संकेत सामान्य हैं! प्रतिदिन जाँच करें और समय पर दवाइयाँ लें।",
      te: "మీ ఆరోగ్య సంకేతాలు నిలకడగా ఉన్నాయి! ప్రతిరోజూ పర్యవేక్షించండి మరియు మందులు సమయానికి తీసుకోండి."
    };
    const fallbackText = (defaultFallbackText as any)[language] || defaultFallbackText.en;

    try {
      const { vitals } = req.body;
      const client = getGeminiClient();

      if (!client) {
        return res.json({ text: fallbackText, isFallback: true });
      }

      const prompt = `Analyze these recent vitals and provide a short, simple health trend summary.
Vitals: ${JSON.stringify(vitals)}
Language: ${language}
Instructions:
- Summarize trends in 2-3 extremely simple, encouraging sentences.
- Avoid any medical jargon. Use words a young child or someone with no reading education would understand when read aloud.
- Use friendly, positive tone.
- Tell them if they are safe, or if they should rest or reach out to their doctor.
- Output ONLY the translated content in the requested language (${language}).`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.3,
        }
      });

      res.json({ text: response.text || fallbackText });
    } catch (error: any) {
      const isTransientOrQuotaError = error?.status === "RESOURCE_EXHAUSTED" || 
                                     error?.status === "UNAVAILABLE" ||
                                     error?.code === 429 || 
                                     error?.code === 503 ||
                                     error?.message?.includes("quota") || 
                                     error?.message?.includes("limit") ||
                                     error?.message?.includes("exhausted") ||
                                     error?.message?.includes("demand") ||
                                     error?.message?.includes("unavailable") ||
                                     error?.message?.includes("temporary");

      if (isTransientOrQuotaError) {
        console.warn("Gemini Insights API: Quota/Rate Limit/Temporary Service issue. Using static translated fallback. Details:", error?.message || error);
      } else {
        console.warn("Gemini Insights API Warning (caught & handled):", error?.message || error);
      }

      res.json({
        text: fallbackText,
        isFallback: true
      });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VitalCare Express server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
