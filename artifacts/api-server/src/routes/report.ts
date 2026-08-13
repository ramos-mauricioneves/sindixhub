import { Hono } from "hono";
import type { AppEnv } from "../types";
import { transcribeAudio, type AudioInput, type ImageInput } from "../services/openai-service";
import { generateInspectionReport } from "../services/gemini-service";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router = new Hono<AppEnv>();

const MAX_AUDIO_MB = 25;
const MAX_IMAGE_MB = 10;
const MAX_FILES = 10;

const ALLOWED_AUDIO_EXT = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg"];
const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function extOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function mimeForAudioExt(ext: string): string {
  switch (ext) {
    case ".mp3":
    case ".mpeg":
    case ".mpga":
      return "audio/mpeg";
    case ".mp4":
    case ".m4a":
      return "audio/mp4";
    case ".wav":
      return "audio/wav";
    case ".webm":
      return "audio/webm";
    case ".ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}

function mimeForImageExt(ext: string): string {
  switch (ext) {
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

// Note on faithfulness of this port: the original Express route used multer
// to stream uploads to os.tmpdir(), then read them back off disk. Workers
// has no filesystem at all, so every file here is read straight into memory
// as an ArrayBuffer (via File.arrayBuffer()) and handed to the OpenAI/
// Anthropic SDKs as in-memory blobs — nothing is ever persisted, matching
// the "ephemeral uploads only" requirement even more directly than before
// (there's no temp file to clean up in a `finally` block anymore).
router.post("/generate-report", requireAuth, async (c) => {
  const openaiKey = c.env.OPENAI_API_KEY;
  const geminiKey = c.env.GOOGLE_GENERATIVE_AI_API_KEY;

  let body: Record<string, string | File | (string | File)[]>;
  try {
    body = await c.req.parseBody({ all: true });
  } catch (err) {
    return c.json({ error: "Arquivo inválido", details: (err as Error).message }, 400);
  }

  const notes = typeof body.notes === "string" ? body.notes : undefined;

  const audioRaw = body.audio;
  const audioFile = Array.isArray(audioRaw) ? audioRaw[0] : audioRaw;
  if (!(audioFile instanceof File)) {
    return c.json(
      { error: "Arquivo de áudio é obrigatório.", details: "Envie um arquivo de áudio da vistoria." },
      400,
    );
  }

  const audioExt = extOf(audioFile.name) || ".wav";
  if (!ALLOWED_AUDIO_EXT.includes(audioExt)) {
    return c.json(
      { error: "Erro no upload", details: `Formato de áudio não suportado: ${audioExt}. Use mp3, wav, m4a ou webm.` },
      400,
    );
  }
  if (audioFile.size > MAX_AUDIO_MB * 1024 * 1024) {
    return c.json({ error: "Erro no upload", details: `Áudio excede o limite de ${MAX_AUDIO_MB}MB.` }, 400);
  }

  const imagesRaw = body.images;
  const imageFilesList = imagesRaw === undefined ? [] : Array.isArray(imagesRaw) ? imagesRaw : [imagesRaw];
  const imageFiles = imageFilesList.filter((f): f is File => f instanceof File);

  if (imageFiles.length > MAX_FILES) {
    return c.json({ error: "Erro no upload", details: `Máximo de ${MAX_FILES} imagens.` }, 400);
  }

  for (const f of imageFiles) {
    const ext = extOf(f.name);
    if (!ALLOWED_IMAGE_EXT.includes(ext)) {
      return c.json(
        { error: "Arquivo inválido", details: `Formato de imagem não suportado: ${ext}. Use jpg, png ou webp.` },
        400,
      );
    }
    if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
      return c.json({ error: "Erro no upload", details: `Imagem ${f.name} excede o limite de ${MAX_IMAGE_MB}MB.` }, 400);
    }
  }

  try {
    const audioInput: AudioInput = {
      data: await audioFile.arrayBuffer(),
      filename: audioFile.name || `audio${audioExt}`,
      mimeType: audioFile.type || mimeForAudioExt(audioExt),
    };
    const imageInputs: ImageInput[] = await Promise.all(
      imageFiles.map(async (f) => ({
        data: await f.arrayBuffer(),
        filename: f.name,
        mimeType: f.type || mimeForImageExt(extOf(f.name)),
      })),
    );

    logger.info(
      { audioFilename: audioInput.filename, imageCount: imageInputs.length },
      "Starting inspection analysis",
    );

    // Two calls instead of the old four: Whisper transcribes the audio,
    // then a single multimodal Gemini call receives that transcription plus
    // the raw images and produces the fully structured report directly
    // (see gemini-service.ts — this replaces the old GPT-4o Vision +
    // GPT-4o "structure it" + Claude Opus "write the report" chain).
    const transcricao = await transcribeAudio(openaiKey, audioInput);
    const report = await generateInspectionReport(geminiKey, transcricao, imageInputs, notes);

    return c.json({ ...report, transcricao });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error({ err: error }, "Failed to generate report");

    if (message.includes("OPENAI_API_KEY") || message.includes("GOOGLE_GENERATIVE_AI_API_KEY")) {
      return c.json(
        {
          error: "Chave de API não configurada",
          details: "Configure OPENAI_API_KEY e GOOGLE_GENERATIVE_AI_API_KEY como secrets do Worker (wrangler secret put).",
        },
        500,
      );
    }
    return c.json({ error: "Falha ao gerar comunicado", details: message }, 500);
  }
});

export default router;
