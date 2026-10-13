import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

const MODEL = "gemini-3.8-flash";
const MAX_STEPS = 8;
const ALLOWED_TABLES = ["orders"]; // <-- ?? ??? ????? ??????? ??????? ???????? ???

const tools = [
  {
    functionDeclarations: [
      {
        name: "query_table",
        description: `Reads rows from an allowed table (read-only). Allowed tables: ${ALLOWED_TABLES.join(", ")}`,
        parameters: {
          type: Type.OBJECT,
          properties: {
            table: { type: Type.STRING },
            columns: { type: Type.STRING, description: "Comma separated columns, or * for all" },
            filter_column: { type: Type.STRING },
            filter_value: { type: Type.STRING },
            limit: { type: Type.NUMBER, description: "Max rows, up to 20" },
          },
          required: ["table"],
        },
      },
      {
        name: "count_rows",
        description: "Counts rows in an allowed table, optionally filtered by one column.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            table: { type: Type.STRING },
            filter_column: { type: Type.STRING },
            filter_value: { type: Type.STRING },
          },
          required: ["table"],
        },
      },
    ],
  },
];

const handlers: Record<string, (a: any) => Promise<unknown>> = {
  query_table: async (a) => {
    if (!ALLOWED_TABLES.includes(a.table)) return { error: "Table not allowed" };
    let q = supabase.from(a.table).select(a.columns || "*");
    if (a.filter_column && a.filter_value !== undefined)
      q = q.eq(a.filter_column, a.filter_value);
    const { data, error } = await q.limit(Math.min(Number(a.limit) || 10, 20));
    return error ? { error: error.message } : { rows: data };
  },
  count_rows: async (a) => {
    if (!ALLOWED_TABLES.includes(a.table)) return { error: "Table not allowed" };
    let q = supabase.from(a.table).select("*", { count: "exact", head: true });
    if (a.filter_column && a.filter_value !== undefined)
      q = q.eq(a.filter_column, a.filter_value);
    const { count, error } = await q;
    return error ? { error: error.message } : { count };
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
            "You are a data assistant. Answer only from tool results. If data is missing, say so. Never invent numbers.",
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
    const parts = await Promise.all(
      calls.map(async (c) => {
        console.log(`[step ${step}] tool:`, c.name, c.args);
        let output: unknown;
        try {
          output = (await handlers[c.name!]?.(c.args ?? {})) ?? { error: "Unknown tool" };
        } catch (err: any) {
          output = { error: String(err.message) };
        }
        return { functionResponse: { id: c.id, name: c.name, response: { output } } };
      })
    );
    contents.push({ role: "user", parts });
  }
  return "Stopped: step limit reached.";
}

const task = process.argv.slice(2).join(" ") || "How many rows are in the orders table?";
console.log("\nAnswer:", await runAgent(task));
