import { NextResponse, type NextRequest } from "next/server";
import { runChat, type ChatEvent, type ChatTurn } from "@/lib/ai/chat";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Ask page posts the conversation so far; the reply streams back as
// newline-delimited JSON, one ChatEvent per line.

const MAX_TURNS = 16;
const MAX_CHARS = 2000;

function readTurns(body: unknown): ChatTurn[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const turns: ChatTurn[] = [];
  for (const item of raw.slice(-MAX_TURNS)) {
    const role = (item as { role?: unknown })?.role;
    const content = (item as { content?: unknown })?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim().slice(0, MAX_CHARS);
    if (!text) continue;
    turns.push({ role, content: text });
  }
  // The API needs the conversation to open with the person and end with them.
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return null;
  return turns;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";
  if (rateLimited(`chat:${ip}`, { limit: 30, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json(
      { error: "You've asked a lot in the last few minutes. Give it a short break and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const turns = readTurns(body);
  if (!turns) {
    return NextResponse.json({ error: "Send a messages array ending with a user message." }, { status: 400 });
  }

  const events = runChat(turns);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of events) send(event);
      } catch (err) {
        if (req.signal.aborted) return;
        console.error("chat failed:", err);
        send({ type: "error", message: "Something went wrong while answering. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

