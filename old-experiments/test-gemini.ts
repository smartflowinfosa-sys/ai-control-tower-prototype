import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const res = await ai.models.generateContent({
  model: "gemini-3.8-flash", // ???? ?? ????? ?????? ?? AI Studio
  contents: "Say hello in one short sentence",
});

console.log(res.text);
