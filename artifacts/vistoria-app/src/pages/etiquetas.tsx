import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import {
  useListCondominios, useListAssets, getListAssetsQueryKey,
} from "@workspace/api-client-react";
import { QrCode, Printer, ArrowLeft, Loader2, Package, Filter, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const CRITICIDADE_BORDER: Record<string, string> = {
  alta: "border-red-500",
  media: "border-yellow-500",
  baixa: "border-green-500",
};

export default function EtiquetasPage() {
  const [, setLocation] = useLocation();
  const [condominioId, setCondominioId] = useState<string>("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [qrDataUrls, setQrDataUrls] = useState<Record<number, string>>({});
  const [labelSize, setLabelSize] = useState<"small" | "medium" | "large">("medium");

  const { data: condominios } = useListCondominios();
  const condominioIdNum = condominioId ? parseInt(condominioId, 10) : undefined;

  const queryParams = useMemo(
    () => (tipoFilter !== "all" ? { tipo: tipoFilter as any } : {}),
    [tipoFilter]
  );

  const { data: assets, isPending } = useListAssets(
    condominioIdNum ?? 0,
    queryParams,
    { query: { enabled: !!condominioIdNum, queryKey: getListAssetsQueryKey(condominioIdNum ?? 0, queryParams) } }
  );

  const condominio = condominios?.find(c => c.id === condominioIdNum);

  const baseUrl = useMemo(() => {
    const origin = window.location.origin;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${origin}${basePath}`;
  }, []);

  useEffect(() => {
    if (!assets) return;
    const toGenerate = assets.filter(a => selectedIds.has(a.id) && !qrDataUrls[a.id]);
    if (toGenerate.length === 0) return;

    Promise.all(
      toGenerate.map(async a => {
        const url = `${baseUrl}/ativo/${a.id}`;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 400,
          margin: 1,
          errorCorrectionLevel: "M",
        });
        return [a.id, dataUrl] as const;
      })
    ).then(results => {
      setQrDataUrls(prev => {
        const next = { ...prev };
        for (const [id, dataUrl] of results) next[id] = dataUrl;
        return next;
      });
    });
  }, [assets, selectedIds, qrDataUrls, baseUrl]);

  const toggleAll = () => {
    if (!assets) return;
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map(a => a.id)));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedAssets = useMemo(
    () => (assets ?? []).filter(a => selectedIds.has(a.id)),
    [assets, selectedIds]
  );

  const sizeClass = labelSize === "small"
    ? "w-[5cm] h-[5cm]"
    : labelSize === "large"
      ? "w-[10cm] h-[10cm]"
      : "w-[7cm] h-[7cm]";

  const qrSizeClass = labelSize === "small"
    ? "w-[3cm] h-[3cm]"
    : labelSize === "large"
      ? "w-[6cm] h-[6cm]"
      : "w-[4.5cm] h-[4.5cm]";

  return (
    <div className="space-y-6 pb-12">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            padding: 0.5cm;
          }
          .no-print { display: none !important; }
          @page { margin: 1cm; }
        }
      `}</style>

      <div className="no-print space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/app/ativos")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <QrCode className="h-6 w-6 text-primary" />
              Etiquetas QR Code
            </h1>
            <p className="text-muted-foreground text-sm">
              Gere etiquetas com QR code para os ativos do condomínio. Ao escanear, zelador ou prestador acessa as informações e pode registrar uma ocorrência.
            </p>
          </div>
        </div>

        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Condomínio</Label>
              <Select value={condominioId} onValueChange={(v) => {
                setCondominioId(v);
                setSelectedIds(new Set());
                setQrDataUrls({});
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione um condomínio" /></SelectTrigger>
                <SelectContent>
                  {(condominios ?? []).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo de ativo</Label>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="equipamento">Equipamento</SelectItem>
                  <SelectItem value="estrutura">Estrutura</SelectItem>
                  <SelectItem value="sistema">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Tamanho da etiqueta</Label>
              <Select value={labelSize} onValueChange={(v: any) => setLabelSize(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Pequena (5×5 cm)</SelectItem>
                  <SelectItem value="medium">Média (7×7 cm)</SelectItem>
                  <SelectItem value="large">Grande (10×10 cm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {!condominioIdNum ? (
          <div className="text-center py-16">
            <QrCode className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Selecione um condomínio para começar.</p>
          </div>
        ) : isPending ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !assets || assets.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum ativo cadastrado neste condomínio.</p>
          </div>
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={toggleAll}>
                    {selectedIds.size === assets.length ? (
                      <><CheckSquare className="h-4 w-4 mr-1" /> Desmarcar tudo</>
                    ) : (
                      <><Square className="h-4 w-4 mr-1" /> Selecionar tudo</>
                    )}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} de {assets.length} selecionado(s)
                  </span>
                </div>
                <Button
                  onClick={handlePrint}
                  disabled={selectedIds.size === 0}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir {selectedIds.size} etiqueta(s)
                </Button>
              </div>
            </Card>

            <div className="grid gap-2 sm:grid-cols-2">
              {assets.map(a => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(a.id)}
                    onCheckedChange={() => toggleOne(a.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.nome}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {a.tipo} · {a.criticidade}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedAssets.length > 0 && (
        <div id="print-area" className="hidden print:block">
          <div className="flex flex-wrap gap-4">
            {selectedAssets.map(a => {
              const qr = qrDataUrls[a.id];
              return (
                <div
                  key={a.id}
                  className={`${sizeClass} border-2 ${CRITICIDADE_BORDER[a.criticidade] ?? "border-gray-400"} rounded-lg p-2 flex flex-col items-center justify-between bg-white text-black break-inside-avoid`}
                  style={{ pageBreakInside: "avoid" }}
                >
                  <div className="text-center w-full">
                    <p className="text-[10px] font-semibold uppercase tracking-wide truncate">
                      {condominio?.nome}
                    </p>
                  </div>
                  {qr ? (
                    <img src={qr} alt="QR" className={qrSizeClass} />
                  ) : (
                    <div className={`${qrSizeClass} flex items-center justify-center`}>
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                  <div className="text-center w-full">
                    <p className="text-xs font-bold leading-tight truncate">{a.nome}</p>
                    <p className="text-[9px] text-gray-600 capitalize">#{a.id} · {a.tipo}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Screen preview of labels */}
      {selectedAssets.length > 0 && (
        <div className="no-print space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Pré-visualização</h2>
          <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
            {selectedAssets.map(a => {
              const qr = qrDataUrls[a.id];
              return (
                <div
                  key={a.id}
                  className={`${sizeClass} border-2 ${CRITICIDADE_BORDER[a.criticidade] ?? "border-gray-400"} rounded-lg p-2 flex flex-col items-center justify-between bg-white text-black`}
                >
                  <div className="text-center w-full">
                    <p className="text-[10px] font-semibold uppercase tracking-wide truncate">
                      {condominio?.nome}
                    </p>
                  </div>
                  {qr ? (
                    <img src={qr} alt="QR" className={qrSizeClass} />
                  ) : (
                    <div className={`${qrSizeClass} flex items-center justify-center`}>
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                  <div className="text-center w-full">
                    <p className="text-xs font-bold leading-tight truncate">{a.nome}</p>
                    <p className="text-[9px] text-gray-600 capitalize">#{a.id} · {a.tipo}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
