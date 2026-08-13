import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output, NoOutputGeneratedError } from "ai";
import { z } from "zod";
import { logger } from "../lib/logger";

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

/**
 * Single-call, single-vendor report generation via Gemini.
 *
 * Original pipeline (Replit-era): Whisper (audio->text) + GPT-4o Vision
 * (image->text) + a second GPT-4o call (structure into JSON) + Claude Opus
 * (write the final report) — 4 calls, 3 vendors effectively (2 OpenAI
 * products + Anthropic).
 *
 * This version: Gemini's multimodal input accepts audio and images
 * natively in the same message — there's no separate "Whisper-equivalent"
 * product to call, transcription is just another input modality on the
 * same model. So audio + images + notes all go into ONE Gemini call that
 * returns transcription, image analysis, and the structured report
 * together. This drops OpenAI entirely (no more Whisper key needed) and
 * cuts the pipeline from 4 calls to 1.
 *
 * Cost note (see conversation record, priced Aug 2026): Gemini bills audio
 * input at ~25 tokens/second, which comes out cheaper per minute than
 * Whisper's flat $0.006/min rate — so this isn't just fewer calls, it's
 * cheaper on the audio leg too, on top of removing 2-3 text-generation
 * calls entirely.
 *
 * SDK/model choices mirror the already-proven pattern used in this org's
 * other Cloudflare Workers app ("meucafe" / brew-buddy-ia,
 * src/lib/ai-gateway.server.ts): the Vercel AI SDK (`ai` + `@ai-sdk/google`)
 * with `createGoogleGenerativeAI` called directly against Google's API
 * (not through the OpenAI-compatible shim), because only the native
 * provider enforces the response schema server-side — the OpenAI-compatible
 * shim lets the model invent field names freely.
 *
 * MODEL ID: "-latest" aliases (not dated IDs like "gemini-2.5-pro"), because
 * newly created Google AI Studio keys get a 404 ("no longer available to
 * new users") on the dated IDs — the same gotcha meucafe's code documents.
 *
 * NOT LIVE-TESTED: this environment has no GOOGLE_GENERATIVE_AI_API_KEY
 * available, so this has been validated for correct wiring/types only, not
 * against the real Gemini API. Test with a real key before relying on it in
 * production — in particular: (1) confirm the AI SDK's `image`-typed
 * content part also accepts audio via a `file`/`data` part correctly for
 * this SDK version (see the `content` array construction below), and (2)
 * confirm transcription quality in pt-BR matches or beats Whisper before
 * fully retiring it — if it doesn't, the old two-call version (Whisper +
 * this same Gemini call receiving pre-transcribed text) is one git revert
 * away, not a rewrite.
 */

export const InspectionReportSchema = z.object({
  transcricao: z.string(),
  tipo: z.string(),
  urgencia: z.enum(["baixa", "média", "alta"]),
  acao: z.string(),
  resumo: z.string(),
  comunicado: z.string(),
  analise_imagens: z.string(),
});

export type GeneratedReport = z.infer<typeof InspectionReportSchema>;

const PRIMARY_MODEL_ID = "gemini-pro-latest";
const FALLBACK_MODEL_ID = "gemini-flash-latest";

function bufferToDataUrl(data: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function buildPrompt(notes: string | undefined): string {
  return `Você é um síndico profissional analisando uma vistoria condominial.

Você recebeu um áudio da vistoria e, possivelmente, fotos do local. Ouça o áudio, analise as fotos (se houver) e gere um relatório estruturado completo.

${notes ? `OBSERVAÇÕES ADICIONAIS DO SÍNDICO:\n${notes}\n` : ""}
Critérios de urgência:
- alta: risco à segurança, saúde ou danos estruturais iminentes
- média: problema que afeta o conforto ou pode piorar em dias/semanas
- baixa: problema estético ou de manutenção preventiva

Campos a preencher:
- transcricao: transcrição literal e completa do áudio, em português
- tipo: tipo específico do problema (ex: Infiltração, Vazamento, Falha elétrica, Dano estrutural, etc.)
- urgencia: baixa, média ou alta
- acao: ação específica e objetiva recomendada
- resumo: resumo conciso em até 2 linhas do problema e situação
- comunicado: comunicado formal completo para os moradores (saudação, descrição do problema, localização, ação que será tomada, previsão se possível, despedida formal), linguagem clara, profissional, sem termos técnicos desnecessários
- analise_imagens: descrição técnica e objetiva do que aparece nas fotos (tipo de problema, localização aparente, gravidade visual e detalhes relevantes); se nenhuma foto foi anexada, responda exatamente "Nenhuma imagem fornecida para análise."`;
}

async function runModel(
  google: ReturnType<typeof createGoogleGenerativeAI>,
  modelId: string,
  audio: AudioInput,
  images: ImageInput[],
  notes: string | undefined,
): Promise<GeneratedReport> {
  const content: Array<
    { type: "text"; text: string } | { type: "image"; image: string } | { type: "file"; data: string; mediaType: string }
  > = [
    { type: "text", text: buildPrompt(notes) },
    { type: "file", data: bufferToDataUrl(audio.data, audio.mimeType), mediaType: audio.mimeType },
  ];
  for (const img of images) {
    content.push({ type: "image", image: bufferToDataUrl(img.data, img.mimeType) });
  }

  const { output } = await generateText({
    model: google(modelId),
    messages: [{ role: "user", content }],
    output: Output.object({ schema: InspectionReportSchema }),
  });

  return output;
}

export async function generateInspectionReport(
  apiKey: string | undefined,
  audio: AudioInput,
  images: ImageInput[],
  notes?: string,
): Promise<GeneratedReport> {
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set");
  }

  const google = createGoogleGenerativeAI({ apiKey });

  logger.info({ imageCount: images.length, model: PRIMARY_MODEL_ID }, "Generating inspection report with Gemini");

  try {
    return await runModel(google, PRIMARY_MODEL_ID, audio, images, notes);
  } catch (err) {
    if (NoOutputGeneratedError.isInstance(err)) {
      logger.error({ err }, "Gemini produced output but not schema-valid JSON");
      throw new Error("Falha ao processar a resposta da IA. Tente novamente.");
    }

    logger.warn({ err, model: PRIMARY_MODEL_ID }, "Primary Gemini model failed, falling back");
    try {
      return await runModel(google, FALLBACK_MODEL_ID, audio, images, notes);
    } catch (err2) {
      if (NoOutputGeneratedError.isInstance(err2)) {
        logger.error({ err: err2 }, "Gemini fallback model also produced non-schema output");
        throw new Error("Falha ao processar a resposta da IA. Tente novamente.");
      }
      throw err2;
    }
  }
}
