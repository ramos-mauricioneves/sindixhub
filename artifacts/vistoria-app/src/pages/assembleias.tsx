import { useState } from "react";
import { useGetAssembleiasInsights, useListCondominios } from "@workspace/api-client-react";
import {
  Lightbulb, AlertTriangle, Info, CheckCircle2, Loader2,
  Building2, RefreshCw, TrendingUp, Wrench, Shield, Package, RotateCcw, FileText
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUser } from "@/components/layout";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORIDADE_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  alta:  { color: "text-red-700",    bg: "bg-red-50 border-red-200",       icon: AlertTriangle,  label: "Alta" },
  media: { color: "text-yellow-800", bg: "bg-yellow-50 border-yellow-200", icon: Info,           label: "Média" },
  baixa: { color: "text-green-700",  bg: "bg-green-50 border-green-200",   icon: CheckCircle2,   label: "Baixa" },
};

const CATEGORIA_ICONS: Record<string, any> = {
  melhorias:   TrendingUp,
  manutencao:  Wrench,
  seguranca:   Shield,
  estrutural:  Building2,
  patrimonio:  Package,
  recorrencia: RotateCcw,
};

const CATEGORIA_LABELS: Record<string, string> = {
  melhorias:   "Melhorias",
  manutencao:  "Manutenção",
  seguranca:   "Segurança",
  estrutural:  "Estrutural",
  patrimonio:  "Patrimônio",
  recorrencia: "Recorrência",
};

const MONTHS_OPTIONS = [
  { value: "3",  label: "Últimos 3 meses" },
  { value: "6",  label: "Últimos 6 meses" },
  { value: "12", label: "Último ano" },
  { value: "24", label: "Últimos 2 anos" },
];

export default function AssembleiasPage() {
  const user = useUser();
  const [condominioId, setCondominioId] = useState<string>("");
  const [months, setMonths] = useState<string>("6");

  const { data: condominios } = useListCondominios();
  const condominioIdNum = condominioId ? parseInt(condominioId, 10) : undefined;

  const { data, isPending, isError, refetch, isRefetching } = useGetAssembleiasInsights(
    {
      ...(condominioIdNum ? { condominioId: condominioIdNum } : {}),
      months: parseInt(months, 10),
    },
    { query: { enabled: true } }
  );

  const topics = data?.topics ?? [];
  const altaCount  = topics.filter(t => t.prioridade === "alta").length;
  const mediaCount = topics.filter(t => t.prioridade === "media").length;
  const baixaCount = topics.filter(t => t.prioridade === "baixa").length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Insights para Assembleia
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Tópicos sugeridos com base nas vistorias e ativos do período
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={() => refetch()} disabled={isPending || isRefetching}>
          <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {user?.role === "admin" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Condomínio</Label>
              <Select value={condominioId || "__all__"} onValueChange={v => setCondominioId(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os condomínios</SelectItem>
                  {(condominios ?? []).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Período de análise</Label>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {isPending || isRefetching ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <Card className="p-8 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
          <p className="text-muted-foreground">Erro ao carregar os insights.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
        </Card>
      ) : topics.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Lightbulb className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="font-medium">Nenhum tópico identificado</p>
          <p className="text-sm text-muted-foreground">
            Não há eventos ou ativos suficientes no período para gerar sugestões de pauta.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 border-red-200 bg-red-50">
              <p className="text-xs text-red-600 font-medium">Alta prioridade</p>
              <p className="text-2xl font-bold text-red-700">{altaCount}</p>
            </Card>
            <Card className="p-3 border-yellow-200 bg-yellow-50">
              <p className="text-xs text-yellow-700 font-medium">Média prioridade</p>
              <p className="text-2xl font-bold text-yellow-800">{mediaCount}</p>
            </Card>
            <Card className="p-3 border-green-200 bg-green-50">
              <p className="text-xs text-green-600 font-medium">Baixa prioridade</p>
              <p className="text-2xl font-bold text-green-700">{baixaCount}</p>
            </Card>
          </div>

          {data?.totalInspections !== undefined && (
            <p className="text-xs text-muted-foreground text-center">
              Análise de {data.totalInspections} vistoria(s) nos últimos {data.periodMonths} meses
              {data.generatedAt
                ? ` · ${format(new Date(data.generatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                : ""}
            </p>
          )}

          <div className="space-y-3">
            {topics.map((topic, idx) => {
              const prio = PRIORIDADE_CONFIG[topic.prioridade] ?? PRIORIDADE_CONFIG.baixa;
              const PrioIcon = prio.icon;
              const CatIcon = CATEGORIA_ICONS[topic.categoria] ?? FileText;
              return (
                <Card key={idx} className={`border ${prio.bg}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex-shrink-0 ${prio.color}`}>
                        <PrioIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-tight mb-2">{topic.titulo}</h3>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <Badge className={`text-xs border ${prio.bg} ${prio.color}`}>{prio.label}</Badge>
                          <Badge variant="outline" className="text-xs gap-1">
                            <CatIcon className="h-3 w-3" />
                            {CATEGORIA_LABELS[topic.categoria] ?? topic.categoria}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{topic.evidencias} evidência(s)</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{topic.descricao}</p>
                        {topic.condominios && topic.condominios.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {topic.condominios.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
