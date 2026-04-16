import OpenAI from "openai";
import { logger } from "../lib/logger";
import fs from "fs";

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface OpenAIAnalysisResult {
  transcription: string;
  image_analysis: string;
  structured_data: {
    possible_issue: string;
    location: string;
    details: string;
  };
}

export async function transcribeAudio(audioPath: string): Promise<string> {
  const client = getClient();
  logger.info({ audioPath }, "Transcribing audio with Whisper");

  const audioStream = fs.createReadStream(audioPath);

  const transcription = await client.audio.transcriptions.create({
    file: audioStream,
    model: "whisper-1",
    language: "pt",
  });

  logger.info("Audio transcription complete");
  return transcription.text;
}

export async function analyzeImages(imagePaths: string[]): Promise<string> {
  if (imagePaths.length === 0) {
    return "Nenhuma imagem fornecida para análise.";
  }

  const client = getClient();
  logger.info({ count: imagePaths.length }, "Analyzing images with Vision");

  const imageContents: OpenAI.Chat.ChatCompletionContentPart[] = imagePaths.map((p) => {
    const base64 = fs.readFileSync(p).toString("base64");
    const ext = p.split(".").pop()?.toLowerCase() ?? "jpeg";
    const mimeType = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
    return {
      type: "image_url" as const,
      image_url: {
        url: `data:${mimeType};base64,${base64}`,
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
  audioPath: string,
  imagePaths: string[]
): Promise<OpenAIAnalysisResult> {
  const [transcription, image_analysis] = await Promise.all([
    transcribeAudio(audioPath),
    analyzeImages(imagePaths),
  ]);

  const client = getClient();

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
