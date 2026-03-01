"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { sileo } from "sileo";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { TablePagination } from "@/components/tables/TablePagination";

type Level2Item = {
  id: string;
  code: string;
  name: string;
  type: string;
  totalAreaHa: string | number;
  legalStatus: string | null;
  isActive: boolean;
};

type Level3Item = {
  id: string;
  code: string;
  name: string;
  type: string;
  totalAreaHa: string | number;
  legalStatus?: string | null;
  isActive: boolean;
};

type Level4Item = {
  id: string;
  code: string;
  name: string;
  type: string;
  totalAreaHa: string | number;
  legalStatus?: string | null;
  isActive: boolean;
};

type Level5Item = {
  id: string;
  code: string;
  name: string;
  type: string;
  shapeType: string;
  areaM2: string | number;
  isActive: boolean;
  dimension1M?: string | number | null;
  dimension2M?: string | number | null;
  dimension3M?: string | number | null;
  dimension4M?: string | number | null;
};

type NeighborItem = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type PaginationState = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
};

type PageAdjustReason = "filtro" | "límite" | "eliminación" | "navegación";

function parseLocaleDecimal(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const normalized = value.trim().replace(",", ".");
  if (!normalized) return Number.NaN;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export default function PatrimonioForestalPage() {
  const [items, setItems] = useState<Level2Item[]>([]);
  const [level3Items, setLevel3Items] = useState<Level3Item[]>([]);
  const [level4Items, setLevel4Items] = useState<Level4Item[]>([]);
  const [level5Items, setLevel5Items] = useState<Level5Item[]>([]);
  const [neighbors, setNeighbors] = useState<NeighborItem[]>([]);

  const [selectedLevel2Id, setSelectedLevel2Id] = useState("");
  const [selectedLevel3Id, setSelectedLevel3Id] = useState("");
  const [selectedLevel4Id, setSelectedLevel4Id] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [pageAdjustReason, setPageAdjustReason] = useState<PageAdjustReason>("navegación");

  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "FINCA",
    legalStatus: "ADQUISICION",
    totalAreaHa: "",
  });

  const [level3Form, setLevel3Form] = useState({
    code: "",
    name: "",
    type: "LOTE",
    totalAreaHa: "",
  });

  const [level4Form, setLevel4Form] = useState({
    code: "",
    name: "",
    type: "RODAL",
    totalAreaHa: "",
  });

  const [level5Form, setLevel5Form] = useState({
    code: "",
    name: "",
    type: "SUBUNIDAD",
    shapeType: "RECTANGULAR",
    dimension1M: "",
    dimension2M: "",
    dimension3M: "",
    dimension4M: "",
  });

  const [neighborForm, setNeighborForm] = useState({
    code: "",
    name: "",
    type: "Colindante",
  });

  const [searchLevel2, setSearchLevel2] = useState("");
  const [searchLevel3, setSearchLevel3] = useState("");
  const [searchLevel4, setSearchLevel4] = useState("");
  const [searchLevel5, setSearchLevel5] = useState("");

  const [pageLevel2, setPageLevel2] = useState(1);
  const [pageLevel3, setPageLevel3] = useState(1);
  const [pageLevel4, setPageLevel4] = useState(1);
  const [pageLevel5, setPageLevel5] = useState(1);

  const [limitLevel2, setLimitLevel2] = useState(25);
  const [limitLevel3, setLimitLevel3] = useState(25);
  const [limitLevel4, setLimitLevel4] = useState(25);
  const [limitLevel5, setLimitLevel5] = useState(25);

  const [paginationLevel2, setPaginationLevel2] = useState<PaginationState>({ page: 1, totalPages: 1, total: 0, limit: 25 });
  const [paginationLevel3, setPaginationLevel3] = useState<PaginationState>({ page: 1, totalPages: 1, total: 0, limit: 25 });
  const [paginationLevel4, setPaginationLevel4] = useState<PaginationState>({ page: 1, totalPages: 1, total: 0, limit: 25 });
  const [paginationLevel5, setPaginationLevel5] = useState<PaginationState>({ page: 1, totalPages: 1, total: 0, limit: 25 });

  const [editingLevel2Id, setEditingLevel2Id] = useState<string | null>(null);
  const [editingLevel3Id, setEditingLevel3Id] = useState<string | null>(null);
  const [editingLevel4Id, setEditingLevel4Id] = useState<string | null>(null);
  const [editingLevel5Id, setEditingLevel5Id] = useState<string | null>(null);
  const [editingNeighborId, setEditingNeighborId] = useState<string | null>(null);

  const [editLevel2Form, setEditLevel2Form] = useState({
    code: "",
    name: "",
    type: "FINCA",
    totalAreaHa: "",
    isActive: true,
  });
  const [editLevel3Form, setEditLevel3Form] = useState({
    code: "",
    name: "",
    type: "LOTE",
    totalAreaHa: "",
    isActive: true,
  });
  const [editLevel4Form, setEditLevel4Form] = useState({
    code: "",
    name: "",
    type: "RODAL",
    totalAreaHa: "",
    isActive: true,
  });
  const [editLevel5Form, setEditLevel5Form] = useState({
    code: "",
    name: "",
    type: "SUBUNIDAD",
    shapeType: "RECTANGULAR",
    dimension1M: "",
    dimension2M: "",
    dimension3M: "",
    dimension4M: "",
    isActive: true,
  });
  const [editNeighborForm, setEditNeighborForm] = useState({ code: "", name: "", type: "" });

  const debouncedSearchLevel2 = useDebounce(searchLevel2, 300);
  const debouncedSearchLevel3 = useDebounce(searchLevel3, 300);
  const debouncedSearchLevel4 = useDebounce(searchLevel4, 300);
  const debouncedSearchLevel5 = useDebounce(searchLevel5, 300);

  const buildPageAdjustMessage = useCallback((level: 2 | 3 | 4 | 5, page: number, reason: PageAdjustReason) => {
    return `Nivel ${level} ajustado automáticamente a la página ${page} por ${reason}.`;
  }, []);

  const canSubmit = useMemo(() => {
    const totalAreaHa = parseLocaleDecimal(form.totalAreaHa);
    return form.code.trim().length > 0 && form.name.trim().length > 1 && totalAreaHa > 0;
  }, [form]);

  const loadLevel2 = useCallback(async (search = "", page = 1, limit = 25) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/forest/patrimony?level=2&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok || !result?.success) {
        setError(result?.error ?? "No fue posible cargar datos del patrimonio forestal");
        return;
      }

      const level2Data = (result.data.items ?? []) as Level2Item[];
      setItems(level2Data);
      setPaginationLevel2({
        page: result?.data?.pagination?.page ?? 1,
        totalPages: result?.data?.pagination?.totalPages ?? 1,
        total: result?.data?.pagination?.total ?? 0,
        limit: result?.data?.pagination?.limit ?? limit,
      });
      setSelectedLevel2Id((current) => current || level2Data[0]?.id || "");
    } catch {
      setError("No fue posible cargar datos del patrimonio forestal");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLevel3 = useCallback(async (level2Id: string, search = "", page = 1, limit = 25) => {
    const response = await fetch(
      `/api/forest/patrimony?level=3&parentId=${level2Id}&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    const data = (result?.data?.items ?? []) as Level3Item[];
    setLevel3Items(data);
    setPaginationLevel3({
      page: result?.data?.pagination?.page ?? 1,
      totalPages: result?.data?.pagination?.totalPages ?? 1,
      total: result?.data?.pagination?.total ?? 0,
      limit: result?.data?.pagination?.limit ?? limit,
    });
    if (data.length > 0) {
      setSelectedLevel3Id((current) => current || data[0].id);
    } else {
      setSelectedLevel3Id("");
    }
  }, []);

  const loadLevel4 = useCallback(async (level3Id: string, search = "", page = 1, limit = 25) => {
    const response = await fetch(
      `/api/forest/patrimony?level=4&parentId=${level3Id}&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    const data = (result?.data?.items ?? []) as Level4Item[];
    setLevel4Items(data);
    setPaginationLevel4({
      page: result?.data?.pagination?.page ?? 1,
      totalPages: result?.data?.pagination?.totalPages ?? 1,
      total: result?.data?.pagination?.total ?? 0,
      limit: result?.data?.pagination?.limit ?? limit,
    });
    if (data.length > 0) {
      setSelectedLevel4Id((current) => current || data[0].id);
    } else {
      setSelectedLevel4Id("");
    }
  }, []);

  const loadLevel5 = useCallback(async (level4Id: string, search = "", page = 1, limit = 25) => {
    const response = await fetch(
      `/api/forest/patrimony?level=5&parentId=${level4Id}&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    setLevel5Items((result?.data?.items ?? []) as Level5Item[]);
    setPaginationLevel5({
      page: result?.data?.pagination?.page ?? 1,
      totalPages: result?.data?.pagination?.totalPages ?? 1,
      total: result?.data?.pagination?.total ?? 0,
      limit: result?.data?.pagination?.limit ?? limit,
    });
  }, []);

  const loadNeighbors = useCallback(async (level2Id: string) => {
    const response = await fetch(`/api/forest/patrimony/neighbors?level2Id=${level2Id}`, { cache: "no-store" });
    const result = await response.json();
    setNeighbors((result?.data?.items ?? []) as NeighborItem[]);
  }, []);

  useEffect(() => {
    loadLevel2(debouncedSearchLevel2, pageLevel2, limitLevel2);
  }, [debouncedSearchLevel2, limitLevel2, loadLevel2, pageLevel2]);

  useEffect(() => {
    if (!selectedLevel2Id) {
      setLevel3Items([]);
      setNeighbors([]);
      return;
    }
    loadLevel3(selectedLevel2Id, debouncedSearchLevel3, pageLevel3, limitLevel3);
    loadNeighbors(selectedLevel2Id);
  }, [debouncedSearchLevel3, limitLevel3, loadLevel3, loadNeighbors, pageLevel3, selectedLevel2Id]);

  useEffect(() => {
    if (!selectedLevel3Id) {
      setLevel4Items([]);
      return;
    }
    loadLevel4(selectedLevel3Id, debouncedSearchLevel4, pageLevel4, limitLevel4);
  }, [debouncedSearchLevel4, limitLevel4, loadLevel4, pageLevel4, selectedLevel3Id]);

  useEffect(() => {
    if (!selectedLevel4Id) {
      setLevel5Items([]);
      return;
    }
    loadLevel5(selectedLevel4Id, debouncedSearchLevel5, pageLevel5, limitLevel5);
  }, [debouncedSearchLevel5, limitLevel5, loadLevel5, pageLevel5, selectedLevel4Id]);

  useEffect(() => {
    const maxPage = Math.max(1, paginationLevel2.totalPages);
    if (pageLevel2 > maxPage) {
      setPageLevel2(maxPage);
      setInfoMessage(buildPageAdjustMessage(2, maxPage, pageAdjustReason));
    }
  }, [buildPageAdjustMessage, pageAdjustReason, pageLevel2, paginationLevel2.totalPages]);

  useEffect(() => {
    const maxPage = Math.max(1, paginationLevel3.totalPages);
    if (pageLevel3 > maxPage) {
      setPageLevel3(maxPage);
      setInfoMessage(buildPageAdjustMessage(3, maxPage, pageAdjustReason));
    }
  }, [buildPageAdjustMessage, pageAdjustReason, pageLevel3, paginationLevel3.totalPages]);

  useEffect(() => {
    const maxPage = Math.max(1, paginationLevel4.totalPages);
    if (pageLevel4 > maxPage) {
      setPageLevel4(maxPage);
      setInfoMessage(buildPageAdjustMessage(4, maxPage, pageAdjustReason));
    }
  }, [buildPageAdjustMessage, pageAdjustReason, pageLevel4, paginationLevel4.totalPages]);

  useEffect(() => {
    const maxPage = Math.max(1, paginationLevel5.totalPages);
    if (pageLevel5 > maxPage) {
      setPageLevel5(maxPage);
      setInfoMessage(buildPageAdjustMessage(5, maxPage, pageAdjustReason));
    }
  }, [buildPageAdjustMessage, pageAdjustReason, pageLevel5, paginationLevel5.totalPages]);

  useEffect(() => {
    if (!infoMessage) return;
    const timeout = setTimeout(() => setInfoMessage(null), 3500);
    return () => clearTimeout(timeout);
  }, [infoMessage]);

  async function createPatrimony(level: "2" | "3" | "4" | "5", data: Record<string, unknown>) {
    const response = await fetch("/api/forest/patrimony", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, data }),
    });

    const result = await response.json();
    if (!response.ok || !result?.success) {
      throw new Error(result?.error ?? "No fue posible crear el registro");
    }
  }

  async function onSaveLevel3Edit() {
    if (!editingLevel3Id || !selectedLevel2Id) return;
    const totalAreaHa = Number(editLevel3Form.totalAreaHa);
    if (Number.isNaN(totalAreaHa) || totalAreaHa <= 0) {
      setError("Superficie inválida");
      sileo.warning({
        title: "Datos inválidos",
        description: "La superficie debe ser mayor a 0.",
      });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await updatePatrimony("3", editingLevel3Id, {
        code: editLevel3Form.code.trim(),
        name: editLevel3Form.name.trim(),
        type: editLevel3Form.type,
        totalAreaHa,
        isActive: editLevel3Form.isActive,
      });
      setEditingLevel3Id(null);
      await loadLevel3(selectedLevel2Id, debouncedSearchLevel3, pageLevel3, limitLevel3);
      sileo.success({
        title: "Nivel 3 actualizado",
        description: "El registro se actualizó correctamente.",
      });
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "No fue posible actualizar el nivel 3";
      setError(message);
      sileo.error({
        title: "No se pudo actualizar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePatrimony(level: "2" | "3" | "4" | "5", id: string) {
    const response = await fetch("/api/forest/patrimony", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, id }),
    });

    const result = await response.json();
    if (!response.ok || !result?.success) {
      throw new Error(result?.error ?? "No fue posible eliminar el registro");
    }
  }

  async function deleteNeighbor(id: string) {
    const response = await fetch("/api/forest/patrimony/neighbors", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const result = await response.json();
    if (!response.ok || !result?.success) {
      throw new Error(result?.error ?? "No fue posible eliminar el vecino");
    }
  }

  async function updatePatrimony(level: "2" | "3" | "4" | "5", id: string, data: Record<string, unknown>) {
    const response = await fetch("/api/forest/patrimony", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, id, data }),
    });

    const result = await response.json();
    if (!response.ok || !result?.success) {
      throw new Error(result?.error ?? "No fue posible actualizar el registro");
    }
  }

  async function updateNeighbor(id: string, data: Record<string, unknown>) {
    const response = await fetch("/api/forest/patrimony/neighbors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });

    const result = await response.json();
    if (!response.ok || !result?.success) {
      throw new Error(result?.error ?? "No fue posible actualizar el vecino");
    }
  }

  function onEditLevel2(item: Level2Item) {
    setEditingLevel2Id(item.id);
    setEditLevel2Form({
      code: item.code,
      name: item.name,
      type: item.type,
      totalAreaHa: String(item.totalAreaHa),
      isActive: item.isActive,
    });
  }

  function onEditLevel3(item: Level3Item) {
    setEditingLevel3Id(item.id);
    setEditLevel3Form({
      code: item.code,
      name: item.name,
      type: item.type,
      totalAreaHa: String(item.totalAreaHa),
      isActive: item.isActive,
    });
  }

  function onEditLevel4(item: Level4Item) {
    setEditingLevel4Id(item.id);
    setEditLevel4Form({
      code: item.code,
      name: item.name,
      type: item.type,
      totalAreaHa: String(item.totalAreaHa),
      isActive: item.isActive,
    });
  }

  function onEditLevel5(item: Level5Item) {
    setEditingLevel5Id(item.id);
    setEditLevel5Form({
      code: item.code,
      name: item.name,
      type: item.type,
      shapeType: item.shapeType,
      dimension1M: item.dimension1M == null ? "" : String(item.dimension1M),
      dimension2M: item.dimension2M == null ? "" : String(item.dimension2M),
      dimension3M: item.dimension3M == null ? "" : String(item.dimension3M),
      dimension4M: item.dimension4M == null ? "" : String(item.dimension4M),
      isActive: item.isActive,
    });
  }

  function onEditNeighbor(item: NeighborItem) {
    setEditingNeighborId(item.id);
    setEditNeighborForm({ code: item.code, name: item.name, type: item.type });
  }

  async function onSaveLevel2Edit() {
    if (!editingLevel2Id) return;
    const totalAreaHa = Number(editLevel2Form.totalAreaHa);
    if (Number.isNaN(totalAreaHa) || totalAreaHa <= 0) {
      setError("Superficie inválida");
      sileo.warning({
        title: "Datos inválidos",
        description: "La superficie debe ser mayor a 0.",
      });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await updatePatrimony("2", editingLevel2Id, {
        code: editLevel2Form.code.trim(),
        name: editLevel2Form.name.trim(),
        type: editLevel2Form.type,
        totalAreaHa,
        isActive: editLevel2Form.isActive,
      });
      setEditingLevel2Id(null);
      await loadLevel2(debouncedSearchLevel2, pageLevel2, limitLevel2);
      sileo.success({
        title: "Nivel 2 actualizado",
        description: "El registro se actualizó correctamente.",
      });
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "No fue posible actualizar el nivel 2";
      setError(message);
      sileo.error({
        title: "No se pudo actualizar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSaveLevel4Edit() {
    if (!editingLevel4Id || !selectedLevel3Id) return;
    const totalAreaHa = Number(editLevel4Form.totalAreaHa);
    if (Number.isNaN(totalAreaHa) || totalAreaHa <= 0) {
      setError("Superficie inválida");
      sileo.warning({
        title: "Datos inválidos",
        description: "La superficie debe ser mayor a 0.",
      });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await updatePatrimony("4", editingLevel4Id, {
        code: editLevel4Form.code.trim(),
        name: editLevel4Form.name.trim(),
        type: editLevel4Form.type,
        totalAreaHa,
        isActive: editLevel4Form.isActive,
      });
      setEditingLevel4Id(null);
      await loadLevel4(selectedLevel3Id, debouncedSearchLevel4, pageLevel4, limitLevel4);
      sileo.success({
        title: "Nivel 4 actualizado",
        description: "El registro se actualizó correctamente.",
      });
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "No fue posible actualizar el nivel 4";
      setError(message);
      sileo.error({
        title: "No se pudo actualizar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSaveLevel5Edit() {
    if (!editingLevel5Id || !selectedLevel4Id) return;

    const code = editLevel5Form.code.trim();
    const name = editLevel5Form.name.trim();
    if (!code || name.length < 2) {
      setError("Codigo y nombre son obligatorios para el nivel 5");
      sileo.warning({
        title: "Datos incompletos",
        description: "Código y nombre son obligatorios para el nivel 5.",
      });
      return;
    }

    const dimension1M = editLevel5Form.dimension1M === "" ? undefined : parseLocaleDecimal(editLevel5Form.dimension1M);
    const dimension2M = editLevel5Form.dimension2M === "" ? undefined : parseLocaleDecimal(editLevel5Form.dimension2M);
    const dimension3M = editLevel5Form.dimension3M === "" ? undefined : parseLocaleDecimal(editLevel5Form.dimension3M);
    const dimension4M = editLevel5Form.dimension4M === "" ? undefined : parseLocaleDecimal(editLevel5Form.dimension4M);

    if ([dimension1M, dimension2M, dimension3M, dimension4M].some((value) => value !== undefined && Number.isNaN(value))) {
      setError("Dimensiones invalidas");
      sileo.warning({
        title: "Dimensiones inválidas",
        description: "Verifica los valores de las dimensiones ingresadas.",
      });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await updatePatrimony("5", editingLevel5Id, {
        code,
        name,
        type: editLevel5Form.type,
        shapeType: editLevel5Form.shapeType,
        dimension1M,
        dimension2M,
        dimension3M,
        dimension4M,
        isActive: editLevel5Form.isActive,
      });
      setEditingLevel5Id(null);
      await loadLevel5(selectedLevel4Id, debouncedSearchLevel5, pageLevel5, limitLevel5);
      sileo.success({
        title: "Nivel 5 actualizado",
        description: "El registro se actualizó correctamente.",
      });
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "No fue posible actualizar el nivel 5";
      setError(message);
      sileo.error({
        title: "No se pudo actualizar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitLevel5Edit(event: FormEvent) {
    event.preventDefault();
    await onSaveLevel5Edit();
  }

  async function onSaveNeighborEdit() {
    if (!editingNeighborId || !selectedLevel2Id) return;

    setSubmitting(true);
    setError(null);
    try {
      await updateNeighbor(editingNeighborId, {
        code: editNeighborForm.code.trim(),
        name: editNeighborForm.name.trim(),
        type: editNeighborForm.type.trim(),
      });
      setEditingNeighborId(null);
      await loadNeighbors(selectedLevel2Id);
      sileo.success({
        title: "Colindante actualizado",
        description: "El colindante se actualizó correctamente.",
      });
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "No fue posible actualizar el vecino";
      setError(message);
      sileo.error({
        title: "No se pudo actualizar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function executeDeleteLevel2(id: string) {
    setPageAdjustReason("eliminación");
    setSubmitting(true);
    setError(null);
    try {
      await deletePatrimony("2", id);
      await loadLevel2(debouncedSearchLevel2, pageLevel2, limitLevel2);
      sileo.success({
        title: "Nivel 2 eliminado",
        description: "El registro se eliminó correctamente.",
      });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "No fue posible eliminar el nivel 2";
      setError(message);
      sileo.error({
        title: "No se pudo eliminar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function onDeleteLevel2(id: string) {
    sileo.action({
      title: "Confirmar eliminación",
      description: "Se eliminará el registro de nivel 2.",
      duration: 6000,
      button: {
        title: "Eliminar",
        onClick: () => {
          void executeDeleteLevel2(id);
        },
      },
    });
  }

  async function executeDeleteLevel3(id: string) {
    if (!selectedLevel2Id) {
      sileo.warning({
        title: "Selección requerida",
        description: "Selecciona un nivel 2 para continuar.",
      });
      return;
    }
    setPageAdjustReason("eliminación");
    setSubmitting(true);
    setError(null);
    try {
      await deletePatrimony("3", id);
      await loadLevel3(selectedLevel2Id, debouncedSearchLevel3, pageLevel3, limitLevel3);
      setSelectedLevel4Id("");
      setLevel5Items([]);
      sileo.success({
        title: "Nivel 3 eliminado",
        description: "El registro se eliminó correctamente.",
      });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "No fue posible eliminar el nivel 3";
      setError(message);
      sileo.error({
        title: "No se pudo eliminar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function onDeleteLevel3(id: string) {
    sileo.action({
      title: "Confirmar eliminación",
      description: "Se eliminará el registro de nivel 3.",
      duration: 6000,
      button: {
        title: "Eliminar",
        onClick: () => {
          void executeDeleteLevel3(id);
        },
      },
    });
  }

  async function executeDeleteLevel4(id: string) {
    if (!selectedLevel3Id) {
      sileo.warning({
        title: "Selección requerida",
        description: "Selecciona un nivel 3 para continuar.",
      });
      return;
    }
    setPageAdjustReason("eliminación");
    setSubmitting(true);
    setError(null);
    try {
      await deletePatrimony("4", id);
      await loadLevel4(selectedLevel3Id, debouncedSearchLevel4, pageLevel4, limitLevel4);
      setLevel5Items([]);
      sileo.success({
        title: "Nivel 4 eliminado",
        description: "El registro se eliminó correctamente.",
      });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "No fue posible eliminar el nivel 4";
      setError(message);
      sileo.error({
        title: "No se pudo eliminar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function onDeleteLevel4(id: string) {
    sileo.action({
      title: "Confirmar eliminación",
      description: "Se eliminará el registro de nivel 4.",
      duration: 6000,
      button: {
        title: "Eliminar",
        onClick: () => {
          void executeDeleteLevel4(id);
        },
      },
    });
  }

  async function executeDeleteLevel5(id: string) {
    if (!selectedLevel4Id) {
      sileo.warning({
        title: "Selección requerida",
        description: "Selecciona un nivel 4 para continuar.",
      });
      return;
    }
    setPageAdjustReason("eliminación");
    setSubmitting(true);
    setError(null);
    try {
      await deletePatrimony("5", id);
      await loadLevel5(selectedLevel4Id, debouncedSearchLevel5, pageLevel5, limitLevel5);
      sileo.success({
        title: "Nivel 5 eliminado",
        description: "El registro se eliminó correctamente.",
      });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "No fue posible eliminar el nivel 5";
      setError(message);
      sileo.error({
        title: "No se pudo eliminar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function onDeleteLevel5(id: string) {
    sileo.action({
      title: "Confirmar eliminación",
      description: "Se eliminará el registro de nivel 5.",
      duration: 6000,
      button: {
        title: "Eliminar",
        onClick: () => {
          void executeDeleteLevel5(id);
        },
      },
    });
  }

  async function executeDeleteNeighbor(id: string) {
    if (!selectedLevel2Id) {
      sileo.warning({
        title: "Selección requerida",
        description: "Selecciona un nivel 2 para continuar.",
      });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await deleteNeighbor(id);
      await loadNeighbors(selectedLevel2Id);
      sileo.success({
        title: "Colindante eliminado",
        description: "El colindante se eliminó correctamente.",
      });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "No fue posible eliminar el vecino";
      setError(message);
      sileo.error({
        title: "No se pudo eliminar",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function onDeleteNeighbor(id: string) {
    sileo.action({
      title: "Confirmar eliminación",
      description: "Se eliminará el vecino colindante.",
      duration: 6000,
      button: {
        title: "Eliminar",
        onClick: () => {
          void executeDeleteNeighbor(id);
        },
      },
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const totalAreaHa = parseLocaleDecimal(form.totalAreaHa);
      if (Number.isNaN(totalAreaHa) || totalAreaHa <= 0) {
        setError("Superficie total inválida");
        sileo.warning({
          title: "Datos inválidos",
          description: "La superficie total debe ser mayor a 0.",
        });
        return;
      }

      await createPatrimony("2", {
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        legalStatus: form.legalStatus,
        totalAreaHa,
      });

      setForm({ code: "", name: "", type: "FINCA", legalStatus: "ADQUISICION", totalAreaHa: "" });
      setSearchLevel2("");
      setPageAdjustReason("navegación");
      setPageLevel2(1);
      await loadLevel2("", 1, limitLevel2);
      sileo.success({
        title: "Nivel 2 creado",
        description: "El registro se creó correctamente.",
      });
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "No fue posible crear el registro";
      setError(message);
      sileo.error({
        title: "No se pudo crear",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitLevel3(event: FormEvent) {
    event.preventDefault();
    if (!selectedLevel2Id) {
      setError("Selecciona un nivel 2 padre antes de crear el nivel 3");
      sileo.warning({
        title: "Selección requerida",
        description: "Selecciona un nivel 2 padre antes de crear el nivel 3.",
      });
      return;
    }

    const code = level3Form.code.trim();
    const name = level3Form.name.trim();
    const totalAreaHa = parseLocaleDecimal(level3Form.totalAreaHa);

    if (!code || name.length < 2) {
      setError("Código y nombre son obligatorios para el nivel 3");
      sileo.warning({
        title: "Datos incompletos",
        description: "Código y nombre son obligatorios para el nivel 3.",
      });
      return;
    }

    if (Number.isNaN(totalAreaHa) || totalAreaHa <= 0) {
      setError("Superficie inválida");
      sileo.warning({
        title: "Datos inválidos",
        description: "La superficie debe ser mayor a 0.",
      });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createPatrimony("3", {
        level2Id: selectedLevel2Id,
        code,
        name,
        type: level3Form.type,
        totalAreaHa,
      });
      setLevel3Form({ code: "", name: "", type: "LOTE", totalAreaHa: "" });
      await loadLevel3(selectedLevel2Id, debouncedSearchLevel3, pageLevel3, limitLevel3);
      sileo.success({
        title: "Nivel 3 creado",
        description: "El registro se creó correctamente.",
      });
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "No fue posible crear el nivel 3";
      setError(message);
      sileo.error({
        title: "No se pudo crear",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitLevel4(event: FormEvent) {
    event.preventDefault();
    if (!selectedLevel3Id) {
      setError("Selecciona un nivel 3 antes de crear el nivel 4");
      sileo.warning({
        title: "Selección requerida",
        description: "Selecciona un nivel 3 antes de crear el nivel 4.",
      });
      return;
    }

    const code = level4Form.code.trim();
    const name = level4Form.name.trim();
    const totalAreaHa = parseLocaleDecimal(level4Form.totalAreaHa);
    if (!code || name.length < 2) {
      setError("Código y nombre son obligatorios para el nivel 4");
      sileo.warning({
        title: "Datos incompletos",
        description: "Código y nombre son obligatorios para el nivel 4.",
      });
      return;
    }
    if (Number.isNaN(totalAreaHa) || totalAreaHa <= 0) {
      setError("Superficie inválida");
      sileo.warning({
        title: "Datos inválidos",
        description: "La superficie debe ser mayor a 0.",
      });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createPatrimony("4", {
        level3Id: selectedLevel3Id,
        code,
        name,
        type: level4Form.type,
        totalAreaHa,
      });
      setLevel4Form({ code: "", name: "", type: "RODAL", totalAreaHa: "" });
      await loadLevel4(selectedLevel3Id, debouncedSearchLevel4, pageLevel4, limitLevel4);
      sileo.success({
        title: "Nivel 4 creado",
        description: "El registro se creó correctamente.",
      });
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "No fue posible crear el nivel 4";
      setError(message);
      sileo.error({
        title: "No se pudo crear",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitLevel5(event: FormEvent) {
    event.preventDefault();
    if (!selectedLevel4Id) return;

    setSubmitting(true);
    setError(null);

    try {
      await createPatrimony("5", {
        level4Id: selectedLevel4Id,
        code: level5Form.code.trim(),
        name: level5Form.name.trim(),
        type: level5Form.type,
        shapeType: level5Form.shapeType,
        dimension1M: level5Form.dimension1M ? Number(level5Form.dimension1M) : undefined,
        dimension2M: level5Form.dimension2M ? Number(level5Form.dimension2M) : undefined,
        dimension3M: level5Form.dimension3M ? Number(level5Form.dimension3M) : undefined,
        dimension4M: level5Form.dimension4M ? Number(level5Form.dimension4M) : undefined,
      });
      setLevel5Form({
        code: "",
        name: "",
        type: "SUBUNIDAD",
        shapeType: "RECTANGULAR",
        dimension1M: "",
        dimension2M: "",
        dimension3M: "",
        dimension4M: "",
      });
      await loadLevel5(selectedLevel4Id, debouncedSearchLevel5, pageLevel5, limitLevel5);
      sileo.success({
        title: "Nivel 5 creado",
        description: "El registro se creó correctamente.",
      });
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "No fue posible crear el nivel 5";
      setError(message);
      sileo.error({
        title: "No se pudo crear",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitNeighbor(event: FormEvent) {
    event.preventDefault();
    if (!selectedLevel2Id) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/forest/patrimony/neighbors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level2Id: selectedLevel2Id,
          code: neighborForm.code.trim(),
          name: neighborForm.name.trim(),
          type: neighborForm.type.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error ?? "No fue posible crear vecino");
      }

      setNeighborForm({ code: "", name: "", type: "Colindante" });
      await loadNeighbors(selectedLevel2Id);
      sileo.success({
        title: "Colindante creado",
        description: "El colindante se creó correctamente.",
      });
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "No fue posible crear vecino";
      setError(message);
      sileo.error({
        title: "No se pudo crear",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Información del Patrimonio Forestal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inicio de implementación Fase 1: captura y consulta de unidades administrativas Nivel 2 (Finca/Predio/Hato/Fundo/Hacienda).
        </p>
        {infoMessage ? <p className="mt-2 text-xs text-blue-600">{infoMessage}</p> : null}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-medium">Nuevo registro Nivel 2</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="space-y-1 text-sm">
            <span>Código</span>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Nombre</span>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Tipo</span>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="FINCA">Finca</option>
              <option value="PREDIO">Predio</option>
              <option value="HATO">Hato</option>
              <option value="FUNDO">Fundo</option>
              <option value="HACIENDA">Hacienda</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>Estado legal</span>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={form.legalStatus}
              onChange={(event) => setForm((prev) => ({ ...prev, legalStatus: event.target.value }))}
            >
              <option value="ADQUISICION">Adquisición</option>
              <option value="ARRIENDO">Arriendo</option>
              <option value="USUFRUCTO">Usufructo</option>
              <option value="COMODATO">Comodato</option>
            </select>
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Superficie total (ha)</span>
            <input
              className="w-full rounded-md border px-3 py-2"
              type="number"
              min="0"
              step="0.01"
              value={form.totalAreaHa}
              onChange={(event) => setForm((prev) => ({ ...prev, totalAreaHa: event.target.value }))}
            />
          </label>
          <div className="md:col-span-2">
            <button
              className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSubmit || submitting}
              type="submit"
            >
              {submitting ? "Guardando..." : "Crear registro"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-medium">Registros Nivel 2</h2>
        <div className="mt-3">
          <TableToolbar
            limit={limitLevel2}
            onLimitChange={(value) => {
              setPageAdjustReason("límite");
              setPageLevel2(1);
              setLimitLevel2(value);
            }}
            onSearchChange={(value) => {
              setPageAdjustReason("filtro");
              setPageLevel2(1);
              setSearchLevel2(value);
            }}
            search={searchLevel2}
            searchPlaceholder="Buscar por código o nombre"
            total={paginationLevel2.total}
          />
        </div>
        {loading ? <p className="mt-3 text-sm">Cargando...</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Superficie (ha)</th>
                <th className="px-3 py-2">Estado legal</th>
                <th className="px-3 py-2">Estatus</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">
                    {editingLevel2Id === item.id ? (
                      <input
                        className="w-full rounded-md border px-2 py-1 text-xs"
                        onChange={(event) => setEditLevel2Form((prev) => ({ ...prev, code: event.target.value }))}
                        value={editLevel2Form.code}
                      />
                    ) : (
                      item.code
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingLevel2Id === item.id ? (
                      <input
                        className="w-full rounded-md border px-2 py-1 text-xs"
                        onChange={(event) => setEditLevel2Form((prev) => ({ ...prev, name: event.target.value }))}
                        value={editLevel2Form.name}
                      />
                    ) : (
                      item.name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingLevel2Id === item.id ? (
                      <select
                        className="w-full rounded-md border px-2 py-1 text-xs"
                        onChange={(event) => setEditLevel2Form((prev) => ({ ...prev, type: event.target.value }))}
                        value={editLevel2Form.type}
                      >
                        <option value="FINCA">Finca</option>
                        <option value="PREDIO">Predio</option>
                        <option value="HATO">Hato</option>
                        <option value="FUNDO">Fundo</option>
                        <option value="HACIENDA">Hacienda</option>
                      </select>
                    ) : (
                      item.type
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingLevel2Id === item.id ? (
                      <input
                        className="w-full rounded-md border px-2 py-1 text-xs"
                        min="0"
                        onChange={(event) => setEditLevel2Form((prev) => ({ ...prev, totalAreaHa: event.target.value }))}
                        step="0.01"
                        type="number"
                        value={editLevel2Form.totalAreaHa}
                      />
                    ) : (
                      String(item.totalAreaHa)
                    )}
                  </td>
                  <td className="px-3 py-2">{item.legalStatus ?? "-"}</td>
                  <td className="px-3 py-2">
                    {editingLevel2Id === item.id ? (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          checked={editLevel2Form.isActive}
                          onChange={(event) => setEditLevel2Form((prev) => ({ ...prev, isActive: event.target.checked }))}
                          type="checkbox"
                        />
                        Activo
                      </label>
                    ) : item.isActive ? (
                      "Activo"
                    ) : (
                      "Inactivo"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingLevel2Id === item.id ? (
                      <>
                        <button
                          className="mr-2 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                          disabled={submitting}
                          onClick={onSaveLevel2Edit}
                          type="button"
                        >
                          Guardar
                        </button>
                        <button
                          className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                          disabled={submitting}
                          onClick={() => setEditingLevel2Id(null)}
                          type="button"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="mr-2 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                          disabled={submitting}
                          onClick={() => onEditLevel2(item)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                          disabled={submitting}
                          onClick={() => onDeleteLevel2(item.id)}
                          type="button"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={7}>
                    Sin resultados
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <TablePagination
            loading={submitting}
            onNext={() => setPageLevel2((current) => Math.min(paginationLevel2.totalPages, current + 1))}
            onPrev={() => setPageLevel2((current) => Math.max(1, current - 1))}
            page={paginationLevel2.page}
            total={paginationLevel2.total}
            totalPages={paginationLevel2.totalPages}
          />
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-medium">Jerarquía y vecinos</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span>Nivel 2</span>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={selectedLevel2Id}
              onChange={(event) => {
                setPageAdjustReason("navegación");
                setSelectedLevel2Id(event.target.value);
                setSelectedLevel3Id("");
                setSelectedLevel4Id("");
                setPageLevel3(1);
                setPageLevel4(1);
                setPageLevel5(1);
              }}
            >
              <option value="">Seleccione</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>Nivel 3</span>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={selectedLevel3Id}
              onChange={(event) => {
                setPageAdjustReason("navegación");
                setSelectedLevel3Id(event.target.value);
                setSelectedLevel4Id("");
                setPageLevel4(1);
                setPageLevel5(1);
              }}
            >
              <option value="">Seleccione</option>
              {level3Items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>Nivel 4</span>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={selectedLevel4Id}
              onChange={(event) => setSelectedLevel4Id(event.target.value)}
            >
              <option value="">Seleccione</option>
              {level4Items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <form className="space-y-2 rounded-md border p-3" onSubmit={onSubmitNeighbor}>
            <h3 className="font-medium">Vecino colindante (Nivel 2)</h3>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Código vecino"
              value={neighborForm.code}
              onChange={(event) => setNeighborForm((prev) => ({ ...prev, code: event.target.value }))}
            />
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Nombre vecino"
              value={neighborForm.name}
              onChange={(event) => setNeighborForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Tipo vecino"
              value={neighborForm.type}
              onChange={(event) => setNeighborForm((prev) => ({ ...prev, type: event.target.value }))}
            />
            <button className="rounded-md border px-3 py-2 text-sm" disabled={!selectedLevel2Id || submitting} type="submit">
              Guardar vecino
            </button>
          </form>

          <div className="rounded-md border p-3">
            <h3 className="font-medium">Vecinos registrados</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {neighbors.map((neighbor) => (
                <li key={neighbor.id}>
                  {editingNeighborId === neighbor.id ? (
                    <div className="space-y-1">
                      <input
                        className="w-full rounded-md border px-2 py-1 text-xs"
                        onChange={(event) => setEditNeighborForm((prev) => ({ ...prev, code: event.target.value }))}
                        value={editNeighborForm.code}
                      />
                      <input
                        className="w-full rounded-md border px-2 py-1 text-xs"
                        onChange={(event) => setEditNeighborForm((prev) => ({ ...prev, name: event.target.value }))}
                        value={editNeighborForm.name}
                      />
                      <input
                        className="w-full rounded-md border px-2 py-1 text-xs"
                        onChange={(event) => setEditNeighborForm((prev) => ({ ...prev, type: event.target.value }))}
                        value={editNeighborForm.type}
                      />
                      <button
                        className="mr-2 rounded-md border px-2 py-0.5 text-xs disabled:opacity-60"
                        disabled={submitting}
                        onClick={onSaveNeighborEdit}
                        type="button"
                      >
                        Guardar
                      </button>
                      <button
                        className="rounded-md border px-2 py-0.5 text-xs disabled:opacity-60"
                        disabled={submitting}
                        onClick={() => setEditingNeighborId(null)}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      {neighbor.code} - {neighbor.name} ({neighbor.type})
                      <button
                        className="ml-2 rounded-md border px-2 py-0.5 text-xs disabled:opacity-60"
                        disabled={submitting}
                        onClick={() => onEditNeighbor(neighbor)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="ml-2 rounded-md border px-2 py-0.5 text-xs disabled:opacity-60"
                        disabled={submitting}
                        onClick={() => onDeleteNeighbor(neighbor.id)}
                        type="button"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </li>
              ))}
              {neighbors.length === 0 ? <li>Sin vecinos</li> : null}
            </ul>
          </div>
        </div>




      </section>



      <section className="rounded-lg border p-4">
        <div className="mt-5 grid gap-4 md:grid-cols-1">
          <h3 className="font-medium">Crear Nivel 3</h3>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmitLevel3}>

            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={selectedLevel2Id}
              onChange={(event) => {
                setPageAdjustReason("navegación");
                setSelectedLevel2Id(event.target.value);
                setSelectedLevel3Id("");
                setSelectedLevel4Id("");
                setPageLevel3(1);
                setPageLevel4(1);
                setPageLevel5(1);
              }}
              required
            >
              <option value="">Seleccione Nivel 2 Padre</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Código"
              value={level3Form.code}
              onChange={(event) => setLevel3Form((prev) => ({ ...prev, code: event.target.value }))}
            />
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Nombre"
              value={level3Form.name}
              onChange={(event) => setLevel3Form((prev) => ({ ...prev, name: event.target.value }))}
            />
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={level3Form.type}
              onChange={(event) => setLevel3Form((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="COMPARTIMIENTO">Compartimiento</option>
              <option value="BLOCK">Block</option>
              <option value="SECCION">Sección</option>
              <option value="LOTE">Lote</option>
              <option value="ZONA">Zona</option>
              <option value="BLOQUE">Bloque</option>
            </select>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              type="number"
              min="0"
              step="0.01"
              placeholder="Superficie ha"
              value={level3Form.totalAreaHa}
              onChange={(event) => setLevel3Form((prev) => ({ ...prev, totalAreaHa: event.target.value }))}
            />
            <button className="rounded-md border px-3 py-2 text-sm" disabled={!selectedLevel2Id || submitting} type="submit">
              Guardar nivel 3
            </button>
          </form>


        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-1">
          <h3 className="font-medium">Nivel 3</h3>
          <TableToolbar
            limit={limitLevel3}
            onLimitChange={(value) => {
              setPageAdjustReason("límite");
              setPageLevel3(1);
              setLimitLevel3(value);
            }}
            onSearchChange={(value) => {
              setPageAdjustReason("filtro");
              setPageLevel3(1);
              setSearchLevel3(value);
            }}
            search={searchLevel3}
            searchPlaceholder="Buscar nivel 3"
            total={paginationLevel3.total}
          />
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Superficie (ha)</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {level3Items.map((item) => (
                  <tr className="border-b" key={item.id}>
                    <td className="px-3 py-2">
                      {editingLevel3Id === item.id ? (
                        <input
                          className="w-full rounded-md border px-2 py-1 text-xs"
                          onChange={(event) => setEditLevel3Form((prev) => ({ ...prev, code: event.target.value }))}
                          value={editLevel3Form.code}
                        />
                      ) : (
                        item.code
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingLevel3Id === item.id ? (
                        <input
                          className="w-full rounded-md border px-2 py-1 text-xs"
                          onChange={(event) => setEditLevel3Form((prev) => ({ ...prev, name: event.target.value }))}
                          value={editLevel3Form.name}
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingLevel3Id === item.id ? (
                        <select
                          className="w-full rounded-md border px-2 py-1 text-xs"
                          onChange={(event) => setEditLevel3Form((prev) => ({ ...prev, type: event.target.value }))}
                          value={editLevel3Form.type}
                        >
                          <option value="COMPARTIMIENTO">Compartimiento</option>
                          <option value="BLOCK">Block</option>
                          <option value="SECCION">Sección</option>
                          <option value="LOTE">Lote</option>
                          <option value="ZONA">Zona</option>
                          <option value="BLOQUE">Bloque</option>
                        </select>
                      ) : (
                        item.type
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingLevel3Id === item.id ? (
                        <input
                          className="w-full rounded-md border px-2 py-1 text-xs"
                          min="0"
                          onChange={(event) => setEditLevel3Form((prev) => ({ ...prev, totalAreaHa: event.target.value }))}
                          step="0.01"
                          type="number"
                          value={editLevel3Form.totalAreaHa}
                        />
                      ) : (
                        String(item.totalAreaHa)
                      )}
                    </td>
                    <td className="px-3 py-2">{item.legalStatus ?? "-"}</td>
                    <td className="px-3 py-2">
                      {editingLevel3Id === item.id ? (
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            checked={editLevel3Form.isActive}
                            onChange={(event) => setEditLevel3Form((prev) => ({ ...prev, isActive: event.target.checked }))}
                            type="checkbox"
                          />
                          Activo
                        </label>
                      ) : item.isActive ? (
                        "Activo"
                      ) : (
                        "Inactivo"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingLevel3Id === item.id ? (
                        <>
                          <button
                            className="mr-2 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                            disabled={submitting}
                            onClick={onSaveLevel3Edit}
                            type="button"
                          >
                            Guardar
                          </button>
                          <button
                            className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                            disabled={submitting}
                            onClick={() => setEditingLevel3Id(null)}
                            type="button"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="mr-2 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                            disabled={submitting}
                            onClick={() => onEditLevel3(item)}
                            type="button"
                          >
                            Editar
                          </button>
                          <button
                            className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                            disabled={submitting}
                            onClick={() => onDeleteLevel3(item.id)}
                            type="button"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && level3Items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={7}>
                      Sin resultados
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-2">
            <TablePagination
              loading={submitting}
              onNext={() => setPageLevel3((current) => Math.min(paginationLevel3.totalPages, current + 1))}
              onPrev={() => setPageLevel3((current) => Math.max(1, current - 1))}
              page={paginationLevel3.page}
              total={paginationLevel3.total}
              totalPages={paginationLevel3.totalPages}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <div className="mt-5 grid gap-4 md:grid-cols-1">
          <h3 className="font-medium">Crear Nivel 4</h3>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmitLevel4}>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={selectedLevel3Id}
              onChange={(event) => {
                setPageAdjustReason("navegación");
                setSelectedLevel3Id(event.target.value);
                setSelectedLevel4Id("");
                setPageLevel4(1);
                setPageLevel5(1);
              }}
              required
            >
              <option value="">Seleccione Nivel 3 Padre</option>
              {level3Items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Código"
              value={level4Form.code}
              onChange={(event) => setLevel4Form((prev) => ({ ...prev, code: event.target.value }))}
            />
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Nombre"
              value={level4Form.name}
              onChange={(event) => setLevel4Form((prev) => ({ ...prev, name: event.target.value }))}
            />
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={level4Form.type}
              onChange={(event) => setLevel4Form((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="RODAL">Rodal</option>
              <option value="PARCELA">Parcela</option>
              <option value="ENUMERATION">Enumeration</option>
              <option value="UNIDAD_DE_MANEJO">Unidad de Manejo</option>
            </select>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              type="number"
              min="0"
              step="0.01"
              placeholder="Superficie ha"
              value={level4Form.totalAreaHa}
              onChange={(event) => setLevel4Form((prev) => ({ ...prev, totalAreaHa: event.target.value }))}
            />
            <button className="rounded-md border px-3 py-2 text-sm" disabled={!selectedLevel3Id || submitting} type="submit">
              Guardar nivel 4
            </button>
          </form>


          <div className="mt-5 grid gap-4 md:grid-cols-1">
            <h3 className="font-medium">Nivel 4</h3>
            <TableToolbar
              limit={limitLevel4}
              onLimitChange={(value) => {
                setPageAdjustReason("límite");
                setPageLevel4(1);
                setLimitLevel4(value);
              }}
              onSearchChange={(value) => {
                setPageAdjustReason("filtro");
                setPageLevel4(1);
                setSearchLevel4(value);
              }}
              search={searchLevel4}
              searchPlaceholder="Buscar nivel 4"
              total={paginationLevel4.total}
            />
            <div className="mt-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Superficie (ha)</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {level4Items.map((item) => (
                    <tr className="border-b" key={item.id}>
                      <td className="px-3 py-2">
                        {editingLevel4Id === item.id ? (
                          <input
                            className="w-full rounded-md border px-2 py-1 text-xs"
                            onChange={(event) => setEditLevel4Form((prev) => ({ ...prev, code: event.target.value }))}
                            value={editLevel4Form.code}
                          />
                        ) : (
                          item.code
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editingLevel4Id === item.id ? (
                          <input
                            className="w-full rounded-md border px-2 py-1 text-xs"
                            onChange={(event) => setEditLevel4Form((prev) => ({ ...prev, name: event.target.value }))}

                            value={editLevel4Form.name}
                          />
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editingLevel4Id === item.id ? (
                          <select
                            className="w-full rounded-md border px-2 py-1 text-xs"
                            onChange={(event) => setEditLevel4Form((prev) => ({ ...prev, type: event.target.value }))}
                            value={editLevel4Form.type}
                          >
                            <option value="RODAL">Rodal</option>
                            <option value="PARCELA">Parcela</option>
                            <option value="ENUMERATION">Enumeration</option>
                            <option value="UNIDAD_DE_MANEJO">Unidad de Manejo</option>
                          </select>
                        ) : (
                          item.type
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editingLevel4Id === item.id ? (
                          <input
                            className="w-full rounded-md border px-2 py-1 text-xs"
                            min="0"
                            onChange={(event) => setEditLevel4Form((prev) => ({ ...prev, totalAreaHa: event.target.value }))}
                            step="0.01"
                            type="number"
                            value={editLevel4Form.totalAreaHa}
                          />
                        ) : (
                          String(item.totalAreaHa)
                        )}
                      </td>
                      <td className="px-3 py-2">{item.legalStatus ?? "-"}</td>
                      <td className="px-3 py-2">
                        {editingLevel4Id === item.id ? (
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              checked={editLevel4Form.isActive}
                              onChange={(event) => setEditLevel4Form((prev) => ({ ...prev, isActive: event.target.checked }))}
                              type="checkbox"
                            />
                            Activo
                          </label>
                        ) : item.isActive ? (
                          "Activo"
                        ) : (
                          "Inactivo"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editingLevel4Id === item.id ? (
                          <>
                            <button
                              className="mr-2 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                              disabled={submitting}
                              onClick={onSaveLevel4Edit}
                              type="button"
                            >
                              Guardar
                            </button>
                            <button
                              className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                              disabled={submitting}
                              onClick={() => setEditingLevel4Id(null)}
                              type="button"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="mr-2 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                              disabled={submitting}
                              onClick={() => onEditLevel4(item)}
                              type="button"
                            >
                              Editar
                            </button>
                            <button
                              className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                              disabled={submitting}
                              onClick={() => onDeleteLevel4(item.id)}
                              type="button"
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loading && level4Items.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3" colSpan={7}>
                        Sin resultados
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="mt-2">
              <TablePagination
                loading={submitting}
                onNext={() => setPageLevel4((current) => Math.min(paginationLevel4.totalPages, current + 1))}
                onPrev={() => setPageLevel4((current) => Math.max(1, current - 1))}
                page={paginationLevel4.page}
                total={paginationLevel4.total}
                totalPages={paginationLevel4.totalPages}
              />
            </div>
          </div>


        </div>
      </section>



      <section className="rounded-lg border p-4">
        <h3 className="font-medium">Crear Nivel 5</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmitLevel5}>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={selectedLevel4Id}
            onChange={(event) => {
              setPageAdjustReason("navegación");
              setSelectedLevel4Id(event.target.value);
              setPageLevel5(1);
            }}
            required
          >
            <option value="">Seleccione Nivel 4 Padre</option>
            {level4Items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Código"
            value={level5Form.code}
            onChange={(event) => setLevel5Form((prev) => ({ ...prev, code: event.target.value }))}
          />
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Nombre"
            value={level5Form.name}
            onChange={(event) => setLevel5Form((prev) => ({ ...prev, name: event.target.value }))}
          />
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={level5Form.type}
            onChange={(event) => setLevel5Form((prev) => ({ ...prev, type: event.target.value }))}
          >
            <option value="REFERENCIA">Referencia</option>
            <option value="SUBUNIDAD">Subunidad</option>
            <option value="SUBPARCELA">Subparcela</option>
            <option value="MUESTRA">Muestra</option>
            <option value="SUBMUESTRA">Submuestra</option>
          </select>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={level5Form.shapeType}
            onChange={(event) => setLevel5Form((prev) => ({ ...prev, shapeType: event.target.value }))}
          >
            <option value="RECTANGULAR">Rectangular</option>
            <option value="CUADRADA">Cuadrada</option>
            <option value="CIRCULAR">Circular</option>
            <option value="HEXAGONAL">Hexagonal</option>
          </select>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            type="number"
            min="0"
            step="0.0001"
            placeholder="Dimensión 1"
            value={level5Form.dimension1M}
            onChange={(event) => setLevel5Form((prev) => ({ ...prev, dimension1M: event.target.value }))}
          />
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            type="number"
            min="0"
            step="0.0001"
            placeholder="Dimensión 2"
            value={level5Form.dimension2M}
            onChange={(event) => setLevel5Form((prev) => ({ ...prev, dimension2M: event.target.value }))}
          />
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            type="number"
            min="0"
            step="0.0001"
            placeholder="Dimensión 3"
            value={level5Form.dimension3M}
            onChange={(event) => setLevel5Form((prev) => ({ ...prev, dimension3M: event.target.value }))}
          />
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            type="number"
            min="0"
            step="0.0001"
            placeholder="Dimensión 4"
            value={level5Form.dimension4M}
            onChange={(event) => setLevel5Form((prev) => ({ ...prev, dimension4M: event.target.value }))}
          />
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!selectedLevel4Id || submitting} type="submit">
            Guardar nivel 5
          </button>
        </form>
        <div className="rounded-md border p-3">
          <h3 className="font-medium">Nivel 5</h3>
          <TableToolbar
            limit={limitLevel5}
            onLimitChange={(value) => {
              setPageAdjustReason("límite");
              setPageLevel5(1);
              setLimitLevel5(value);
            }}
            onSearchChange={(value) => {
              setPageAdjustReason("filtro");
              setPageLevel5(1);
              setSearchLevel5(value);
            }}
            search={searchLevel5}
            searchPlaceholder="Buscar nivel 5"
            total={paginationLevel5.total}
          />
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2">Codigo</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Area (m2)</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {level5Items.map((item) => (
                  <tr className="border-b" key={item.id}>
                    <td className="px-3 py-2">{item.code}</td>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">{item.type}</td>
                    <td className="px-3 py-2">{String(item.areaM2)}</td>
                    <td className="px-3 py-2">
                      <button className="mr-2 rounded-md border px-2 py-0.5 text-xs" onClick={() => onEditLevel5(item)} type="button">
                        Editar
                      </button>
                      <button className="rounded-md border px-2 py-0.5 text-xs" onClick={() => onDeleteLevel5(item.id)} type="button">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {level5Items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={5}>
                      Sin registros
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-2">
            <TablePagination
              loading={submitting}
              onNext={() => setPageLevel5((current) => Math.min(paginationLevel5.totalPages, current + 1))}
              onPrev={() => setPageLevel5((current) => Math.max(1, current - 1))}
              page={paginationLevel5.page}
              total={paginationLevel5.total}
              totalPages={paginationLevel5.totalPages}
            />
          </div>
        </div>
        {editingLevel5Id ? (
          <form className="mt-4 grid gap-3 rounded-lg border p-3 md:grid-cols-4" onSubmit={onSubmitLevel5Edit}>
            <input
              className="rounded-md border px-3 py-2"
              value={editLevel5Form.code}
              onChange={(event) => setEditLevel5Form((prev) => ({ ...prev, code: event.target.value }))}
            />
            <input
              className="rounded-md border px-3 py-2 md:col-span-2"
              value={editLevel5Form.name}
              onChange={(event) => setEditLevel5Form((prev) => ({ ...prev, name: event.target.value }))}
            />
            <select
              className="rounded-md border px-3 py-2"
              value={editLevel5Form.type}
              onChange={(event) => setEditLevel5Form((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="REFERENCIA">Referencia</option>
              <option value="SUBUNIDAD">Subunidad</option>
              <option value="SUBPARCELA">Subparcela</option>
              <option value="MUESTRA">Muestra</option>
              <option value="SUBMUESTRA">Submuestra</option>
            </select>
            <select
              className="rounded-md border px-3 py-2"
              value={editLevel5Form.shapeType}
              onChange={(event) => setEditLevel5Form((prev) => ({ ...prev, shapeType: event.target.value }))}
            >
              <option value="RECTANGULAR">Rectangular</option>
              <option value="CUADRADA">Cuadrada</option>
              <option value="CIRCULAR">Circular</option>
              <option value="HEXAGONAL">Hexagonal</option>
            </select>
            <input
              className="rounded-md border px-3 py-2"
              placeholder="Dimension 1"
              type="number"
              min="0"
              step="0.0001"
              value={editLevel5Form.dimension1M}
              onChange={(event) => setEditLevel5Form((prev) => ({ ...prev, dimension1M: event.target.value }))}
            />
            <input
              className="rounded-md border px-3 py-2"
              placeholder="Dimension 2"
              type="number"
              min="0"
              step="0.0001"
              value={editLevel5Form.dimension2M}
              onChange={(event) => setEditLevel5Form((prev) => ({ ...prev, dimension2M: event.target.value }))}
            />
            <input
              className="rounded-md border px-3 py-2"
              placeholder="Dimension 3"
              type="number"
              min="0"
              step="0.0001"
              value={editLevel5Form.dimension3M}
              onChange={(event) => setEditLevel5Form((prev) => ({ ...prev, dimension3M: event.target.value }))}
            />
            <input
              className="rounded-md border px-3 py-2"
              placeholder="Dimension 4"
              type="number"
              min="0"
              step="0.0001"
              value={editLevel5Form.dimension4M}
              onChange={(event) => setEditLevel5Form((prev) => ({ ...prev, dimension4M: event.target.value }))}
            />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                checked={editLevel5Form.isActive}
                onChange={(event) => setEditLevel5Form((prev) => ({ ...prev, isActive: event.target.checked }))}
                type="checkbox"
              />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" disabled={submitting} type="submit">
                Guardar
              </button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingLevel5Id(null)} type="button">
                Cancelar
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>



  );
}
