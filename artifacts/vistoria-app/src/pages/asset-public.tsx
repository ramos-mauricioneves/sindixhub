import { useParams } from "wouter";
import { useGetPublicAsset } from "@workspace/api-client-react";
import { Package, AlertTriangle, CheckCircle2, Wrench, PackageX, ClipboardCheck, Loader2, MapPin, FileText } from "lucide-react";
import { SindixHubLogo } from "@/components/sindixhub-logo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CRITICIDADE_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700 border-red-300",
  media: "bg-yellow-100 text-yellow-800 border-yellow-300",
  baixa: "bg-green-100 text-green-700 border-green-300",
};

const STATUS_COLORS: Record<string, string> = {
  operacional: "bg-green-100 text-green-700",
  em_manutencao: "bg-yellow-100 text-yellow-800",
  inativo: "bg-gray-100 text-gray-700",
};

const STATUS_ICONS: Record<string, any> = {
  operacional: CheckCircle2,
  em_manutencao: Wrench,
  inativo: PackageX,
};

const STATUS_LABEL: Record<string, string> = {
  operacional: "Operacional",
  em_manutencao: "Em Manutenção",
  inativo: "Inativo",
};

const URGENCIA_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-yellow-100 text-yellow-800",
  média: "bg-yellow-100 text-yellow-800",
  baixa: "bg-green-100 text-green-700",
};

export default function AssetPublicPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const { data, isPending, isError } = useGetPublicAsset(id, {
    query: { enabled: !isNaN(id) },
  });

  if (isPending) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-bold">Ativo não encontrado</h1>
            <p className="text-muted-foreground text-sm">
              O QR code escaneado não corresponde a um ativo válido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = STATUS_ICONS[data.status] ?? Package;
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-[100dvh] bg-background pb-12">
      <div className="bg-primary text-primary-foreground py-6 px-4 shadow">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <SindixHubLogo className="h-7 w-7" />
          <div>
            <p className="text-xs opacity-90">SindixHub</p>
            <p className="font-bold text-lg leading-tight">{data.condominioNome}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${STATUS_COLORS[data.status] ?? ""}`}>
                <StatusIcon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold leading-tight">{data.nome}</h1>
                <p className="text-sm text-muted-foreground capitalize mt-1">
                  {data.tipo}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={CRITICIDADE_COLORS[data.criticidade] ?? ""}>
                Criticidade: {data.criticidade}
              </Badge>
              <Badge className={STATUS_COLORS[data.status] ?? ""}>
                {STATUS_LABEL[data.status] ?? data.status}
              </Badge>
              {data.areaNome && (
                <Badge variant="outline" className="gap-1">
                  <MapPin className="h-3 w-3" />
                  {data.areaNome}
                </Badge>
              )}
            </div>

            {data.descricao && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm whitespace-pre-wrap">{data.descricao}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button asChild className="w-full" size="lg">
          <a href={`${basePath}/app/nova-vistoria?assetId=${data.id}`}>
            <ClipboardCheck className="h-5 w-5 mr-2" />
            Registrar Ocorrência neste Ativo
          </a>
        </Button>

        {data.ultimasVistorias && data.ultimasVistorias.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Últimas vistorias deste ativo</h2>
              </div>
              <div className="space-y-2">
                {data.ultimasVistorias.map(v => (
                  <div key={v.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(v.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <Badge className={`text-xs ${URGENCIA_COLORS[v.urgencia] ?? ""}`}>
                        {v.urgencia}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium capitalize">{v.tipo}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{v.resumo}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">
          Acesso público via QR code · SindixHub
        </p>
      </div>
    </div>
  );
}
