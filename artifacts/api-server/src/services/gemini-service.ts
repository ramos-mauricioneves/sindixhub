import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output, NoOutputGeneratedError } from "ai";
import { z } from "zod";
import { logger } from "../lib/logger";
import type { ImageInput } from "./openai-service";

/**
 * Consolidated report generation via Gemini.
 *
 * This replaces what used to be 3 separate LLM calls (OpenAI GPT-4o Vision
 * for image analysis, a second GPT-4o call to structure that analysis +
 * the transcription into JSON, then Claude Opus to write the final report)
 * with a single multimodal call: Gemini receives the raw transcription text
 * plus the raw images directly and produces the fully structured report in
 * one pass. Whisper (OpenAI) is kept only for audio transcription — Gemini
 * has no first-class audio-transcription primitive worth relying on here,
 * and Whisper's pt-BR transcription quality is already proven in this app.
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
 * production — in particular, verify the multimodal request shape (image
 * data URLs in message content) and that schema enforcement actually holds
 * for this response shape.
 */

export const InspectionReportSchema = z.object({
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

function buildPrompt(transcription: string, notes: string | undefined): string {
  return `Você é um síndico profissional analisando uma vistoria condominial.

TRANSCRIÇÃO DO ÁUDIO DA VISTORIA:
${transcription}

${notes ? `OBSERVAÇÕES ADICIONAIS DO SÍNDICO:\n${notes}\n` : ""}
Analise a transcrição acima junto com as imagens anexadas a esta mensagem (se houver) e gere um relatório estruturado.

Critérios de urgência:
- alta: risco à segurança, saúde ou danos estruturais iminentes
- média: problema que afeta o conforto ou pode piorar em dias/semanas
- baixa: problema estético ou de manutenção preventiva

Campos a preencher:
- tipo: tipo específico do problema (ex: Infiltração, Vazamento, Falha elétrica, Dano estrutural, etc.)
- urgencia: baixa, média ou alta
- acao: ação específica e objetiva recomendada
- resumo: resumo conciso em até 2 linhas do problema e situação
- comunicado: comunicado formal completo para os moradores (saudação, descrição do problema, localização, ação que será tomada, previsão se possível, despedida formal), linguagem clara, profissional, sem termos técnicos desnecessários
- analise_imagens: descrição técnica e objetiva do que aparece nas imagens (tipo de problema, localização aparente, gravidade visual e detalhes relevantes); se nenhuma imagem foi anexada, responda exatamente "Nenhuma imagem fornecida para análise."`;
}

async function runModel(
  google: ReturnType<typeof createGoogleGenerativeAI>,
  modelId: string,
  transcription: string,
  images: ImageInput[],
  notes: string | undefined,
): Promise<GeneratedReport> {
  const content: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [
    { type: "text", text: buildPrompt(transcription, notes) },
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
  transcription: string,
  images: ImageInput[],
  notes?: string,
): Promise<GeneratedReport> {
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set");
  }

  const google = createGoogleGenerativeAI({ apiKey });

  logger.info({ imageCount: images.length, model: PRIMARY_MODEL_ID }, "Generating inspection report with Gemini");

  try {
    return await runModel(google, PRIMARY_MODEL_ID, transcription, images, notes);
  } catch (err) {
    if (NoOutputGeneratedError.isInstance(err)) {
      logger.error({ err }, "Gemini produced text but not schema-valid JSON");
      throw new Error("Falha ao processar a resposta da IA. Tente novamente.");
    }

    logger.warn({ err, model: PRIMARY_MODEL_ID }, "Primary Gemini model failed, falling back");
    try {
      return await runModel(google, FALLBACK_MODEL_ID, transcription, images, notes);
    } catch (err2) {
      if (NoOutputGeneratedError.isInstance(err2)) {
        logger.error({ err: err2 }, "Gemini fallback model also produced non-schema output");
        throw new Error("Falha ao processar a resposta da IA. Tente novamente.");
      }
      throw err2;
    }
  }
}
