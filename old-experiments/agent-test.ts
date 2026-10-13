import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const rl = createInterface({ input: process.stdin, output: process.stdout });

const MODEL = "gemini-3.8-flash";
const MAX_STEPS = 8;
const TABLE = "agent_test";

const tools = [
  {
    functionDeclarations: [
      {
        name: "add_note",
        description: "Adds a note to the test table.",
        parameters: {
          type: Type.OBJECT,
          properties: { text: { type: Type.STRING } },
          required: ["text"],
        },
      },
      {
        name: "list_notes",
        description: "Lists the notes in the test table.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "delete_note",
        description: "Deletes one note by its numeric id. Use list_notes first to find the id.",
        parameters: {
          type: Type.OBJECT,
          properties: { id: { type: Type.NUMBER } },
          required: ["id"],
        },
      },
    ],
  },
];

const handlers: Record<string, (a: any) => Promise<unknown>> = {
  add_note: async ({ text }) => {
    const { data, error } = await supabase.from(TABLE).insert({ note: String(text) }).select();
    return error ? { error: error.message } : { inserted: data };
  },
  list_notes: async () => {
    const { data, error } = await supabase.from(TABLE).select("*").order("id").limit(20);
    return error ? { error: error.message } : { rows: data };
  },
  delete_note: async ({ id }) => {
    const answer = await rl.question(`\n>>> Agent wants to DELETE note id ${id}. Allow? (y/n) `);
    if (answer.trim().toLowerCase() !== "y") return { cancelled: true };
    const { data, error } = await supabase.from(TABLE).delete().eq("id", Number(id)).select();
    return error ? { error: error.message } : { deleted_count: data?.length ?? 0, deleted: data };
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
          systemInstruction:
            "You manage a small notes table. Use tools for every action. Report only what tool results show.",
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
    const parts: any[] = [];
    for (const c of calls) {
      console.log(`[step ${step}] tool:`, c.name, c.args);
      let output: unknown;
      try {
        output = (await handlers[c.name!]?.(c.args ?? {})) ?? { error: "Unknown tool" };
      } catch (err: any) {
        output = { error: String(err.message) };
      }
      parts.push({ functionResponse: { id: c.id, name: c.name, response: { output } } });
    }
    contents.push({ role: "user", parts });
  }
  return "Stopped: step limit reached.";
}

const task = process.argv.slice(2).join(" ");
if (!task) {
  console.log("Usage: npx tsx --env-file=.env agent-test.ts \"your task\"");
} else {
  console.log("\nAnswer:", await runAgent(task));
}
rl.close();
