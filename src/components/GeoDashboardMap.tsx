"use client";

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { Button } from "@/components/ui/button";

const LeafletMapContainer = MapContainer as unknown as ComponentType<Record<string, unknown>>;
const LeafletTileLayer = TileLayer as unknown as ComponentType<Record<string, unknown>>;
const LeafletGeoJSON = GeoJSON as unknown as ComponentType<Record<string, unknown>>;

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: unknown;
    properties: Record<string, unknown>;
  }>;
};

type ImportJob = {
  id: string;
  status: "PENDING" | "EXTRACTING" | "VALIDATING" | "PROCESSING" | "COMPLETED" | "FAILED";
  processedRecords: number;
  failedRecords: number;
  totalRecords: number;
  errorMessage?: string | null;
};

const WORLD_BBOX = "-180,-85,180,85";

export function GeoDashboardMap() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loadingLayer, setLoadingLayer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [geoJson, setGeoJson] = useState<FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });

  const loadLayer = useCallback(async () => {
    setLoadingLayer(true);
    try {
      const response = await fetch(`/api/forest/geo/layers/nivel4?bbox=${WORLD_BBOX}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: FeatureCollection;
      };

      if (payload.success && payload.data) {
        setGeoJson(payload.data);
      }
    } finally {
      setLoadingLayer(false);
    }
  }, []);

  useEffect(() => {
    void loadLayer();
  }, [loadLayer]);

  const stopPolling = useCallback(() => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      pollerRef.current = setInterval(() => {
        void (async () => {
          const response = await fetch(`/api/forest/geo/import/${jobId}`, { cache: "no-store" });
          if (!response.ok) {
            return;
          }

          const payload = (await response.json()) as { success: boolean; data?: ImportJob };
          if (!payload.success || !payload.data) {
            return;
          }

          setJob(payload.data);
          if (payload.data.status === "COMPLETED" || payload.data.status === "FAILED") {
            stopPolling();
            setUploading(false);
            if (payload.data.status === "COMPLETED") {
              void loadLayer();
            }
          }
        })();
      }, 2000);
    },
    [loadLayer, stopPolling],
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/forest/geo/import", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { success: boolean; data?: { jobId: string }; error?: string };
    if (!response.ok || !payload.success || !payload.data?.jobId) {
      setUploading(false);
      setJob({
        id: "",
        status: "FAILED",
        processedRecords: 0,
        failedRecords: 0,
        totalRecords: 0,
        errorMessage: payload.error ?? "No se pudo iniciar la importación",
      });
      return;
    }

    setJob({
      id: payload.data.jobId,
      status: "PENDING",
      processedRecords: 0,
      failedRecords: 0,
      totalRecords: 0,
    });

    pollJob(payload.data.jobId);
  }, [pollJob]);

  const statusNode = useMemo(() => {
    if (!job) return null;

    if (job.status === "FAILED") {
      return (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="size-4" />
          <span>{job.errorMessage ?? "Error en el lote."}</span>
        </div>
      );
    }

    if (job.status === "COMPLETED") {
      return (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="size-4" />
          <span>
            Procesamiento exitoso. {job.processedRecords} registros actualizados, {job.failedRecords} con error.
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>
          {job.status} · {job.processedRecords}/{job.totalRecords || "?"} procesados
        </span>
      </div>
    );
  }, [job]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Mapa de rodales (Nivel 4)</h2>
          <p className="text-sm text-muted-foreground">Visualización geoespacial con superficies oficiales derivadas de PostGIS.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleUpload(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}Cargar shapefile (.zip)
          </Button>
        </div>
      </div>

      {statusNode}

      <div className="h-[440px] overflow-hidden rounded-lg border">
        <LeafletMapContainer center={[8, -66]} zoom={5} className="h-full w-full" scrollWheelZoom>
          <LeafletTileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LeafletGeoJSON data={geoJson} />
        </LeafletMapContainer>
      </div>

      {loadingLayer ? <p className="text-xs text-muted-foreground">Actualizando capa geoespacial...</p> : null}
    </section>
  );
}
