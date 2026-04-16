import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { analyzeInspection } from "../services/openai-service";
import { generateReport } from "../services/claude-service";

const router = Router();

const MAX_AUDIO_MB = 25;
const MAX_IMAGE_MB = 10;
const MAX_FILES = 10;

const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: MAX_AUDIO_MB * 1024 * 1024,
    files: MAX_FILES + 1,
  },
  fileFilter(_req, file, cb) {
    if (file.fieldname === "audio") {
      const allowed = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        return cb(new Error(`Formato de áudio não suportado: ${ext}. Use mp3, wav, m4a ou webm.`));
      }
    } else if (file.fieldname === "images") {
      const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        return cb(new Error(`Formato de imagem não suportado: ${ext}. Use jpg, png ou webp.`));
      }
    }
    cb(null, true);
  },
});

const uploadFields = upload.fields([
  { name: "audio", maxCount: 1 },
  { name: "images", maxCount: MAX_FILES },
]);

router.post("/generate-report", (req, res) => {
  uploadFields(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: "Erro no upload", details: err.message });
      return;
    } else if (err) {
      res.status(400).json({ error: "Arquivo inválido", details: (err as Error).message });
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const audioFiles = files?.["audio"];
    const imageFiles = files?.["images"] ?? [];
    const notes = req.body.notes as string | undefined;

    if (!audioFiles || audioFiles.length === 0) {
      res.status(400).json({ error: "Arquivo de áudio é obrigatório.", details: "Envie um arquivo de áudio da vistoria." });
      return;
    }

    const audioFile = audioFiles[0]!;
    const audioExt = path.extname(audioFile.originalname).toLowerCase() || ".wav";
    const renamedAudioPath = audioFile.path + audioExt;

    const tempPaths: string[] = [audioFile.path];

    try {
      fs.renameSync(audioFile.path, renamedAudioPath);
      tempPaths[0] = renamedAudioPath;

      const imagePaths = imageFiles.map((f) => {
        tempPaths.push(f.path);
        return f.path;
      });

      req.log.info({ audioPath: renamedAudioPath, imageCount: imagePaths.length }, "Starting inspection analysis");

      const analysisResult = await analyzeInspection(renamedAudioPath, imagePaths);
      const report = await generateReport(analysisResult, notes);

      res.json({
        ...report,
        transcricao: analysisResult.transcription,
        analise_imagens: analysisResult.image_analysis,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      req.log.error({ err: error }, "Failed to generate report");

      if (message.includes("OPENAI_API_KEY") || message.includes("CLAUDE_API_KEY")) {
        res.status(500).json({
          error: "Chave de API não configurada",
          details: "Configure as variáveis OPENAI_API_KEY e CLAUDE_API_KEY no painel de segredos.",
        });
      } else {
        res.status(500).json({ error: "Falha ao gerar comunicado", details: message });
      }
    } finally {
      for (const p of tempPaths) {
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch {
        }
      }
    }
  });
});

export default router;
