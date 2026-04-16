import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Shield, Save, ShieldAlert, Loader2, AlertCircle } from "lucide-react";
import { useListUsers, useUpdateUserRole, getListUsersQueryKey, UserProfile, UpdateUserRoleBodyRole } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function UserRow({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateUserRole = useUpdateUserRole();

  const [role, setRole] = useState<string>(user.role);
  const [condominio, setCondominio] = useState(user.condominio || "");

  const handleSave = () => {
    updateUserRole.mutate(
      { clerkId: user.clerkId, data: { role: role as UpdateUserRoleBodyRole, condominio: condominio || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: t("admin.savedSuccess") });
        },
        onError: () => {
          toast({ title: t("admin.errorSaving"), variant: "destructive" });
        },
      }
    );
  };

  const roleColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    sindico: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    vistoriador: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  };

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium text-sm">{user.name || "—"}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={roleColors[user.role] || ""}>
          {t(`admin.roles.${user.role}`)}
        </Badge>
      </TableCell>
      <TableCell>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid={`select-role-${user.clerkId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">{t("admin.roles.admin")}</SelectItem>
            <SelectItem value="sindico">{t("admin.roles.sindico")}</SelectItem>
            <SelectItem value="vistoriador">{t("admin.roles.vistoriador")}</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={condominio}
          onChange={(e) => setCondominio(e.target.value)}
          placeholder={t("admin.condominioPlaceholder")}
          className="h-8 text-xs w-40"
          data-testid={`input-condominio-${user.clerkId}`}
        />
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={updateUserRole.isPending}
          className="h-8 text-xs"
          data-testid={`button-save-user-${user.clerkId}`}
        >
          {updateUserRole.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <><Save className="h-3 w-3 mr-1" />{t("admin.saveChanges")}</>
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function AdminPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const currentUser = useUser();

  const { data: users, isPending, isError } = useListUsers({
    query: { queryKey: getListUsersQueryKey() }
  });

  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive opacity-50 mb-4" />
        <p className="text-muted-foreground">{t("admin.accessDenied")}</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/app/nova-vistoria")}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.title")}</h1>
          <p className="text-muted-foreground">{t("admin.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.title")}</CardTitle>
          <CardDescription>{t("admin.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isPending ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-destructive px-6">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("admin.errorLoading")}</p>
            </div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-6">
              <p>{t("admin.noUsers")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.name")}</TableHead>
                    <TableHead>{t("admin.role")}</TableHead>
                    <TableHead>Nova {t("admin.role")}</TableHead>
                    <TableHead>{t("admin.condominio")}</TableHead>
                    <TableHead>{t("admin.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <UserRow key={user.clerkId} user={user} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
