// Synthesizes Arabic speech with OpenAI TTS for synthetic test fixtures.
// Usage: node scripts/tts.mjs <out.mp3> "<text>"   (reads OPENAI_API_KEY from backend env files)
import fs from "node:fs";
const [out, text] = process.argv.slice(2);
const env = Object.fromEntries(
  ["backend/supabase/functions/.env", "backend/.env"].filter((f) => fs.existsSync(f)).flatMap((f) =>
    fs.readFileSync(f, "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  ),
);
const res = await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "alloy", input: text, response_format: "mp3" }),
});
if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
console.log("wrote", out);
