import OpenAI from "openai";
import { logger } from "../lib/logger";

// Workers has no filesystem, so the report route hands us the uploaded
// audio/image bytes directly (ArrayBuffer, from File.arrayBuffer()) instead
// of a tmp-dir file path like the old Express/multer version did.
export interface AudioInput {
  data: ArrayBuffer;
  filename: string;
  mimeType: string;
}

export interface ImageInput {
  data: ArrayBuffer;
  filename: string;
  mimeType: string;
}

function getClient(apiKey: string | undefined): OpenAI {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

// Only Whisper (audio transcription) is left here. Image analysis + report
// structuring moved to a single Gemini call (see gemini-service.ts) — Gemini
// has no first-class audio transcription primitive worth relying on, so
// Whisper stays for that one job.
export async function transcribeAudio(apiKey: string | undefined, audio: AudioInput): Promise<string> {
  const client = getClient(apiKey);
  logger.info({ filename: audio.filename }, "Transcribing audio with Whisper");

  const file = new File([audio.data], audio.filename, { type: audio.mimeType });

  const transcription = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "pt",
  });

  logger.info("Audio transcription complete");
  return transcription.text;
}
