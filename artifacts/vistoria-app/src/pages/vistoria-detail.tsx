import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Copy, MessageCircle, Calendar, MapPin, Building2, ClipboardList, Zap, Info, FileText } from "lucide-react";
import { useGetInspection, getGetInspectionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";

export default function VistoriaDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const inspectionId = parseInt(id || "0", 10);
  
  const { data: inspection, isPending, isError } = useGetInspection(inspectionId, {
    query: {
      enabled: !!inspectionId,
      queryKey: getGetInspectionQueryKey(inspectionId)
    }
  });

  const handleCopy = () => {
    if (inspection?.comunicado) {
      navigator.clipboard.writeText(inspection.comunicado);
      toast({
        title: "Copiado!",
        description: "Comunicado copiado para a área de transferência."
      });
    }
  };

  const handleWhatsApp = () => {
    if (inspection?.comunicado) {
      console.log("Sharing to WhatsApp:", inspection.comunicado);
      toast({
        title: "Compartilhamento simulado",
        description: "Abriria o WhatsApp com o texto preenchido."
      });
    }
  };

  if (isPending) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (isError || !inspection) {
    return (
      <div className="text-center py-12 text-destructive">
        <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">Vistoria não encontrada</h2>
        <p className="mb-6">Não foi possível carregar os detalhes desta vistoria.</p>
        <Button variant="outline" onClick={() => setLocation("/app/historico")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para histórico
        </Button>
      </div>
    );
  }

  const getUrgenciaColor = (u: string) => {
    if (u === "alta") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    if (u === "média" || u === "media") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <Button variant="ghost" className="mb-2 -ml-2 text-muted-foreground" onClick={() => setLocation("/app/historico")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-sm font-medium">
            {inspection.tipo}
          </Badge>
          <Badge className={`text-xs font-semibold uppercase tracking-wider ${getUrgenciaColor(inspection.urgencia)}`} variant="secondary">
            Urgência {inspection.urgencia}
          </Badge>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          {inspection.resumo}
        </h1>
        
        <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm text-muted-foreground mt-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            {format(new Date(inspection.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
          {inspection.local && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              {inspection.local}
            </div>
          )}
          {inspection.condominio && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0" />
              {inspection.condominio}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mt-8">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Comunicado
              </CardTitle>
              <CardDescription>Texto para envio aos moradores ou responsáveis.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="bg-background rounded-md border p-4 text-sm whitespace-pre-wrap leading-relaxed font-medium">
                {inspection.comunicado}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t flex flex-wrap gap-3 pt-6">
              <Button onClick={handleCopy} variant="secondary" className="flex-1 sm:flex-none">
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
              <Button onClick={handleWhatsApp} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            </CardFooter>
          </Card>

          {(inspection.transcricao || inspection.analise_imagens) && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Detalhes da Análise IA</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {inspection.transcricao && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Transcrição do Áudio
                    </h4>
                    <p className="text-sm bg-muted/30 p-3 rounded border text-foreground/80 italic">
                      "{inspection.transcricao}"
                    </p>
                  </div>
                )}
                
                {inspection.analise_imagens && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Análise de Imagens
                    </h4>
                    <p className="text-sm text-foreground/80">
                      {inspection.analise_imagens}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-primary/20 shadow-sm bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-primary">
                <AlertCircle className="h-5 w-5" />
                Ação Recomendada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium leading-relaxed">
                {inspection.acao}
              </p>
            </CardContent>
          </Card>
          
          <div className="text-xs text-muted-foreground text-center px-4">
            <p>ID da vistoria: #{inspection.id}</p>
            <p>Reportado por: {inspection.createdByClerkId.substring(0, 8)}...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
