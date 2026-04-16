import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, User, Building, Save, ShieldAlert } from "lucide-react";
import { useListUsers, useUpdateUserRole, getListUsersQueryKey, UserProfile, UpdateUserRoleBodyRole } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";


function UserRow({ user }: { user: UserProfile }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateUserRole = useUpdateUserRole();
  
  const [role, setRole] = useState<UpdateUserRoleBodyRole>(user.role);
  const [condominio, setCondominio] = useState(user.condominio || "");

  const hasChanges = role !== user.role || condominio !== (user.condominio || "");

  const handleSave = () => {
    updateUserRole.mutate({
      clerkId: user.clerkId,
      data: {
        role,
        condominio: condominio || undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: "Usuário atualizado com sucesso" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (err) => {
        toast({ 
          title: "Erro ao atualizar usuário", 
          description: err.error || "Ocorreu um erro.",
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{user.name || "Sem nome"}</div>
        <div className="text-sm text-muted-foreground">{user.email}</div>
      </TableCell>
      <TableCell>
        <Select value={role} onValueChange={(v) => setRole(v as UpdateUserRoleBodyRole)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="sindico">Síndico</SelectItem>
            <SelectItem value="vistoriador">Vistoriador</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input 
          value={condominio} 
          onChange={(e) => setCondominio(e.target.value)} 
          placeholder="Nome do condomínio"
          className="max-w-[200px]"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button 
          size="sm" 
          onClick={handleSave} 
          disabled={!hasChanges || updateUserRole.isPending}
        >
          {updateUserRole.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}

function MobileUserCard({ user }: { user: UserProfile }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateUserRole = useUpdateUserRole();
  
  const [role, setRole] = useState<UpdateUserRoleBodyRole>(user.role);
  const [condominio, setCondominio] = useState(user.condominio || "");

  const hasChanges = role !== user.role || condominio !== (user.condominio || "");

  const handleSave = () => {
    updateUserRole.mutate({
      clerkId: user.clerkId,
      data: {
        role,
        condominio: condominio || undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: "Usuário atualizado com sucesso" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (err) => {
        toast({ 
          title: "Erro ao atualizar usuário", 
          description: err.error || "Ocorreu um erro.",
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6 space-y-4">
        <div>
          <div className="font-semibold text-lg">{user.name || "Sem nome"}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
        
        <div className="space-y-3 pt-2 border-t">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Papel do Usuário
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as UpdateUserRoleBodyRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="sindico">Síndico</SelectItem>
                <SelectItem value="vistoriador">Vistoriador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" /> Condomínio
            </label>
            <Input 
              value={condominio} 
              onChange={(e) => setCondominio(e.target.value)} 
              placeholder="Ex: Edifício Central"
            />
          </div>
        </div>
        
        {hasChanges && (
          <Button 
            className="w-full mt-2" 
            onClick={handleSave} 
            disabled={updateUserRole.isPending}
          >
            {updateUserRole.isPending ? <Spinner className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const currentUser = useUser();
  const [, setLocation] = useLocation();

  if (currentUser && currentUser.role !== "admin") {
    setLocation("/app/nova-vistoria");
    return null;
  }

  const { data: users, isPending, isError } = useListUsers({
    query: {
      queryKey: getListUsersQueryKey()
    }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" />
          Administração
        </h1>
        <p className="text-muted-foreground">Gerencie os usuários e permissões do sistema.</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Usuários Cadastrados</CardTitle>
          <CardDescription>Defina quem é administrador, síndico ou vistoriador.</CardDescription>
        </CardHeader>
        
        {isPending ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        ) : isError || !users ? (
          <div className="text-center py-12 text-destructive">
            <p>Erro ao carregar usuários.</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Condomínio</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <UserRow key={user.id} user={user} />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden p-4 bg-muted/20">
              {users.map(user => (
                <MobileUserCard key={user.id} user={user} />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
