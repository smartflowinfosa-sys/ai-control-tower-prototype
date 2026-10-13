import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const res = await client.chat.completions.create({
  model: "deepseek-chat",
  messages: [{ role: "user", content: "Say hello in one short sentence" }],
});

console.log(res.choices[0].message.content);
