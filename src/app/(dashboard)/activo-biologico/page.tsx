"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { sileo } from "sileo";

type Level2Item = { id: string; code: string; name: string };
type Level3Item = { id: string; code: string; name: string };
type Level4Item = { id: string; code: string; name: string; _count?: { level6Assets?: number } };

type BiologicalAssetItem = {
  id: string;
  level4Id: string;
  biologicalAssetKey: string;
  accountingKey: string | null;
  establishmentDate: string | null;
  plantingYear: number | null;
  geneticMaterialCode: string | null;
  geneticMaterialName: string | null;
  assetType: "COMERCIAL" | "INVESTIGACION";
  managementSchemeCode: string | null;
  managementSchemeName: string | null;
  inventoryCode: string | null;
  inventoryType: string | null;
  inventoryDate: string | null;
  inventoryAgeYears: number | null;
  level5UnitCount: number | null;
  spacingCode: string | null;
  spacingDescription: string | null;
  spacingBetweenRowsM: string | number | null;
  spacingBetweenTreesM: string | number | null;
  treeDensityPerHa: string | number | null;
  survivalRate: string | number | null;
  dominantHeightM: string | number | null;
  meanHeightM: string | number | null;
  quadraticDiameterM: string | number | null;
  basalAreaM2: string | number | null;
  unitVolumeM3NoBarkPerHa: string | number | null;
  unitVolumeM3WithBarkPerHa: string | number | null;
  totalVolumeM3NoBark: string | number | null;
  totalVolumeM3WithBark: string | number | null;
  adjustedVolumeM3NoBarkPerHa: string | number | null;
  adjustedVolumeM3WithBarkPerHa: string | number | null;
  imaClassCode: string | null;
  imaClassName: string | null;
  actualCostUsd: string | number | null;
  isActive: boolean;
};

type Pagination = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
};

type PaginatedResponse<T> = {
  items: T[];
  pagination: Pagination;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[]>;
  };
};

const limits = [10, 25, 50] as const;
const selectorFieldClass = "w-full rounded-md border bg-gray-100 px-3 py-2";
const readonlyFieldClass = "w-full rounded-md border bg-gray-100 px-3 py-2";
const compactSelectorClass = "rounded-md border bg-gray-100 px-3 py-2";

type SimpleCatalogOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type SpacingOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  betweenRowsM: string | number | null;
  betweenTreesM: string | number | null;
  treeDensityPerHa: string | number | null;
  isActive: boolean;
};

type ImaClassOption = {
  id: string;
  code: string;
  name: string;
  classification: string;
  isActive: boolean;
};

type AssetFormState = {
  biologicalAssetKey: string;
  accountingKey: string;
  establishmentDate: string;
  plantingYear: string;
  geneticMaterialCode: string;
  geneticMaterialName: string;
  assetType: "COMERCIAL" | "INVESTIGACION";
  managementSchemeCode: string;
  managementSchemeName: string;
  inventoryCode: string;
  inventoryType: string;
  inventoryDate: string;
  inventoryAgeYears: string;
  level5UnitCount: string;
  spacingCode: string;
  spacingDescription: string;
  spacingBetweenRowsM: string;
  spacingBetweenTreesM: string;
  treeDensityPerHa: string;
  survivalRate: string;
  dominantHeightM: string;
  meanHeightM: string;
  quadraticDiameterM: string;
  basalAreaM2: string;
  unitVolumeM3NoBarkPerHa: string;
  unitVolumeM3WithBarkPerHa: string;
  totalVolumeM3NoBark: string;
  totalVolumeM3WithBark: string;
  adjustedVolumeM3NoBarkPerHa: string;
  adjustedVolumeM3WithBarkPerHa: string;
  imaClassCode: string;
  imaClassName: string;
  actualCostUsd: string;
  isActive: boolean;
};

const initialForm: AssetFormState = {
  biologicalAssetKey: "",
  accountingKey: "",
  establishmentDate: "",
  plantingYear: "",
  geneticMaterialCode: "",
  geneticMaterialName: "",
  assetType: "COMERCIAL",
  managementSchemeCode: "",
  managementSchemeName: "",
  inventoryCode: "",
  inventoryType: "",
  inventoryDate: "",
  inventoryAgeYears: "",
  level5UnitCount: "",
  spacingCode: "",
  spacingDescription: "",
  spacingBetweenRowsM: "",
  spacingBetweenTreesM: "",
  treeDensityPerHa: "",
  survivalRate: "",
  dominantHeightM: "",
  meanHeightM: "",
  quadraticDiameterM: "",
  basalAreaM2: "",
  unitVolumeM3NoBarkPerHa: "",
  unitVolumeM3WithBarkPerHa: "",
  totalVolumeM3NoBark: "",
  totalVolumeM3WithBark: "",
  adjustedVolumeM3NoBarkPerHa: "",
  adjustedVolumeM3WithBarkPerHa: "",
  imaClassCode: "",
  imaClassName: "",
  actualCostUsd: "",
  isActive: true,
};

function stringValue(value: string | null | undefined) {
  return value ?? "";
}

function numberValue(value: string | number | null | undefined) {
  if (value == null) return "";
  return String(value);
}

function toNullableString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableIsoDate(value: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toISOString();
}

function fromIsoDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function getYearFromDateInput(value: string) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return String(parsed.getFullYear());
}

function getInventoryAgeYears(establishmentDate: string, inventoryDate: string) {
  if (!establishmentDate || !inventoryDate) return "";
  const start = new Date(`${establishmentDate}T00:00:00`);
  const end = new Date(`${inventoryDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return "";
  const years = diffMs / (365.25 * 24 * 60 * 60 * 1000);
  return years.toFixed(2);
}

function getApiErrorMessage<T>(result: ApiResponse<T>, fallback: string) {
  if (result.error) {
    const fieldError = Object.values(result.details?.fieldErrors ?? {}).find((errors) => errors?.length)?.[0];
    const formError = result.details?.formErrors?.[0];
    if (fieldError || formError) {
      return `${result.error}: ${fieldError ?? formError}`;
    }

    return result.error;
  }

  return fallback;
}

async function fetchAllPages<T>(endpoint: string, limit = 100): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const response = await fetch(`${endpoint}${separator}page=${page}&limit=${limit}`, { cache: "no-store" });
    const result = (await response.json()) as ApiResponse<PaginatedResponse<T>>;

    if (!response.ok || !result.success || !result.data) return items;

    items.push(...(result.data.items ?? []));
    if (page >= (result.data.pagination?.totalPages ?? 1)) return items;
    page += 1;
  }
}

export default function ActivoBiologicoPage() {
  const [level2Items, setLevel2Items] = useState<Level2Item[]>([]);
  const [level3Items, setLevel3Items] = useState<Level3Item[]>([]);
  const [level4Items, setLevel4Items] = useState<Level4Item[]>([]);
  const [items, setItems] = useState<BiologicalAssetItem[]>([]);
  const [geneticMaterialOptions, setGeneticMaterialOptions] = useState<SimpleCatalogOption[]>([]);
  const [managementSchemeOptions, setManagementSchemeOptions] = useState<SimpleCatalogOption[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<SimpleCatalogOption[]>([]);
  const [spacingOptions, setSpacingOptions] = useState<SpacingOption[]>([]);
  const [imaClassOptions, setImaClassOptions] = useState<ImaClassOption[]>([]);

  const [selectedLevel2Id, setSelectedLevel2Id] = useState("");
  const [selectedLevel3Id, setSelectedLevel3Id] = useState("");
  const [selectedLevel4Id, setSelectedLevel4Id] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(25);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, totalPages: 1, total: 0, limit: 25 });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetFormState>(initialForm);

  const canSubmit = useMemo(() => {
    return selectedLevel4Id.length > 0 && form.biologicalAssetKey.trim().length > 0;
  }, [form.biologicalAssetKey, selectedLevel4Id]);

  async function loadLevel2() {
    const response = await fetch(`/api/forest/patrimony?level=2&page=1&limit=100`, { cache: "no-store" });
    const result = (await response.json()) as ApiResponse<{ items: Level2Item[] }>;

    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error ?? "No fue posible cargar nivel 2");
    }

    setLevel2Items(result.data.items);
    setSelectedLevel2Id((current) => current || result.data?.items?.[0]?.id || "");
  }

  async function loadLevel3(level2Id: string) {
    if (!level2Id) {
      setLevel3Items([]);
      setSelectedLevel3Id("");
      return;
    }

    const response = await fetch(`/api/forest/patrimony?level=3&parentId=${level2Id}&page=1&limit=100`, { cache: "no-store" });
    const result = (await response.json()) as ApiResponse<{ items: Level3Item[] }>;

    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error ?? "No fue posible cargar nivel 3");
    }

    setLevel3Items(result.data.items);
    setSelectedLevel3Id((current) => current || result.data?.items?.[0]?.id || "");
  }

  async function loadLevel4(level3Id: string) {
    if (!level3Id) {
      setLevel4Items([]);
      setSelectedLevel4Id("");
      return;
    }

    const response = await fetch(`/api/forest/patrimony?level=4&parentId=${level3Id}&page=1&limit=100`, { cache: "no-store" });
    const result = (await response.json()) as ApiResponse<{ items: Level4Item[] }>;

    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error ?? "No fue posible cargar nivel 4");
    }

    setLevel4Items(result.data.items);
    setSelectedLevel4Id((current) => {
      if (current && result.data?.items?.some((item) => item.id === current)) {
        return current;
      }

      const withLevel6 = result.data?.items?.find((item) => (item._count?.level6Assets ?? 0) > 0);
      return withLevel6?.id || result.data?.items?.[0]?.id || "";
    });
  }

  async function loadAssets(level4Id: string, currentSearch: string, currentPage: number, currentLimit: number) {
    if (!level4Id) {
      setItems([]);
      setPagination({ page: 1, totalPages: 1, total: 0, limit: currentLimit });
      return;
    }

    const params = new URLSearchParams({
      level4Id,
      page: String(currentPage),
      limit: String(currentLimit),
    });

    if (currentSearch.trim()) {
      params.set("search", currentSearch.trim());
    }

    const response = await fetch(`/api/forest/biological-assets?${params.toString()}`, { cache: "no-store" });
    const result = (await response.json()) as ApiResponse<{ items: BiologicalAssetItem[]; pagination: Pagination }>;

    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error ?? "No fue posible cargar activos biológicos");
    }

    setItems(result.data.items);
    setPagination(result.data.pagination);
  }

  const refreshAssets = useCallback(async () => {
    await loadAssets(selectedLevel4Id, debouncedSearch, page, limit);
  }, [debouncedSearch, limit, page, selectedLevel4Id]);

  const loadCatalogOptions = useCallback(async () => {
    const [materials, schemes, inventories, spacings, imaClasses] = await Promise.all([
      fetchAllPages<SimpleCatalogOption>("/api/forest/config/vegetal-materials"),
      fetchAllPages<SimpleCatalogOption>("/api/forest/config/management-schemes"),
      fetchAllPages<SimpleCatalogOption>("/api/forest/config/inventory-types"),
      fetchAllPages<SpacingOption>("/api/forest/config/spacings"),
      fetchAllPages<ImaClassOption>("/api/forest/config/ima-classes"),
    ]);

    setGeneticMaterialOptions(materials.filter((item) => item.isActive));
    setManagementSchemeOptions(schemes.filter((item) => item.isActive));
    setInventoryOptions(inventories.filter((item) => item.isActive));
    setSpacingOptions(spacings.filter((item) => item.isActive));
    setImaClassOptions(imaClasses.filter((item) => item.isActive));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    loadLevel2()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Error al cargar jerarquía");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCatalogOptions().catch(() => null);
  }, [loadCatalogOptions]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    loadLevel3(selectedLevel2Id)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Error al cargar nivel 3");
      })
      .finally(() => setLoading(false));
  }, [selectedLevel2Id]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    loadLevel4(selectedLevel3Id)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Error al cargar nivel 4");
      })
      .finally(() => setLoading(false));
  }, [selectedLevel3Id]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    refreshAssets()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Error al cargar activos biológicos");
      })
      .finally(() => setLoading(false));
  }, [refreshAssets]);

  useEffect(() => {
    const maxPage = Math.max(1, pagination.totalPages);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, pagination.totalPages]);

  function resetForm() {
    setEditingId(null);
    setForm(initialForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        level4Id: selectedLevel4Id,
        biologicalAssetKey: form.biologicalAssetKey.trim(),
        accountingKey: toNullableString(form.accountingKey),
        establishmentDate: toNullableIsoDate(form.establishmentDate),
        plantingYear: toNullableNumber(form.plantingYear),
        geneticMaterialCode: toNullableString(form.geneticMaterialCode),
        geneticMaterialName: toNullableString(form.geneticMaterialName),
        assetType: form.assetType,
        managementSchemeCode: toNullableString(form.managementSchemeCode),
        managementSchemeName: toNullableString(form.managementSchemeName),
        inventoryCode: toNullableString(form.inventoryCode),
        inventoryType: toNullableString(form.inventoryType),
        inventoryDate: toNullableIsoDate(form.inventoryDate),
        inventoryAgeYears: toNullableNumber(form.inventoryAgeYears),
        level5UnitCount: toNullableNumber(form.level5UnitCount),
        spacingCode: toNullableString(form.spacingCode),
        spacingDescription: toNullableString(form.spacingDescription),
        spacingBetweenRowsM: toNullableNumber(form.spacingBetweenRowsM),
        spacingBetweenTreesM: toNullableNumber(form.spacingBetweenTreesM),
        treeDensityPerHa: toNullableNumber(form.treeDensityPerHa),
        survivalRate: toNullableNumber(form.survivalRate),
        dominantHeightM: toNullableNumber(form.dominantHeightM),
        meanHeightM: toNullableNumber(form.meanHeightM),
        quadraticDiameterM: toNullableNumber(form.quadraticDiameterM),
        basalAreaM2: toNullableNumber(form.basalAreaM2),
        unitVolumeM3NoBarkPerHa: toNullableNumber(form.unitVolumeM3NoBarkPerHa),
        unitVolumeM3WithBarkPerHa: toNullableNumber(form.unitVolumeM3WithBarkPerHa),
        totalVolumeM3NoBark: toNullableNumber(form.totalVolumeM3NoBark),
        totalVolumeM3WithBark: toNullableNumber(form.totalVolumeM3WithBark),
        adjustedVolumeM3NoBarkPerHa: toNullableNumber(form.adjustedVolumeM3NoBarkPerHa),
        adjustedVolumeM3WithBarkPerHa: toNullableNumber(form.adjustedVolumeM3WithBarkPerHa),
        imaClassCode: toNullableString(form.imaClassCode),
        imaClassName: toNullableString(form.imaClassName),
        actualCostUsd: toNullableNumber(form.actualCostUsd),
        isActive: form.isActive,
      };

      const isEditing = Boolean(editingId);
      const response = await fetch("/api/forest/biological-assets", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { id: editingId, ...payload } : payload),
      });

      const result = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !result.success) {
        throw new Error(getApiErrorMessage(result, "No fue posible guardar"));
      }

      resetForm();
      setSearch("");
      setPage(1);
      await loadAssets(selectedLevel4Id, "", 1, limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: BiologicalAssetItem) {
    const establishmentDate = fromIsoDate(item.establishmentDate);
    const inventoryDate = fromIsoDate(item.inventoryDate);
    const derivedPlantingYear = establishmentDate ? getYearFromDateInput(establishmentDate) : numberValue(item.plantingYear);
    const derivedInventoryAge = establishmentDate && inventoryDate
      ? getInventoryAgeYears(establishmentDate, inventoryDate)
      : numberValue(item.inventoryAgeYears);
    setEditingId(item.id);
    setForm({
      biologicalAssetKey: item.biologicalAssetKey,
      accountingKey: stringValue(item.accountingKey),
      establishmentDate,
      plantingYear: derivedPlantingYear,
      geneticMaterialCode: stringValue(item.geneticMaterialCode),
      geneticMaterialName: stringValue(item.geneticMaterialName),
      assetType: item.assetType,
      managementSchemeCode: stringValue(item.managementSchemeCode),
      managementSchemeName: stringValue(item.managementSchemeName),
      inventoryCode: stringValue(item.inventoryCode),
      inventoryType: stringValue(item.inventoryType),
      inventoryDate,
      inventoryAgeYears: derivedInventoryAge,
      level5UnitCount: numberValue(item.level5UnitCount),
      spacingCode: stringValue(item.spacingCode),
      spacingDescription: stringValue(item.spacingDescription),
      spacingBetweenRowsM: numberValue(item.spacingBetweenRowsM),
      spacingBetweenTreesM: numberValue(item.spacingBetweenTreesM),
      treeDensityPerHa: numberValue(item.treeDensityPerHa),
      survivalRate: numberValue(item.survivalRate),
      dominantHeightM: numberValue(item.dominantHeightM),
      meanHeightM: numberValue(item.meanHeightM),
      quadraticDiameterM: numberValue(item.quadraticDiameterM),
      basalAreaM2: numberValue(item.basalAreaM2),
      unitVolumeM3NoBarkPerHa: numberValue(item.unitVolumeM3NoBarkPerHa),
      unitVolumeM3WithBarkPerHa: numberValue(item.unitVolumeM3WithBarkPerHa),
      totalVolumeM3NoBark: numberValue(item.totalVolumeM3NoBark),
      totalVolumeM3WithBark: numberValue(item.totalVolumeM3WithBark),
      adjustedVolumeM3NoBarkPerHa: numberValue(item.adjustedVolumeM3NoBarkPerHa),
      adjustedVolumeM3WithBarkPerHa: numberValue(item.adjustedVolumeM3WithBarkPerHa),
      imaClassCode: stringValue(item.imaClassCode),
      imaClassName: stringValue(item.imaClassName),
      actualCostUsd: numberValue(item.actualCostUsd),
      isActive: item.isActive,
    });
  }

  async function executeDelete(id: string) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/forest/biological-assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const result = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !result.success) {
        throw new Error(getApiErrorMessage(result, "No fue posible eliminar"));
      }

      if (editingId === id) {
        resetForm();
      }

      await refreshAssets();
      sileo.success({
        title: "Activo eliminado",
        description: "Se eliminó el activo biológico.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No fue posible eliminar";
      setError(message);
      sileo.error({
        title: "No se pudo eliminar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(id: string) {
    sileo.action({
      title: "Confirmar eliminación",
      description: "Se eliminará este activo biológico.",
      duration: 6000,
      button: {
        title: "Eliminar",
        onClick: () => {
          void executeDelete(id);
        },
      },
    });
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Activo biológico (Nivel 6)</h1>
        <p className="text-sm text-muted-foreground">Gestiona activos biológicos vinculados a rodales (nivel 4).</p>
      </header>

      {error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nivel 2</span>
          <select
            className={selectorFieldClass}
            value={selectedLevel2Id}
            onChange={(event) => {
              setSelectedLevel2Id(event.target.value);
              setSelectedLevel3Id("");
              setSelectedLevel4Id("");
              setPage(1);
            }}
          >
            {level2Items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Nivel 3</span>
          <select
            className={selectorFieldClass}
            value={selectedLevel3Id}
            onChange={(event) => {
              setSelectedLevel3Id(event.target.value);
              setSelectedLevel4Id("");
              setPage(1);
            }}
          >
            {level3Items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Nivel 4</span>
          <select
            className={selectorFieldClass}
            value={selectedLevel4Id}
            onChange={(event) => {
              setSelectedLevel4Id(event.target.value);
              setPage(1);
            }}
          >
            {level4Items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form className="grid gap-3 rounded-xl border p-4 md:grid-cols-4" onSubmit={handleSubmit}>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Clave activo biológico *</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={form.biologicalAssetKey}
            onChange={(event) => setForm((prev) => ({ ...prev, biologicalAssetKey: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Clave contable</span>
          <input className="w-full rounded-md border px-3 py-2" value={form.accountingKey} onChange={(event) => setForm((prev) => ({ ...prev, accountingKey: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Fecha establecimiento</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="date"
            value={form.establishmentDate}
            onChange={(event) => {
              const establishmentDate = event.target.value;
              const plantingYear = getYearFromDateInput(establishmentDate);
              const inventoryAgeYears = getInventoryAgeYears(establishmentDate, form.inventoryDate);
              setForm((prev) => ({
                ...prev,
                establishmentDate,
                plantingYear,
                inventoryAgeYears,
              }));
            }}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Año plantación</span>
          <input className={readonlyFieldClass} type="number" min={0} value={form.plantingYear} readOnly />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Material genético código</span>
          <select
            className={selectorFieldClass}
            value={form.geneticMaterialCode}
            onChange={(event) => {
              const selected = geneticMaterialOptions.find((option) => option.code === event.target.value);
              setForm((prev) => ({
                ...prev,
                geneticMaterialCode: selected?.code ?? "",
                geneticMaterialName: selected?.name ?? "",
              }));
            }}
          >
            <option value="">Seleccione material</option>
            {geneticMaterialOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.code} · {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Material genético nombre</span>
          <input className={readonlyFieldClass} value={form.geneticMaterialName} readOnly />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Tipo</span>
          <select
            className={selectorFieldClass}
            value={form.assetType}
            onChange={(event) => setForm((prev) => ({ ...prev, assetType: event.target.value as "COMERCIAL" | "INVESTIGACION" }))}
          >
            <option value="COMERCIAL">COMERCIAL</option>
            <option value="INVESTIGACION">INVESTIGACION</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Esquema manejo código</span>
          <select
            className={selectorFieldClass}
            value={form.managementSchemeCode}
            onChange={(event) => {
              const selected = managementSchemeOptions.find((option) => option.code === event.target.value);
              setForm((prev) => ({
                ...prev,
                managementSchemeCode: selected?.code ?? "",
                managementSchemeName: selected?.name ?? "",
              }));
            }}
          >
            <option value="">Seleccione esquema</option>
            {managementSchemeOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.code} · {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Esquema manejo nombre</span>
          <input className={readonlyFieldClass} value={form.managementSchemeName} readOnly />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Inventario código</span>
          <select
            className={selectorFieldClass}
            value={form.inventoryCode}
            onChange={(event) => {
              const selected = inventoryOptions.find((option) => option.code === event.target.value);
              setForm((prev) => ({
                ...prev,
                inventoryCode: selected?.code ?? "",
                inventoryType: selected?.name ?? "",
              }));
            }}
          >
            <option value="">Seleccione inventario</option>
            {inventoryOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.code} · {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Inventario tipo</span>
          <input className={readonlyFieldClass} value={form.inventoryType} readOnly />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Fecha inventario</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="date"
            value={form.inventoryDate}
            onChange={(event) => {
              const inventoryDate = event.target.value;
              const inventoryAgeYears = getInventoryAgeYears(form.establishmentDate, inventoryDate);
              setForm((prev) => ({
                ...prev,
                inventoryDate,
                inventoryAgeYears,
              }));
            }}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Año inventario</span>
          <input className={readonlyFieldClass} type="number" min={0} value={getYearFromDateInput(form.inventoryDate)} readOnly />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Edad inventario (años)</span>
          <input className={readonlyFieldClass} type="number" min={0} step="0.01" value={form.inventoryAgeYears} readOnly />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Unidades nivel 5</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" min={0} value={form.level5UnitCount} onChange={(event) => setForm((prev) => ({ ...prev, level5UnitCount: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Espaciamiento código</span>
          <select
            className={selectorFieldClass}
            value={form.spacingCode}
            onChange={(event) => {
              const selected = spacingOptions.find((option) => option.code === event.target.value);
              setForm((prev) => ({
                ...prev,
                spacingCode: selected?.code ?? "",
                spacingDescription: selected?.description ?? selected?.name ?? "",
                spacingBetweenRowsM: selected?.betweenRowsM != null ? String(selected.betweenRowsM) : "",
                spacingBetweenTreesM: selected?.betweenTreesM != null ? String(selected.betweenTreesM) : "",
                treeDensityPerHa: selected?.treeDensityPerHa != null ? String(selected.treeDensityPerHa) : "",
              }));
            }}
          >
            <option value="">Seleccione espaciamiento</option>
            {spacingOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.code} · {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Espaciamiento descripción</span>
          <input className={readonlyFieldClass} value={form.spacingDescription} readOnly />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Distancia entre filas (m)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.spacingBetweenRowsM} onChange={(event) => setForm((prev) => ({ ...prev, spacingBetweenRowsM: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Distancia entre árboles (m)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.spacingBetweenTreesM} onChange={(event) => setForm((prev) => ({ ...prev, spacingBetweenTreesM: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Densidad árboles/ha</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="1" value={form.treeDensityPerHa} onChange={(event) => setForm((prev) => ({ ...prev, treeDensityPerHa: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Sobrevivencia (%)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.01" value={form.survivalRate} onChange={(event) => setForm((prev) => ({ ...prev, survivalRate: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Altura dominante (m)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.dominantHeightM} onChange={(event) => setForm((prev) => ({ ...prev, dominantHeightM: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Altura media (m)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.meanHeightM} onChange={(event) => setForm((prev) => ({ ...prev, meanHeightM: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Diámetro cuadrático (m)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.quadraticDiameterM} onChange={(event) => setForm((prev) => ({ ...prev, quadraticDiameterM: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Área basal (m²)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.basalAreaM2} onChange={(event) => setForm((prev) => ({ ...prev, basalAreaM2: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Vol. unit. sin corteza (m³/ha)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.unitVolumeM3NoBarkPerHa} onChange={(event) => setForm((prev) => ({ ...prev, unitVolumeM3NoBarkPerHa: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Vol. unit. con corteza (m³/ha)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.unitVolumeM3WithBarkPerHa} onChange={(event) => setForm((prev) => ({ ...prev, unitVolumeM3WithBarkPerHa: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Volumen total sin corteza (m³)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.totalVolumeM3NoBark} onChange={(event) => setForm((prev) => ({ ...prev, totalVolumeM3NoBark: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Volumen total con corteza (m³)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.totalVolumeM3WithBark} onChange={(event) => setForm((prev) => ({ ...prev, totalVolumeM3WithBark: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Vol. ajustado sin corteza (m³/ha)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.adjustedVolumeM3NoBarkPerHa} onChange={(event) => setForm((prev) => ({ ...prev, adjustedVolumeM3NoBarkPerHa: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Vol. ajustado con corteza (m³/ha)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.0001" value={form.adjustedVolumeM3WithBarkPerHa} onChange={(event) => setForm((prev) => ({ ...prev, adjustedVolumeM3WithBarkPerHa: event.target.value }))} />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">IMA clase código</span>
          <select
            className={selectorFieldClass}
            value={form.imaClassCode}
            onChange={(event) => {
              const selected = imaClassOptions.find((option) => option.code === event.target.value);
              setForm((prev) => ({
                ...prev,
                imaClassCode: selected?.code ?? "",
                imaClassName: selected?.name ?? "",
              }));
            }}
          >
            <option value="">Seleccione IMA</option>
            {imaClassOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.code} · {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">IMA clase nombre</span>
          <input className={readonlyFieldClass} value={form.imaClassName} readOnly />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Costo real (USD)</span>
          <input className="w-full rounded-md border px-3 py-2" type="number" step="0.01" value={form.actualCostUsd} onChange={(event) => setForm((prev) => ({ ...prev, actualCostUsd: event.target.value }))} />
        </label>

        <label className="flex items-center gap-2 text-sm md:pt-7">
          <input checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
          <span className="font-medium">Activo</span>
        </label>

        <div className="md:col-span-4 flex flex-wrap gap-2">
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canSubmit || submitting || loading} type="submit">
            {editingId ? "Actualizar" : "Crear"}
          </button>
          {editingId ? (
            <button className="rounded-md border px-3 py-2 text-sm" onClick={resetForm} type="button">
              Cancelar edición
            </button>
          ) : null}
        </div>
      </form>

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Buscar</span>
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Clave, contable, material, inventario"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Límite</span>
          <select
            className={compactSelectorClass}
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
          >
            {limits.map((current) => (
              <option key={current} value={current}>
                {current}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto text-sm text-muted-foreground">Total: {pagination.total}</div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2">Clave biológica</th>
              <th className="px-3 py-2">Clave contable</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Año</th>
              <th className="px-3 py-2">Inventario</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-t" key={item.id}>
                <td className="px-3 py-2">{item.biologicalAssetKey}</td>
                <td className="px-3 py-2">{item.accountingKey ?? "-"}</td>
                <td className="px-3 py-2">{item.assetType}</td>
                <td className="px-3 py-2">{item.plantingYear ?? "-"}</td>
                <td className="px-3 py-2">{item.inventoryCode ?? "-"}</td>
                <td className="px-3 py-2">{item.isActive ? "Activo" : "Inactivo"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button className="rounded-md border px-2 py-1" onClick={() => startEdit(item)} type="button">
                      Editar
                    </button>
                    <button className="rounded-md border px-2 py-1" onClick={() => handleDelete(item.id)} type="button">
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={7}>
                  {loading ? "Cargando..." : "Sin registros"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          className="rounded-md border px-3 py-2 text-sm"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          type="button"
        >
          Anterior
        </button>
        <span className="text-sm text-muted-foreground">
          Página {pagination.page} de {Math.max(1, pagination.totalPages)}
        </span>
        <button
          className="rounded-md border px-3 py-2 text-sm"
          disabled={page >= Math.max(1, pagination.totalPages)}
          onClick={() => setPage((current) => Math.min(Math.max(1, pagination.totalPages), current + 1))}
          type="button"
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
