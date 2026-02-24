"use client";

import { useState, useEffect, useRef } from "react";
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

export function OrganizationClient({ initialData }: { initialData: Organization[] }) {
    const [organizations, setOrganizations] = useState<Organization[]>(initialData);
    const [countries, setCountries] = useState<Country[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploadingFlag, setUploadingFlag] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(createOrganizationSchema),
    });

    const selectedCountryId = watch("countryId");

    useEffect(() => {
        const loadCountries = async () => {
            const res = await fetch("/api/countries");
            if (res.ok) {
                const data = await res.json();
                setCountries(data.data.items);
            }
        };
        loadCountries();
    }, []);

    const onSubmit = async (data: FormData) => {
        setLoading(true);
        try {
            const url = editingId ? `/api/organizations/${editingId}` : "/api/organizations";
            const method = editingId ? "PATCH" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                setIsOpen(false);
                reset();
                setEditingId(null);
                router.refresh();
                const updatedResponse = await fetch("/api/organizations");
                const updatedData = await updatedResponse.json();
                setOrganizations(updatedData.data.items);
            }
        } catch (error) {
            console.error("Error saving organization:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFlagUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const countryId = selectedCountryId;
        if (!countryId) {
            alert("Por favor seleccione un país primero");
            return;
        }

        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingFlag(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`/api/countries/${countryId}/flag`, {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                // Update countries list to show new flag
                setCountries(countries.map(c =>
                    c.id === countryId ? { ...c, flagUrl: data.data.flagUrl } : c
                ));
            }
        } catch (error) {
            console.error("Error uploading flag:", error);
        } finally {
            setUploadingFlag(false);
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

    const onDelete = async (id: string) => {
        if (!confirm("¿Está seguro de eliminar esta organización?")) return;

        try {
            const response = await fetch(`/api/organizations/${id}`, { method: "DELETE" });
            if (response.ok) {
                setOrganizations(organizations.filter(o => o.id !== id));
                router.refresh();
            }
        } catch (error) {
            console.error("Error deleting organization:", error);
        }
    };

    const selectedCountry = countries.find(c => c.id === selectedCountryId);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Organizaciones</h1>
                <Dialog open={isOpen} onOpenChange={(open) => {
                    setIsOpen(open);
                    if (!open) {
                        setEditingId(null);
                        reset({ name: "", rif: "", countryId: "" });
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nueva Organización
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Editar Organización" : "Nueva Organización"}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre</Label>
                                <Input id="name" {...register("name")} placeholder="Nombre de la empresa" />
                                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="rif">RIF / Identificación</Label>
                                <Input id="rif" {...register("rif")} placeholder="J-12345678-9" />
                                {errors.rif && <p className="text-sm text-red-500">{errors.rif.message}</p>}
                            </div>

                            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                                <div className="space-y-2">
                                    <Label htmlFor="countryId">País</Label>
                                    <select
                                        id="countryId"
                                        className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        {...register("countryId")}
                                    >
                                        <option value="">Seleccione un país</option>
                                        {countries.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    {errors.countryId && <p className="text-sm text-red-500">{errors.countryId.message}</p>}
                                </div>

                                {selectedCountryId && (
                                    <div className="space-y-3 pt-2">
                                        <Label>Bandera del País</Label>
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-12 w-20 items-center justify-center overflow-hidden rounded border bg-background text-muted-foreground shadow-sm">
                                                {selectedCountry?.flagUrl ? (
                                                    <img src={selectedCountry.flagUrl} alt="Flag" className="h-full w-full object-cover" />
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
                                )}
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
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Bandera</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>RIF</TableHead>
                            <TableHead>País</TableHead>
                            <TableHead>Fecha Creación</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {organizations.map((org) => (
                            <TableRow key={org.id}>
                                <TableCell>
                                    {(org.country?.flagUrl || countries.find(c => c.id === org.countryId)?.flagUrl) ? (
                                        <img
                                            src={org.country?.flagUrl || countries.find(c => c.id === org.countryId)?.flagUrl || ""}
                                            alt="Flag"
                                            className="h-6 w-10 object-cover rounded shadow-sm border border-muted"
                                        />
                                    ) : (
                                        <Globe className="h-5 w-5 text-muted-foreground/40" />
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">{org.name}</TableCell>
                                <TableCell>{org.rif}</TableCell>
                                <TableCell>{org.country?.name || countries.find(c => c.id === org.countryId)?.name || "-"}</TableCell>
                                <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => onEdit(org)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onDelete(org.id)}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {organizations.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No hay organizaciones registradas.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
