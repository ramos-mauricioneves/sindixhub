import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Search, Filter, RefreshCw, FileText, ChevronRight, AlertCircle, Clock } from "lucide-react";
import { useListInspections, getListInspectionsQueryKey, ListInspectionsUrgencia } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";


export default function HistoricoPage() {
  const queryClient = useQueryClient();
  const [urgenciaFilter, setUrgenciaFilter] = useState<string>("all");

  const queryParams = {
    ...(urgenciaFilter !== "all" ? { urgencia: urgenciaFilter as ListInspectionsUrgencia } : {})
  };

  const { data, isPending, isError, refetch, isRefetching } = useListInspections(queryParams, {
    query: {
      queryKey: getListInspectionsQueryKey(queryParams)
    }
  });

  const getUrgenciaColor = (u: string) => {
    if (u === "alta") return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900";
    if (u === "média" || u === "media") return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-900";
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900";
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico de Vistorias</h1>
          <p className="text-muted-foreground">Acompanhe os registros realizados.</p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          disabled={isRefetching}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex items-center gap-3 bg-card p-3 rounded-lg border">
        <Filter className="h-5 w-5 text-muted-foreground ml-2" />
        <Select value={urgenciaFilter} onValueChange={setUrgenciaFilter}>
          <SelectTrigger className="w-full border-none shadow-none focus:ring-0" data-testid="select-filter-urgencia">
            <SelectValue placeholder="Filtrar por urgência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as urgências</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
            <SelectItem value="média">Média</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-destructive">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Erro ao carregar o histórico.</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : data?.inspections?.length === 0 ? (
        <div className="text-center py-16 px-4 border rounded-xl bg-card border-dashed">
          <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="text-lg font-medium text-foreground">Nenhuma vistoria encontrada</h3>
          <p className="text-muted-foreground mb-6 mt-1">
            {urgenciaFilter !== "all" 
              ? "Não há registros com este nível de urgência."
              : "Nenhuma vistoria foi registrada ainda no sistema."}
          </p>
          {urgenciaFilter !== "all" ? (
            <Button variant="outline" onClick={() => setUrgenciaFilter("all")}>Limpar filtros</Button>
          ) : (
            <Link href="/app/nova-vistoria">
              <Button>Criar nova vistoria</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {data.inspections.map((inspection) => (
            <Link key={inspection.id} href={`/app/vistoria/${inspection.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-background text-xs font-normal">
                          {inspection.tipo}
                        </Badge>
                        <Badge variant="outline" className={`${getUrgenciaColor(inspection.urgencia)} text-xs font-semibold uppercase tracking-wider`}>
                          {inspection.urgencia}
                        </Badge>
                      </div>
                      
                      <h3 className="font-semibold text-base sm:text-lg text-foreground line-clamp-2 leading-tight">
                        {inspection.resumo}
                      </h3>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(inspection.createdAt), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                        {(inspection.local || inspection.condominio) && (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="hidden sm:inline text-border">•</span>
                            <span className="truncate">
                              {inspection.local} {inspection.local && inspection.condominio && "-"} {inspection.condominio}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="hidden sm:flex items-center justify-center h-10 w-10 rounded-full bg-muted/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
