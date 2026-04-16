import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useListCondominios } from "@workspace/api-client-react";
import { CalendarDays, Plus, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/components/layout";

interface Reserva {
  id: number;
  condominioId: number;
  areaId: number;
  moradorNome: string;
  unidade: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  status: string;
  observacao: string | null;
  motivoRejeicao: string | null;
  createdAt: string;
}

interface Area {
  id: number;
  nome: string;
  tipo: string;
}

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-50 text-yellow-700 border-yellow-200",
  aprovada: "bg-green-50 text-green-700 border-green-200",
  rejeitada: "bg-red-50 text-red-700 border-red-200",
  cancelada: "bg-gray-50 text-gray-500 border-gray-200",
};

const STATUS_ICONS: Record<string, any> = {
  pendente: Clock,
  aprovada: CheckCircle2,
  rejeitada: XCircle,
  cancelada: XCircle,
};

const pt = (lang: string) => lang === "pt";

export default function ReservasPage() {
  const { i18n } = useTranslation();
  const user = useUser();
  const { toast } = useToast();
  const isPt = pt(i18n.language);

  const [condominioId, setCondominioId] = useState<string>("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ areaId: "", moradorNome: "", unidade: "", data: "", horaInicio: "08:00", horaFim: "10:00", observacao: "" });
  const [isSaving, setIsSaving] = useState(false);

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");

  const { data: condominios } = useListCondominios();
  const canManage = user?.role === "admin" || user?.role === "sindico";

  const loadAreas = async (condId: string) => {
    try {
      const res = await fetch(`/api/condominios/${condId}/areas`);
      if (res.ok) setAreas(await res.json());
    } catch {}
  };

  const loadReservas = async (condId: string) => {
    if (!condId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== "todos") params.set("status", filterStatus);
      const res = await fetch(`/api/condominios/${condId}/reservas?${params}`);
      if (res.ok) setReservas(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const handleCondominioChange = (val: string) => {
    setCondominioId(val);
    loadAreas(val);
    loadReservas(val);
  };

  const openCreate = () => {
    const today = new Date().toISOString().split("T")[0];
    setForm({ areaId: "", moradorNome: "", unidade: "", data: today, horaInicio: "08:00", horaFim: "10:00", observacao: "" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.areaId || !form.moradorNome || !form.unidade || !form.data || !form.horaInicio || !form.horaFim) {
      toast({ title: isPt ? "Preencha todos os campos obrigatórios" : "Fill in required fields", variant: "destructive" }); return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/condominios/${condominioId}/reservas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, areaId: parseInt(form.areaId), observacao: form.observacao || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error || (isPt ? "Erro ao criar reserva" : "Error creating reservation"), variant: "destructive" }); return;
      }
      toast({ title: isPt ? "Reserva solicitada!" : "Reservation requested!" });
      setShowDialog(false);
      loadReservas(condominioId);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (id: number) => {
    await fetch(`/api/condominios/${condominioId}/reservas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "aprovada" }),
    });
    toast({ title: isPt ? "Reserva aprovada!" : "Reservation approved!" });
    loadReservas(condominioId);
  };

  const handleReject = async () => {
    if (!rejectId) return;
    await fetch(`/api/condominios/${condominioId}/reservas/${rejectId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejeitada", motivoRejeicao: rejectMotivo || null }),
    });
    toast({ title: isPt ? "Reserva rejeitada" : "Reservation rejected" });
    setShowRejectDialog(false);
    setRejectId(null);
    setRejectMotivo("");
    loadReservas(condominioId);
  };

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  }, [currentWeekStart]);

  const DAY_NAMES_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayNames = isPt ? DAY_NAMES_PT : DAY_NAMES_EN;

  const prevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };

  const reservasByDay = useMemo(() => {
    const map: Record<string, Reserva[]> = {};
    weekDays.forEach(d => map[d] = []);
    reservas.forEach(r => { if (map[r.data]) map[r.data].push(r); });
    return map;
  }, [reservas, weekDays]);

  const areaName = (areaId: number) => areas.find(a => a.id === areaId)?.nome ?? `Área ${areaId}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            {isPt ? "Reservas" : "Reservations"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isPt ? "Agende e gerencie reservas de áreas comuns" : "Schedule and manage common area reservations"}
          </p>
        </div>
        {condominioId && (
          <Button onClick={openCreate} data-testid="button-nova-reserva">
            <Plus className="h-4 w-4 mr-2" />
            {isPt ? "Nova Reserva" : "New Reservation"}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={condominioId} onValueChange={handleCondominioChange}>
              <SelectTrigger><SelectValue placeholder={isPt ? "Selecionar condomínio" : "Select condominium"} /></SelectTrigger>
              <SelectContent>
                {condominios?.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); if (condominioId) loadReservas(condominioId); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{isPt ? "Todos os status" : "All statuses"}</SelectItem>
                <SelectItem value="pendente">{isPt ? "Pendente" : "Pending"}</SelectItem>
                <SelectItem value="aprovada">{isPt ? "Aprovada" : "Approved"}</SelectItem>
                <SelectItem value="rejeitada">{isPt ? "Rejeitada" : "Rejected"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!condominioId ? (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{isPt ? "Selecione um condomínio para ver as reservas" : "Select a condominium to view reservations"}</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Week Calendar View */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
                <CardTitle className="text-base">
                  {new Date(weekDays[0]).toLocaleDateString(isPt ? "pt-BR" : "en-US", { month: "long", year: "numeric" })}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day, i) => {
                  const isToday = day === new Date().toISOString().split("T")[0];
                  const dayReservas = reservasByDay[day] || [];
                  return (
                    <div key={day} className={`min-h-[100px] border rounded-md p-1.5 ${isToday ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {dayNames[i]} {new Date(day + "T12:00:00").getDate()}
                      </div>
                      {dayReservas.map((r) => {
                        const StatusIcon = STATUS_ICONS[r.status] || Clock;
                        return (
                          <div key={r.id} className={`text-[10px] rounded px-1 py-0.5 mb-0.5 border ${STATUS_COLORS[r.status] || ""}`}>
                            <div className="font-medium truncate flex items-center gap-0.5">
                              <StatusIcon className="h-2.5 w-2.5 shrink-0" />
                              {r.horaInicio}-{r.horaFim}
                            </div>
                            <div className="truncate">{areaName(r.areaId)}</div>
                            <div className="truncate opacity-75">{r.moradorNome} · {r.unidade}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Pending approvals */}
          {canManage && reservas.filter(r => r.status === "pendente").length > 0 && (
            <Card className="border-yellow-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  {isPt ? "Aguardando aprovação" : "Pending approval"} ({reservas.filter(r => r.status === "pendente").length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reservas.filter(r => r.status === "pendente").map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-yellow-50/50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{areaName(r.areaId)} — {r.data}</p>
                      <p className="text-xs text-muted-foreground">{r.horaInicio} - {r.horaFim} · {r.moradorNome} ({r.unidade})</p>
                      {r.observacao && <p className="text-xs text-muted-foreground mt-0.5 italic">{r.observacao}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleApprove(r.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{isPt ? "Aprovar" : "Approve"}
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setRejectId(r.id); setRejectMotivo(""); setShowRejectDialog(true); }}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />{isPt ? "Rejeitar" : "Reject"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Create dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isPt ? "Nova Reserva" : "New Reservation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{isPt ? "Área *" : "Area *"}</Label>
              <Select value={form.areaId} onValueChange={(v) => setForm({ ...form, areaId: v })}>
                <SelectTrigger><SelectValue placeholder={isPt ? "Selecionar área" : "Select area"} /></SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (<SelectItem key={a.id} value={String(a.id)}>{a.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isPt ? "Nome do morador *" : "Resident name *"}</Label>
                <Input value={form.moradorNome} onChange={(e) => setForm({ ...form, moradorNome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{isPt ? "Unidade *" : "Unit *"}</Label>
                <Input placeholder="101" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{isPt ? "Data *" : "Date *"}</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isPt ? "Horário início *" : "Start time *"}</Label>
                <Input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{isPt ? "Horário fim *" : "End time *"}</Label>
                <Input type="time" value={form.horaFim} onChange={(e) => setForm({ ...form, horaFim: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{isPt ? "Observação" : "Notes"}</Label>
              <Textarea placeholder={isPt ? "Motivo da reserva..." : "Reservation reason..."} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{isPt ? "Cancelar" : "Cancel"}</Button></DialogClose>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isPt ? "Solicitar" : "Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isPt ? "Rejeitar Reserva" : "Reject Reservation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>{isPt ? "Motivo da rejeição (opcional)" : "Rejection reason (optional)"}</Label>
            <Textarea value={rejectMotivo} onChange={(e) => setRejectMotivo(e.target.value)} rows={3} placeholder={isPt ? "Ex: Área em manutenção..." : "e.g. Area under maintenance..."} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{isPt ? "Cancelar" : "Cancel"}</Button></DialogClose>
            <Button variant="destructive" onClick={handleReject}>
              {isPt ? "Rejeitar" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
