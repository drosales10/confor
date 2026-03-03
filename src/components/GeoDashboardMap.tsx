"use client";

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { area as turfArea, polygon as turfPolygon } from "@turf/turf";
import html2canvas from "html2canvas";
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, EyeOff, Layers3, Loader2, Maximize2, Minimize2, Palette, Search, Upload } from "lucide-react";
import { MapContainer, TileLayer, GeoJSON, Polygon, Polyline, ScaleControl, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/uiStore";

const LeafletMapContainer = MapContainer as unknown as ComponentType<Record<string, unknown>>;
const LeafletTileLayer = TileLayer as unknown as ComponentType<Record<string, unknown>>;
const LeafletGeoJSON = GeoJSON as unknown as ComponentType<Record<string, unknown>>;
const LeafletScaleControl = ScaleControl as unknown as ComponentType<Record<string, unknown>>;
const LeafletPolyline = Polyline as unknown as ComponentType<Record<string, unknown>>;
const LeafletPolygon = Polygon as unknown as ComponentType<Record<string, unknown>>;
const LeafletCircleMarker = CircleMarker as unknown as ComponentType<Record<string, unknown>>;

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: unknown;
    properties: Record<string, unknown>;
  }>;
};

type LayerStyleMode = "single" | "surfaceRange";

type MapLayer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  color: string;
  styleMode: LayerStyleMode;
  data: FeatureCollection;
};

type PersistedLayerSetting = {
  id: string;
  visible: boolean;
  opacity: number;
  color: string;
  styleMode: LayerStyleMode;
  order: number;
};

type ImportJob = {
  id: string;
  status: "PENDING" | "EXTRACTING" | "VALIDATING" | "PROCESSING" | "COMPLETED" | "FAILED";
  processedRecords: number;
  failedRecords: number;
  totalRecords: number;
  errorMessage?: string | null;
};

type EditMode = "none" | "distance" | "area" | "split" | "createLevel4";

type BasemapKey = "osm" | "googleSatellite" | "topographic" | "grayCanvas" | "nationalGeographic";

type BasemapOption = {
  label: string;
  url: string;
  attribution: string;
  subdomains?: string[];
  maxZoom?: number;
};

type PointerCoords = {
  lat: number;
  lng: number;
};

type MapViewState = {
  lat: number;
  lng: number;
  zoom: number;
};

type PatrimonyLevel2Option = {
  id: string;
  code: string;
  name: string;
};

type PatrimonyLevel3Option = {
  id: string;
  code: string;
  name: string;
  level2Id: string;
};

type LandUseOption = {
  id: string;
  code: string;
  name: string;
};

type SelectedLevel4Detail = {
  id: string;
  level2Id: string;
  level3Id: string;
  code: string;
  name: string;
  type: "RODAL" | "PARCELA" | "ENUMERATION" | "UNIDAD_DE_MANEJO" | "CONUCO" | "OTRO_USO";
  fscCertificateStatus: "SI" | "NO";
  currentLandUseName?: string | null;
  previousLandUseName?: string | null;
  rotationPhase?: string | null;
  previousUse?: string | null;
};

type PolygonVisibilityMode = "all" | "none" | "selected";
type RightPanelTab = "buscar" | "filtros" | "gis" | "capas";

const WORLD_BBOX = "-180,-85,180,85";
const LAYER_SETTINGS_KEY = "geoDashboard.layerSettings.v1";
const BASEMAP_SETTINGS_KEY = "geoDashboard.basemap.v1";
const MAP_VIEW_SETTINGS_KEY = "geoDashboard.mapView.v1";
const SELECTED_FEATURES_SETTINGS_KEY = "geoDashboard.selectedFeatures.v1";
const FILTER_SETTINGS_KEY = "geoDashboard.filters.v1";
const DEFAULT_BASEMAP: BasemapKey = "osm";
const DEFAULT_MAP_VIEW: MapViewState = { lat: 8, lng: -66, zoom: 5 };
const SNAP_CLOSE_DISTANCE_METERS = 20;

const BASEMAPS: Record<BasemapKey, BasemapOption> = {
  osm: {
    label: "Openstreetmap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
  },
  googleSatellite: {
    label: "Google Satellite",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "&copy; Google",
    maxZoom: 20,
  },
  topographic: {
    label: "Topografico",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  },
  grayCanvas: {
    label: "Lienzo gris",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: ["a", "b", "c", "d"],
    maxZoom: 20,
  },
  nationalGeographic: {
    label: "National Geographic",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri — National Geographic",
    maxZoom: 16,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw.trim()) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function colorForSurface(surfaceHa: number) {
  if (surfaceHa < 10) return "#34d399";
  if (surfaceHa < 50) return "#facc15";
  if (surfaceHa < 150) return "#f97316";
  return "#ef4444";
}

function haversineDistanceMeters(a: PointerCoords, b: PointerCoords) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

function formatDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters)) return "0 m";
  if (distanceMeters < 1000) return `${distanceMeters.toFixed(1)} m`;
  return `${(distanceMeters / 1000).toFixed(3)} km`;
}

function formatArea(areaM2: number) {
  if (!Number.isFinite(areaM2)) return "0 m²";
  if (areaM2 >= 10000) return `${(areaM2 / 10000).toFixed(3)} ha`;
  return `${areaM2.toFixed(1)} m²`;
}

function createLayer(name: string, data: FeatureCollection, existing?: MapLayer): MapLayer {
  return {
    id: existing?.id ?? `layer-${Date.now()}`,
    name,
    visible: existing?.visible ?? true,
    opacity: existing?.opacity ?? 70,
    color: existing?.color ?? "#2563eb",
    styleMode: existing?.styleMode ?? "surfaceRange",
    data,
  };
}

function serializeLayerSettings(layers: MapLayer[]): PersistedLayerSetting[] {
  return layers.map((layer, index) => ({
    id: layer.id,
    visible: layer.visible,
    opacity: layer.opacity,
    color: layer.color,
    styleMode: layer.styleMode,
    order: index,
  }));
}

function applyPersistedSettings(layers: MapLayer[], settings: PersistedLayerSetting[]) {
  if (!settings.length) return layers;

  const settingsMap = new Map(settings.map((setting) => [setting.id, setting]));

  const patched = layers.map((layer) => {
    const persisted = settingsMap.get(layer.id);
    if (!persisted) return layer;

    return {
      ...layer,
      visible: persisted.visible,
      opacity: clamp(persisted.opacity, 5, 100),
      color: persisted.color,
      styleMode: persisted.styleMode,
    };
  });

  return [...patched].sort((a, b) => {
    const orderA = settingsMap.get(a.id)?.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = settingsMap.get(b.id)?.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}

function MapResizeController({ resizeToken }: { resizeToken: string }) {
  const map = useMap();

  useEffect(() => {
    const run = () => map.invalidateSize({ animate: false });

    run();
    const raf = window.requestAnimationFrame(run);
    const timeout = window.setTimeout(run, 180);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [map, resizeToken]);

  useEffect(() => {
    const container = map.getContainer();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [map]);

  return null;
}

function MapCursorController({ isDrawingMode }: { isDrawingMode: boolean }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const elements = [
      container,
      ...(Array.from(
        container.querySelectorAll(".leaflet-container, .leaflet-pane, .leaflet-interactive, .leaflet-grab"),
      ) as HTMLElement[]),
    ];

    const cursor = isDrawingMode ? "crosshair" : "";
    elements.forEach((element) => {
      if (cursor) {
        element.style.setProperty("cursor", cursor, "important");
      } else {
        element.style.removeProperty("cursor");
      }
    });

    return () => {
      elements.forEach((element) => {
        element.style.removeProperty("cursor");
      });
    };
  }, [isDrawingMode, map]);

  return null;
}

function MapInteractionController({
  editMode,
  onPointerMove,
  onMapClick,
  onMapMouseUp,
}: {
  editMode: EditMode;
  onPointerMove: (coords: PointerCoords) => void;
  onMapClick: (coords: PointerCoords) => void;
  onMapMouseUp: () => void;
}) {
  useMapEvents({
    mousemove: (event: { latlng: { lat: number; lng: number } }) => {
      onPointerMove({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
    mouseup: () => {
      onMapMouseUp();
    },
    click: (event: { latlng: { lat: number; lng: number } }) => {
      if (editMode === "none") return;
      onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

function MapViewPersistenceController({
  onViewChange,
}: {
  onViewChange: (view: MapViewState) => void;
}) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onViewChange({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    },
    zoomend: () => {
      const center = map.getCenter();
      onViewChange({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    },
  });

  useEffect(() => {
    const center = map.getCenter();
    onViewChange({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
  }, [map, onViewChange]);

  return null;
}

function MapViewResetController({
  resetSignal,
  targetView,
}: {
  resetSignal: number;
  targetView: MapViewState;
}) {
  const map = useMap();

  useEffect(() => {
    if (resetSignal === 0) return;
    map.setView([targetView.lat, targetView.lng], targetView.zoom, { animate: false });
  }, [map, resetSignal, targetView.lat, targetView.lng, targetView.zoom]);

  return null;
}

function MapInstanceController({
  onMapReady,
}: {
  onMapReady: (map: ReturnType<typeof useMap>) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  return null;
}

function collectGeometryCoordinates(geometry: unknown): number[][] {
  if (!geometry || typeof geometry !== "object") return [];

  const geometryValue = geometry as { type?: string; coordinates?: unknown; geometries?: unknown[] };
  const geometryType = geometryValue.type;

  if (geometryType === "GeometryCollection" && Array.isArray(geometryValue.geometries)) {
    return geometryValue.geometries.flatMap((item) => collectGeometryCoordinates(item));
  }

  if (geometryType !== "Point"
    && geometryType !== "MultiPoint"
    && geometryType !== "LineString"
    && geometryType !== "MultiLineString"
    && geometryType !== "Polygon"
    && geometryType !== "MultiPolygon") {
    return [];
  }

  const points: number[][] = [];

  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;

    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
      return;
    }

    for (const child of value) {
      walk(child);
    }
  };

  walk(geometryValue.coordinates);
  return points;
}

function MapSearchFocusController({
  focusSignal,
  targetGeometry,
}: {
  focusSignal: number;
  targetGeometry: unknown | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (focusSignal === 0 || !targetGeometry) return;

    try {
      const coords = collectGeometryCoordinates(targetGeometry);
      if (coords.length === 0) return;

      let minLat = Number.POSITIVE_INFINITY;
      let minLng = Number.POSITIVE_INFINITY;
      let maxLat = Number.NEGATIVE_INFINITY;
      let maxLng = Number.NEGATIVE_INFINITY;

      for (const [lng, lat] of coords) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        minLat = Math.min(minLat, lat);
        minLng = Math.min(minLng, lng);
        maxLat = Math.max(maxLat, lat);
        maxLng = Math.max(maxLng, lng);
      }

      if (!Number.isFinite(minLat) || !Number.isFinite(minLng) || !Number.isFinite(maxLat) || !Number.isFinite(maxLng)) {
        return;
      }

      map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { animate: false, padding: [40, 40] });
    } catch {
      // no-op
    }
  }, [focusSignal, map, targetGeometry]);

  return null;
}

export function GeoDashboardMap() {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<ReturnType<typeof useMap> | null>(null);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const persistedSettingsRef = useRef<PersistedLayerSetting[]>([]);
  const editModeRef = useRef<EditMode>("none");
  const finalizeDrawingRef = useRef<(() => Promise<void>) | null>(null);
  const draggingVertexIndexRef = useRef<number | null>(null);
  const suppressNextMapClickRef = useRef(false);
  const [loadingLayer, setLoadingLayer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [level2FilterTerm, setLevel2FilterTerm] = useState("");
  const [level3FilterTerm, setLevel3FilterTerm] = useState("");
  const [level4FilterTerm, setLevel4FilterTerm] = useState("");
  const [polygonVisibilityMode, setPolygonVisibilityMode] = useState<PolygonVisibilityMode>("all");
  const [selectedLevel2, setSelectedLevel2] = useState("");
  const [selectedLevel3, setSelectedLevel3] = useState("");
  const [selectedLevel4, setSelectedLevel4] = useState("");
  const [activeRightTab, setActiveRightTab] = useState<RightPanelTab>("buscar");
  const [focusSignal, setFocusSignal] = useState(0);
  const [focusGeometry, setFocusGeometry] = useState<unknown | null>(null);
  const [selectedBasemap, setSelectedBasemap] = useState<BasemapKey>(DEFAULT_BASEMAP);
  const [mapView, setMapView] = useState<MapViewState>(DEFAULT_MAP_VIEW);
  const [resetSignal, setResetSignal] = useState(0);
  const [pointerCoords, setPointerCoords] = useState<PointerCoords | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [drawPoints, setDrawPoints] = useState<PointerCoords[]>([]);
  const [isNearFirstVertex, setIsNearFirstVertex] = useState(false);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [measurementLabel, setMeasurementLabel] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [isApplyingOperation, setIsApplyingOperation] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [splitCodeA, setSplitCodeA] = useState("");
  const [splitCodeB, setSplitCodeB] = useState("");
  const [mergeCode, setMergeCode] = useState("");
  const [createLevel2Id, setCreateLevel2Id] = useState("");
  const [createLevel3Id, setCreateLevel3Id] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState("RODAL");
  const [createFscStatus, setCreateFscStatus] = useState("NO");
  const [createCurrentLandUseName, setCreateCurrentLandUseName] = useState("");
  const [createPreviousLandUseName, setCreatePreviousLandUseName] = useState("");
  const [createRotationPhase, setCreateRotationPhase] = useState("");
  const [createPreviousUse, setCreatePreviousUse] = useState("");
  const [selectedLevel4Detail, setSelectedLevel4Detail] = useState<SelectedLevel4Detail | null>(null);
  const [editingCode, setEditingCode] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editingType, setEditingType] = useState("RODAL");
  const [editingFscStatus, setEditingFscStatus] = useState("NO");
  const [editingCurrentLandUseName, setEditingCurrentLandUseName] = useState("");
  const [editingPreviousLandUseName, setEditingPreviousLandUseName] = useState("");
  const [editingRotationPhase, setEditingRotationPhase] = useState("");
  const [editingPreviousUse, setEditingPreviousUse] = useState("");
  const [applyDrawnGeometryToUpdate, setApplyDrawnGeometryToUpdate] = useState(false);
  const [isLoadingSelectedDetail, setIsLoadingSelectedDetail] = useState(false);
  const [patrimonyLevel2Options, setPatrimonyLevel2Options] = useState<PatrimonyLevel2Option[]>([]);
  const [patrimonyLevel3Options, setPatrimonyLevel3Options] = useState<PatrimonyLevel3Option[]>([]);
  const [landUseOptions, setLandUseOptions] = useState<LandUseOption[]>([]);
  const [loadingCreateOptions, setLoadingCreateOptions] = useState(false);
  const isPanelCollapsed = useUIStore((state) => state.geoPanelCollapsed);
  const showLegend = useUIStore((state) => state.geoLegendVisible);
  const toggleGeoPanel = useUIStore((state) => state.toggleGeoPanel);
  const toggleGeoLegend = useUIStore((state) => state.toggleGeoLegend);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);

  const loadLayer = useCallback(async () => {
    setLoadingLayer(true);
    try {
      const response = await fetch(`/api/forest/geo/layers/nivel4?bbox=${WORLD_BBOX}`, {
        cache: "no-store",
      });
      const payload = await readJsonSafe<{
        success: boolean;
        error?: string;
        data?: FeatureCollection;
      }>(response);

      if (!response.ok || !payload?.success) {
        const message = payload?.error ?? "No se pudo cargar la capa de rodales.";
        setOperationMessage(`Carga de capa: ${message}`);
        sileo.error({ title: "Error de capa", description: message });
        setLayers((previous) => {
          const existing = previous.find((layer) => layer.id === "rodales-activos");
          const baseLayer = createLayer("Rodales activos (Nivel 4)", { type: "FeatureCollection", features: [] }, existing);
          baseLayer.id = "rodales-activos";
          const others = previous.filter((layer) => layer.id !== "rodales-activos");
          return applyPersistedSettings([baseLayer, ...others], persistedSettingsRef.current);
        });
        return;
      }

      if (payload.data) {
        const layerData = payload.data;
        setOperationMessage(null);
        setLayers((previous) => {
          const existing = previous.find((layer) => layer.id === "rodales-activos");
          const baseLayer = createLayer("Rodales activos (Nivel 4)", layerData, existing);
          baseLayer.id = "rodales-activos";
          const others = previous.filter((layer) => layer.id !== "rodales-activos");
          return applyPersistedSettings([baseLayer, ...others], persistedSettingsRef.current);
        });
      }
    } catch {
      sileo.error({ title: "Error de capa", description: "No se pudo cargar la capa de rodales." });
    } finally {
      setLoadingLayer(false);
    }
  }, []);

  const loadLevel2Options = useCallback(async () => {
    const limit = 100;
    let page = 1;
    let totalPages = 1;
    const allItems: Array<{ id: string; code: string; name: string }> = [];

    while (page <= totalPages) {
      const response = await fetch(`/api/forest/patrimony?level=2&page=${page}&limit=${limit}`, { cache: "no-store" });
      const payload = await readJsonSafe<{
        success: boolean;
        data?: {
          items?: Array<{ id: string; code: string; name: string }>;
          pagination?: { totalPages?: number };
        };
        error?: string;
      }>(response);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No se pudieron cargar los niveles 2");
      }

      const items = payload.data?.items ?? [];
      allItems.push(...items);
      totalPages = Math.max(1, Number(payload.data?.pagination?.totalPages ?? 1));
      page += 1;
    }

    setPatrimonyLevel2Options(allItems.map((item) => ({ id: item.id, code: item.code, name: item.name })));
  }, []);

  const loadLevel3Options = useCallback(async (level2Id: string) => {
    if (!level2Id) {
      setPatrimonyLevel3Options([]);
      return;
    }

    const limit = 100;
    let page = 1;
    let totalPages = 1;
    const allItems: Array<{ id: string; code: string; name: string; level2Id?: string }> = [];

    while (page <= totalPages) {
      const response = await fetch(`/api/forest/patrimony?level=3&parentId=${level2Id}&page=${page}&limit=${limit}`, { cache: "no-store" });
      const payload = await readJsonSafe<{
        success: boolean;
        data?: {
          items?: Array<{ id: string; code: string; name: string; level2Id?: string }>;
          pagination?: { totalPages?: number };
        };
        error?: string;
      }>(response);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No se pudieron cargar los niveles 3");
      }

      const items = payload.data?.items ?? [];
      allItems.push(...items);
      totalPages = Math.max(1, Number(payload.data?.pagination?.totalPages ?? 1));
      page += 1;
    }

    setPatrimonyLevel3Options(
      allItems.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        level2Id,
      })),
    );
  }, []);

  const loadLandUseOptions = useCallback(async () => {
    const limit = 100;
    let page = 1;
    let totalPages = 1;
    const allItems: Array<{ id: string; code: string; name: string }> = [];

    while (page <= totalPages) {
      const response = await fetch(`/api/forest/config/land-use-types?page=${page}&limit=${limit}&sortBy=name&sortOrder=asc`, { cache: "no-store" });
      const payload = await readJsonSafe<{
        success: boolean;
        data?: {
          items?: Array<{ id: string; code: string; name: string }>;
          pagination?: { totalPages?: number };
        };
        error?: string;
      }>(response);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No se pudieron cargar los usos de suelos");
      }

      const items = payload.data?.items ?? [];
      allItems.push(...items);
      totalPages = Math.max(1, Number(payload.data?.pagination?.totalPages ?? 1));
      page += 1;
    }

    setLandUseOptions(allItems);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAYER_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedLayerSetting[];
        if (Array.isArray(parsed)) {
          persistedSettingsRef.current = parsed;
        }
      }
    } catch {
      persistedSettingsRef.current = [];
    }

    try {
      const rawBasemap = window.localStorage.getItem(BASEMAP_SETTINGS_KEY);
      if (rawBasemap && Object.hasOwn(BASEMAPS, rawBasemap)) {
        setSelectedBasemap(rawBasemap as BasemapKey);
      }
    } catch {
      // no-op
    }

    try {
      const rawView = window.localStorage.getItem(MAP_VIEW_SETTINGS_KEY);
      if (rawView) {
        const parsedView = JSON.parse(rawView) as Partial<MapViewState>;
        const lat = Number(parsedView.lat);
        const lng = Number(parsedView.lng);
        const zoom = Number(parsedView.zoom);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(zoom)) {
          setMapView({ lat, lng, zoom });
        }
      }
    } catch {
      // no-op
    }

    try {
      const rawSelected = window.localStorage.getItem(SELECTED_FEATURES_SETTINGS_KEY);
      if (rawSelected) {
        const parsedSelected = JSON.parse(rawSelected) as string[];
        if (Array.isArray(parsedSelected)) {
          setSelectedFeatureIds(parsedSelected.filter((item) => typeof item === "string"));
        }
      }
    } catch {
      // no-op
    }

    try {
      const rawFilters = window.localStorage.getItem(FILTER_SETTINGS_KEY);
      if (rawFilters) {
        const parsedFilters = JSON.parse(rawFilters) as {
          searchTerm?: string;
          selectedLevel2?: string;
          selectedLevel3?: string;
          selectedLevel4?: string;
          polygonVisibilityMode?: PolygonVisibilityMode;
        };

        if (typeof parsedFilters.searchTerm === "string") {
          setSearchTerm(parsedFilters.searchTerm);
        }
        if (typeof parsedFilters.selectedLevel2 === "string") {
          setSelectedLevel2(parsedFilters.selectedLevel2);
        }
        if (typeof parsedFilters.selectedLevel3 === "string") {
          setSelectedLevel3(parsedFilters.selectedLevel3);
        }
        if (typeof parsedFilters.selectedLevel4 === "string") {
          setSelectedLevel4(parsedFilters.selectedLevel4);
        }
        if (
          parsedFilters.polygonVisibilityMode === "all"
          || parsedFilters.polygonVisibilityMode === "none"
          || parsedFilters.polygonVisibilityMode === "selected"
        ) {
          setPolygonVisibilityMode(parsedFilters.polygonVisibilityMode);
        }
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(BASEMAP_SETTINGS_KEY, selectedBasemap);
    } catch {
      // no-op
    }
  }, [selectedBasemap]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SELECTED_FEATURES_SETTINGS_KEY, JSON.stringify(selectedFeatureIds));
    } catch {
      // no-op
    }
  }, [selectedFeatureIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        FILTER_SETTINGS_KEY,
        JSON.stringify({
          searchTerm,
          selectedLevel2,
          selectedLevel3,
          selectedLevel4,
          polygonVisibilityMode,
        }),
      );
    } catch {
      // no-op
    }
  }, [polygonVisibilityMode, searchTerm, selectedLevel2, selectedLevel3, selectedLevel4]);

  const persistMapView = useCallback((view: MapViewState) => {
    setMapView(view);
    try {
      window.localStorage.setItem(MAP_VIEW_SETTINGS_KEY, JSON.stringify(view));
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    void loadLayer();
  }, [loadLayer]);

  useEffect(() => {
    void (async () => {
      setLoadingCreateOptions(true);
      try {
        await loadLevel2Options();
        await loadLandUseOptions();
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron cargar opciones de niveles";
        sileo.error({ title: "Error de catálogo", description: message });
      } finally {
        setLoadingCreateOptions(false);
      }
    })();
  }, [loadLandUseOptions, loadLevel2Options]);

  useEffect(() => {
    if (!createLevel2Id) {
      setCreateLevel3Id("");
      setPatrimonyLevel3Options([]);
      return;
    }

    void (async () => {
      setLoadingCreateOptions(true);
      try {
        await loadLevel3Options(createLevel2Id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron cargar niveles 3";
        sileo.error({ title: "Error de catálogo", description: message });
      } finally {
        setLoadingCreateOptions(false);
      }
    })();
  }, [createLevel2Id, loadLevel3Options]);

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
          try {
            const response = await fetch(`/api/forest/geo/import/${jobId}`, { cache: "no-store" });
            if (!response.ok) {
              return;
            }

            const payload = await readJsonSafe<{ success: boolean; data?: ImportJob }>(response);
            if (!payload?.success || !payload.data) {
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
          } catch {
            stopPolling();
            setUploading(false);
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
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/geo/import", {
        method: "POST",
        body: formData,
      });

      const payload = await readJsonSafe<{ success: boolean; data?: { jobId: string }; error?: string }>(response);
      if (!response.ok || !payload?.success || !payload.data?.jobId) {
        setUploading(false);
        setJob({
          id: "",
          status: "FAILED",
          processedRecords: 0,
          failedRecords: 0,
          totalRecords: 0,
          errorMessage: payload?.error ?? "No se pudo iniciar la importación",
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
    } catch {
      setUploading(false);
      setJob({
        id: "",
        status: "FAILED",
        processedRecords: 0,
        failedRecords: 0,
        totalRecords: 0,
        errorMessage: "No se pudo iniciar la importación",
      });
    }
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

  const visibleLayers = useMemo(
    () => layers.filter((layer) => layer.visible),
    [layers],
  );

  const allFeatures = useMemo(
    () => layers.flatMap((layer) => layer.data.features),
    [layers],
  );

  const level2Options = useMemo(() => {
    const map = new Map<string, string>();
    for (const feature of allFeatures) {
      const id = String(feature.properties.level2Id ?? "").trim();
      if (!id) continue;
      const code = String(feature.properties.level2Code ?? id);
      const name = String(feature.properties.level2Name ?? "").trim();
      map.set(id, name ? `${code} · ${name}` : code);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allFeatures]);

  const level3Options = useMemo(() => {
    const map = new Map<string, string>();
    for (const feature of allFeatures) {
      const level2Id = String(feature.properties.level2Id ?? "").trim();
      if (selectedLevel2 && level2Id !== selectedLevel2) continue;

      const id = String(feature.properties.level3Id ?? "").trim();
      if (!id) continue;
      const code = String(feature.properties.level3Code ?? id);
      const name = String(feature.properties.level3Name ?? "").trim();
      map.set(id, name ? `${code} · ${name}` : code);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allFeatures, selectedLevel2]);

  const level4Options = useMemo(() => {
    const map = new Map<string, string>();
    for (const feature of allFeatures) {
      const level2Id = String(feature.properties.level2Id ?? "").trim();
      const level3Id = String(feature.properties.level3Id ?? "").trim();
      if (selectedLevel2 && level2Id !== selectedLevel2) continue;
      if (selectedLevel3 && level3Id !== selectedLevel3) continue;

      const id = String(feature.properties.level4Id ?? "").trim();
      if (!id) continue;
      const code = String(feature.properties.level4Code ?? id);
      const name = String(feature.properties.level4Name ?? "").trim();
      map.set(id, name ? `${code} · ${name}` : code);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allFeatures, selectedLevel2, selectedLevel3]);

  const filteredLevel2Options = useMemo(() => {
    const term = level2FilterTerm.trim().toLowerCase();
    if (!term) return level2Options;
    return level2Options.filter((option) => option.label.toLowerCase().includes(term));
  }, [level2FilterTerm, level2Options]);

  const filteredLevel3Options = useMemo(() => {
    const term = level3FilterTerm.trim().toLowerCase();
    if (!term) return level3Options;
    return level3Options.filter((option) => option.label.toLowerCase().includes(term));
  }, [level3FilterTerm, level3Options]);

  const filteredLevel4Options = useMemo(() => {
    const term = level4FilterTerm.trim().toLowerCase();
    if (!term) return level4Options;
    return level4Options.filter((option) => option.label.toLowerCase().includes(term));
  }, [level4FilterTerm, level4Options]);

  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const searchMatches = useMemo(() => {
    if (!normalizedSearch) return [] as Array<{ level4Id: string; label: string; geometry: unknown }>;

    const matches: Array<{ level4Id: string; label: string; geometry: unknown }> = [];
    const seen = new Set<string>();

    for (const layer of layers) {
      for (const feature of layer.data.features) {
        const level4Id = String(feature.properties.level4Id ?? "").trim();
        if (!level4Id || seen.has(level4Id)) continue;

        const level4Code = String(feature.properties.level4Code ?? "").trim();
        const level4Name = String(feature.properties.level4Name ?? "").trim();
        const idLower = level4Id.toLowerCase();
        const codeLower = level4Code.toLowerCase();
        const nameLower = level4Name.toLowerCase();

        const isMatch = idLower.includes(normalizedSearch)
          || codeLower.includes(normalizedSearch)
          || nameLower.includes(normalizedSearch);

        if (!isMatch) continue;

        seen.add(level4Id);
        matches.push({
          level4Id,
          label: level4Name ? `${level4Code || level4Id} · ${level4Name}` : (level4Code || level4Id),
          geometry: feature.geometry,
        });
      }
    }

    return matches;
  }, [layers, normalizedSearch]);

  const firstSearchMatch = useMemo(() => searchMatches[0] ?? null, [searchMatches]);

  const panelLayers = useMemo(() => {
    if (!normalizedSearch) return layers;
    return layers.filter((layer) => {
      if (layer.name.toLowerCase().includes(normalizedSearch)) {
        return true;
      }

      return layer.data.features.some((feature) => {
        const level4Id = String(feature.properties.level4Id ?? "").toLowerCase();
        const level4Code = String(feature.properties.level4Code ?? "").toLowerCase();
        const level4Name = String(feature.properties.level4Name ?? "").toLowerCase();
        return level4Id.includes(normalizedSearch)
          || level4Code.includes(normalizedSearch)
          || level4Name.includes(normalizedSearch);
      });
    });
  }, [layers, normalizedSearch]);

  const filteredVisibleLayers = useMemo(() => {
    if (polygonVisibilityMode === "none") return [];

    if (polygonVisibilityMode === "selected") {
      if (selectedFeatureIds.length === 0) return [];
      const selectedSet = new Set(selectedFeatureIds);

      return visibleLayers
        .map((layer) => ({
          ...layer,
          data: {
            ...layer.data,
            features: layer.data.features.filter((feature) => {
              const level4Id = String(feature.properties.level4Id ?? "").trim();
              if (!selectedSet.has(level4Id)) return false;

              if (!normalizedSearch) return true;
              const level4Code = String(feature.properties.level4Code ?? "").toLowerCase();
              const level4Name = String(feature.properties.level4Name ?? "").toLowerCase();
              const level4IdLower = level4Id.toLowerCase();

              return level4IdLower.includes(normalizedSearch)
                || level4Code.includes(normalizedSearch)
                || level4Name.includes(normalizedSearch);
            }),
          },
        }))
        .filter((layer) => layer.data.features.length > 0);
    }

    const hasHierarchyFilter = Boolean(selectedLevel2 || selectedLevel3 || selectedLevel4);
    if (!normalizedSearch && !hasHierarchyFilter) return visibleLayers;

    return visibleLayers
      .map((layer) => {
        const layerMatchesSearch = normalizedSearch && layer.name.toLowerCase().includes(normalizedSearch);
        const layerMatchesHierarchy = !selectedLevel2 && !selectedLevel3 && !selectedLevel4;

        if (layerMatchesSearch && layerMatchesHierarchy) {
          return layer;
        }

        return {
          ...layer,
          data: {
            ...layer.data,
            features: layer.data.features.filter((feature) => {
              const level2Id = String(feature.properties.level2Id ?? "").trim();
              const level3Id = String(feature.properties.level3Id ?? "").trim();
              const level4Id = String(feature.properties.level4Id ?? "").trim();

              const matchesHierarchy =
                (!selectedLevel2 || level2Id === selectedLevel2)
                && (!selectedLevel3 || level3Id === selectedLevel3)
                && (!selectedLevel4 || level4Id === selectedLevel4);

              if (!matchesHierarchy) return false;
              if (!normalizedSearch) return true;

              const level4Code = String(feature.properties.level4Code ?? "").toLowerCase();
              const level4Name = String(feature.properties.level4Name ?? "").toLowerCase();
              const level4IdLower = level4Id.toLowerCase();

              return level4IdLower.includes(normalizedSearch)
                || level4Code.includes(normalizedSearch)
                || level4Name.includes(normalizedSearch);
            }),
          },
        };
      })
      .filter((layer) => layer.data.features.length > 0);
  }, [normalizedSearch, polygonVisibilityMode, selectedFeatureIds, selectedLevel2, selectedLevel3, selectedLevel4, visibleLayers]);

  useEffect(() => {
    if (!selectedLevel3) {
      if (selectedLevel4) {
        setSelectedLevel4("");
      }
      return;
    }

    const exists = level4Options.some((option) => option.id === selectedLevel4);
    if (!exists && selectedLevel4) {
      setSelectedLevel4("");
    }
  }, [level4Options, selectedLevel3, selectedLevel4]);

  useEffect(() => {
    if (!selectedLevel2) {
      if (selectedLevel3) setSelectedLevel3("");
      if (selectedLevel4) setSelectedLevel4("");
      return;
    }

    const exists = level3Options.some((option) => option.id === selectedLevel3);
    if (!exists && selectedLevel3) {
      setSelectedLevel3("");
      if (selectedLevel4) setSelectedLevel4("");
    }
  }, [level3Options, selectedLevel2, selectedLevel3, selectedLevel4]);

  useEffect(() => {
    const serialized = serializeLayerSettings(layers);
    persistedSettingsRef.current = serialized;
    try {
      window.localStorage.setItem(LAYER_SETTINGS_KEY, JSON.stringify(serialized));
    } catch {
      // no-op
    }
  }, [layers]);

  const moveLayer = useCallback((id: string, direction: "up" | "down") => {
    setLayers((current) => {
      const index = current.findIndex((layer) => layer.id === id);
      if (index < 0) return current;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;

      const clone = [...current];
      [clone[index], clone[target]] = [clone[target], clone[index]];
      return clone;
    });
  }, []);

  const updateLayer = useCallback((id: string, updater: (layer: MapLayer) => MapLayer) => {
    setLayers((current) => current.map((layer) => (layer.id === id ? updater(layer) : layer)));
  }, []);

  const currentSurfaceSummary = useMemo(() => {
    const baseLayer = filteredVisibleLayers.find((layer) => layer.id === "rodales-activos");
    const features = baseLayer?.data.features ?? [];
    const total = features.reduce((sum, feature) => sum + (parseNumber(feature.properties.surfaceHa) ?? 0), 0);
    return {
      count: features.length,
      total,
    };
  }, [filteredVisibleLayers]);

  const legendLayers = useMemo(
    () => filteredVisibleLayers.filter((layer) => layer.data.features.length > 0),
    [filteredVisibleLayers],
  );

  const exportableFeatureCount = useMemo(
    () => filteredVisibleLayers.reduce((sum, layer) => sum + layer.data.features.length, 0),
    [filteredVisibleLayers],
  );

  const resizeToken = useMemo(
    () => `${sidebarOpen ? "left-open" : "left-closed"}-${isPanelCollapsed ? "right-closed" : "right-open"}`,
    [isPanelCollapsed, sidebarOpen],
  );

  const activeBasemap = useMemo(() => BASEMAPS[selectedBasemap], [selectedBasemap]);

  const availableLevel4IdsKey = useMemo(() => layers
    .flatMap((layer) => layer.data.features.map((feature) => String(feature.properties.level4Id ?? "")))
    .filter(Boolean)
    .sort()
    .join("|"), [layers]);

  useEffect(() => {
    const available = new Set(
      availableLevel4IdsKey
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean),
    );

    setSelectedFeatureIds((current) => current.filter((id) => available.has(id)));
  }, [availableLevel4IdsKey]);

  const selectedSingleLevel4Id = useMemo(() => (
    selectedFeatureIds.length === 1 ? selectedFeatureIds[0] : null
  ), [selectedFeatureIds]);

  useEffect(() => {
    if (!selectedSingleLevel4Id) {
      setSelectedLevel4Detail(null);
      setEditingCode("");
      setEditingName("");
      setEditingType("RODAL");
      setEditingFscStatus("NO");
      setEditingCurrentLandUseName("");
      setEditingPreviousLandUseName("");
      setEditingRotationPhase("");
      setEditingPreviousUse("");
      setApplyDrawnGeometryToUpdate(false);
      return;
    }

    void (async () => {
      setIsLoadingSelectedDetail(true);
      try {
        const response = await fetch(`/api/forest/geo/level4?id=${selectedSingleLevel4Id}`, { cache: "no-store" });
        const payload = await readJsonSafe<{
          success: boolean;
          data?: SelectedLevel4Detail;
          error?: string;
        }>(response);

        if (!response.ok || !payload?.success || !payload.data) {
          const message = payload?.error ?? "No se pudo cargar el detalle del Nivel 4 seleccionado.";
          sileo.error({ title: "Error de lectura", description: message });
          setSelectedLevel4Detail(null);
          return;
        }

        setSelectedLevel4Detail(payload.data);
        setEditingCode(payload.data.code ?? "");
        setEditingName(payload.data.name ?? "");
        setEditingType(payload.data.type ?? "RODAL");
        setEditingFscStatus(payload.data.fscCertificateStatus ?? "NO");
        setEditingCurrentLandUseName(payload.data.currentLandUseName ?? "");
        setEditingPreviousLandUseName(payload.data.previousLandUseName ?? "");
        setEditingRotationPhase(payload.data.rotationPhase ?? "");
        setEditingPreviousUse(payload.data.previousUse ?? "");
      } catch {
        sileo.error({ title: "Error de lectura", description: "No se pudo cargar el detalle del Nivel 4 seleccionado." });
        setSelectedLevel4Detail(null);
      } finally {
        setIsLoadingSelectedDetail(false);
      }
    })();
  }, [selectedSingleLevel4Id]);

  const drawDistanceMeters = useMemo(() => {
    if (drawPoints.length < 2) return 0;
    let total = 0;
    for (let index = 1; index < drawPoints.length; index += 1) {
      total += haversineDistanceMeters(drawPoints[index - 1], drawPoints[index]);
    }
    return total;
  }, [drawPoints]);

  const drawAreaM2 = useMemo(() => {
    if (drawPoints.length < 3) return 0;

    const ring = drawPoints.map((point) => [point.lng, point.lat]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
      ring.push([first[0], first[1]]);
    }

    try {
      return turfArea(turfPolygon([ring]));
    } catch {
      return 0;
    }
  }, [drawPoints]);

  const drawPathPositions = useMemo(
    () => drawPoints.map((point) => [point.lat, point.lng]),
    [drawPoints],
  );

  const handlePointerMove = useCallback((coords: PointerCoords) => {
    setPointerCoords(coords);

    const draggingIndex = draggingVertexIndexRef.current;
    if (draggingIndex !== null) {
      setDrawPoints((current) => {
        if (draggingIndex < 0 || draggingIndex >= current.length) {
          return current;
        }

        const next = [...current];
        next[draggingIndex] = coords;
        return next;
      });
      return;
    }

    const isPolygonMode = editModeRef.current === "area" || editModeRef.current === "split" || editModeRef.current === "createLevel4";
    if (!isPolygonMode || drawPoints.length < 3) {
      if (isNearFirstVertex) {
        setIsNearFirstVertex(false);
      }
      return;
    }

    const firstPoint = drawPoints[0];
    if (!firstPoint) {
      if (isNearFirstVertex) {
        setIsNearFirstVertex(false);
      }
      return;
    }

    const near = haversineDistanceMeters(coords, firstPoint) <= SNAP_CLOSE_DISTANCE_METERS;
    if (near !== isNearFirstVertex) {
      setIsNearFirstVertex(near);
    }
  }, [drawPoints, isNearFirstVertex]);

  const handleMapPoint = useCallback((coords: PointerCoords) => {
    if (suppressNextMapClickRef.current) {
      suppressNextMapClickRef.current = false;
      return;
    }

    if (draggingVertexIndexRef.current !== null) {
      return;
    }

    const isPolygonMode = editModeRef.current === "area" || editModeRef.current === "split" || editModeRef.current === "createLevel4";
    const firstPoint = drawPoints[0];
    if (isPolygonMode && drawPoints.length >= 3 && firstPoint) {
      const near = haversineDistanceMeters(coords, firstPoint) <= SNAP_CLOSE_DISTANCE_METERS;
      if (near) {
        suppressNextMapClickRef.current = true;
        void finalizeDrawingRef.current?.();
        return;
      }
    }

    setDrawPoints((current) => [...current, coords]);
    if (isNearFirstVertex) {
      setIsNearFirstVertex(false);
    }
  }, [drawPoints, isNearFirstVertex]);

  const handleMapMouseUp = useCallback(() => {
    if (draggingVertexIndexRef.current !== null) {
      draggingVertexIndexRef.current = null;
      suppressNextMapClickRef.current = true;
    }
  }, []);

  const startVertexDrag = useCallback((index: number) => {
    if (editModeRef.current === "none") return;
    draggingVertexIndexRef.current = index;
    suppressNextMapClickRef.current = true;
  }, []);

  const removeVertex = useCallback((index: number) => {
    if (editModeRef.current === "none") return;

    setDrawPoints((current) => {
      if (index < 0 || index >= current.length) return current;
      if (current.length <= 1) return [];
      return current.filter((_, vertexIndex) => vertexIndex !== index);
    });

    suppressNextMapClickRef.current = true;
  }, []);

  const startMode = useCallback((mode: EditMode) => {
    setEditMode(mode);
    setDrawPoints([]);
    setIsNearFirstVertex(false);
    setMeasurementLabel(null);
    setOperationMessage(null);
    if (mode !== "split") {
      setSplitCodeA("");
      setSplitCodeB("");
    }
    if (mode !== "createLevel4") {
      setCreateCode("");
      setCreateName("");
      setCreateType("RODAL");
      setCreateFscStatus("NO");
      setCreateCurrentLandUseName("");
      setCreatePreviousLandUseName("");
      setCreateRotationPhase("");
      setCreatePreviousUse("");
    }
  }, []);

  const cancelDrawing = useCallback(() => {
    setEditMode("none");
    setDrawPoints([]);
    setIsNearFirstVertex(false);
    draggingVertexIndexRef.current = null;
    suppressNextMapClickRef.current = false;
  }, []);

  const deleteCurrentPolygon = useCallback(() => {
    if (drawPoints.length === 0) {
      sileo.warning({ title: "Sin polígono", description: "No hay vértices para eliminar." });
      return;
    }

    const confirmed = window.confirm("Se eliminará el polígono dibujado actual. ¿Deseas continuar?");
    if (!confirmed) {
      sileo.warning({ title: "Eliminación cancelada", description: "Se mantuvo el polígono actual." });
      return;
    }

    setDrawPoints([]);
    setIsNearFirstVertex(false);
    draggingVertexIndexRef.current = null;
    suppressNextMapClickRef.current = false;
    sileo.success({ title: "Polígono eliminado", description: "La geometría dibujada fue eliminada." });
  }, [drawPoints.length]);

  const executeSplit = useCallback(async () => {
    if (selectedFeatureIds.length !== 1) {
      const message = "Selecciona exactamente 1 rodal para partir.";
      setOperationMessage(message);
      sileo.warning({ title: "Selección inválida", description: message });
      return;
    }

    if (drawPoints.length < 3) {
      const message = "Dibuja una geometría de corte con al menos 3 puntos.";
      setOperationMessage(message);
      sileo.warning({ title: "Corte incompleto", description: message });
      return;
    }

    const codeA = splitCodeA.trim();
    const codeB = splitCodeB.trim();
    if (!codeA || !codeB) {
      const message = "Debes indicar los códigos nuevos para ambos rodales resultantes.";
      setOperationMessage(message);
      sileo.warning({ title: "Códigos requeridos", description: message });
      return;
    }

    const cutRing = drawPoints.map((point) => [point.lng, point.lat]);
    const first = cutRing[0];
    const last = cutRing[cutRing.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
      cutRing.push([first[0], first[1]]);
    }

    setIsApplyingOperation(true);
    try {
      const response = await fetch("/api/forest/geo/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "split",
          sourceLevel4Id: selectedFeatureIds[0],
          newCodes: [codeA, codeB],
          cutGeometry: {
            type: "Polygon",
            coordinates: [cutRing],
          },
        }),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        const message = payload.error ?? "No fue posible partir el rodal.";
        setOperationMessage(message);
        sileo.error({ title: "Error al partir", description: message });
        return;
      }

      const message = "Rodal partido correctamente. Se crearon dos rodales nuevos y se desactivó el original.";
      setOperationMessage(message);
      sileo.success({ title: "Partición completada", description: message });
      setSelectedFeatureIds([]);
      setDrawPoints([]);
      setIsNearFirstVertex(false);
      setSplitCodeA("");
      setSplitCodeB("");
      setEditMode("none");
      await loadLayer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible partir el rodal.";
      setOperationMessage(message);
      sileo.error({ title: "Error al partir", description: message });
    } finally {
      setIsApplyingOperation(false);
    }
  }, [drawPoints, loadLayer, selectedFeatureIds, splitCodeA, splitCodeB]);

  const executeMerge = useCallback(async () => {
    if (selectedFeatureIds.length !== 2) {
      const message = "Selecciona exactamente 2 rodales para consolidar.";
      setOperationMessage(message);
      sileo.warning({ title: "Selección inválida", description: message });
      return;
    }

    const newCode = mergeCode.trim();
    if (!newCode) {
      const message = "Debes indicar el código nuevo del rodal consolidado.";
      setOperationMessage(message);
      sileo.warning({ title: "Código requerido", description: message });
      return;
    }

    setIsApplyingOperation(true);
    try {
      const response = await fetch("/api/forest/geo/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "merge",
          sourceLevel4Ids: [selectedFeatureIds[0], selectedFeatureIds[1]],
          newCode,
        }),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        const message = payload.error ?? "No fue posible consolidar los rodales.";
        setOperationMessage(message);
        sileo.error({ title: "Error al consolidar", description: message });
        return;
      }

      const message = "Rodales consolidados correctamente. Se desactivaron los anteriores y se creó un nuevo rodal.";
      setOperationMessage(message);
      sileo.success({ title: "Consolidación completada", description: message });
      setSelectedFeatureIds([]);
      setDrawPoints([]);
      setIsNearFirstVertex(false);
      setMergeCode("");
      setEditMode("none");
      await loadLayer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible consolidar los rodales.";
      setOperationMessage(message);
      sileo.error({ title: "Error al consolidar", description: message });
    } finally {
      setIsApplyingOperation(false);
    }
  }, [loadLayer, mergeCode, selectedFeatureIds]);

  const executeCreateLevel4 = useCallback(async () => {
    if (!createLevel2Id || !createLevel3Id) {
      const message = "Selecciona Nivel 2 y Nivel 3 para crear el rodal.";
      setOperationMessage(message);
      sileo.warning({ title: "Datos incompletos", description: message });
      return;
    }

    if (!createCode.trim() || !createName.trim()) {
      const message = "Debes indicar código y nombre del rodal.";
      setOperationMessage(message);
      sileo.warning({ title: "Datos incompletos", description: message });
      return;
    }

    if (!createCurrentLandUseName.trim()) {
      const message = "Debes seleccionar el uso actual.";
      setOperationMessage(message);
      sileo.warning({ title: "Datos incompletos", description: message });
      return;
    }

    if (drawPoints.length < 3) {
      const message = "Dibuja el polígono del rodal con al menos 3 vértices.";
      setOperationMessage(message);
      sileo.warning({ title: "Polígono incompleto", description: message });
      return;
    }

    const ring = drawPoints.map((point) => [point.lng, point.lat]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
      ring.push([first[0], first[1]]);
    }

    setIsApplyingOperation(true);
    try {
      const response = await fetch("/api/forest/geo/level4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level2Id: createLevel2Id,
          level3Id: createLevel3Id,
          code: createCode.trim(),
          name: createName.trim(),
          type: createType,
          fscCertificateStatus: createFscStatus,
          currentLandUseName: createCurrentLandUseName.trim(),
          previousLandUseName: createPreviousLandUseName.trim() || null,
          rotationPhase: createRotationPhase.trim() || null,
          previousUse: createPreviousUse.trim() || null,
          polygon: {
            type: "Polygon",
            coordinates: [ring],
          },
        }),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        const message = payload.error ?? "No fue posible crear el rodal desde el mapa.";
        setOperationMessage(message);
        sileo.error({ title: "Error al crear rodal", description: message });
        return;
      }

      const message = "Rodal creado correctamente con geometría dibujada.";
      setOperationMessage(message);
      sileo.success({ title: "Rodal creado", description: message });
      setDrawPoints([]);
      setIsNearFirstVertex(false);
      setEditMode("none");
      setCreateCode("");
      setCreateName("");
      setCreateCurrentLandUseName("");
      setCreatePreviousLandUseName("");
      setCreateRotationPhase("");
      setCreatePreviousUse("");
      setSelectedFeatureIds([]);
      await loadLayer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible crear el rodal desde el mapa.";
      setOperationMessage(message);
      sileo.error({ title: "Error al crear rodal", description: message });
    } finally {
      setIsApplyingOperation(false);
    }
  }, [createCode, createCurrentLandUseName, createFscStatus, createLevel2Id, createLevel3Id, createName, createPreviousLandUseName, createPreviousUse, createRotationPhase, createType, drawPoints, loadLayer]);

  const executeUpdateSelectedLevel4 = useCallback(async () => {
    if (!selectedSingleLevel4Id || !selectedLevel4Detail) {
      const message = "Selecciona un polígono Nivel 4 para actualizar.";
      setOperationMessage(message);
      sileo.warning({ title: "Selección requerida", description: message });
      return;
    }

    if (!editingCode.trim() || !editingName.trim()) {
      const message = "Código y nombre son obligatorios para actualizar.";
      setOperationMessage(message);
      sileo.warning({ title: "Datos incompletos", description: message });
      return;
    }

    if (!editingCurrentLandUseName.trim()) {
      const message = "Debes seleccionar el uso actual para actualizar.";
      setOperationMessage(message);
      sileo.warning({ title: "Datos incompletos", description: message });
      return;
    }

    let polygonPayload: { type: "Polygon"; coordinates: number[][][] } | null = null;
    if (applyDrawnGeometryToUpdate) {
      if (drawPoints.length < 3) {
        const message = "Para reemplazar geometría dibuja un polígono con al menos 3 vértices.";
        setOperationMessage(message);
        sileo.warning({ title: "Geometría incompleta", description: message });
        return;
      }

      const ring = drawPoints.map((point) => [point.lng, point.lat]);
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
        ring.push([first[0], first[1]]);
      }

      polygonPayload = {
        type: "Polygon",
        coordinates: [ring],
      };
    }

    setIsApplyingOperation(true);
    try {
      const response = await fetch("/api/forest/geo/level4", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level4Id: selectedSingleLevel4Id,
          code: editingCode.trim(),
          name: editingName.trim(),
          type: editingType,
          fscCertificateStatus: editingFscStatus,
          currentLandUseName: editingCurrentLandUseName.trim(),
          previousLandUseName: editingPreviousLandUseName.trim() || null,
          rotationPhase: editingRotationPhase.trim() || null,
          previousUse: editingPreviousUse.trim() || null,
          ...(polygonPayload ? { polygon: polygonPayload } : {}),
        }),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        const message = payload.error ?? "No fue posible actualizar el Nivel 4 seleccionado.";
        setOperationMessage(message);
        sileo.error({ title: "Error al actualizar", description: message });
        return;
      }

      const message = polygonPayload
        ? "Nivel 4 actualizado con atributos y nueva geometría."
        : "Nivel 4 actualizado correctamente.";
      setOperationMessage(message);
      sileo.success({ title: "Actualización completada", description: message });
      setApplyDrawnGeometryToUpdate(false);
      setDrawPoints([]);
      await loadLayer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible actualizar el Nivel 4 seleccionado.";
      setOperationMessage(message);
      sileo.error({ title: "Error al actualizar", description: message });
    } finally {
      setIsApplyingOperation(false);
    }
  }, [applyDrawnGeometryToUpdate, drawPoints, editingCode, editingCurrentLandUseName, editingFscStatus, editingName, editingPreviousLandUseName, editingPreviousUse, editingRotationPhase, editingType, loadLayer, selectedLevel4Detail, selectedSingleLevel4Id]);

  const executeDeleteSelectedLevel4 = useCallback(async () => {
    if (!selectedSingleLevel4Id) {
      const message = "Selecciona un polígono Nivel 4 para eliminar.";
      setOperationMessage(message);
      sileo.warning({ title: "Selección requerida", description: message });
      return;
    }

    const confirmed = window.confirm("Se eliminará (desactivará) el Nivel 4 seleccionado y su geometría activa. ¿Deseas continuar?");
    if (!confirmed) {
      sileo.warning({ title: "Eliminación cancelada", description: "Se mantuvo el polígono seleccionado." });
      return;
    }

    setIsApplyingOperation(true);
    try {
      const response = await fetch("/api/forest/geo/level4", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level4Id: selectedSingleLevel4Id }),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        const message = payload.error ?? "No fue posible eliminar el Nivel 4 seleccionado.";
        setOperationMessage(message);
        sileo.error({ title: "Error al eliminar", description: message });
        return;
      }

      const message = "Nivel 4 eliminado correctamente.";
      setOperationMessage(message);
      sileo.success({ title: "Eliminación completada", description: message });
      setSelectedFeatureIds([]);
      setDrawPoints([]);
      await loadLayer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible eliminar el Nivel 4 seleccionado.";
      setOperationMessage(message);
      sileo.error({ title: "Error al eliminar", description: message });
    } finally {
      setIsApplyingOperation(false);
    }
  }, [loadLayer, selectedSingleLevel4Id]);

  const finalizeDrawing = useCallback(async () => {
    if (editMode === "distance") {
      if (drawPoints.length < 2) {
        const message = "Distancia: agrega al menos 2 puntos.";
        setMeasurementLabel(message);
        sileo.warning({ title: "Medición incompleta", description: message });
        return;
      }

      const message = `Distancia medida: ${formatDistance(drawDistanceMeters)}`;
      setMeasurementLabel(message);
      sileo.success({ title: "Medición lista", description: message });
      setEditMode("none");
      return;
    }

    if (editMode === "area") {
      if (drawPoints.length < 3) {
        const message = "Área: agrega al menos 3 puntos.";
        setMeasurementLabel(message);
        sileo.warning({ title: "Medición incompleta", description: message });
        return;
      }

      const message = `Área medida: ${formatArea(drawAreaM2)}`;
      setMeasurementLabel(message);
      sileo.success({ title: "Medición lista", description: message });
      setEditMode("none");
      return;
    }

    if (editMode === "split") {
      await executeSplit();
      return;
    }

    if (editMode === "createLevel4") {
      await executeCreateLevel4();
    }
  }, [drawAreaM2, drawDistanceMeters, drawPoints.length, editMode, executeCreateLevel4, executeSplit]);

  const closePolygonFromFirstVertex = useCallback(() => {
    if (editModeRef.current !== "area" && editModeRef.current !== "split" && editModeRef.current !== "createLevel4") {
      return;
    }

    if (drawPoints.length < 3) {
      const message = "Agrega al menos 3 vértices para cerrar el polígono.";
      setOperationMessage(message);
      sileo.warning({ title: "Polígono incompleto", description: message });
      return;
    }

    void finalizeDrawing();
  }, [drawPoints.length, finalizeDrawing]);

  const exportVisibleAsJson = useCallback(() => {
    const mergedFeatures = filteredVisibleLayers.flatMap((layer) =>
      layer.data.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          layerId: layer.id,
          layerName: layer.name,
        },
      })),
    );

    if (mergedFeatures.length === 0) {
      sileo.warning({ title: "Sin datos para exportar", description: "No hay rodales visibles para exportar en GeoJSON." });
      return;
    }

    const payload = {
      type: "FeatureCollection",
      features: mergedFeatures,
    };

    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/geo+json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mapa-rodales-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.geojson`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
      sileo.success({ title: "GeoJSON exportado", description: `${mergedFeatures.length} elementos exportados.` });
    } catch {
      sileo.error({ title: "Error al exportar GeoJSON", description: "No fue posible generar el archivo GeoJSON." });
    }
  }, [filteredVisibleLayers]);

  const exportMapAsPng = useCallback(async () => {
    const container = mapWrapperRef.current;
    if (!container) {
      sileo.error({ title: "Error al exportar PNG", description: "No se encontró el contenedor del mapa." });
      return;
    }

    const downloadCanvas = async (canvas: HTMLCanvasElement) => {
      const filename = `mapa-rodales-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
            return;
          }

          reject(new Error("No se pudo convertir el lienzo a PNG"));
        }, "image/png");
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    };

    const renderCanvas = (excludeTilePane: boolean) => html2canvas(container, {
      useCORS: true,
      allowTaint: false,
      scale: 2,
      backgroundColor: null,
      logging: false,
      imageTimeout: 15000,
      ignoreElements: (element) => {
        if (!excludeTilePane) return false;

        const htmlElement = element as HTMLElement;
        if (htmlElement.classList?.contains("leaflet-tile-pane")) {
          return true;
        }

        return false;
      },
    });

    const hexToRgba = (hex: string, alpha: number) => {
      const normalized = hex.replace("#", "").trim();
      if (normalized.length !== 6) {
        return `rgba(37,99,235,${alpha})`;
      }

      const r = Number.parseInt(normalized.slice(0, 2), 16);
      const g = Number.parseInt(normalized.slice(2, 4), 16);
      const b = Number.parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const renderVectorFallbackCanvas = () => {
      type LngLat = [number, number];
      const map = mapInstanceRef.current;
      if (!map) {
        throw new Error("No hay instancia de mapa disponible para proyectar");
      }

      const polygons: Array<{ rings: LngLat[][]; color: string; opacity: number }> = [];
      const lines: Array<{ path: LngLat[]; color: string; opacity: number }> = [];
      const points: Array<{ point: LngLat; color: string; opacity: number }> = [];

      const asLngLat = (value: unknown): LngLat | null => {
        if (!Array.isArray(value) || value.length < 2) return null;
        const lng = Number(value[0]);
        const lat = Number(value[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        return [lng, lat];
      };

      for (const layer of filteredVisibleLayers) {
        for (const feature of layer.data.features) {
          const geometry = feature.geometry as { type?: string; coordinates?: unknown } | null;
          const type = geometry?.type;
          const coordinates = geometry?.coordinates;

          if (!type || !coordinates) continue;

          if (type === "Polygon" && Array.isArray(coordinates)) {
            const rings: LngLat[][] = [];
            for (const ring of coordinates) {
              if (!Array.isArray(ring)) continue;
              const parsed = ring.map(asLngLat).filter((value): value is LngLat => value !== null);
              if (parsed.length >= 3) rings.push(parsed);
            }
            if (rings.length > 0) {
              polygons.push({ rings, color: layer.color, opacity: layer.opacity });
            }
            continue;
          }

          if (type === "MultiPolygon" && Array.isArray(coordinates)) {
            for (const polygon of coordinates) {
              if (!Array.isArray(polygon)) continue;
              const rings: LngLat[][] = [];
              for (const ring of polygon) {
                if (!Array.isArray(ring)) continue;
                const parsed = ring.map(asLngLat).filter((value): value is LngLat => value !== null);
                if (parsed.length >= 3) rings.push(parsed);
              }
              if (rings.length > 0) {
                polygons.push({ rings, color: layer.color, opacity: layer.opacity });
              }
            }
            continue;
          }

          if (type === "LineString" && Array.isArray(coordinates)) {
            const parsed = coordinates.map(asLngLat).filter((value): value is LngLat => value !== null);
            if (parsed.length >= 2) {
              lines.push({ path: parsed, color: layer.color, opacity: layer.opacity });
            }
            continue;
          }

          if (type === "MultiLineString" && Array.isArray(coordinates)) {
            for (const line of coordinates) {
              if (!Array.isArray(line)) continue;
              const parsed = line.map(asLngLat).filter((value): value is LngLat => value !== null);
              if (parsed.length >= 2) {
                lines.push({ path: parsed, color: layer.color, opacity: layer.opacity });
              }
            }
            continue;
          }

          if (type === "Point") {
            const parsed = asLngLat(coordinates);
            if (parsed) {
              points.push({ point: parsed, color: layer.color, opacity: layer.opacity });
            }
            continue;
          }

          if (type === "MultiPoint" && Array.isArray(coordinates)) {
            for (const point of coordinates) {
              const parsed = asLngLat(point);
              if (parsed) {
                points.push({ point: parsed, color: layer.color, opacity: layer.opacity });
              }
            }
          }
        }
      }

      const allCoords: LngLat[] = [];
      polygons.forEach((polygon) => polygon.rings.forEach((ring) => allCoords.push(...ring)));
      lines.forEach((line) => allCoords.push(...line.path));
      points.forEach((point) => allCoords.push(point.point));

      if (allCoords.length === 0) {
        throw new Error("Sin geometrías visibles para exportar");
      }

      const mapSize = map.getSize();
      const exportScale = 2;
      const width = Math.max(1, Math.floor(mapSize.x * exportScale));
      const height = Math.max(1, Math.floor(mapSize.y * exportScale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("No fue posible inicializar el lienzo de exportación");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);

      const project = ([lng, lat]: LngLat): [number, number] => {
        const projected = map.latLngToContainerPoint([lat, lng]);
        const x = projected.x * exportScale;
        const y = projected.y * exportScale;
        return [x, y];
      };

      for (const polygon of polygons) {
        context.beginPath();
        for (const ring of polygon.rings) {
          ring.forEach((coord, index) => {
            const [x, y] = project(coord);
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
        }
        context.fillStyle = hexToRgba(polygon.color, Math.max(0.15, Math.min(0.55, polygon.opacity / 180)));
        context.strokeStyle = hexToRgba(polygon.color, Math.max(0.6, Math.min(1, polygon.opacity / 100)));
        context.lineWidth = 2 * exportScale;
        context.fill("evenodd");
        context.stroke();
      }

      for (const line of lines) {
        context.beginPath();
        line.path.forEach((coord, index) => {
          const [x, y] = project(coord);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.strokeStyle = hexToRgba(line.color, Math.max(0.7, Math.min(1, line.opacity / 100)));
        context.lineWidth = 2 * exportScale;
        context.stroke();
      }

      for (const point of points) {
        const [x, y] = project(point.point);
        context.beginPath();
        context.arc(x, y, 4 * exportScale, 0, Math.PI * 2);
        context.fillStyle = hexToRgba(point.color, Math.max(0.7, Math.min(1, point.opacity / 100)));
        context.fill();
      }

      context.fillStyle = "#111827";
      context.font = `${600 * exportScale / 2} ${20 * exportScale / 2}px sans-serif`;
      context.fillText("Mapa de rodales (exportación vectorial)", 24 * exportScale, 34 * exportScale);
      context.font = `${400 * exportScale / 2} ${14 * exportScale / 2}px sans-serif`;
      context.fillText(`Elementos visibles: ${filteredVisibleLayers.reduce((sum, layer) => sum + layer.data.features.length, 0)}`, 24 * exportScale, 56 * exportScale);

      return canvas;
    };

    try {
      const canvas = await renderCanvas(false);
      await downloadCanvas(canvas);
      sileo.success({ title: "PNG exportado", description: "Se descargó la imagen del mapa." });
      return;
    } catch {
      const tilePane = container.querySelector(".leaflet-tile-pane") as HTMLElement | null;
      const previousVisibility = tilePane?.style.visibility;

      try {
        if (tilePane) {
          tilePane.style.visibility = "hidden";
        }

        const fallbackCanvas = await renderCanvas(true);
        await downloadCanvas(fallbackCanvas);
        sileo.warning({ title: "PNG exportado sin mapa base", description: "Se exportaron capas y gráficos sin teselas de fondo por restricciones CORS." });
      } catch {
        try {
          const vectorCanvas = renderVectorFallbackCanvas();
          await downloadCanvas(vectorCanvas);
          sileo.warning({ title: "PNG exportado en modo seguro", description: "Se generó una imagen vectorial de las geometrías visibles." });
        } catch {
          sileo.error({ title: "Error al exportar PNG", description: "No fue posible generar la imagen. Verifica que haya geometrías visibles e inténtalo nuevamente." });
        }
      } finally {
        if (tilePane) {
          tilePane.style.visibility = previousVisibility ?? "";
        }
      }
    }
  }, [filteredVisibleLayers]);

  const clearHierarchyFilters = useCallback(() => {
    setSelectedLevel2("");
    setSelectedLevel3("");
    setSelectedLevel4("");
  }, []);

  const focusSearchResult = useCallback(() => {
    if (!searchTerm.trim()) {
      sileo.warning({ title: "Búsqueda vacía", description: "Escribe un código, nombre o id para enfocar." });
      return;
    }

    if (!firstSearchMatch) {
      sileo.warning({ title: "Sin resultados", description: "No se encontró ningún rodal con ese criterio." });
      return;
    }

    setSelectedLevel2("");
    setSelectedLevel3("");
    setSelectedLevel4(firstSearchMatch.level4Id);
    setSelectedFeatureIds([firstSearchMatch.level4Id]);
    setPolygonVisibilityMode("all");
    setFocusGeometry(firstSearchMatch.geometry);
    setFocusSignal((current) => current + 1);
    sileo.success({ title: "Resultado enfocado", description: firstSearchMatch.label });
  }, [firstSearchMatch, searchTerm]);

  const resetView = useCallback(() => {
    const hasUnsavedContext = Boolean(
      searchTerm
      || selectedLevel2
      || selectedLevel3
      || selectedLevel4
      || selectedFeatureIds.length
      || drawPoints.length
      || editMode !== "none",
    );

    if (hasUnsavedContext) {
      const confirmed = window.confirm("Se restablecerá la vista del mapa y se limpiarán filtros/selecciones. ¿Deseas continuar?");
      if (!confirmed) {
        sileo.warning({ title: "Restablecimiento cancelado", description: "Se mantuvo la vista actual." });
        return;
      }
    }

    setSelectedBasemap(DEFAULT_BASEMAP);
    setMapView(DEFAULT_MAP_VIEW);
    setResetSignal((current) => current + 1);
    setSearchTerm("");
    setSelectedLevel2("");
    setSelectedLevel3("");
    setSelectedLevel4("");
    setSelectedFeatureIds([]);
    setDrawPoints([]);
    setIsNearFirstVertex(false);
    setSplitCodeA("");
    setSplitCodeB("");
    setMergeCode("");
    setCreateLevel2Id("");
    setCreateLevel3Id("");
    setCreateCode("");
    setCreateName("");
    setCreateType("RODAL");
    setCreateFscStatus("NO");
    setCreateCurrentLandUseName("");
    setCreatePreviousLandUseName("");
    setCreateRotationPhase("");
    setCreatePreviousUse("");
    setEditMode("none");
    setMeasurementLabel(null);
    setOperationMessage(null);
    sileo.success({ title: "Vista restablecida", description: "Se aplicaron los valores por defecto del visualizador." });
  }, [drawPoints.length, editMode, searchTerm, selectedFeatureIds.length, selectedLevel2, selectedLevel3, selectedLevel4]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === viewerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const element = viewerRef.current;
    if (!element) return;

    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      return;
    }

    await element.requestFullscreen();
  }, []);

  const canRunSplit = selectedFeatureIds.length === 1 && splitCodeA.trim().length > 0 && splitCodeB.trim().length > 0;
  const canRunMerge = selectedFeatureIds.length === 2 && mergeCode.trim().length > 0;
  const hasCreateCatalog = patrimonyLevel2Options.length > 0;
  const canCrudSelectedLevel4 = Boolean(selectedSingleLevel4Id && selectedLevel4Detail);
  const canUpdateSelectedLevel4 = Boolean(
    canCrudSelectedLevel4
    && editingCode.trim().length > 0
    && editingName.trim().length > 0
    && (!applyDrawnGeometryToUpdate || drawPoints.length >= 3),
  );
  const canRunCreateLevel4 = Boolean(
    createLevel2Id
    && createLevel3Id
    && createCode.trim().length > 0
    && createName.trim().length > 0
    && createCurrentLandUseName.trim().length > 0,
  );
  const canFinalizeDrawing = (() => {
    if (isApplyingOperation) return false;
    if (editMode === "distance") return drawPoints.length >= 2;
    if (editMode === "area") return drawPoints.length >= 3;
    if (editMode === "split") return drawPoints.length >= 3 && canRunSplit;
    if (editMode === "createLevel4") return drawPoints.length >= 3 && canRunCreateLevel4;
    return false;
  })();

  const isDrawingMode = editMode === "distance" || editMode === "area" || editMode === "split" || editMode === "createLevel4";

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    finalizeDrawingRef.current = finalizeDrawing;
  }, [finalizeDrawing]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isDrawingMode) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase() ?? "";
      const isEditableTarget = tagName === "input"
        || tagName === "textarea"
        || tagName === "select"
        || Boolean(target?.isContentEditable);

      if (isEditableTarget) {
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") {
        if (event.key === "Escape") {
          event.preventDefault();
          setEditMode("none");
          setDrawPoints([]);
          setIsNearFirstVertex(false);
          draggingVertexIndexRef.current = null;
          suppressNextMapClickRef.current = false;
        }
        return;
      }

      event.preventDefault();
      setDrawPoints((current) => current.slice(0, -1));
      suppressNextMapClickRef.current = true;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawingMode]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Mapa de rodales (Nivel 4)</h2>
          <p className="text-sm text-muted-foreground">Visualización geoespacial con gestor de capas, simbología y superficies oficiales derivadas de PostGIS.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void exportMapAsPng();
            }}
          >
            <Download className="mr-2 size-4" /> Exportar PNG
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={exportVisibleAsJson}
            disabled={exportableFeatureCount === 0}
          >
            <Download className="mr-2 size-4" /> Exportar GeoJSON
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={resetView}
          >
            Restablecer vista
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void toggleFullscreen();
            }}
          >
            {isFullscreen ? <Minimize2 className="mr-2 size-4" /> : <Maximize2 className="mr-2 size-4" />}
            {isFullscreen ? "Salir pantalla completa" : "Pantalla completa"}
          </Button>
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

      {measurementLabel ? <p className="text-xs text-muted-foreground">{measurementLabel}</p> : null}
      {operationMessage ? <p className="text-xs text-muted-foreground">{operationMessage}</p> : null}

      <div
        ref={viewerRef}
        className={`grid gap-3 ${isPanelCollapsed ? "lg:grid-cols-[1fr_44px]" : "lg:grid-cols-[1fr_320px]"} ${isFullscreen ? "bg-background p-3" : ""}`}
      >
        <div ref={mapWrapperRef} className={`relative overflow-hidden rounded-lg border ${isFullscreen ? "h-[calc(100vh-140px)]" : "h-[520px]"}`}>
          <LeafletMapContainer center={[mapView.lat, mapView.lng]} zoom={mapView.zoom} className={`h-full w-full ${isDrawingMode ? "cursor-crosshair" : "cursor-default"}`} scrollWheelZoom>
            <MapInstanceController onMapReady={(map) => { mapInstanceRef.current = map; }} />
            <MapResizeController resizeToken={resizeToken} />
            <MapCursorController isDrawingMode={isDrawingMode} />
            <MapInteractionController
              editMode={editMode}
              onPointerMove={handlePointerMove}
              onMapClick={handleMapPoint}
              onMapMouseUp={handleMapMouseUp}
            />
            <MapViewPersistenceController onViewChange={persistMapView} />
            <MapViewResetController resetSignal={resetSignal} targetView={DEFAULT_MAP_VIEW} />
            <MapSearchFocusController focusSignal={focusSignal} targetGeometry={focusGeometry} />
            <LeafletScaleControl position="topright" />
            <LeafletTileLayer
              attribution={activeBasemap.attribution}
              url={activeBasemap.url}
              subdomains={activeBasemap.subdomains}
              maxZoom={activeBasemap.maxZoom}
              crossOrigin="anonymous"
            />

            {drawPathPositions.length >= 2 ? (
              <LeafletPolyline
                positions={drawPathPositions}
                pathOptions={{ color: editMode === "split" ? "#dc2626" : "#2563eb", weight: 2 }}
              />
            ) : null}

            {drawPathPositions.map((position, index) => (
              <LeafletCircleMarker
                key={`vertex-${index}-${position[0]}-${position[1]}`}
                center={position}
                radius={index === 0 && isNearFirstVertex ? 7 : 5}
                eventHandlers={{
                  mousedown: (event: { originalEvent?: { stopPropagation?: () => void; preventDefault?: () => void } }) => {
                    event?.originalEvent?.stopPropagation?.();
                    event?.originalEvent?.preventDefault?.();
                    startVertexDrag(index);
                  },
                  contextmenu: (event: { originalEvent?: { stopPropagation?: () => void; preventDefault?: () => void } }) => {
                    event?.originalEvent?.stopPropagation?.();
                    event?.originalEvent?.preventDefault?.();
                    removeVertex(index);
                  },
                  dblclick: (event: { originalEvent?: { stopPropagation?: () => void; preventDefault?: () => void } }) => {
                    event?.originalEvent?.stopPropagation?.();
                    event?.originalEvent?.preventDefault?.();
                    if (index === 0) {
                      closePolygonFromFirstVertex();
                    }
                  },
                }}
                pathOptions={{
                  color: index === 0 && isNearFirstVertex ? "#22c55e" : "#ffffff",
                  weight: index === 0 && isNearFirstVertex ? 2 : 1,
                  fillColor: editMode === "split" ? "#dc2626" : "#2563eb",
                  fillOpacity: 1,
                }}
              />
            ))}

            {(editMode === "area" || editMode === "split" || editMode === "createLevel4") && drawPathPositions.length >= 3 ? (
              <LeafletPolygon
                positions={drawPathPositions}
                pathOptions={{ color: editMode === "split" ? "#dc2626" : "#2563eb", weight: 2, fillOpacity: 0.15 }}
              />
            ) : null}

            {filteredVisibleLayers.map((layer) => (
              <LeafletGeoJSON
                key={layer.id}
                data={layer.data}
                style={(feature: { properties?: Record<string, unknown> }) => {
                  const level4Id = String(feature?.properties?.level4Id ?? "");
                  const isSelected = selectedFeatureIds.includes(level4Id);
                  const surface = parseNumber(feature?.properties?.surfaceHa) ?? 0;
                  const fillColor = layer.styleMode === "single" ? layer.color : colorForSurface(surface);
                  return {
                    color: isSelected ? "#1d4ed8" : "#111827",
                    weight: isSelected ? 2.5 : 1,
                    fillColor,
                    fillOpacity: isSelected ? Math.min(0.85, layer.opacity / 100 + 0.1) : layer.opacity / 100,
                  };
                }}
                onEachFeature={(feature: { properties?: Record<string, unknown> }, leafletLayer: {
                  bindTooltip: (content: string) => void;
                  on: (eventName: string, callback: (event?: { originalEvent?: { stopPropagation?: () => void } }) => void) => void;
                }) => {
                  const level4Id = String(feature?.properties?.level4Id ?? "-");
                  const level4Code = String(feature?.properties?.level4Code ?? level4Id);
                  const level4Name = String(feature?.properties?.level4Name ?? "");
                  const surface = parseNumber(feature?.properties?.surfaceHa) ?? 0;
                  leafletLayer.bindTooltip(`Nivel 4: ${level4Code}${level4Name ? ` · ${level4Name}` : ""}<br/>ID: ${level4Id}<br/>Superficie: ${surface.toFixed(2)} ha`);

                  leafletLayer.on("click", (event) => {
                    if (editModeRef.current !== "none") {
                      return;
                    }

                    event?.originalEvent?.stopPropagation?.();
                    setSelectedFeatureIds((current) => {
                      if (current.includes(level4Id)) {
                        return current.filter((item) => item !== level4Id);
                      }
                      return [...current, level4Id];
                    });
                  });
                }}
              />
            ))}
          </LeafletMapContainer>

          <div className="pointer-events-none absolute right-3 bottom-3 z-[520] rounded-md border bg-background/95 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
            {pointerCoords
              ? `Lon: ${pointerCoords.lng.toFixed(6)} · Lat: ${pointerCoords.lat.toFixed(6)}`
              : "Mueve el puntero para ver coordenadas"}
          </div>

          <div className="absolute left-3 bottom-14 z-[520] w-56 rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur-sm">
            <label className="mb-1 block text-[10px] text-muted-foreground">Mapa base</label>
            <select
              value={selectedBasemap}
              onChange={(event) => setSelectedBasemap(event.target.value as BasemapKey)}
              className="h-8 w-full rounded-md border bg-background px-2 text-xs"
            >
              {(Object.entries(BASEMAPS) as Array<[BasemapKey, BasemapOption]>).map(([key, option]) => (
                <option key={key} value={key}>{option.label}</option>
              ))}
            </select>
          </div>

          {showLegend ? (
            <div className="pointer-events-none absolute right-3 bottom-28 z-[500] w-64 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur-sm">
              <p className="mb-2 text-xs font-semibold">Leyenda de capas</p>
              {legendLayers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay capas visibles con datos.</p>
              ) : (
                <div className="space-y-3">
                  {legendLayers.map((layer) => (
                    <div key={`legend-${layer.id}`} className="space-y-1">
                      <p className="text-[11px] font-medium">{layer.name}</p>
                      {layer.styleMode === "single" ? (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: layer.color, opacity: layer.opacity / 100 }} />
                          Color único · Opacidad {layer.opacity}%
                        </div>
                      ) : (
                        <ul className="space-y-1 text-[11px] text-muted-foreground">
                          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> &lt; 10 ha</li>
                          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-yellow-400" /> 10 - 49.99 ha</li>
                          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500" /> 50 - 149.99 ha</li>
                          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> ≥ 150 ha</li>
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <aside className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers3 className="size-4" />
              {!isPanelCollapsed ? <h3 className="font-medium">Gestor de capas</h3> : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-7 px-2"
              onClick={toggleGeoPanel}
              title={isPanelCollapsed ? "Expandir panel" : "Colapsar panel"}
            >
              {isPanelCollapsed ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </Button>
          </div>

          {isPanelCollapsed ? (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 px-2"
                onClick={toggleGeoLegend}
                title={showLegend ? "Ocultar leyenda" : "Mostrar leyenda"}
              >
                {showLegend ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </Button>
            </div>
          ) : null}

          {!isPanelCollapsed ? (
            <div className="grid grid-cols-4 gap-1 rounded-md border p-1">
              <Button
                type="button"
                variant={activeRightTab === "buscar" ? "default" : "ghost"}
                className="h-7 px-1 text-[11px]"
                onClick={() => setActiveRightTab("buscar")}
              >
                Buscar
              </Button>
              <Button
                type="button"
                variant={activeRightTab === "filtros" ? "default" : "ghost"}
                className="h-7 px-1 text-[11px]"
                onClick={() => setActiveRightTab("filtros")}
              >
                Filtros
              </Button>
              <Button
                type="button"
                variant={activeRightTab === "gis" ? "default" : "ghost"}
                className="h-7 px-1 text-[11px]"
                onClick={() => setActiveRightTab("gis")}
              >
                GIS
              </Button>
              <Button
                type="button"
                variant={activeRightTab === "capas" ? "default" : "ghost"}
                className="h-7 px-1 text-[11px]"
                onClick={() => setActiveRightTab("capas")}
              >
                Capas
              </Button>
            </div>
          ) : null}

          {!isPanelCollapsed && activeRightTab === "buscar" ? (
            <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              <p>Rodales visibles: {currentSurfaceSummary.count}</p>
              <p>Superficie visible: {currentSurfaceSummary.total.toFixed(2)} ha</p>
            </div>
          ) : null}

          {!isPanelCollapsed && activeRightTab === "buscar" ? (
            <div className="space-y-1 rounded-md border p-2">
              <label className="text-xs text-muted-foreground">Buscar capa o Nivel 4</label>
              <div className="flex items-center gap-2 rounded-md border px-2">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Ej: RODAL-001"
                  className="h-8 w-full bg-transparent text-xs outline-none"
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground">Coincidencias: {searchMatches.length}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={focusSearchResult}
                  disabled={!normalizedSearch || !firstSearchMatch}
                >
                  Enfocar resultado
                </Button>
              </div>
            </div>
          ) : null}

          {!isPanelCollapsed && activeRightTab === "filtros" ? (
            <div className="space-y-2 rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Filtrar por nivel</p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={clearHierarchyFilters}
                  disabled={!selectedLevel2 && !selectedLevel3 && !selectedLevel4}
                >
                  Limpiar
                </Button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Nivel 2</label>
                <input
                  value={level2FilterTerm}
                  onChange={(event) => setLevel2FilterTerm(event.target.value)}
                  placeholder="Buscar Nivel 2..."
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                />
                <select
                  value={selectedLevel2}
                  onChange={(event) => setSelectedLevel2(event.target.value)}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                >
                  <option value="">Todos</option>
                  {filteredLevel2Options.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Nivel 3</label>
                <input
                  value={level3FilterTerm}
                  onChange={(event) => setLevel3FilterTerm(event.target.value)}
                  placeholder="Buscar Nivel 3..."
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                  disabled={level3Options.length === 0}
                />
                <select
                  value={selectedLevel3}
                  onChange={(event) => setSelectedLevel3(event.target.value)}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                  disabled={level3Options.length === 0}
                >
                  <option value="">Todos</option>
                  {filteredLevel3Options.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Nivel 4</label>
                <input
                  value={level4FilterTerm}
                  onChange={(event) => setLevel4FilterTerm(event.target.value)}
                  placeholder="Buscar Nivel 4..."
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                  disabled={level4Options.length === 0}
                />
                <select
                  value={selectedLevel4}
                  onChange={(event) => setSelectedLevel4(event.target.value)}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                  disabled={level4Options.length === 0}
                >
                  <option value="">Todos</option>
                  {filteredLevel4Options.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Polígonos visibles</label>
                <select
                  value={polygonVisibilityMode}
                  onChange={(event) => setPolygonVisibilityMode(event.target.value as PolygonVisibilityMode)}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                >
                  <option value="all">Todos</option>
                  <option value="selected">Solo seleccionados</option>
                  <option value="none">Ninguno</option>
                </select>
              </div>
            </div>
          ) : null}

          {!isPanelCollapsed && activeRightTab === "gis" ? (
            <div className="space-y-2 rounded-md border p-2">
              <p className="text-xs text-muted-foreground">Herramientas GIS</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={editMode === "distance" ? "default" : "outline"}
                  className="h-8 px-2 text-[11px]"
                  onClick={() => startMode("distance")}
                >
                  Medir distancia
                </Button>
                <Button
                  type="button"
                  variant={editMode === "area" ? "default" : "outline"}
                  className="h-8 px-2 text-[11px]"
                  onClick={() => startMode("area")}
                >
                  Medir área
                </Button>
                <Button
                  type="button"
                  variant={editMode === "split" ? "default" : "outline"}
                  className="h-8 px-2 text-[11px]"
                  onClick={() => startMode("split")}
                >
                  Partir forma
                </Button>
                <Button
                  type="button"
                  variant={editMode === "createLevel4" ? "default" : "outline"}
                  className="h-8 px-2 text-[11px]"
                  onClick={() => startMode("createLevel4")}
                  disabled={!hasCreateCatalog || loadingCreateOptions}
                >
                  Crear Nivel 4
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-2 text-[11px]"
                  onClick={() => {
                    void executeMerge();
                  }}
                  disabled={isApplyingOperation || !canRunMerge}
                >
                  Consolidar 2
                </Button>
              </div>

              {editMode === "createLevel4" ? (
                <div className="space-y-2 rounded-md border p-2">
                  <p className="text-[11px] text-muted-foreground">Selecciona Nivel 2 / Nivel 3 y completa datos del rodal.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={createLevel2Id}
                      onChange={(event) => setCreateLevel2Id(event.target.value)}
                      className="h-8 rounded-md border bg-background px-2 text-[11px]"
                      disabled={loadingCreateOptions}
                    >
                      <option value="">Nivel 2</option>
                      {patrimonyLevel2Options.map((item) => (
                        <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
                      ))}
                    </select>
                    <select
                      value={createLevel3Id}
                      onChange={(event) => setCreateLevel3Id(event.target.value)}
                      className="h-8 rounded-md border bg-background px-2 text-[11px]"
                      disabled={!createLevel2Id || loadingCreateOptions}
                    >
                      <option value="">Nivel 3</option>
                      {patrimonyLevel3Options.map((item) => (
                        <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={createCode}
                      onChange={(event) => setCreateCode(event.target.value)}
                      placeholder="Código rodal"
                      className="h-8 rounded-md border bg-background px-2 text-[11px]"
                    />
                    <input
                      value={createName}
                      onChange={(event) => setCreateName(event.target.value)}
                      placeholder="Nombre rodal"
                      className="h-8 rounded-md border bg-background px-2 text-[11px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={createType}
                      onChange={(event) => setCreateType(event.target.value)}
                      className="h-8 rounded-md border bg-background px-2 text-[11px]"
                    >
                      <option value="RODAL">RODAL</option>
                      <option value="PARCELA">PARCELA</option>
                      <option value="ENUMERATION">ENUMERATION</option>
                      <option value="UNIDAD_DE_MANEJO">UNIDAD_DE_MANEJO</option>
                      <option value="CONUCO">CONUCO</option>
                      <option value="OTRO_USO">OTRO USO</option>
                    </select>
                    <select
                      value={createFscStatus}
                      onChange={(event) => setCreateFscStatus(event.target.value)}
                      className="h-8 rounded-md border bg-background px-2 text-[11px]"
                    >
                      <option value="NO">FSC: NO</option>
                      <option value="SI">FSC: SI</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={createRotationPhase}
                      onChange={(event) => setCreateRotationPhase(event.target.value)}
                      placeholder="Rotación/Fase"
                      className="h-8 rounded-md border bg-background px-2 text-[11px]"
                    />
                    <input
                      value={createPreviousUse}
                      onChange={(event) => setCreatePreviousUse(event.target.value)}
                      placeholder="Uso anterior"
                      className="h-8 rounded-md border bg-background px-2 text-[11px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={createCurrentLandUseName}
                      onChange={(event) => setCreateCurrentLandUseName(event.target.value)}
                      className="h-8 rounded-md border bg-background px-2 text-[11px]"
                    >
                      <option value="">Uso actual</option>
                      {landUseOptions.map((item) => (
                        <option key={`create-current-use-${item.id}`} value={item.name}>{item.name}</option>
                      ))}
                    </select>
                    <select
                      value={createPreviousLandUseName}
                      onChange={(event) => setCreatePreviousLandUseName(event.target.value)}
                      className="h-8 rounded-md border bg-background px-2 text-[11px]"
                    >
                      <option value="">Uso antiguo</option>
                      {landUseOptions.map((item) => (
                        <option key={`create-previous-use-${item.id}`} value={item.name}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {!hasCreateCatalog ? (
                <div className="rounded-md border border-amber-300/60 bg-amber-50/60 p-2 text-[11px] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                  No hay registros de Nivel 2 disponibles para tu organización. Crea o importa Patrimonio Forestal (Nivel 2/3) para habilitar “Crear Nivel 4”.
                </div>
              ) : null}

              {selectedFeatureIds.length === 1 ? (
                <div className="space-y-2 rounded-md border p-2">
                  <p className="text-[11px] text-muted-foreground">CRUD Nivel 4 seleccionado</p>
                  {isLoadingSelectedDetail ? (
                    <p className="text-[11px] text-muted-foreground">Cargando detalle del polígono seleccionado...</p>
                  ) : canCrudSelectedLevel4 ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={editingCode}
                          onChange={(event) => setEditingCode(event.target.value)}
                          placeholder="Código"
                          className="h-8 rounded-md border bg-background px-2 text-[11px]"
                        />
                        <input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          placeholder="Nombre"
                          className="h-8 rounded-md border bg-background px-2 text-[11px]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editingType}
                          onChange={(event) => setEditingType(event.target.value)}
                          className="h-8 rounded-md border bg-background px-2 text-[11px]"
                        >
                          <option value="RODAL">RODAL</option>
                          <option value="PARCELA">PARCELA</option>
                          <option value="ENUMERATION">ENUMERATION</option>
                          <option value="UNIDAD_DE_MANEJO">UNIDAD_DE_MANEJO</option>
                          <option value="CONUCO">CONUCO</option>
                          <option value="OTRO_USO">OTRO USO</option>
                        </select>
                        <select
                          value={editingFscStatus}
                          onChange={(event) => setEditingFscStatus(event.target.value)}
                          className="h-8 rounded-md border bg-background px-2 text-[11px]"
                        >
                          <option value="NO">FSC: NO</option>
                          <option value="SI">FSC: SI</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={editingRotationPhase}
                          onChange={(event) => setEditingRotationPhase(event.target.value)}
                          placeholder="Rotación/Fase"
                          className="h-8 rounded-md border bg-background px-2 text-[11px]"
                        />
                        <input
                          value={editingPreviousUse}
                          onChange={(event) => setEditingPreviousUse(event.target.value)}
                          placeholder="Uso anterior"
                          className="h-8 rounded-md border bg-background px-2 text-[11px]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editingCurrentLandUseName}
                          onChange={(event) => setEditingCurrentLandUseName(event.target.value)}
                          className="h-8 rounded-md border bg-background px-2 text-[11px]"
                        >
                          <option value="">Uso actual</option>
                          {landUseOptions.map((item) => (
                            <option key={`edit-current-use-${item.id}`} value={item.name}>{item.name}</option>
                          ))}
                        </select>
                        <select
                          value={editingPreviousLandUseName}
                          onChange={(event) => setEditingPreviousLandUseName(event.target.value)}
                          className="h-8 rounded-md border bg-background px-2 text-[11px]"
                        >
                          <option value="">Uso antiguo</option>
                          {landUseOptions.map((item) => (
                            <option key={`edit-previous-use-${item.id}`} value={item.name}>{item.name}</option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={applyDrawnGeometryToUpdate}
                          onChange={(event) => setApplyDrawnGeometryToUpdate(event.target.checked)}
                        />
                        Reemplazar geometría usando el dibujo actual
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          className="h-8 px-2 text-[11px]"
                          onClick={() => {
                            void executeUpdateSelectedLevel4();
                          }}
                          disabled={!canUpdateSelectedLevel4 || isApplyingOperation}
                        >
                          Guardar cambios
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-2 text-[11px]"
                          onClick={() => {
                            void executeDeleteSelectedLevel4();
                          }}
                          disabled={isApplyingOperation}
                        >
                          Eliminar Nivel 4
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No fue posible cargar el detalle del nivel seleccionado.</p>
                  )}
                </div>
              ) : null}

              {editMode === "split" ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={splitCodeA}
                    onChange={(event) => setSplitCodeA(event.target.value)}
                    placeholder="Código nuevo A"
                    className="h-8 rounded-md border bg-background px-2 text-[11px]"
                  />
                  <input
                    value={splitCodeB}
                    onChange={(event) => setSplitCodeB(event.target.value)}
                    placeholder="Código nuevo B"
                    className="h-8 rounded-md border bg-background px-2 text-[11px]"
                  />
                </div>
              ) : null}

              <input
                value={mergeCode}
                onChange={(event) => setMergeCode(event.target.value)}
                placeholder="Código consolidado"
                className="h-8 w-full rounded-md border bg-background px-2 text-[11px]"
              />

              <div className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
                <p>Seleccionados: {selectedFeatureIds.length}</p>
                {editMode === "distance" ? <p>Distancia actual: {formatDistance(drawDistanceMeters)}</p> : null}
                {editMode === "area" || editMode === "split" || editMode === "createLevel4" ? <p>Área actual: {formatArea(drawAreaM2)}</p> : null}
                {editMode === "split" ? <p>Dibuja polígono de corte y pulsa Finalizar.</p> : null}
                {editMode === "createLevel4" ? <p>Dibuja el polígono del nuevo rodal y pulsa Finalizar.</p> : null}
                {editMode !== "none" ? <p>Tip: arrastra vértices para mover, clic derecho en un vértice para borrarlo.</p> : null}
                {editMode !== "none" ? <p>Atajo: Supr o Backspace elimina el último vértice.</p> : null}
                {editMode !== "none" ? <p>Atajo: Esc cancela el dibujo actual.</p> : null}
                {(editMode === "area" || editMode === "split" || editMode === "createLevel4") ? <p>Snap: clic cerca del primer vértice para cerrar automáticamente.</p> : null}
                {(editMode === "area" || editMode === "split" || editMode === "createLevel4") ? <p>Doble clic sobre el primer vértice para cerrar y finalizar.</p> : null}
              </div>

              {editMode !== "none" ? (
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    className="h-8 px-2 text-[11px]"
                    onClick={() => {
                      void finalizeDrawing();
                    }}
                    disabled={!canFinalizeDrawing}
                  >
                    Finalizar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-2 text-[11px]"
                    onClick={deleteCurrentPolygon}
                    disabled={isApplyingOperation || drawPoints.length === 0}
                  >
                    Eliminar polígono
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-2 text-[11px]"
                    onClick={cancelDrawing}
                    disabled={isApplyingOperation}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isPanelCollapsed && activeRightTab === "capas" ? (
            <div className="flex items-center justify-between rounded-md border p-2 text-xs">
              <span className="text-muted-foreground">Leyenda flotante</span>
              <Button
                type="button"
                variant="outline"
                className="h-7 px-2"
                onClick={toggleGeoLegend}
              >
                {showLegend ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </Button>
            </div>
          ) : null}

          {!isPanelCollapsed && activeRightTab === "capas" ? <div className="space-y-2">
            {panelLayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay capas disponibles.</p>
            ) : (
              panelLayers.map((layer, index) => (
                <article key={layer.id} className="space-y-2 rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{layer.name}</p>
                      <p className="text-xs text-muted-foreground">{layer.data.features.length} geometrías</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" className="h-7 px-2" onClick={() => updateLayer(layer.id, (previous) => ({ ...previous, visible: !previous.visible }))}>
                        {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      </Button>
                      <Button type="button" variant="outline" className="h-7 px-2" onClick={() => moveLayer(layer.id, "up")} disabled={index === 0}>
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button type="button" variant="outline" className="h-7 px-2" onClick={() => moveLayer(layer.id, "down")} disabled={index === panelLayers.length - 1}>
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>Transparencia</span>
                      <span>{layer.opacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={layer.opacity}
                      onChange={(event) => {
                        const nextValue = clamp(Number(event.target.value), 5, 100);
                        updateLayer(layer.id, (previous) => ({ ...previous, opacity: nextValue }));
                      }}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <Palette className="size-3.5" />
                      Simbología
                    </div>
                    <select
                      value={layer.styleMode}
                      onChange={(event) => {
                        const value = event.target.value === "single" ? "single" : "surfaceRange";
                        updateLayer(layer.id, (previous) => ({ ...previous, styleMode: value }));
                      }}
                      className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="surfaceRange">Rangos por superficie (ha)</option>
                      <option value="single">Color único</option>
                    </select>

                    {layer.styleMode === "single" ? (
                      <input
                        type="color"
                        value={layer.color}
                        onChange={(event) => updateLayer(layer.id, (previous) => ({ ...previous, color: event.target.value }))}
                        className="h-8 w-full rounded border bg-background"
                      />
                    ) : (
                      <ul className="space-y-1 text-[11px] text-muted-foreground">
                        <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> &lt; 10 ha</li>
                        <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-yellow-400" /> 10 - 49.99 ha</li>
                        <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500" /> 50 - 149.99 ha</li>
                        <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> ≥ 150 ha</li>
                      </ul>
                    )}
                  </div>
                </article>
              ))
            )}
          </div> : null}
        </aside>

      </div>

      {loadingLayer ? <p className="text-xs text-muted-foreground">Actualizando capa geoespacial...</p> : null}
    </section>
  );
}
