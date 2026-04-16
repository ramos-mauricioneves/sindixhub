import React, { useState, useRef, useEffect } from "react";
import { useGenerateReport } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mic, Image as ImageIcon, UploadCloud, Copy, Send, CheckCircle2, AlertCircle, X, FileAudio, RefreshCw } from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const generateReport = useGenerateReport();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");

  const [report, setReport] = useState<any>(null);

  const [loadingStage, setLoadingStage] = useState(0);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImageFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (generateReport.isPending) {
      interval = setInterval(() => {
        setLoadingStage((prev) => (prev < 2 ? prev + 1 : prev));
      }, 8000);
    } else {
      setLoadingStage(0);
    }
    return () => clearInterval(interval);
  }, [generateReport.isPending]);

  const loadingMessages = [
    "Transcrevendo áudio...",
    "Analisando imagens...",
    "Gerando comunicado...",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!audioFile) {
      toast({
        title: "Erro de validação",
        description: "O arquivo de áudio é obrigatório para gerar a vistoria.",
        variant: "destructive",
      });
      return;
    }

    try {
      generateReport.mutate(
        {
          data: {
            audio: audioFile,
            images: imageFiles.length > 0 ? imageFiles : undefined,
            notes: notes || undefined,
          },
        },
        {
          onSuccess: (data) => {
            setReport(data);
            toast({
              title: "Sucesso",
              description: "Relatório gerado com sucesso.",
            });
          },
          onError: (error) => {
            const apiError = error as any;
            const message = apiError?.data?.details || apiError?.data?.error || apiError?.message || "Ocorreu um erro ao processar a vistoria.";
            toast({
              title: "Erro na geração",
              description: message,
              variant: "destructive",
            });
          },
        }
      );
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setAudioFile(null);
    setImageFiles([]);
    setNotes("");
    setReport(null);
  };

  if (report) {
    const urgenciaColors = {
      baixa: "bg-green-100 text-green-800 border-green-200",
      "média": "bg-yellow-100 text-yellow-800 border-yellow-200",
      alta: "bg-red-100 text-red-800 border-red-200",
    };
    const urgencyClass = urgenciaColors[report.urgencia as keyof typeof urgenciaColors] || urgenciaColors["média"];

    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto flex flex-col gap-6 animate-in fade-in zoom-in duration-300">
        <header className="mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Resultado da Vistoria</h1>
          <p className="text-muted-foreground mt-1">Comunicado pronto para revisão e envio.</p>
        </header>

        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">{report.tipo}</CardTitle>
                <CardDescription className="mt-1.5">{report.resumo}</CardDescription>
              </div>
              <Badge variant="outline" className={`capitalize px-2.5 py-0.5 text-xs font-medium ${urgencyClass}`}>
                Urgência {report.urgencia}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ação Recomendada</Label>
              <p className="text-sm font-medium leading-relaxed bg-slate-50 p-3 rounded-md border">{report.acao}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comunicado" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comunicado aos Moradores</Label>
              <Textarea 
                id="comunicado"
                value={report.comunicado}
                onChange={(e) => setReport({ ...report, comunicado: e.target.value })}
                className="min-h-[200px] text-sm resize-y font-serif leading-relaxed p-4"
                data-testid="textarea-comunicado"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-3 border-t bg-slate-50/50 pt-6">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto"
              onClick={() => {
                navigator.clipboard.writeText(report.comunicado);
                toast({ title: "Copiado", description: "Texto copiado para a área de transferência." });
              }}
              data-testid="btn-copy-comunicado"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Texto
            </Button>
            <Button 
              className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white"
              onClick={() => {
                console.log("Enviando para WhatsApp:", report.comunicado);
                toast({ title: "Simulação", description: "Ação de envio via WhatsApp registrada no console." });
              }}
              data-testid="btn-send-whatsapp"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar via WhatsApp
            </Button>
            <div className="flex-1"></div>
            <Button 
              variant="ghost" 
              className="w-full sm:w-auto text-muted-foreground"
              onClick={resetForm}
              data-testid="btn-new-vistoria"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Nova Vistoria
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Assistente de Vistoria</h1>
        <p className="text-muted-foreground mt-2">Registre ocorrências no condomínio com áudio e fotos. A IA organizará as informações e criará um comunicado profissional.</p>
      </header>

      <form onSubmit={handleSubmit}>
        <Card className="border shadow-sm">
          <CardContent className="pt-6 space-y-8">
            {/* Audio Upload */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center">
                <Mic className="w-4 h-4 mr-2 text-primary" />
                Gravação da Vistoria <span className="text-destructive ml-1">*</span>
              </Label>
              <div 
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors cursor-pointer hover:bg-slate-50 ${audioFile ? 'border-primary bg-primary/5' : 'border-border'}`}
                onClick={() => audioInputRef.current?.click()}
                data-testid="area-audio-upload"
              >
                <input 
                  type="file" 
                  accept="audio/*" 
                  className="hidden" 
                  ref={audioInputRef}
                  onChange={handleAudioChange}
                  data-testid="input-audio"
                />
                {audioFile ? (
                  <div className="flex items-center gap-3 text-primary">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileAudio className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{audioFile.name}</p>
                      <p className="text-xs opacity-80">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="ml-auto rounded-full h-8 w-8 hover:bg-primary/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAudioFile(null);
                      }}
                      data-testid="btn-remove-audio"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Clique para anexar o áudio</p>
                    <p className="text-xs text-muted-foreground mt-1">Grave descrevendo o que você está vendo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Images Upload */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center">
                <ImageIcon className="w-4 h-4 mr-2 text-primary" />
                Fotos (Opcional)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {imageFiles.map((file, index) => (
                  <div key={index} className="relative aspect-square rounded-lg border overflow-hidden group">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={`Upload ${index + 1}`} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon"
                        className="w-8 h-8 rounded-full"
                        onClick={() => removeImage(index)}
                        data-testid={`btn-remove-image-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div 
                  className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:bg-slate-50 hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => imageInputRef.current?.click()}
                  data-testid="area-image-upload"
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                    ref={imageInputRef}
                    onChange={handleImageChange}
                    data-testid="input-image"
                  />
                  <UploadCloud className="w-6 h-6 mb-2" />
                  <span className="text-xs font-medium">Adicionar fotos</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <Label htmlFor="notes" className="text-sm font-semibold text-foreground">
                Observações Adicionais (Opcional)
              </Label>
              <Textarea 
                id="notes"
                placeholder="Detalhes que não estão no áudio ou nas fotos..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-y"
                data-testid="textarea-notes"
              />
            </div>
          </CardContent>
          <CardFooter className="pt-4 pb-6 bg-slate-50/50 border-t">
            <Button 
              type="submit" 
              size="lg" 
              className="w-full text-base"
              disabled={generateReport.isPending}
              data-testid="btn-submit-report"
            >
              {generateReport.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  {loadingMessages[loadingStage]}
                </>
              ) : (
                "Gerar Comunicado"
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
