import OpenAI from "openai";
import { logger } from "../lib/logger";

export interface OpenAIAnalysisResult {
  transcription: string;
  image_analysis: string;
  structured_data: {
    possible_issue: string;
    location: string;
    details: string;
  };
}

// Workers has no filesystem, so the report route now hands us the uploaded
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

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

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

export async function analyzeImages(apiKey: string | undefined, images: ImageInput[]): Promise<string> {
  if (images.length === 0) {
    return "Nenhuma imagem fornecida para análise.";
  }

  const client = getClient(apiKey);
  logger.info({ count: images.length }, "Analyzing images with Vision");

  const imageContents: OpenAI.Chat.ChatCompletionContentPart[] = images.map((img) => {
    const base64 = bufferToBase64(img.data);
    return {
      type: "image_url" as const,
      image_url: {
        url: `data:${img.mimeType};base64,${base64}`,
        detail: "high" as const,
      },
    };
  });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Você está analisando imagens de uma vistoria em condomínio. Descreva detalhadamente o que vê em cada imagem: tipo de problema, localização aparente, gravidade visual e quaisquer detalhes relevantes. Seja objetivo e técnico.",
          },
          ...imageContents,
        ],
      },
    ],
    max_tokens: 1000,
  });

  const analysis = response.choices[0]?.message?.content ?? "Não foi possível analisar as imagens.";
  logger.info("Image analysis complete");
  return analysis;
}

export async function analyzeInspection(
  apiKey: string | undefined,
  audio: AudioInput,
  images: ImageInput[]
): Promise<OpenAIAnalysisResult> {
  const [transcription, image_analysis] = await Promise.all([
    transcribeAudio(apiKey, audio),
    analyzeImages(apiKey, images),
  ]);

  const client = getClient(apiKey);

  const structureResponse = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "Você é um assistente especialista em vistoria condominial. Analise as informações fornecidas e extraia dados estruturados sobre o problema identificado.",
      },
      {
        role: "user",
        content: `Transcrição do áudio: ${transcription}\n\nAnálise das imagens: ${image_analysis}\n\nExtrai as informações em formato JSON com os campos: possible_issue (tipo de problema), location (localização), details (detalhes relevantes).`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  let structured_data = {
    possible_issue: "Não identificado",
    location: "Não identificado",
    details: "Sem detalhes adicionais",
  };

  try {
    const parsed = JSON.parse(structureResponse.choices[0]?.message?.content ?? "{}");
    structured_data = {
      possible_issue: parsed.possible_issue ?? structured_data.possible_issue,
      location: parsed.location ?? structured_data.location,
      details: parsed.details ?? structured_data.details,
    };
  } catch {
    logger.warn("Failed to parse structured data from OpenAI response");
  }

  return { transcription, image_analysis, structured_data };
}
