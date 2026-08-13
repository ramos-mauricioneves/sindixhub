import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger";
import type { OpenAIAnalysisResult } from "./openai-service";

export interface InspectionReport {
  tipo: string;
  urgencia: "baixa" | "média" | "alta";
  acao: string;
  resumo: string;
  comunicado: string;
}

function getClient(apiKey: string | undefined): Anthropic {
  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey });
}

export async function generateReport(
  apiKey: string | undefined,
  analysisResult: OpenAIAnalysisResult,
  notes?: string
): Promise<InspectionReport> {
  const client = getClient(apiKey);
  logger.info("Generating inspection report with Claude");

  const prompt = `Você é um síndico profissional.

Analise as informações a seguir e gere um relatório estruturado de vistoria condominial.

TRANSCRIÇÃO DO ÁUDIO:
${analysisResult.transcription}

ANÁLISE DAS IMAGENS:
${analysisResult.image_analysis}

DADOS ESTRUTURADOS:
- Problema identificado: ${analysisResult.structured_data.possible_issue}
- Localização: ${analysisResult.structured_data.location}
- Detalhes: ${analysisResult.structured_data.details}

${notes ? `OBSERVAÇÕES ADICIONAIS DO SÍNDICO:\n${notes}` : ""}

Com base nessas informações, gere um JSON com os seguintes campos:

{
  "tipo": "tipo específico do problema (ex: Infiltração, Vazamento, Falha elétrica, Dano estrutural, etc.)",
  "urgencia": "baixa, média ou alta",
  "acao": "ação específica e objetiva recomendada",
  "resumo": "resumo conciso em até 2 linhas do problema e situação",
  "comunicado": "comunicado formal completo para os moradores, com linguagem clara e profissional, sem termos técnicos desnecessários"
}

Critérios de urgência:
- alta: risco à segurança, saúde ou danos estruturais iminentes
- média: problema que afeta o conforto ou pode piorar em dias/semanas
- baixa: problema estético ou de manutenção preventiva

O comunicado deve incluir: saudação, descrição do problema, localização, ação que será tomada e previsão se possível, despedida formal.

Responda APENAS com o JSON, sem texto adicional.`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  let report: InspectionReport;
  try {
    const cleaned = content.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    report = JSON.parse(cleaned);

    const validUrgencias = ["baixa", "média", "alta"];
    if (!validUrgencias.includes(report.urgencia)) {
      report.urgencia = "média";
    }
  } catch (err) {
    logger.error({ err, text: content.text }, "Failed to parse Claude response as JSON");
    throw new Error("Falha ao processar a resposta da IA. Tente novamente.");
  }

  logger.info({ tipo: report.tipo, urgencia: report.urgencia }, "Report generated successfully");
  return report;
}
