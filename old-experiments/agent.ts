import { GoogleGenAI, Type } from "@google/genai";
import { readFileSync } from "node:fs";
import { resolve, relative } from "node:path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.8-flash";
const MAX_STEPS = 8;

const tools = [
  {
    functionDeclarations: [
      {
        name: "get_current_time",
        description: "Returns the current date and time in ISO format.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "read_text_file",
        description: "Reads a text file inside the project folder.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: "Relative path, e.g. package.json" },
          },
          required: ["path"],
        },
      },
    ],
  },
];

const handlers: Record<string, (args: any) => unknown> = {
  get_current_time: () => ({ now: new Date().toISOString() }),
  read_text_file: ({ path }) => {
    const full = resolve(process.cwd(), String(path));
    const rel = relative(process.cwd(), full);
    const blocked =
      rel.startsWith("..") || rel.split(/[\\/]/).some((p) => p.startsWith(".env"));
    if (blocked) return { error: "Access denied" };
    return { content: readFileSync(full, "utf8").slice(0, 5000) };
  },
};

async function callModel(contents: any[]) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          tools,
          systemInstruction: "You are a helpful assistant. Use tools when needed.",
        },
      });
    } catch (e: any) {
      const retryable = e?.status === 503 || e?.status === 429;
      if (!retryable || attempt === 5) throw e;
      const wait = 2000 * 2 ** (attempt - 1);
      console.log(`Model busy, retry ${attempt} in ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

async function runAgent(task: string) {
  const contents: any[] = [{ role: "user", parts: [{ text: task }] }];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const res = await callModel(contents);
    const calls = res.functionCalls ?? [];
    if (calls.length === 0) return res.text;

    contents.push(res.candidates![0].content);

    const parts = calls.map((c) => {
      console.log(`[step ${step}] tool:`, c.name, c.args);
      let output: unknown;
      try {
        output = handlers[c.name!]?.(c.args ?? {}) ?? { error: "Unknown tool" };
      } catch (err: any) {
        output = { error: String(err.message) };
      }
      return { functionResponse: { id: c.id, name: c.name, response: { output } } };
    });
    contents.push({ role: "user", parts });
  }
  return "Stopped: step limit reached.";
}

const task =
  process.argv.slice(2).join(" ") ||
  "What time is it now, and what is the project name in package.json?";
console.log("\nAnswer:", await runAgent(task));
