"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOrganizationSchema } from "@/validations/organization.schema";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Globe, Plus, Upload, Loader2 } from "lucide-react";
import { sileo } from "sileo";
import { useDebounce } from "@/hooks/useDebounce";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { TablePagination } from "@/components/tables/TablePagination";
import { SortableHeader } from "@/components/tables/SortableHeader";

type Country = {
  id: string;
  name: string;
  flagUrl: string | null;
};

type Organization = {
  id: string;
  name: string;
  rif: string;
  countryId: string | null;
  country?: Country | null;
  createdAt: string;
};

type FormData = z.infer<typeof createOrganizationSchema>;

type SortKey = "flag" | "name" | "rif" | "country" | "createdAt";
const sortableKeys = ["flag", "name", "rif", "country", "createdAt"] as const;

function isSortKey(value: string): value is SortKey {
  return (sortableKeys as ReadonlyArray<string>).includes(value);
}

export function OrganizationClient({ initialData }: { initialData: Organization[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [organizations, setOrganizations] = useState<Organization[]>(initialData);
  const [countries, setCountries] = useState<Country[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingFlag, setUploadingFlag] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportLimit, setExportLimit] = useState(100);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(createOrganizationSchema),
  });

  const selectedCountryId = watch("countryId");

  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const hasOrganizationsAdmin = permissionSet.has("organizations:ADMIN");
  const canCreate = hasOrganizationsAdmin || permissionSet.has("organizations:CREATE");
  const canUpdate = hasOrganizationsAdmin || permissionSet.has("organizations:UPDATE");
  const canDelete = hasOrganizationsAdmin || permissionSet.has("organizations:DELETE");
  const canExport = hasOrganizationsAdmin || permissionSet.has("organizations:EXPORT");

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === selectedCountryId),
    [countries, selectedCountryId],
  );

  const getCountryName = useCallback(
    (org: Organization) => org.country?.name || countries.find((country) => country.id === org.countryId)?.name || "-",
    [countries],
  );

  const getFlagUrl = useCallback(
    (org: Organization) => org.country?.flagUrl || countries.find((country) => country.id === org.countryId)?.flagUrl || null,
    [countries],
  );

  const filteredOrganizations = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return organizations;

    return organizations.filter((org) => {
      const name = org.name?.toLowerCase() ?? "";
      const rif = org.rif?.toLowerCase() ?? "";
      const country = getCountryName(org).toLowerCase();
      return name.includes(term) || rif.includes(term) || country.includes(term);
    });
  }, [debouncedSearch, getCountryName, organizations]);

  const sortedOrganizations = useMemo(() => {
    const direction = sortOrder === "asc" ? 1 : -1;
    const items = [...filteredOrganizations];

    items.sort((left, right) => {
      if (sortBy === "flag") {
        const leftValue = getFlagUrl(left) ? 1 : 0;
        const rightValue = getFlagUrl(right) ? 1 : 0;
        return (leftValue - rightValue) * direction;
      }

      if (sortBy === "createdAt") {
        const leftDate = new Date(left.createdAt).getTime();
        const rightDate = new Date(right.createdAt).getTime();
        return (leftDate - rightDate) * direction;
      }

      const leftValue =
        sortBy === "name"
          ? left.name
          : sortBy === "rif"
            ? left.rif
            : getCountryName(left);

      const rightValue =
        sortBy === "name"
          ? right.name
          : sortBy === "rif"
            ? right.rif
            : getCountryName(right);

      return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "es", { sensitivity: "base" }) * direction;
    });

    return items;
  }, [filteredOrganizations, getCountryName, getFlagUrl, sortBy, sortOrder]);

  const total = sortedOrganizations.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const pagedOrganizations = useMemo(() => {
    const start = (safePage - 1) * limit;
    return sortedOrganizations.slice(start, start + limit);
  }, [safePage, limit, sortedOrganizations]);

  async function refreshOrganizations() {
    const response = await fetch("/api/organizations", { cache: "no-store" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "No fue posible cargar organizaciones");
    }

    const payload = await response.json().catch(() => null);
    setOrganizations(payload?.data?.items ?? []);
  }

  async function loadCountries() {
    const response = await fetch("/api/countries");
    if (!response.ok) return;

    const payload = await response.json().catch(() => null);
    setCountries(payload?.data?.items ?? []);
  }

  useEffect(() => {
    const loadSessionAndCountries = async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionPayload = sessionResponse.ok ? await sessionResponse.json().catch(() => null) : null;
        const sessionPermissions = (sessionPayload?.user?.permissions ?? []) as string[];
        setPermissions(sessionPermissions);
      } catch {
        setPermissions([]);
      }

      await loadCountries();
    };

    void loadSessionAndCountries();
  }, []);

  function toggleSort(nextSortBy: string) {
    if (!isSortKey(nextSortBy)) {
      return;
    }

    const sortKey = nextSortBy;
    const isSameColumn = sortBy === sortKey;

    setPage(1);
    setSortBy(sortKey);
    setSortOrder(isSameColumn ? (sortOrder === "asc" ? "desc" : "asc") : "asc");
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);

    try {
      const url = editingId ? `/api/organizations/${editingId}` : "/api/organizations";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible guardar la organización");
      }

      setIsOpen(false);
      reset({ name: "", rif: "", countryId: "" });
      setEditingId(null);
      await refreshOrganizations();
      router.refresh();

      sileo.success({
        title: editingId ? "Organización actualizada" : "Organización creada",
        description: `Se guardó ${data.name}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      sileo.error({
        title: "No se pudo guardar",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFlagUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const countryId = selectedCountryId;
    if (!countryId) {
      sileo.warning({
        title: "País requerido",
        description: "Por favor selecciona un país primero.",
      });
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFlag(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/countries/${countryId}/flag`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible cargar la bandera");
      }

      const payload = await response.json().catch(() => null);
      const nextFlagUrl = payload?.data?.flagUrl ?? null;

      setCountries((prev) => prev.map((country) => (country.id === countryId ? { ...country, flagUrl: nextFlagUrl } : country)));

      sileo.success({
        title: "Bandera actualizada",
        description: "La bandera del país se cargó correctamente.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      sileo.error({
        title: "No se pudo cargar la bandera",
        description: message,
      });
    } finally {
      setUploadingFlag(false);
      event.target.value = "";
    }
  };

  const onEdit = (org: Organization) => {
    setEditingId(org.id);
    reset({
      name: org.name,
      rif: org.rif,
      countryId: org.countryId || "",
    });
    setIsOpen(true);
  };

  async function executeDelete(id: string, name: string) {
    try {
      setError(null);
      const response = await fetch(`/api/organizations/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible eliminar la organización");
      }

      setOrganizations((prev) => prev.filter((org) => org.id !== id));
      router.refresh();

      sileo.success({
        title: "Organización eliminada",
        description: `Se eliminó ${name}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      sileo.error({
        title: "No se pudo eliminar",
        description: message,
      });
    }
  }

  const onDelete = (id: string, name: string) => {
    sileo.action({
      title: "Confirmar eliminación",
      description: `Se eliminará la organización ${name}.`,
      duration: 7000,
      button: {
        title: "Eliminar",
        onClick: () => {
          void executeDelete(id, name);
        },
      },
    });
  };

  async function downloadExport(format: "csv" | "xlsx") {
    try {
      setExporting(true);
      setError(null);

      const params = new URLSearchParams({
        format,
        limit: String(exportLimit),
        sortBy,
        sortOrder,
      });

      const nextSearch = debouncedSearch.trim();
      if (nextSearch) {
        params.set("search", nextSearch);
      }

      const response = await fetch(`/api/organizations/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar organizaciones");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `organizations.${format}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      sileo.success({
        title: "Exportación lista",
        description: `Se generó el archivo correctamente (máx. ${exportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      sileo.error({
        title: "No se pudo exportar",
        description: message,
      });
    } finally {
      setExporting(false);
    }
  }

  async function onImportOrganizations(file: File) {
    try {
      setImporting(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/organizations/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar organizaciones");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; name?: string; error: string }>;
          }
        | undefined;

      await refreshOrganizations();
      await loadCountries();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creadas: ${created} · Actualizadas: ${updated} · Omitidas: ${skipped}`;

      if (errorCount > 0) {
        sileo.warning({
          title: "Importación parcial",
          description: `${description} · Errores: ${errorCount}`,
        });
      } else {
        sileo.success({
          title: "Importación completada",
          description,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      sileo.error({
        title: "No se pudo importar",
        description: message,
      });
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Organizaciones</h1>

        <div className="flex items-center gap-2">
          {canCreate ? (
            <>
              <input
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onImportOrganizations(file);
                }}
                ref={importInputRef}
                type="file"
              />
              <button
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
                disabled={importing}
                onClick={() => importInputRef.current?.click()}
                type="button"
              >
                Importar
              </button>
            </>
          ) : null}

          {canExport ? (
            <>
              <button
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
                disabled={exporting}
                onClick={() => void downloadExport("csv")}
                type="button"
              >
                Exportar CSV
              </button>
              <button
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
                disabled={exporting}
                onClick={() => void downloadExport("xlsx")}
                type="button"
              >
                Exportar Excel
              </button>
            </>
          ) : null}

          {canCreate ? (
            <Dialog
              open={isOpen}
              onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) {
                  setEditingId(null);
                  reset({ name: "", rif: "", countryId: "" });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva Organización
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-125">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Organización" : "Nueva Organización"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input id="name" {...register("name")} placeholder="Nombre de la empresa" />
                    {errors.name ? <p className="text-sm text-red-500">{errors.name.message}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rif">RIF / Identificación</Label>
                    <Input id="rif" {...register("rif")} placeholder="J-12345678-9" />
                    {errors.rif ? <p className="text-sm text-red-500">{errors.rif.message}</p> : null}
                  </div>

                  <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="countryId">País</Label>
                      <select
                        id="countryId"
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        {...register("countryId")}
                      >
                        <option value="">Seleccione un país</option>
                        {countries.map((country) => (
                          <option key={country.id} value={country.id}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                      {errors.countryId ? <p className="text-sm text-red-500">{errors.countryId.message}</p> : null}
                    </div>

                    {selectedCountryId ? (
                      <div className="space-y-3 pt-2">
                        <Label>Bandera del País</Label>
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-20 items-center justify-center overflow-hidden rounded border bg-background text-muted-foreground shadow-sm">
                            {selectedCountry?.flagUrl ? (
                              <Image src={selectedCountry.flagUrl} alt="Flag" className="h-full w-full object-cover" height={48} width={80} />
                            ) : (
                              <Globe className="h-6 w-6 opacity-30" />
                            )}
                          </div>
                          <div className="flex-1">
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFlagUpload}
                              className="hidden"
                              accept="image/*"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingFlag}
                            >
                              {uploadingFlag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                              {selectedCountry?.flagUrl ? "Cargar nueva bandera" : "Cargar bandera"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {loading ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      <TableToolbar
        canExport={canExport}
        exportLimit={exportLimit}
        limit={limit}
        onExportLimitChange={(value) => setExportLimit(value)}
        onLimitChange={(value) => {
          setPage(1);
          setLimit(value);
        }}
        onSearchChange={(value) => {
          setPage(1);
          setSearch(value);
        }}
        search={search}
        searchPlaceholder="Buscar organizaciones"
        total={total}
      />

      {loading ? <p className="text-sm">Cargando...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">
                <SortableHeader label="Bandera" onToggle={toggleSort} sortBy={sortBy} sortKey="flag" sortOrder={sortOrder} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Nombre" onToggle={toggleSort} sortBy={sortBy} sortKey="name" sortOrder={sortOrder} />
              </TableHead>
              <TableHead>
                <SortableHeader label="RIF" onToggle={toggleSort} sortBy={sortBy} sortKey="rif" sortOrder={sortOrder} />
              </TableHead>
              <TableHead>
                <SortableHeader label="País" onToggle={toggleSort} sortBy={sortBy} sortKey="country" sortOrder={sortOrder} />
              </TableHead>
              <TableHead>
                <SortableHeader
                  label="Fecha Creación"
                  onToggle={toggleSort}
                  sortBy={sortBy}
                  sortKey="createdAt"
                  sortOrder={sortOrder}
                />
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedOrganizations.map((org) => {
              const flagUrl = getFlagUrl(org);
              const countryName = getCountryName(org);

              return (
                <TableRow key={org.id}>
                  <TableCell>
                    {flagUrl ? (
                      <Image src={flagUrl} alt="Flag" className="h-6 w-10 rounded border border-muted object-cover shadow-sm" height={24} width={40} />
                    ) : (
                      <Globe className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>{org.rif}</TableCell>
                  <TableCell>{countryName}</TableCell>
                  <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(org)} disabled={!canUpdate}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(org.id, org.name)}
                        disabled={!canDelete}
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && pagedOrganizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No hay organizaciones registradas.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        loading={loading}
        onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
        onPrev={() => setPage((current) => Math.max(1, current - 1))}
        page={safePage}
        total={total}
        totalPages={totalPages}
      />
    </div>
  );
}
