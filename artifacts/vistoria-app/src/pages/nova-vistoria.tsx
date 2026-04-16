import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, Square, Camera, X, Check, Loader2, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGenerateReport, useSaveInspection, getListInspectionsQueryKey, InspectionReport } from "@workspace/api-client-react";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function NovaVistoriaPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [images, setImages] = useState<File[]>([]);
  const [local, setLocal] = useState("");
  const [notes, setNotes] = useState("");

  const generateReport = useGenerateReport();
  const saveInspection = useSaveInspection();

  const [report, setReport] = useState<InspectionReport | null>(null);
  const [editedComunicado, setEditedComunicado] = useState("");

  const [loadingMessage, setLoadingMessage] = useState("");

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (generateReport.isPending) {
      setLoadingMessage("Transcrevendo áudio...");
      const t1 = setTimeout(() => setLoadingMessage("Analisando imagens..."), 10000);
      const t2 = setTimeout(() => setLoadingMessage("Gerando comunicado..."), 20000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [generateReport.isPending]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      setAudioBlob(null);
      setReport(null);
      
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "Erro ao acessar microfone",
        description: "Verifique as permissões do navegador.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!audioBlob) {
      toast({
        title: "Áudio obrigatório",
        description: "Grave um áudio relatando a ocorrência.",
        variant: "destructive"
      });
      return;
    }

    generateReport.mutate({
      data: {
        audio: audioBlob,
        images: images.length > 0 ? images : undefined,
        notes: notes || undefined
      }
    }, {
      onSuccess: (data) => {
        setReport(data);
        setEditedComunicado(data.comunicado);
        toast({
          title: "Relatório gerado!",
          description: "Revise os dados antes de salvar."
        });
      },
      onError: (err) => {
        toast({
          title: "Erro ao gerar relatório",
          description: err.error || "Tente novamente mais tarde.",
          variant: "destructive"
        });
      }
    });
  };

  const handleSave = () => {
    if (!report) return;

    saveInspection.mutate({
      data: {
        tipo: report.tipo,
        urgencia: report.urgencia,
        acao: report.acao,
        resumo: report.resumo,
        comunicado: editedComunicado,
        transcricao: report.transcricao,
        analise_imagens: report.analise_imagens,
        local: local || undefined
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInspectionsQueryKey() });
        toast({
          title: "Vistoria salva!",
          description: "Registro adicionado com sucesso."
        });
        setLocation("/app/historico");
      },
      onError: (err) => {
        toast({
          title: "Erro ao salvar",
          description: err.error || "Tente novamente.",
          variant: "destructive"
        });
      }
    });
  };

  const getUrgenciaColor = (u: string) => {
    if (u === "alta") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    if (u === "média" || u === "media") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nova Vistoria</h1>
        <p className="text-muted-foreground">Registre uma ocorrência no condomínio.</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Audio Section */}
          <div className="flex flex-col items-center justify-center py-6 space-y-4 rounded-lg bg-muted/50 border border-dashed">
            {!audioBlob ? (
              <>
                <Button
                  size="lg"
                  variant={isRecording ? "destructive" : "default"}
                  className={`w-24 h-24 rounded-full shadow-lg ${isRecording ? "animate-pulse" : ""}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  data-testid="button-record"
                >
                  {isRecording ? <Square className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </Button>
                <div className="text-center">
                  <p className="font-medium text-lg">
                    {isRecording ? formatDuration(recordingSeconds) : "Iniciar Gravação"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isRecording ? "Toque para parar" : "Relate o problema em áudio"}
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full max-w-sm space-y-4 px-4">
                <div className="flex items-center justify-between bg-background p-3 rounded-md border">
                  <div className="flex items-center gap-3 text-primary">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Áudio gravado</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setAudioBlob(null)}>
                    Regravar
                  </Button>
                </div>
                <audio src={URL.createObjectURL(audioBlob)} controls className="w-full" />
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="local">Local da ocorrência (opcional)</Label>
              <Input
                id="local"
                placeholder="Ex: Garagem subsolo 2, Hall de entrada..."
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                data-testid="input-local"
              />
            </div>

            <div className="space-y-2">
              <Label>Imagens (opcional)</Label>
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                    <img src={URL.createObjectURL(img)} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                    <button
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
                      onClick={() => removeImage(i)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 flex flex-col items-center justify-center border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                  <Camera className="h-6 w-6 text-muted-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={handleImageCapture}
                    data-testid="input-camera"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações adicionais (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Anotações extras..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                data-testid="input-notes"
              />
            </div>
          </div>
        </CardContent>
        
        {!report && (
          <CardFooter className="bg-muted/20 border-t pt-6">
            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleSubmit}
              disabled={!audioBlob || generateReport.isPending}
              data-testid="button-submit-report"
            >
              {generateReport.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {loadingMessage}
                </>
              ) : (
                "Gerar Relatório IA"
              )}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Result Section */}
      {report && (
        <Card className="border-primary/20 shadow-md overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="bg-primary/5 px-6 py-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="outline" className="mb-2 bg-background">
                  {report.tipo}
                </Badge>
                <CardTitle className="text-xl">{report.resumo}</CardTitle>
              </div>
              <Badge className={getUrgenciaColor(report.urgencia)} variant="secondary">
                {report.urgencia.toUpperCase()}
              </Badge>
            </div>
          </div>
          
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-md">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Ação Recomendada</p>
                <p className="text-sm">{report.acao}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comunicado" className="text-base font-semibold">Comunicado aos Moradores</Label>
              <p className="text-sm text-muted-foreground">Você pode editar este texto antes de salvar.</p>
              <Textarea
                id="comunicado"
                value={editedComunicado}
                onChange={(e) => setEditedComunicado(e.target.value)}
                rows={6}
                className="resize-y"
                data-testid="input-comunicado"
              />
            </div>
          </CardContent>

          <CardFooter className="bg-muted/20 border-t pt-6">
            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleSave}
              disabled={saveInspection.isPending}
              data-testid="button-save-inspection"
            >
              {saveInspection.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Save className="mr-2 h-5 w-5" />
              )}
              Salvar Vistoria
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
