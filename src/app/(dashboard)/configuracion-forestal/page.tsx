/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable */
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { ApiResponse, PaginatedResponse } from "@/types/api.types";
import { TablePagination } from "@/components/tables/TablePagination";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { sileo } from "sileo";

type PaginationState = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
};

type SimpleItem = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

type SchemeSortKey = "code" | "name" | "isActive" | "createdAt";

function isSchemeSortKey(value: string): value is SchemeSortKey {
  return ["code", "name", "isActive", "createdAt"].includes(value);
}

type InventorySortKey = "code" | "name" | "isActive" | "createdAt";

function isInventorySortKey(value: string): value is InventorySortKey {
  return ["code", "name", "isActive", "createdAt"].includes(value);
}

type ImaSortKey = "code" | "classification" | "name" | "isActive" | "createdAt";

function isImaSortKey(value: string): value is ImaSortKey {
  return ["code", "classification", "name", "isActive", "createdAt"].includes(value);
}

type SpeciesSortKey = "code" | "scientificName" | "commonName" | "isActive" | "createdAt";

function isSpeciesSortKey(value: string): value is SpeciesSortKey {
  return ["code", "scientificName", "commonName", "isActive", "createdAt"].includes(value);
}

type ProvenanceSortKey = "countryName" | "code" | "name" | "isActive" | "createdAt";

function isProvenanceSortKey(value: string): value is ProvenanceSortKey {
  return ["countryName", "code", "name", "isActive", "createdAt"].includes(value);
}

type MaterialSortKey = "code" | "name" | "speciesName" | "provenanceName" | "materialType" | "isActive" | "createdAt";

function isMaterialSortKey(value: string): value is MaterialSortKey {
  return ["code", "name", "speciesName", "provenanceName", "materialType", "isActive", "createdAt"].includes(value);
}

type SpacingSortKey = "code" | "name" | "isActive" | "createdAt";

function isSpacingSortKey(value: string): value is SpacingSortKey {
  return ["code", "name", "isActive", "createdAt"].includes(value);
}

type Level4CostSortKey = "code" | "plantationAreaHa" | "rotationPhase" | "isActive" | "createdAt";

function isLevel4CostSortKey(value: string): value is Level4CostSortKey {
  return ["code", "plantationAreaHa", "rotationPhase", "isActive", "createdAt"].includes(value);
}

type ProductTypeSortKey = "code" | "name" | "recommendedHarvestType" | "isActive" | "createdAt";

function isProductTypeSortKey(value: string): value is ProductTypeSortKey {
  return ["code", "name", "recommendedHarvestType", "isActive", "createdAt"].includes(value);
}

const LAND_USE_CATEGORIES = [
  "BOSQUE",
  "NO BOSQUE",
  "BOSQUE DEFORESTADO",
  "BOSQUE DEGRADADO",
  "CUERPOS DE AGUA",
  "SUELO DESNUDO",
  "INFRAESTRUCTURA",
] as const;

type LandUseCategory = (typeof LAND_USE_CATEGORIES)[number];
type LandUseSortKey = "code" | "name" | "category" | "isProductive" | "isActive" | "createdAt";

function isLandUseSortKey(value: string): value is LandUseSortKey {
  return ["code", "name", "category", "isProductive", "isActive", "createdAt"].includes(value);
}

type ImaClassification = "I" | "II" | "III" | "IV" | "V";

type ImaItem = {
  id: string;
  code: string;
  classification: ImaClassification;
  name: string;
  description: string | null;
  rangeMin: string | number | null;
  rangeMax: string | number | null;
  isActive: boolean;
  createdAt: string;
};

type CountryItem = {
  id: string;
  continentId?: string | null;
  code: string;
  name: string;
  isActive: boolean;
  continent?: {
    id: string;
    code: string;
    name: string;
  };
};

type RegionItem = {
  id: string;
  countryId?: string | null;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  country?: {
    id: string;
    code: string;
    name: string;
  };
};

type StateDepartmentItem = {
  id: string;
  countryId?: string | null;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  country?: {
    id: string;
    code: string;
    name: string;
  };
};

type MunicipalityDistrictItem = {
  id: string;
  stateId?: string | null;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  state?: {
    id: string;
    code: string;
    name: string;
    country?: {
      id: string;
      code: string;
      name: string;
    };
  };
};

type CityItem = {
  id: string;
  municipalityId?: string | null;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  municipality?: {
    id: string;
    code: string;
    name: string;
    state?: {
      id: string;
      code: string;
      name: string;
      country?: {
        id: string;
        code: string;
        name: string;
      };
    };
  };
};

type CommunityType = "COMUNA" | "TERRITORIO_INDIGENA" | "COMUNIDAD_CRIOLLA" | "PARROQUIA";

type CommunityTerritoryItem = {
  id: string;
  cityId?: string | null;
  code: string;
  name: string;
  type: CommunityType;
  isActive: boolean;
  createdAt: string;
  city?: {
    id: string;
    code: string;
    name: string;
    municipality?: {
      id: string;
      code: string;
      name: string;
      state?: {
        id: string;
        code: string;
        name: string;
        country?: {
          id: string;
          code: string;
          name: string;
        };
      };
    };
  };
};

type SpacingItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  betweenRowsM: string | number | null;
  betweenTreesM: string | number | null;
  treeDensityPerHa: string | number | null;
  isActive: boolean;
  createdAt: string;
};

type Level4Item = {
  id: string;
  code: string;
  name: string;
};

type AccountingDocumentItem = {
  id: string;
  code: string;
  documentNumber: string;
};

type Level4AdministrativeCostItem = {
  id: string;
  level4Id?: string | null;
  code: string;
  plantationAreaHa: string | number;
  rotationPhase: string | null;
  accountingDocumentId: string | null;
  isActive: boolean;
  createdAt: string;
  level4?: Level4Item;
  accountingDocument?: AccountingDocumentItem | null;
};

type RecommendedHarvestType = "MECANIZADA" | "MANUAL";

type ProductTypeItem = {
  id: string;
  code: string;
  name: string;
  minLengthM: string | number | null;
  maxLengthM: string | number | null;
  minSmallEndDiameterCm: string | number | null;
  maxSmallEndDiameterCm: string | number | null;
  recommendedHarvestType: RecommendedHarvestType;
  isActive: boolean;
  createdAt: string;
};

type ContinentItem = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

type SpeciesItem = {
  id: string;
  code: string;
  scientificName: string;
  commonName: string | null;
  genus: string | null;
  family: string | null;
  taxonomicOrder: string | null;
  isActive: boolean;
  createdAt: string;
};

type ProvenanceItem = {
  id: string;
  countryId: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  country?: {
    id: string;
    code: string;
    name: string;
  };
};

type VegetalMaterialType = "PURA" | "HIBRIDA";
type PlantType = "PROGENIE" | "CLON" | "INJERTO" | "IN_VITRO";
type PlantOrigin = "NATIVA" | "EXOTICA" | "NATURALIZADA" | "INTRODUCIDA" | "ENDEMICA" | "CULTIVADA";

type VegetalMaterialItem = {
  id: string;
  code: string;
  name: string;
  speciesId: string;
  materialType: VegetalMaterialType;
  plantType: PlantType;
  plantOrigin: PlantOrigin;
  provenanceId: string | null;
  isActive: boolean;
  createdAt: string;
  species?: {
    id: string;
    code: string;
    scientificName: string;
  };
  provenance?: {
    id: string;
    code: string;
    name: string;
    country?: {
      id: string;
      code: string;
      name: string;
    };
  } | null;
};

type LandUseTypeItem = {
  id: string;
  code: string;
  name: string;
  category: LandUseCategory;
  isProductive: boolean;
  isActive: boolean;
  createdAt: string;
};

const INITIAL_PAGINATION: PaginationState = { page: 1, totalPages: 1, total: 0, limit: 10 };

function toNumberOrNull(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok) {
    return { success: false, error: payload?.error ?? "Error de servidor", details: payload?.details, statusCode: response.status };
  }

  return { ...payload, statusCode: response.status };
}

async function fetchAllPages<T>(endpoint: string, limit = 100): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const result = await requestJson<PaginatedResponse<T>>(`${endpoint}${separator}page=${page}&limit=${limit}`);
    if (!result.success || !result.data) return items;

    items.push(...result.data.items);
    if (page >= result.data.pagination.totalPages) return items;
    page += 1;
  }
}

function CatalogHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export default function ConfiguracionForestalPage() {
  const importSchemeInputRef = useRef<HTMLInputElement | null>(null);
  const importInventoryInputRef = useRef<HTMLInputElement | null>(null);
  const importImaInputRef = useRef<HTMLInputElement | null>(null);
  const importSpeciesInputRef = useRef<HTMLInputElement | null>(null);
  const importProvenanceInputRef = useRef<HTMLInputElement | null>(null);
  const importMaterialInputRef = useRef<HTMLInputElement | null>(null);
  const importSpacingInputRef = useRef<HTMLInputElement | null>(null);
  const importLevel4CostInputRef = useRef<HTMLInputElement | null>(null);
  const importProductTypeInputRef = useRef<HTMLInputElement | null>(null);
  const importLandUseInputRef = useRef<HTMLInputElement | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  const [schemeItems, setSchemeItems] = useState<SimpleItem[]>([]);
  const [schemeSearch, setSchemeSearch] = useState("");
  const [schemePage, setSchemePage] = useState(1);
  const [schemePagination, setSchemePagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [schemeLoading, setSchemeLoading] = useState(false);
  const [schemeError, setSchemeError] = useState<string | null>(null);
  const [schemeImporting, setSchemeImporting] = useState(false);
  const [schemeExporting, setSchemeExporting] = useState(false);
  const [schemeExportLimit, setSchemeExportLimit] = useState(100);
  const [schemeSortBy, setSchemeSortBy] = useState<SchemeSortKey>("createdAt");
  const [schemeSortOrder, setSchemeSortOrder] = useState<"asc" | "desc">("desc");
  const [schemeForm, setSchemeForm] = useState({ code: "", name: "", isActive: true });
  const [editingScheme, setEditingScheme] = useState<SimpleItem | null>(null);

  const [inventoryItems, setInventoryItems] = useState<SimpleItem[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPagination, setInventoryPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryImporting, setInventoryImporting] = useState(false);
  const [inventoryExporting, setInventoryExporting] = useState(false);
  const [inventoryExportLimit, setInventoryExportLimit] = useState(100);
  const [inventorySortBy, setInventorySortBy] = useState<InventorySortKey>("createdAt");
  const [inventorySortOrder, setInventorySortOrder] = useState<"asc" | "desc">("desc");
  const [inventoryForm, setInventoryForm] = useState({ code: "", name: "", isActive: true });
  const [editingInventory, setEditingInventory] = useState<SimpleItem | null>(null);

  const [imaItems, setImaItems] = useState<ImaItem[]>([]);
  const [imaSearch, setImaSearch] = useState("");
  const [imaPage, setImaPage] = useState(1);
  const [imaPagination, setImaPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [imaLoading, setImaLoading] = useState(false);
  const [imaError, setImaError] = useState<string | null>(null);
  const [imaImporting, setImaImporting] = useState(false);
  const [imaExporting, setImaExporting] = useState(false);
  const [imaExportLimit, setImaExportLimit] = useState(100);
  const [imaSortBy, setImaSortBy] = useState<ImaSortKey>("createdAt");
  const [imaSortOrder, setImaSortOrder] = useState<"asc" | "desc">("desc");
  const [imaForm, setImaForm] = useState({
    code: "",
    classification: "I" as ImaClassification,
    name: "",
    description: "",
    rangeMin: "",
    rangeMax: "",
    isActive: true,
  });
  const [editingIma, setEditingIma] = useState<ImaItem | null>(null);

  const [countryOptions, setCountryOptions] = useState<CountryItem[]>([]);
  const [stateOptions, setStateOptions] = useState<StateDepartmentItem[]>([]);
  const [municipalityOptions, setMunicipalityOptions] = useState<MunicipalityDistrictItem[]>([]);
  const [cityOptions, setCityOptions] = useState<CityItem[]>([]);
  const [level4Options, setLevel4Options] = useState<Level4Item[]>([]);
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesItem[]>([]);
  const [provenanceOptions, setProvenanceOptions] = useState<ProvenanceItem[]>([]);

  const [continentItems, setContinentItems] = useState<ContinentItem[]>([]);
  const [continentSearch, setContinentSearch] = useState("");
  const [continentPage, setContinentPage] = useState(1);
  const [continentPagination, setContinentPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [continentLoading, setContinentLoading] = useState(false);
  const [continentError, setContinentError] = useState<string | null>(null);
  const [continentForm, setContinentForm] = useState({ code: "", name: "", isActive: true });
  const [editingContinent, setEditingContinent] = useState<ContinentItem | null>(null);

  const [countryItems, setCountryItems] = useState<CountryItem[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryPage, setCountryPage] = useState(1);
  const [countryPagination, setCountryPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [countryForm, setCountryForm] = useState({ continentId: "", code: "", name: "", isActive: true });
  const [editingCountry, setEditingCountry] = useState<CountryItem | null>(null);

  const [regionItems, setRegionItems] = useState<RegionItem[]>([]);
  const [regionSearch, setRegionSearch] = useState("");
  const [regionPage, setRegionPage] = useState(1);
  const [regionPagination, setRegionPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [regionForm, setRegionForm] = useState({ countryId: "", code: "", name: "", isActive: true });
  const [editingRegion, setEditingRegion] = useState<RegionItem | null>(null);

  const [stateDepartmentItems, setStateDepartmentItems] = useState<StateDepartmentItem[]>([]);
  const [stateDepartmentSearch, setStateDepartmentSearch] = useState("");
  const [stateDepartmentPage, setStateDepartmentPage] = useState(1);
  const [stateDepartmentPagination, setStateDepartmentPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [stateDepartmentLoading, setStateDepartmentLoading] = useState(false);
  const [stateDepartmentError, setStateDepartmentError] = useState<string | null>(null);
  const [stateDepartmentForm, setStateDepartmentForm] = useState({ countryId: "", code: "", name: "", isActive: true });
  const [editingStateDepartment, setEditingStateDepartment] = useState<StateDepartmentItem | null>(null);

  const [municipalityItems, setMunicipalityItems] = useState<MunicipalityDistrictItem[]>([]);
  const [municipalitySearch, setMunicipalitySearch] = useState("");
  const [municipalityPage, setMunicipalityPage] = useState(1);
  const [municipalityPagination, setMunicipalityPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [municipalityLoading, setMunicipalityLoading] = useState(false);
  const [municipalityError, setMunicipalityError] = useState<string | null>(null);
  const [municipalityForm, setMunicipalityForm] = useState({ stateId: "", code: "", name: "", isActive: true });
  const [editingMunicipality, setEditingMunicipality] = useState<MunicipalityDistrictItem | null>(null);

  const [cityItems, setCityItems] = useState<CityItem[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [cityPage, setCityPage] = useState(1);
  const [cityPagination, setCityPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [cityForm, setCityForm] = useState({ municipalityId: "", code: "", name: "", isActive: true });
  const [editingCity, setEditingCity] = useState<CityItem | null>(null);

  const [communityItems, setCommunityItems] = useState<CommunityTerritoryItem[]>([]);
  const [communitySearch, setCommunitySearch] = useState("");
  const [communityPage, setCommunityPage] = useState(1);
  const [communityPagination, setCommunityPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityForm, setCommunityForm] = useState({
    cityId: "",
    code: "",
    name: "",
    type: "COMUNA" as CommunityType,
    isActive: true,
  });
  const [editingCommunity, setEditingCommunity] = useState<CommunityTerritoryItem | null>(null);

  const [spacingItems, setSpacingItems] = useState<SpacingItem[]>([]);
  const [spacingSearch, setSpacingSearch] = useState("");
  const [spacingPage, setSpacingPage] = useState(1);
  const [spacingPagination, setSpacingPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [spacingLoading, setSpacingLoading] = useState(false);
  const [spacingError, setSpacingError] = useState<string | null>(null);
  const [spacingImporting, setSpacingImporting] = useState(false);
  const [spacingExporting, setSpacingExporting] = useState(false);
  const [spacingExportLimit, setSpacingExportLimit] = useState(100);
  const [spacingSortBy, setSpacingSortBy] = useState<SpacingSortKey>("createdAt");
  const [spacingSortOrder, setSpacingSortOrder] = useState<"asc" | "desc">("desc");
  const [spacingForm, setSpacingForm] = useState({
    code: "",
    name: "",
    description: "",
    betweenRowsM: "",
    betweenTreesM: "",
    treeDensityPerHa: "",
    isActive: true,
  });
  const [editingSpacing, setEditingSpacing] = useState<SpacingItem | null>(null);

  const [level4CostItems, setLevel4CostItems] = useState<Level4AdministrativeCostItem[]>([]);
  const [level4CostSearch, setLevel4CostSearch] = useState("");
  const [level4CostPage, setLevel4CostPage] = useState(1);
  const [level4CostPagination, setLevel4CostPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [level4CostLoading, setLevel4CostLoading] = useState(false);
  const [level4CostError, setLevel4CostError] = useState<string | null>(null);
  const [level4CostImporting, setLevel4CostImporting] = useState(false);
  const [level4CostExporting, setLevel4CostExporting] = useState(false);
  const [level4CostExportLimit, setLevel4CostExportLimit] = useState(100);
  const [level4CostSortBy, setLevel4CostSortBy] = useState<Level4CostSortKey>("createdAt");
  const [level4CostSortOrder, setLevel4CostSortOrder] = useState<"asc" | "desc">("desc");
  const [level4CostForm, setLevel4CostForm] = useState({
    level4Id: "",
    code: "",
    plantationAreaHa: "",
    rotationPhase: "",
    accountingDocumentId: "",
    isActive: true,
  });
  const [editingLevel4Cost, setEditingLevel4Cost] = useState<Level4AdministrativeCostItem | null>(null);

  const [productTypeItems, setProductTypeItems] = useState<ProductTypeItem[]>([]);
  const [productTypeSearch, setProductTypeSearch] = useState("");
  const [productTypePage, setProductTypePage] = useState(1);
  const [productTypePagination, setProductTypePagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [productTypeLoading, setProductTypeLoading] = useState(false);
  const [productTypeError, setProductTypeError] = useState<string | null>(null);
  const [productTypeImporting, setProductTypeImporting] = useState(false);
  const [productTypeExporting, setProductTypeExporting] = useState(false);
  const [productTypeExportLimit, setProductTypeExportLimit] = useState(100);
  const [productTypeSortBy, setProductTypeSortBy] = useState<ProductTypeSortKey>("createdAt");
  const [productTypeSortOrder, setProductTypeSortOrder] = useState<"asc" | "desc">("desc");
  const [productTypeForm, setProductTypeForm] = useState({
    code: "",
    name: "",
    minLengthM: "",
    maxLengthM: "",
    minSmallEndDiameterCm: "",
    maxSmallEndDiameterCm: "",
    recommendedHarvestType: "MECANIZADA" as RecommendedHarvestType,
    isActive: true,
  });
  const [editingProductType, setEditingProductType] = useState<ProductTypeItem | null>(null);

  const [landUseItems, setLandUseItems] = useState<LandUseTypeItem[]>([]);
  const [landUseSearch, setLandUseSearch] = useState("");
  const [landUsePage, setLandUsePage] = useState(1);
  const [landUsePagination, setLandUsePagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [landUseLoading, setLandUseLoading] = useState(false);
  const [landUseError, setLandUseError] = useState<string | null>(null);
  const [landUseImporting, setLandUseImporting] = useState(false);
  const [landUseExporting, setLandUseExporting] = useState(false);
  const [landUseExportLimit, setLandUseExportLimit] = useState(100);
  const [landUseSortBy, setLandUseSortBy] = useState<LandUseSortKey>("createdAt");
  const [landUseSortOrder, setLandUseSortOrder] = useState<"asc" | "desc">("desc");
  const [landUseForm, setLandUseForm] = useState<{
    code: string;
    name: string;
    category: LandUseCategory;
    isProductive: boolean;
    isActive: boolean;
  }>({
    code: "",
    name: "",
    category: LAND_USE_CATEGORIES[0],
    isProductive: false,
    isActive: true,
  });
  const [editingLandUse, setEditingLandUse] = useState<LandUseTypeItem | null>(null);

  const [speciesItems, setSpeciesItems] = useState<SpeciesItem[]>([]);
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [speciesPage, setSpeciesPage] = useState(1);
  const [speciesPagination, setSpeciesPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [speciesError, setSpeciesError] = useState<string | null>(null);
  const [speciesImporting, setSpeciesImporting] = useState(false);
  const [speciesExporting, setSpeciesExporting] = useState(false);
  const [speciesExportLimit, setSpeciesExportLimit] = useState(100);
  const [speciesSortBy, setSpeciesSortBy] = useState<SpeciesSortKey>("createdAt");
  const [speciesSortOrder, setSpeciesSortOrder] = useState<"asc" | "desc">("desc");
  const [speciesForm, setSpeciesForm] = useState({
    code: "",
    scientificName: "",
    commonName: "",
    genus: "",
    family: "",
    taxonomicOrder: "",
    isActive: true,
  });
  const [editingSpecies, setEditingSpecies] = useState<SpeciesItem | null>(null);

  const [provenanceItems, setProvenanceItems] = useState<ProvenanceItem[]>([]);
  const [provenanceSearch, setProvenanceSearch] = useState("");
  const [provenancePage, setProvenancePage] = useState(1);
  const [provenancePagination, setProvenancePagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [provenanceLoading, setProvenanceLoading] = useState(false);
  const [provenanceError, setProvenanceError] = useState<string | null>(null);
  const [provenanceImporting, setProvenanceImporting] = useState(false);
  const [provenanceExporting, setProvenanceExporting] = useState(false);
  const [provenanceExportLimit, setProvenanceExportLimit] = useState(100);
  const [provenanceSortBy, setProvenanceSortBy] = useState<ProvenanceSortKey>("createdAt");
  const [provenanceSortOrder, setProvenanceSortOrder] = useState<"asc" | "desc">("desc");
  const [provenanceForm, setProvenanceForm] = useState({
    countryId: "",
    code: "",
    name: "",
    isActive: true,
  });
  const [editingProvenance, setEditingProvenance] = useState<ProvenanceItem | null>(null);

  const [materialItems, setMaterialItems] = useState<VegetalMaterialItem[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialPage, setMaterialPage] = useState(1);
  const [materialPagination, setMaterialPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [materialImporting, setMaterialImporting] = useState(false);
  const [materialExporting, setMaterialExporting] = useState(false);
  const [materialExportLimit, setMaterialExportLimit] = useState(100);
  const [materialSortBy, setMaterialSortBy] = useState<MaterialSortKey>("createdAt");
  const [materialSortOrder, setMaterialSortOrder] = useState<"asc" | "desc">("desc");
  const [materialForm, setMaterialForm] = useState({
    code: "",
    name: "",
    speciesId: "",
    materialType: "PURA" as VegetalMaterialType,
    plantType: "PROGENIE" as PlantType,
    plantOrigin: "NATIVA" as PlantOrigin,
    provenanceId: "",
    isActive: true,
  });
  const [editingMaterial, setEditingMaterial] = useState<VegetalMaterialItem | null>(null);

  const debouncedSchemeSearch = useDebounce(schemeSearch, 300);
  const debouncedInventorySearch = useDebounce(inventorySearch, 300);
  const debouncedImaSearch = useDebounce(imaSearch, 300);
  const debouncedSpeciesSearch = useDebounce(speciesSearch, 300);
  const debouncedProvenanceSearch = useDebounce(provenanceSearch, 300);
  const debouncedMaterialSearch = useDebounce(materialSearch, 300);
  const debouncedContinentSearch = useDebounce(continentSearch, 300);
  const debouncedCountrySearch = useDebounce(countrySearch, 300);
  const debouncedRegionSearch = useDebounce(regionSearch, 300);
  const debouncedStateDepartmentSearch = useDebounce(stateDepartmentSearch, 300);
  const debouncedMunicipalitySearch = useDebounce(municipalitySearch, 300);
  const debouncedCitySearch = useDebounce(citySearch, 300);
  const debouncedCommunitySearch = useDebounce(communitySearch, 300);
  const debouncedSpacingSearch = useDebounce(spacingSearch, 300);
  const debouncedLevel4CostSearch = useDebounce(level4CostSearch, 300);
  const debouncedProductTypeSearch = useDebounce(productTypeSearch, 300);
  const debouncedLandUseSearch = useDebounce(landUseSearch, 300);

  const loadCountryOptions = useCallback(async () => {
    const allItems = await fetchAllPages<CountryItem>("/api/general-config/countries");
    const options = allItems.filter((item) => item.isActive);
    setCountryOptions(options);
    if (options.length === 0) return;
    setProvenanceForm((prev) => ({ ...prev, countryId: prev.countryId || options[0]?.id || "" }));
    setRegionForm((prev) => ({ ...prev, countryId: prev.countryId || options[0]?.id || "" }));
    setStateDepartmentForm((prev) => ({ ...prev, countryId: prev.countryId || options[0]?.id || "" }));
  }, []);

  const loadStateOptions = useCallback(async () => {
    const allItems = await fetchAllPages<StateDepartmentItem>("/api/general-config/state-departments");
    const options = allItems.filter((item) => item.isActive);
    setStateOptions(options);
    if (options.length === 0) return;
    setMunicipalityForm((prev) => ({ ...prev, stateId: prev.stateId || options[0]?.id || "" }));
  }, []);

  const loadMunicipalityOptions = useCallback(async () => {
    const allItems = await fetchAllPages<MunicipalityDistrictItem>("/api/general-config/municipality-districts");
    const options = allItems.filter((item) => item.isActive);
    setMunicipalityOptions(options);
    if (options.length === 0) return;
    setCityForm((prev) => ({ ...prev, municipalityId: prev.municipalityId || options[0]?.id || "" }));
  }, []);

  const loadCityOptions = useCallback(async () => {
    const allItems = await fetchAllPages<CityItem>("/api/general-config/cities");
    const options = allItems.filter((item) => item.isActive);
    setCityOptions(options);
    if (options.length === 0) return;
    setCommunityForm((prev) => ({ ...prev, cityId: prev.cityId || options[0]?.id || "" }));
  }, []);

  const loadLevel4Options = useCallback(async () => {
    const options = await fetchAllPages<Level4Item>("/api/forest/patrimony?level=4");
    setLevel4Options(options);
    if (options.length === 0) return;
    setLevel4CostForm((prev) => ({ ...prev, level4Id: prev.level4Id || options[0]?.id || "" }));
  }, []);

  const loadSpeciesOptions = useCallback(async () => {
    const allItems = await fetchAllPages<SpeciesItem>("/api/forest/config/species");
    const options = allItems.filter((item) => item.isActive);
    setSpeciesOptions(options);
    if (options.length === 0) return;
    setMaterialForm((prev) => ({ ...prev, speciesId: prev.speciesId || options[0]?.id || "" }));
  }, []);

  const loadProvenanceOptions = useCallback(async () => {
    const allItems = await fetchAllPages<ProvenanceItem>("/api/forest/config/provenances");
    const options = allItems.filter((item) => item.isActive);
    setProvenanceOptions(options);
  }, []);

  const loadContinents = useCallback(async () => {
    setContinentLoading(true);
    setContinentError(null);

    const result = await requestJson<PaginatedResponse<ContinentItem>>(
      `/api/general-config/continents?page=${continentPage}&limit=${continentPagination.limit}${debouncedContinentSearch ? `&search=${encodeURIComponent(debouncedContinentSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setContinentError(result.error ?? "No fue posible cargar continentes");
      setContinentLoading(false);
      return;
    }
    setContinentItems(result.data.items);
    setContinentPagination(result.data.pagination);
    setContinentLoading(false);

    const active = result.data.items.filter((item) => item.isActive);
    setCountryForm((prev) => ({ ...prev, continentId: prev.continentId || active[0]?.id || "" }));
  }, [continentPage, continentPagination.limit, debouncedContinentSearch]);

  const loadCountries = useCallback(async () => {
    setCountryLoading(true);
    setCountryError(null);

    const result = await requestJson<PaginatedResponse<CountryItem>>(
      `/api/general-config/countries?page=${countryPage}&limit=${countryPagination.limit}${debouncedCountrySearch ? `&search=${encodeURIComponent(debouncedCountrySearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setCountryError(result.error ?? "No fue posible cargar países");
      setCountryLoading(false);
      return;
    }

    setCountryItems(result.data.items);
    setCountryPagination(result.data.pagination);
    setCountryLoading(false);
  }, [countryPage, countryPagination.limit, debouncedCountrySearch]);

  const loadRegions = useCallback(async () => {
    setRegionLoading(true);
    setRegionError(null);

    const result = await requestJson<PaginatedResponse<RegionItem>>(
      `/api/general-config/regions?page=${regionPage}&limit=${regionPagination.limit}${debouncedRegionSearch ? `&search=${encodeURIComponent(debouncedRegionSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setRegionError(result.error ?? "No fue posible cargar regiones");
      setRegionLoading(false);
      return;
    }

    setRegionItems(result.data.items);
    setRegionPagination(result.data.pagination);
    setRegionLoading(false);
  }, [regionPage, regionPagination.limit, debouncedRegionSearch]);

  const loadStateDepartments = useCallback(async () => {
    setStateDepartmentLoading(true);
    setStateDepartmentError(null);

    const result = await requestJson<PaginatedResponse<StateDepartmentItem>>(
      `/api/general-config/state-departments?page=${stateDepartmentPage}&limit=${stateDepartmentPagination.limit}${debouncedStateDepartmentSearch ? `&search=${encodeURIComponent(debouncedStateDepartmentSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setStateDepartmentError(result.error ?? "No fue posible cargar estados/departamentos");
      setStateDepartmentLoading(false);
      return;
    }

    setStateDepartmentItems(result.data.items);
    setStateDepartmentPagination(result.data.pagination);
    setStateDepartmentLoading(false);
  }, [debouncedStateDepartmentSearch, stateDepartmentPage, stateDepartmentPagination.limit]);

  const loadMunicipalities = useCallback(async () => {
    setMunicipalityLoading(true);
    setMunicipalityError(null);

    const result = await requestJson<PaginatedResponse<MunicipalityDistrictItem>>(
      `/api/general-config/municipality-districts?page=${municipalityPage}&limit=${municipalityPagination.limit}${debouncedMunicipalitySearch ? `&search=${encodeURIComponent(debouncedMunicipalitySearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setMunicipalityError(result.error ?? "No fue posible cargar municipios/distritos");
      setMunicipalityLoading(false);
      return;
    }

    setMunicipalityItems(result.data.items);
    setMunicipalityPagination(result.data.pagination);
    setMunicipalityLoading(false);
  }, [debouncedMunicipalitySearch, municipalityPage, municipalityPagination.limit]);

  const loadCities = useCallback(async () => {
    setCityLoading(true);
    setCityError(null);

    const result = await requestJson<PaginatedResponse<CityItem>>(
      `/api/general-config/cities?page=${cityPage}&limit=${cityPagination.limit}${debouncedCitySearch ? `&search=${encodeURIComponent(debouncedCitySearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setCityError(result.error ?? "No fue posible cargar ciudades");
      setCityLoading(false);
      return;
    }

    setCityItems(result.data.items);
    setCityPagination(result.data.pagination);
    setCityLoading(false);
  }, [cityPage, cityPagination.limit, debouncedCitySearch]);

  const loadCommunityTerritories = useCallback(async () => {
    setCommunityLoading(true);
    setCommunityError(null);

    const result = await requestJson<PaginatedResponse<CommunityTerritoryItem>>(
      `/api/general-config/community-territories?page=${communityPage}&limit=${communityPagination.limit}${debouncedCommunitySearch ? `&search=${encodeURIComponent(debouncedCommunitySearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setCommunityError(result.error ?? "No fue posible cargar desarrollos locales");
      setCommunityLoading(false);
      return;
    }

    setCommunityItems(result.data.items);
    setCommunityPagination(result.data.pagination);
    setCommunityLoading(false);
  }, [communityPage, communityPagination.limit, debouncedCommunitySearch]);

  const loadSpacings = useCallback(async () => {
    setSpacingLoading(true);
    setSpacingError(null);

    const result = await requestJson<PaginatedResponse<SpacingItem>>(
      `/api/forest/config/spacings?page=${spacingPage}&limit=${spacingPagination.limit}&sortBy=${spacingSortBy}&sortOrder=${spacingSortOrder}${debouncedSpacingSearch ? `&search=${encodeURIComponent(debouncedSpacingSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setSpacingError(result.error ?? "No fue posible cargar espaciamientos");
      setSpacingLoading(false);
      return;
    }

    setSpacingItems(result.data.items);
    setSpacingPagination(result.data.pagination);
    setSpacingLoading(false);
  }, [debouncedSpacingSearch, spacingPage, spacingPagination.limit, spacingSortBy, spacingSortOrder]);

  const loadLevel4Costs = useCallback(async () => {
    setLevel4CostLoading(true);
    setLevel4CostError(null);

    const result = await requestJson<PaginatedResponse<Level4AdministrativeCostItem>>(
      `/api/forest/config/level4-costs?page=${level4CostPage}&limit=${level4CostPagination.limit}&sortBy=${level4CostSortBy}&sortOrder=${level4CostSortOrder}${debouncedLevel4CostSearch ? `&search=${encodeURIComponent(debouncedLevel4CostSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setLevel4CostError(result.error ?? "No fue posible cargar costos nivel 4");
      setLevel4CostLoading(false);
      return;
    }

    setLevel4CostItems(result.data.items);
    setLevel4CostPagination(result.data.pagination);
    setLevel4CostLoading(false);
  }, [debouncedLevel4CostSearch, level4CostPage, level4CostPagination.limit, level4CostSortBy, level4CostSortOrder]);

  const loadProductTypes = useCallback(async () => {
    setProductTypeLoading(true);
    setProductTypeError(null);

    const result = await requestJson<PaginatedResponse<ProductTypeItem>>(
      `/api/forest/config/product-types?page=${productTypePage}&limit=${productTypePagination.limit}&sortBy=${productTypeSortBy}&sortOrder=${productTypeSortOrder}${debouncedProductTypeSearch ? `&search=${encodeURIComponent(debouncedProductTypeSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setProductTypeError(result.error ?? "No fue posible cargar tipos de productos");
      setProductTypeLoading(false);
      return;
    }

    setProductTypeItems(result.data.items);
    setProductTypePagination(result.data.pagination);
    setProductTypeLoading(false);
  }, [debouncedProductTypeSearch, productTypePage, productTypePagination.limit, productTypeSortBy, productTypeSortOrder]);

  const loadLandUseTypes = useCallback(async () => {
    setLandUseLoading(true);
    setLandUseError(null);

    const result = await requestJson<PaginatedResponse<LandUseTypeItem>>(
      `/api/forest/config/land-use-types?page=${landUsePage}&limit=${landUsePagination.limit}&sortBy=${landUseSortBy}&sortOrder=${landUseSortOrder}${debouncedLandUseSearch ? `&search=${encodeURIComponent(debouncedLandUseSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setLandUseError(result.error ?? "No fue posible cargar usos de suelos");
      setLandUseLoading(false);
      return;
    }

    setLandUseItems(result.data.items);
    setLandUsePagination(result.data.pagination);
    setLandUseLoading(false);
  }, [debouncedLandUseSearch, landUsePage, landUsePagination.limit, landUseSortBy, landUseSortOrder]);

  const loadSchemes = useCallback(async () => {
    setSchemeLoading(true);
    setSchemeError(null);

    const result = await requestJson<PaginatedResponse<SimpleItem>>(
      `/api/forest/config/management-schemes?page=${schemePage}&limit=${schemePagination.limit}&sortBy=${schemeSortBy}&sortOrder=${schemeSortOrder}${debouncedSchemeSearch ? `&search=${encodeURIComponent(debouncedSchemeSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setSchemeError(result.error ?? "No fue posible cargar esquemas de manejo");
      setSchemeLoading(false);
      return;
    }

    setSchemeItems(result.data.items);
    setSchemePagination(result.data.pagination);
    setSchemeLoading(false);
  }, [debouncedSchemeSearch, schemePage, schemePagination.limit, schemeSortBy, schemeSortOrder]);

  const loadInventoryTypes = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);

    const result = await requestJson<PaginatedResponse<SimpleItem>>(
      `/api/forest/config/inventory-types?page=${inventoryPage}&limit=${inventoryPagination.limit}&sortBy=${inventorySortBy}&sortOrder=${inventorySortOrder}${debouncedInventorySearch ? `&search=${encodeURIComponent(debouncedInventorySearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setInventoryError(result.error ?? "No fue posible cargar tipos de inventario");
      setInventoryLoading(false);
      return;
    }

    setInventoryItems(result.data.items);
    setInventoryPagination(result.data.pagination);
    setInventoryLoading(false);
  }, [debouncedInventorySearch, inventoryPage, inventoryPagination.limit, inventorySortBy, inventorySortOrder]);

  const loadImaClasses = useCallback(async () => {
    setImaLoading(true);
    setImaError(null);

    const result = await requestJson<PaginatedResponse<ImaItem>>(
      `/api/forest/config/ima-classes?page=${imaPage}&limit=${imaPagination.limit}&sortBy=${imaSortBy}&sortOrder=${imaSortOrder}${debouncedImaSearch ? `&search=${encodeURIComponent(debouncedImaSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setImaError(result.error ?? "No fue posible cargar clases IMA");
      setImaLoading(false);
      return;
    }

    setImaItems(result.data.items);
    setImaPagination(result.data.pagination);
    setImaLoading(false);
  }, [debouncedImaSearch, imaPage, imaPagination.limit, imaSortBy, imaSortOrder]);

  const loadSpecies = useCallback(async () => {
    setSpeciesLoading(true);
    setSpeciesError(null);

    const result = await requestJson<PaginatedResponse<SpeciesItem>>(
      `/api/forest/config/species?page=${speciesPage}&limit=${speciesPagination.limit}&sortBy=${speciesSortBy}&sortOrder=${speciesSortOrder}${debouncedSpeciesSearch ? `&search=${encodeURIComponent(debouncedSpeciesSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setSpeciesError(result.error ?? "No fue posible cargar especies vegetales");
      setSpeciesLoading(false);
      return;
    }

    setSpeciesItems(result.data.items);
    setSpeciesPagination(result.data.pagination);
    setSpeciesLoading(false);
  }, [debouncedSpeciesSearch, speciesPage, speciesPagination.limit, speciesSortBy, speciesSortOrder]);

  const loadProvenances = useCallback(async () => {
    setProvenanceLoading(true);
    setProvenanceError(null);

    const result = await requestJson<PaginatedResponse<ProvenanceItem>>(
      `/api/forest/config/provenances?page=${provenancePage}&limit=${provenancePagination.limit}&sortBy=${provenanceSortBy}&sortOrder=${provenanceSortOrder}${debouncedProvenanceSearch ? `&search=${encodeURIComponent(debouncedProvenanceSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setProvenanceError(result.error ?? "No fue posible cargar procedencias");
      setProvenanceLoading(false);
      return;
    }

    setProvenanceItems(result.data.items);
    setProvenancePagination(result.data.pagination);
    setProvenanceLoading(false);
  }, [debouncedProvenanceSearch, provenancePage, provenancePagination.limit, provenanceSortBy, provenanceSortOrder]);

  const loadVegetalMaterials = useCallback(async () => {
    setMaterialLoading(true);
    setMaterialError(null);

    const result = await requestJson<PaginatedResponse<VegetalMaterialItem>>(
      `/api/forest/config/vegetal-materials?page=${materialPage}&limit=${materialPagination.limit}&sortBy=${materialSortBy}&sortOrder=${materialSortOrder}${debouncedMaterialSearch ? `&search=${encodeURIComponent(debouncedMaterialSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setMaterialError(result.error ?? "No fue posible cargar materiales vegetales");
      setMaterialLoading(false);
      return;
    }

    setMaterialItems(result.data.items);
    setMaterialPagination(result.data.pagination);
    setMaterialLoading(false);
  }, [debouncedMaterialSearch, materialPage, materialPagination.limit, materialSortBy, materialSortOrder]);

  useEffect(() => {
    void loadSchemes();
  }, [loadSchemes]);

  useEffect(() => {
    void loadInventoryTypes();
  }, [loadInventoryTypes]);

  useEffect(() => {
    void loadImaClasses();
  }, [loadImaClasses]);

  useEffect(() => {
    void loadSpecies();
  }, [loadSpecies]);

  useEffect(() => {
    void loadProvenances();
  }, [loadProvenances]);

  useEffect(() => {
    void loadVegetalMaterials();
  }, [loadVegetalMaterials]);

  useEffect(() => {
    void loadContinents();
  }, [loadContinents]);

  useEffect(() => {
    void loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    void loadRegions();
  }, [loadRegions]);

  useEffect(() => {
    void loadStateDepartments();
  }, [loadStateDepartments]);

  useEffect(() => {
    void loadMunicipalities();
  }, [loadMunicipalities]);

  useEffect(() => {
    void loadCities();
  }, [loadCities]);

  useEffect(() => {
    void loadCommunityTerritories();
  }, [loadCommunityTerritories]);

  useEffect(() => {
    void loadSpacings();
  }, [loadSpacings]);

  useEffect(() => {
    void loadLevel4Costs();
  }, [loadLevel4Costs]);

  useEffect(() => {
    void loadProductTypes();
  }, [loadProductTypes]);

  useEffect(() => {
    void loadLandUseTypes();
  }, [loadLandUseTypes]);

  useEffect(() => {
    void loadCountryOptions();
    void loadSpeciesOptions();
    void loadProvenanceOptions();
    void loadStateOptions();
    void loadMunicipalityOptions();
    void loadCityOptions();
    void loadLevel4Options();
  }, [
    loadCountryOptions,
    loadSpeciesOptions,
    loadProvenanceOptions,
    loadStateOptions,
    loadMunicipalityOptions,
    loadCityOptions,
    loadLevel4Options,
  ]);

  useEffect(() => {
    setSchemePage(1);
  }, [debouncedSchemeSearch]);

  useEffect(() => {
    setInventoryPage(1);
  }, [debouncedInventorySearch]);

  useEffect(() => {
    setImaPage(1);
  }, [debouncedImaSearch]);

  useEffect(() => {
    setSpeciesPage(1);
  }, [debouncedSpeciesSearch]);

  useEffect(() => {
    setProvenancePage(1);
  }, [debouncedProvenanceSearch]);

  useEffect(() => {
    setMaterialPage(1);
  }, [debouncedMaterialSearch]);

  useEffect(() => {
    setContinentPage(1);
  }, [debouncedContinentSearch]);

  useEffect(() => {
    setCountryPage(1);
  }, [debouncedCountrySearch]);

  useEffect(() => {
    setRegionPage(1);
  }, [debouncedRegionSearch]);

  useEffect(() => {
    setStateDepartmentPage(1);
  }, [debouncedStateDepartmentSearch]);

  useEffect(() => {
    setMunicipalityPage(1);
  }, [debouncedMunicipalitySearch]);

  useEffect(() => {
    setCityPage(1);
  }, [debouncedCitySearch]);

  useEffect(() => {
    setCommunityPage(1);
  }, [debouncedCommunitySearch]);

  useEffect(() => {
    setSpacingPage(1);
  }, [debouncedSpacingSearch]);

  useEffect(() => {
    setLevel4CostPage(1);
  }, [debouncedLevel4CostSearch]);

  useEffect(() => {
    setProductTypePage(1);
  }, [debouncedProductTypeSearch]);

  useEffect(() => {
    setLandUsePage(1);
  }, [debouncedLandUseSearch]);

  const canCreateScheme = useMemo(() => schemeForm.code.trim().length > 0 && schemeForm.name.trim().length > 0, [schemeForm]);
  const canCreateInventory = useMemo(
    () => inventoryForm.code.trim().length > 0 && inventoryForm.name.trim().length > 0,
    [inventoryForm],
  );
  const canCreateIma = useMemo(() => imaForm.code.trim().length > 0 && imaForm.name.trim().length > 0, [imaForm]);
  const canCreateSpecies = useMemo(
    () => speciesForm.code.trim().length > 0 && speciesForm.scientificName.trim().length > 0,
    [speciesForm],
  );
  const canCreateProvenance = useMemo(
    () => provenanceForm.countryId.length > 0 && provenanceForm.code.trim().length > 0 && provenanceForm.name.trim().length > 0,
    [provenanceForm],
  );
  const canCreateMaterial = useMemo(
    () => materialForm.code.trim().length > 0 && materialForm.name.trim().length > 0 && materialForm.speciesId.length > 0,
    [materialForm],
  );
  const canCreateContinent = useMemo(
    () => continentForm.code.trim().length > 0 && continentForm.name.trim().length > 0,
    [continentForm],
  );
  const canCreateCountry = useMemo(
    () => countryForm.continentId.length > 0 && countryForm.code.trim().length > 0 && countryForm.name.trim().length > 0,
    [countryForm],
  );
  const canCreateRegion = useMemo(
    () => regionForm.countryId.length > 0 && regionForm.code.trim().length > 0 && regionForm.name.trim().length > 0,
    [regionForm],
  );
  const canCreateStateDepartment = useMemo(
    () =>
      stateDepartmentForm.countryId.length > 0 &&
      stateDepartmentForm.code.trim().length > 0 &&
      stateDepartmentForm.name.trim().length > 0,
    [stateDepartmentForm],
  );
  const canCreateMunicipality = useMemo(
    () => municipalityForm.stateId.length > 0 && municipalityForm.code.trim().length > 0 && municipalityForm.name.trim().length > 0,
    [municipalityForm],
  );
  const canCreateCity = useMemo(
    () => cityForm.municipalityId.length > 0 && cityForm.code.trim().length > 0 && cityForm.name.trim().length > 0,
    [cityForm],
  );
  const canCreateCommunity = useMemo(
    () => communityForm.cityId.length > 0 && communityForm.code.trim().length > 0 && communityForm.name.trim().length > 0,
    [communityForm],
  );
  const canCreateSpacing = useMemo(
    () => spacingForm.code.trim().length > 0 && spacingForm.name.trim().length > 0,
    [spacingForm],
  );
  const canCreateLevel4Cost = useMemo(
    () =>
      level4CostForm.level4Id.length > 0 &&
      level4CostForm.code.trim().length > 0 &&
      level4CostForm.plantationAreaHa.trim().length > 0,
    [level4CostForm],
  );
  const canCreateProductType = useMemo(
    () => productTypeForm.code.trim().length > 0 && productTypeForm.name.trim().length > 0,
    [productTypeForm],
  );
  const canCreateLandUse = useMemo(
    () => landUseForm.code.trim().length > 0 && landUseForm.name.trim().length > 0 && landUseForm.category.trim().length > 0,
    [landUseForm],
  );
  const activeContinents = useMemo(() => continentItems.filter((item) => item.isActive), [continentItems]);

  function showCrudSuccess(message: string) {
    setGlobalMessage(message);
    sileo.success({
      title: "Operación completada",
      description: message,
    });
  }

  function showCrudError(setter: (value: string | null) => void, message: string) {
    setter(message);
    sileo.error({
      title: "No se pudo completar",
      description: message,
    });
  }

  function showCrudWarning(setter: (value: string | null) => void, message: string) {
    setter(message);
    sileo.warning({
      title: "Acción no permitida",
      description: message,
    });
  }

  function confirmDeletion(description: string, onConfirm: () => void) {
    sileo.action({
      title: "Confirmar eliminación",
      description,
      duration: 6000,
      button: {
        title: "Eliminar",
        onClick: onConfirm,
      },
    });
  }

  async function createScheme(event: FormEvent) {
    event.preventDefault();
    if (!canCreateScheme) return;

    const result = await requestJson<SimpleItem>("/api/forest/config/management-schemes", {
      method: "POST",
      body: JSON.stringify(schemeForm),
    });

    if (!result.success) {
      showCrudError(setSchemeError, result.error ?? "No fue posible crear el esquema de manejo");
      return;
    }

    showCrudSuccess("Esquema de manejo creado");
    setSchemeForm({ code: "", name: "", isActive: true });
    setSchemePage(1);
    await loadSchemes();
  }

  async function updateScheme(event: FormEvent) {
    event.preventDefault();
    if (!editingScheme) return;

    const result = await requestJson<SimpleItem>("/api/forest/config/management-schemes", {
      method: "PATCH",
      body: JSON.stringify(editingScheme),
    });

    if (!result.success) {
      showCrudError(setSchemeError, result.error ?? "No fue posible actualizar el esquema de manejo");
      return;
    }

    showCrudSuccess("Esquema de manejo actualizado");
    setEditingScheme(null);
    await loadSchemes();
  }

  async function deleteScheme(id: string) {
    const result = await requestJson<{ id: string }>("/api/forest/config/management-schemes", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setSchemeError, result.error ?? "No fue posible eliminar el esquema de manejo");
      return;
    }

    showCrudSuccess("Esquema de manejo eliminado");
    await loadSchemes();
  }

  function toggleSchemeSort(nextSortBy: string) {
    if (!isSchemeSortKey(nextSortBy)) return;

    const isSameColumn = schemeSortBy === nextSortBy;
    setSchemeSortBy(nextSortBy);
    setSchemeSortOrder(isSameColumn ? (schemeSortOrder === "asc" ? "desc" : "asc") : "asc");
    setSchemePage(1);
  }

  async function downloadSchemeExport(format: "csv" | "xlsx") {
    try {
      setSchemeExporting(true);
      setSchemeError(null);

      const params = new URLSearchParams({
        format,
        limit: String(schemeExportLimit),
        sortBy: schemeSortBy,
        sortOrder: schemeSortOrder,
      });

      const trimmedSearch = debouncedSchemeSearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/forest/config/management-schemes/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar esquemas de manejo");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `management_schemes.${format}`;

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
        description: `Se generó el archivo correctamente (máx. ${schemeExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      showCrudError(setSchemeError, message);
    } finally {
      setSchemeExporting(false);
    }
  }

  async function onImportSchemes(file: File) {
    try {
      setSchemeImporting(true);
      setSchemeError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/config/management-schemes/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar esquemas de manejo");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; code?: string; error: string }>;
          }
        | undefined;

      await loadSchemes();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

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
      showCrudError(setSchemeError, message);
    } finally {
      setSchemeImporting(false);
      if (importSchemeInputRef.current) {
        importSchemeInputRef.current.value = "";
      }
    }
  }

  async function createInventoryType(event: FormEvent) {
    event.preventDefault();
    if (!canCreateInventory) return;

    const result = await requestJson<SimpleItem>("/api/forest/config/inventory-types", {
      method: "POST",
      body: JSON.stringify(inventoryForm),
    });

    if (!result.success) {
      showCrudError(setInventoryError, result.error ?? "No fue posible crear el tipo de inventario");
      return;
    }

    showCrudSuccess("Tipo de inventario creado");
    setInventoryForm({ code: "", name: "", isActive: true });
    setInventoryPage(1);
    await loadInventoryTypes();
  }

  async function updateInventoryType(event: FormEvent) {
    event.preventDefault();
    if (!editingInventory) return;

    const result = await requestJson<SimpleItem>("/api/forest/config/inventory-types", {
      method: "PATCH",
      body: JSON.stringify(editingInventory),
    });

    if (!result.success) {
      showCrudError(setInventoryError, result.error ?? "No fue posible actualizar el tipo de inventario");
      return;
    }

    showCrudSuccess("Tipo de inventario actualizado");
    setEditingInventory(null);
    await loadInventoryTypes();
  }

  async function deleteInventoryType(id: string) {
    const result = await requestJson<{ id: string }>("/api/forest/config/inventory-types", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setInventoryError, result.error ?? "No fue posible eliminar el tipo de inventario");
      return;
    }

    showCrudSuccess("Tipo de inventario eliminado");
    await loadInventoryTypes();
  }

  function toggleInventorySort(nextSortBy: string) {
    if (!isInventorySortKey(nextSortBy)) return;

    const isSameColumn = inventorySortBy === nextSortBy;
    setInventorySortBy(nextSortBy);
    setInventorySortOrder(isSameColumn ? (inventorySortOrder === "asc" ? "desc" : "asc") : "asc");
    setInventoryPage(1);
  }

  async function downloadInventoryExport(format: "csv" | "xlsx") {
    try {
      setInventoryExporting(true);
      setInventoryError(null);

      const params = new URLSearchParams({
        format,
        limit: String(inventoryExportLimit),
        sortBy: inventorySortBy,
        sortOrder: inventorySortOrder,
      });

      const trimmedSearch = debouncedInventorySearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/forest/config/inventory-types/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar tipos de inventario");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `inventory_types.${format}`;

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
        description: `Se generó el archivo correctamente (máx. ${inventoryExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      showCrudError(setInventoryError, message);
    } finally {
      setInventoryExporting(false);
    }
  }

  async function onImportInventoryTypes(file: File) {
    try {
      setInventoryImporting(true);
      setInventoryError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/config/inventory-types/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar tipos de inventario");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; code?: string; error: string }>;
          }
        | undefined;

      await loadInventoryTypes();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

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
      showCrudError(setInventoryError, message);
    } finally {
      setInventoryImporting(false);
      if (importInventoryInputRef.current) {
        importInventoryInputRef.current.value = "";
      }
    }
  }

  async function createImaClass(event: FormEvent) {
    event.preventDefault();
    if (!canCreateIma) return;

    const result = await requestJson<ImaItem>("/api/forest/config/ima-classes", {
      method: "POST",
      body: JSON.stringify({
        ...imaForm,
        rangeMin: toNumberOrNull(imaForm.rangeMin),
        rangeMax: toNumberOrNull(imaForm.rangeMax),
      }),
    });

    if (!result.success) {
      showCrudError(setImaError, result.error ?? "No fue posible crear la clase IMA");
      return;
    }

    showCrudSuccess("Clase IMA creada");
    setImaForm({
      code: "",
      classification: "I",
      name: "",
      description: "",
      rangeMin: "",
      rangeMax: "",
      isActive: true,
    });
    setImaPage(1);
    await loadImaClasses();
  }

  async function updateImaClass(event: FormEvent) {
    event.preventDefault();
    if (!editingIma) return;

    const result = await requestJson<ImaItem>("/api/forest/config/ima-classes", {
      method: "PATCH",
      body: JSON.stringify({
        ...editingIma,
        rangeMin: editingIma.rangeMin == null ? null : toNumberOrNull(String(editingIma.rangeMin)),
        rangeMax: editingIma.rangeMax == null ? null : toNumberOrNull(String(editingIma.rangeMax)),
      }),
    });

    if (!result.success) {
      showCrudError(setImaError, result.error ?? "No fue posible actualizar la clase IMA");
      return;
    }

    showCrudSuccess("Clase IMA actualizada");
    setEditingIma(null);
    await loadImaClasses();
  }

  async function deleteImaClass(id: string) {
    const result = await requestJson<{ id: string }>("/api/forest/config/ima-classes", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setImaError, result.error ?? "No fue posible eliminar la clase IMA");
      return;
    }

    showCrudSuccess("Clase IMA eliminada");
    await loadImaClasses();
  }

  function toggleImaSort(nextSortBy: string) {
    if (!isImaSortKey(nextSortBy)) return;

    const isSameColumn = imaSortBy === nextSortBy;
    setImaSortBy(nextSortBy);
    setImaSortOrder(isSameColumn ? (imaSortOrder === "asc" ? "desc" : "asc") : "asc");
    setImaPage(1);
  }

  async function downloadImaExport(format: "csv" | "xlsx") {
    try {
      setImaExporting(true);
      setImaError(null);

      const params = new URLSearchParams({
        format,
        limit: String(imaExportLimit),
        sortBy: imaSortBy,
        sortOrder: imaSortOrder,
      });

      const trimmedSearch = debouncedImaSearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/forest/config/ima-classes/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar clases IMA");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `ima_classes.${format}`;

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
        description: `Se generó el archivo correctamente (máx. ${imaExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      showCrudError(setImaError, message);
    } finally {
      setImaExporting(false);
    }
  }

  async function onImportImaClasses(file: File) {
    try {
      setImaImporting(true);
      setImaError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/config/ima-classes/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar clases IMA");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; code?: string; error: string }>;
          }
        | undefined;

      await loadImaClasses();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

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
      showCrudError(setImaError, message);
    } finally {
      setImaImporting(false);
      if (importImaInputRef.current) {
        importImaInputRef.current.value = "";
      }
    }
  }

  async function createSpecies(event: FormEvent) {
    event.preventDefault();
    if (!canCreateSpecies) return;

    const result = await requestJson<SpeciesItem>("/api/forest/config/species", {
      method: "POST",
      body: JSON.stringify({
        ...speciesForm,
        commonName: toNullableString(speciesForm.commonName),
        genus: toNullableString(speciesForm.genus),
        family: toNullableString(speciesForm.family),
        taxonomicOrder: toNullableString(speciesForm.taxonomicOrder),
      }),
    });

    if (!result.success) {
      showCrudError(setSpeciesError, result.error ?? "No fue posible crear la especie vegetal");
      return;
    }

    showCrudSuccess("Especie vegetal creada");
    setSpeciesForm({
      code: "",
      scientificName: "",
      commonName: "",
      genus: "",
      family: "",
      taxonomicOrder: "",
      isActive: true,
    });
    setSpeciesPage(1);
    await loadSpecies();
    await loadSpeciesOptions();
  }

  async function updateSpecies(event: FormEvent) {
    event.preventDefault();
    if (!editingSpecies) return;

    const result = await requestJson<SpeciesItem>("/api/forest/config/species", {
      method: "PATCH",
      body: JSON.stringify({
        ...editingSpecies,
        commonName: toNullableString(editingSpecies.commonName ?? ""),
        genus: toNullableString(editingSpecies.genus ?? ""),
        family: toNullableString(editingSpecies.family ?? ""),
        taxonomicOrder: toNullableString(editingSpecies.taxonomicOrder ?? ""),
      }),
    });

    if (!result.success) {
      showCrudError(setSpeciesError, result.error ?? "No fue posible actualizar la especie vegetal");
      return;
    }

    showCrudSuccess("Especie vegetal actualizada");
    setEditingSpecies(null);
    await loadSpecies();
    await loadSpeciesOptions();
  }

  async function deleteSpecies(id: string) {
    const result = await requestJson<{ id: string }>("/api/forest/config/species", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setSpeciesError, result.error ?? "No fue posible eliminar la especie vegetal");
      return;
    }

    showCrudSuccess("Especie vegetal eliminada");
    await loadSpecies();
    await loadSpeciesOptions();
  }

  function toggleSpeciesSort(nextSortBy: string) {
    if (!isSpeciesSortKey(nextSortBy)) return;

    const isSameColumn = speciesSortBy === nextSortBy;
    setSpeciesSortBy(nextSortBy);
    setSpeciesSortOrder(isSameColumn ? (speciesSortOrder === "asc" ? "desc" : "asc") : "asc");
    setSpeciesPage(1);
  }

  async function downloadSpeciesExport(format: "csv" | "xlsx") {
    try {
      setSpeciesExporting(true);
      setSpeciesError(null);

      const params = new URLSearchParams({
        format,
        limit: String(speciesExportLimit),
        sortBy: speciesSortBy,
        sortOrder: speciesSortOrder,
      });

      const trimmedSearch = debouncedSpeciesSearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/forest/config/species/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar especies vegetales");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `species.${format}`;

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
        description: `Se generó el archivo correctamente (máx. ${speciesExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      showCrudError(setSpeciesError, message);
    } finally {
      setSpeciesExporting(false);
    }
  }

  async function onImportSpecies(file: File) {
    try {
      setSpeciesImporting(true);
      setSpeciesError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/config/species/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar especies vegetales");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; code?: string; error: string }>;
          }
        | undefined;

      await loadSpecies();
      await loadSpeciesOptions();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

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
      showCrudError(setSpeciesError, message);
    } finally {
      setSpeciesImporting(false);
      if (importSpeciesInputRef.current) {
        importSpeciesInputRef.current.value = "";
      }
    }
  }

  async function createProvenance(event: FormEvent) {
    event.preventDefault();
    if (!canCreateProvenance) return;

    const result = await requestJson<ProvenanceItem>("/api/forest/config/provenances", {
      method: "POST",
      body: JSON.stringify(provenanceForm),
    });

    if (!result.success) {
      showCrudError(setProvenanceError, result.error ?? "No fue posible crear la procedencia");
      return;
    }

    showCrudSuccess("Procedencia creada");
    setProvenanceForm((prev) => ({
      countryId: prev.countryId,
      code: "",
      name: "",
      isActive: true,
    }));
    setProvenancePage(1);
    await loadProvenances();
    await loadProvenanceOptions();
  }

  async function updateProvenance(event: FormEvent) {
    event.preventDefault();
    if (!editingProvenance) return;

    const result = await requestJson<ProvenanceItem>("/api/forest/config/provenances", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingProvenance.id,
        countryId: editingProvenance.countryId,
        code: editingProvenance.code,
        name: editingProvenance.name,
        isActive: editingProvenance.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setProvenanceError, result.error ?? "No fue posible actualizar la procedencia");
      return;
    }

    showCrudSuccess("Procedencia actualizada");
    setEditingProvenance(null);
    await loadProvenances();
    await loadProvenanceOptions();
  }

  async function deleteProvenance(id: string) {
    const result = await requestJson<{ id: string }>("/api/forest/config/provenances", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setProvenanceError, result.error ?? "No fue posible eliminar la procedencia");
      return;
    }

    showCrudSuccess("Procedencia eliminada");
    await loadProvenances();
    await loadProvenanceOptions();
  }

  function toggleProvenanceSort(nextSortBy: string) {
    if (!isProvenanceSortKey(nextSortBy)) return;

    const isSameColumn = provenanceSortBy === nextSortBy;
    setProvenanceSortBy(nextSortBy);
    setProvenanceSortOrder(isSameColumn ? (provenanceSortOrder === "asc" ? "desc" : "asc") : "asc");
    setProvenancePage(1);
  }

  async function downloadProvenanceExport(format: "csv" | "xlsx") {
    try {
      setProvenanceExporting(true);
      setProvenanceError(null);

      const params = new URLSearchParams({
        format,
        limit: String(provenanceExportLimit),
        sortBy: provenanceSortBy,
        sortOrder: provenanceSortOrder,
      });

      const trimmedSearch = debouncedProvenanceSearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/forest/config/provenances/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar procedencias");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `provenances.${format}`;

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
        description: `Se generó el archivo correctamente (máx. ${provenanceExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      showCrudError(setProvenanceError, message);
    } finally {
      setProvenanceExporting(false);
    }
  }

  async function onImportProvenances(file: File) {
    try {
      setProvenanceImporting(true);
      setProvenanceError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/config/provenances/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar procedencias");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; code?: string; error: string }>;
          }
        | undefined;

      await loadProvenances();
      await loadProvenanceOptions();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

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
      showCrudError(setProvenanceError, message);
    } finally {
      setProvenanceImporting(false);
      if (importProvenanceInputRef.current) {
        importProvenanceInputRef.current.value = "";
      }
    }
  }

  async function createMaterial(event: FormEvent) {
    event.preventDefault();
    if (!canCreateMaterial) return;

    const result = await requestJson<VegetalMaterialItem>("/api/forest/config/vegetal-materials", {
      method: "POST",
      body: JSON.stringify({
        ...materialForm,
        provenanceId: materialForm.provenanceId || null,
      }),
    });

    if (!result.success) {
      showCrudError(setMaterialError, result.error ?? "No fue posible crear el material vegetal");
      return;
    }

    showCrudSuccess("Material vegetal creado");
    setMaterialForm((prev) => ({
      code: "",
      name: "",
      speciesId: prev.speciesId || speciesOptions[0]?.id || "",
      materialType: "PURA",
      plantType: "PROGENIE",
      plantOrigin: "NATIVA",
      provenanceId: "",
      isActive: true,
    }));
    setMaterialPage(1);
    await loadVegetalMaterials();
  }

  async function updateMaterial(event: FormEvent) {
    event.preventDefault();
    if (!editingMaterial) return;

    const result = await requestJson<VegetalMaterialItem>("/api/forest/config/vegetal-materials", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingMaterial.id,
        code: editingMaterial.code,
        name: editingMaterial.name,
        speciesId: editingMaterial.speciesId,
        materialType: editingMaterial.materialType,
        plantType: editingMaterial.plantType,
        plantOrigin: editingMaterial.plantOrigin,
        provenanceId: editingMaterial.provenanceId || null,
        isActive: editingMaterial.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setMaterialError, result.error ?? "No fue posible actualizar el material vegetal");
      return;
    }

    showCrudSuccess("Material vegetal actualizado");
    setEditingMaterial(null);
    await loadVegetalMaterials();
  }

  async function deleteMaterial(id: string) {
    const result = await requestJson<{ id: string }>("/api/forest/config/vegetal-materials", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setMaterialError, result.error ?? "No fue posible eliminar el material vegetal");
      return;
    }

    showCrudSuccess("Material vegetal eliminado");
    await loadVegetalMaterials();
  }

  function toggleMaterialSort(nextSortBy: string) {
    if (!isMaterialSortKey(nextSortBy)) return;

    const isSameColumn = materialSortBy === nextSortBy;
    setMaterialSortBy(nextSortBy);
    setMaterialSortOrder(isSameColumn ? (materialSortOrder === "asc" ? "desc" : "asc") : "asc");
    setMaterialPage(1);
  }

  async function downloadMaterialExport(format: "csv" | "xlsx") {
    try {
      setMaterialExporting(true);
      setMaterialError(null);

      const params = new URLSearchParams({
        format,
        limit: String(materialExportLimit),
        sortBy: materialSortBy,
        sortOrder: materialSortOrder,
      });

      const trimmedSearch = debouncedMaterialSearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/forest/config/vegetal-materials/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar materiales vegetales");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `vegetal_materials.${format}`;

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
        description: `Se generó el archivo correctamente (máx. ${materialExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      showCrudError(setMaterialError, message);
    } finally {
      setMaterialExporting(false);
    }
  }

  async function onImportMaterials(file: File) {
    try {
      setMaterialImporting(true);
      setMaterialError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/config/vegetal-materials/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar materiales vegetales");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; code?: string; error: string }>;
          }
        | undefined;

      await loadVegetalMaterials();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

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
      showCrudError(setMaterialError, message);
    } finally {
      setMaterialImporting(false);
      if (importMaterialInputRef.current) {
        importMaterialInputRef.current.value = "";
      }
    }
  }

  async function createContinent(event: FormEvent) {
    event.preventDefault();
    if (!canCreateContinent) return;

    const result = await requestJson<ContinentItem>("/api/general-config/continents", {
      method: "POST",
      body: JSON.stringify(continentForm),
    });

    if (!result.success) {
      showCrudError(setContinentError, result.error ?? "No fue posible crear el continente");
      return;
    }

    showCrudSuccess("Continente creado");
    setContinentForm({ code: "", name: "", isActive: true });
    setContinentPage(1);
    await loadContinents();
  }

  async function updateContinent(event: FormEvent) {
    event.preventDefault();
    if (!editingContinent) return;

    const result = await requestJson<ContinentItem>("/api/general-config/continents", {
      method: "PATCH",
      body: JSON.stringify(editingContinent),
    });

    if (!result.success) {
      showCrudError(setContinentError, result.error ?? "No fue posible actualizar el continente");
      return;
    }

    showCrudSuccess("Continente actualizado");
    setEditingContinent(null);
    await loadContinents();
  }

  async function deleteContinent(id: string) {
    const result = await requestJson<{ id: string }>("/api/general-config/continents", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setContinentError, result.error ?? "No fue posible eliminar el continente");
      return;
    }

    showCrudSuccess("Continente eliminado");
    await loadContinents();
  }

  async function createCountry(event: FormEvent) {
    event.preventDefault();
    if (!canCreateCountry) return;

    const result = await requestJson<CountryItem>("/api/general-config/countries", {
      method: "POST",
      body: JSON.stringify(countryForm),
    });

    if (!result.success) {
      showCrudError(setCountryError, result.error ?? "No fue posible crear el país");
      return;
    }

    showCrudSuccess("País creado");
    setCountryForm((prev) => ({
      continentId: prev.continentId,
      code: "",
      name: "",
      isActive: true,
    }));
    setCountryPage(1);
    await loadCountries();
    await loadCountryOptions();
  }

  async function updateCountry(event: FormEvent) {
    event.preventDefault();
    if (!editingCountry) return;

    const result = await requestJson<CountryItem>("/api/general-config/countries", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingCountry.id,
        continentId: editingCountry.continentId ?? editingCountry.continent?.id ?? "",
        code: editingCountry.code,
        name: editingCountry.name,
        isActive: editingCountry.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setCountryError, result.error ?? "No fue posible actualizar el país");
      return;
    }

    showCrudSuccess("País actualizado");
    setEditingCountry(null);
    await loadCountries();
    await loadCountryOptions();
  }

  async function deleteCountry(id: string) {
    const result = await requestJson<{ id: string }>("/api/general-config/countries", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      if (result.statusCode === 409) {
        showCrudWarning(setCountryError, result.error ?? "No se puede eliminar el país porque tiene registros relacionados");
        return;
      }
      showCrudError(setCountryError, result.error ?? "No fue posible eliminar el país");
      return;
    }

    showCrudSuccess("País eliminado");
    await loadCountries();
    await loadCountryOptions();
  }

  async function createRegion(event: FormEvent) {
    event.preventDefault();
    if (!canCreateRegion) return;

    const result = await requestJson<RegionItem>("/api/general-config/regions", {
      method: "POST",
      body: JSON.stringify(regionForm),
    });

    if (!result.success) {
      showCrudError(setRegionError, result.error ?? "No fue posible crear la región");
      return;
    }

    showCrudSuccess("Región creada");
    setRegionForm((prev) => ({
      countryId: prev.countryId,
      code: "",
      name: "",
      isActive: true,
    }));
    setRegionPage(1);
    await loadRegions();
  }

  async function updateRegion(event: FormEvent) {
    event.preventDefault();
    if (!editingRegion) return;

    const result = await requestJson<RegionItem>("/api/general-config/regions", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingRegion.id,
        countryId: editingRegion.countryId ?? editingRegion.country?.id ?? "",
        code: editingRegion.code,
        name: editingRegion.name,
        isActive: editingRegion.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setRegionError, result.error ?? "No fue posible actualizar la región");
      return;
    }

    showCrudSuccess("Región actualizada");
    setEditingRegion(null);
    await loadRegions();
  }

  async function deleteRegion(id: string) {
    const result = await requestJson<{ id: string }>("/api/general-config/regions", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setRegionError, result.error ?? "No fue posible eliminar la región");
      return;
    }

    showCrudSuccess("Región eliminada");
    await loadRegions();
  }

  async function createStateDepartment(event: FormEvent) {
    event.preventDefault();
    if (!canCreateStateDepartment) return;

    const result = await requestJson<StateDepartmentItem>("/api/general-config/state-departments", {
      method: "POST",
      body: JSON.stringify(stateDepartmentForm),
    });

    if (!result.success) {
      showCrudError(setStateDepartmentError, result.error ?? "No fue posible crear el estado/departamento");
      return;
    }

    showCrudSuccess("Estado/departamento creado");
    setStateDepartmentForm((prev) => ({
      countryId: prev.countryId,
      code: "",
      name: "",
      isActive: true,
    }));
    setStateDepartmentPage(1);
    await loadStateDepartments();
    await loadStateOptions();
  }

  async function updateStateDepartment(event: FormEvent) {
    event.preventDefault();
    if (!editingStateDepartment) return;

    const result = await requestJson<StateDepartmentItem>("/api/general-config/state-departments", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingStateDepartment.id,
        countryId: editingStateDepartment.countryId ?? editingStateDepartment.country?.id ?? "",
        code: editingStateDepartment.code,
        name: editingStateDepartment.name,
        isActive: editingStateDepartment.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setStateDepartmentError, result.error ?? "No fue posible actualizar el estado/departamento");
      return;
    }

    showCrudSuccess("Estado/departamento actualizado");
    setEditingStateDepartment(null);
    await loadStateDepartments();
    await loadStateOptions();
  }

  async function deleteStateDepartment(id: string) {
    const result = await requestJson<{ id: string }>("/api/general-config/state-departments", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setStateDepartmentError, result.error ?? "No fue posible eliminar el estado/departamento");
      return;
    }

    showCrudSuccess("Estado/departamento eliminado");
    await loadStateDepartments();
    await loadStateOptions();
  }

  async function createMunicipality(event: FormEvent) {
    event.preventDefault();
    if (!canCreateMunicipality) return;

    const result = await requestJson<MunicipalityDistrictItem>("/api/general-config/municipality-districts", {
      method: "POST",
      body: JSON.stringify(municipalityForm),
    });

    if (!result.success) {
      showCrudError(setMunicipalityError, result.error ?? "No fue posible crear el municipio/distrito");
      return;
    }

    showCrudSuccess("Municipio/distrito creado");
    setMunicipalityForm((prev) => ({
      stateId: prev.stateId,
      code: "",
      name: "",
      isActive: true,
    }));
    setMunicipalityPage(1);
    await loadMunicipalities();
    await loadMunicipalityOptions();
  }

  async function updateMunicipality(event: FormEvent) {
    event.preventDefault();
    if (!editingMunicipality) return;

    const result = await requestJson<MunicipalityDistrictItem>("/api/general-config/municipality-districts", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingMunicipality.id,
        stateId: editingMunicipality.stateId ?? editingMunicipality.state?.id ?? "",
        code: editingMunicipality.code,
        name: editingMunicipality.name,
        isActive: editingMunicipality.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setMunicipalityError, result.error ?? "No fue posible actualizar el municipio/distrito");
      return;
    }

    showCrudSuccess("Municipio/distrito actualizado");
    setEditingMunicipality(null);
    await loadMunicipalities();
    await loadMunicipalityOptions();
  }

  async function deleteMunicipality(id: string) {
    const result = await requestJson<{ id: string }>("/api/general-config/municipality-districts", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setMunicipalityError, result.error ?? "No fue posible eliminar el municipio/distrito");
      return;
    }

    showCrudSuccess("Municipio/distrito eliminado");
    await loadMunicipalities();
    await loadMunicipalityOptions();
  }

  async function createCity(event: FormEvent) {
    event.preventDefault();
    if (!canCreateCity) return;

    const result = await requestJson<CityItem>("/api/general-config/cities", {
      method: "POST",
      body: JSON.stringify(cityForm),
    });

    if (!result.success) {
      showCrudError(setCityError, result.error ?? "No fue posible crear la ciudad");
      return;
    }

    showCrudSuccess("Ciudad creada");
    setCityForm((prev) => ({
      municipalityId: prev.municipalityId,
      code: "",
      name: "",
      isActive: true,
    }));
    setCityPage(1);
    await loadCities();
    await loadCityOptions();
  }

  async function updateCity(event: FormEvent) {
    event.preventDefault();
    if (!editingCity) return;

    const result = await requestJson<CityItem>("/api/general-config/cities", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingCity.id,
        municipalityId: editingCity.municipalityId ?? editingCity.municipality?.id ?? "",
        code: editingCity.code,
        name: editingCity.name,
        isActive: editingCity.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setCityError, result.error ?? "No fue posible actualizar la ciudad");
      return;
    }

    showCrudSuccess("Ciudad actualizada");
    setEditingCity(null);
    await loadCities();
    await loadCityOptions();
  }

  async function deleteCity(id: string) {
    const result = await requestJson<{ id: string }>("/api/general-config/cities", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setCityError, result.error ?? "No fue posible eliminar la ciudad");
      return;
    }

    showCrudSuccess("Ciudad eliminada");
    await loadCities();
    await loadCityOptions();
  }

  async function createCommunity(event: FormEvent) {
    event.preventDefault();
    if (!canCreateCommunity) return;

    const result = await requestJson<CommunityTerritoryItem>("/api/general-config/community-territories", {
      method: "POST",
      body: JSON.stringify(communityForm),
    });

    if (!result.success) {
      showCrudError(setCommunityError, result.error ?? "No fue posible crear el desarrollo local");
      return;
    }

    showCrudSuccess("Desarrollo local creado");
    setCommunityForm((prev) => ({
      cityId: prev.cityId,
      code: "",
      name: "",
      type: "COMUNA",
      isActive: true,
    }));
    setCommunityPage(1);
    await loadCommunityTerritories();
  }

  async function updateCommunity(event: FormEvent) {
    event.preventDefault();
    if (!editingCommunity) return;

    const result = await requestJson<CommunityTerritoryItem>("/api/general-config/community-territories", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingCommunity.id,
        cityId: editingCommunity.cityId ?? editingCommunity.city?.id ?? "",
        code: editingCommunity.code,
        name: editingCommunity.name,
        type: editingCommunity.type,
        isActive: editingCommunity.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setCommunityError, result.error ?? "No fue posible actualizar el desarrollo local");
      return;
    }

    showCrudSuccess("Desarrollo local actualizado");
    setEditingCommunity(null);
    await loadCommunityTerritories();
  }

  async function deleteCommunity(id: string) {
    const result = await requestJson<{ id: string }>("/api/general-config/community-territories", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setCommunityError, result.error ?? "No fue posible eliminar el desarrollo local");
      return;
    }

    showCrudSuccess("Desarrollo local eliminado");
    await loadCommunityTerritories();
  }

  async function createSpacing(event: FormEvent) {
    event.preventDefault();
    if (!canCreateSpacing) return;

    const result = await requestJson<SpacingItem>("/api/forest/config/spacings", {
      method: "POST",
      body: JSON.stringify({
        ...spacingForm,
        description: toNullableString(spacingForm.description),
        betweenRowsM: toNumberOrNull(spacingForm.betweenRowsM),
        betweenTreesM: toNumberOrNull(spacingForm.betweenTreesM),
        treeDensityPerHa: toNumberOrNull(spacingForm.treeDensityPerHa),
      }),
    });

    if (!result.success) {
      showCrudError(setSpacingError, result.error ?? "No fue posible crear el espaciamiento");
      return;
    }

    showCrudSuccess("Espaciamiento creado");
    setSpacingForm({
      code: "",
      name: "",
      description: "",
      betweenRowsM: "",
      betweenTreesM: "",
      treeDensityPerHa: "",
      isActive: true,
    });
    setSpacingPage(1);
    await loadSpacings();
  }

  async function updateSpacing(event: FormEvent) {
    event.preventDefault();
    if (!editingSpacing) return;

    const result = await requestJson<SpacingItem>("/api/forest/config/spacings", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingSpacing.id,
        code: editingSpacing.code,
        name: editingSpacing.name,
        description: toNullableString(editingSpacing.description ?? ""),
        betweenRowsM: editingSpacing.betweenRowsM == null ? null : toNumberOrNull(String(editingSpacing.betweenRowsM)),
        betweenTreesM: editingSpacing.betweenTreesM == null ? null : toNumberOrNull(String(editingSpacing.betweenTreesM)),
        treeDensityPerHa: editingSpacing.treeDensityPerHa == null ? null : toNumberOrNull(String(editingSpacing.treeDensityPerHa)),
        isActive: editingSpacing.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setSpacingError, result.error ?? "No fue posible actualizar el espaciamiento");
      return;
    }

    showCrudSuccess("Espaciamiento actualizado");
    setEditingSpacing(null);
    await loadSpacings();
  }

  async function deleteSpacing(id: string) {
    const result = await requestJson<{ id: string }>("/api/forest/config/spacings", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setSpacingError, result.error ?? "No fue posible eliminar el espaciamiento");
      return;
    }

    showCrudSuccess("Espaciamiento eliminado");
    await loadSpacings();
  }

  function toggleSpacingSort(nextSortBy: string) {
    if (!isSpacingSortKey(nextSortBy)) return;

    const isSameColumn = spacingSortBy === nextSortBy;
    setSpacingSortBy(nextSortBy);
    setSpacingSortOrder(isSameColumn ? (spacingSortOrder === "asc" ? "desc" : "asc") : "asc");
    setSpacingPage(1);
  }

  async function downloadSpacingExport(format: "csv" | "xlsx") {
    try {
      setSpacingExporting(true);
      setSpacingError(null);

      const params = new URLSearchParams({
        format,
        limit: String(spacingExportLimit),
        sortBy: spacingSortBy,
        sortOrder: spacingSortOrder,
      });

      const trimmedSearch = debouncedSpacingSearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/forest/config/spacings/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar espaciamientos");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `spacings.${format}`;

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
        description: `Se generó el archivo correctamente (máx. ${spacingExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      showCrudError(setSpacingError, message);
    } finally {
      setSpacingExporting(false);
    }
  }

  async function onImportSpacings(file: File) {
    try {
      setSpacingImporting(true);
      setSpacingError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/config/spacings/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar espaciamientos");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; code?: string; error: string }>;
          }
        | undefined;

      await loadSpacings();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

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
      showCrudError(setSpacingError, message);
    } finally {
      setSpacingImporting(false);
      if (importSpacingInputRef.current) {
        importSpacingInputRef.current.value = "";
      }
    }
  }

  async function createLevel4Cost(event: FormEvent) {
    event.preventDefault();
    if (!canCreateLevel4Cost) return;

    const plantationAreaHa = toNumberOrNull(level4CostForm.plantationAreaHa);
    if (plantationAreaHa === null) {
      setLevel4CostError("Área de plantación inválida");
      sileo.warning({
        title: "Datos inválidos",
        description: "Área de plantación inválida.",
      });
      return;
    }

    const result = await requestJson<Level4AdministrativeCostItem>("/api/forest/config/level4-costs", {
      method: "POST",
      body: JSON.stringify({
        level4Id: level4CostForm.level4Id,
        code: level4CostForm.code,
        plantationAreaHa,
        rotationPhase: toNullableString(level4CostForm.rotationPhase),
        accountingDocumentId: level4CostForm.accountingDocumentId || null,
        isActive: level4CostForm.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setLevel4CostError, result.error ?? "No fue posible crear el costo nivel 4");
      return;
    }

    showCrudSuccess("Costo nivel 4 creado");
    setLevel4CostForm((prev) => ({
      level4Id: prev.level4Id,
      code: "",
      plantationAreaHa: "",
      rotationPhase: "",
      accountingDocumentId: "",
      isActive: true,
    }));
    setLevel4CostPage(1);
    await loadLevel4Costs();
  }

  async function updateLevel4Cost(event: FormEvent) {
    event.preventDefault();
    if (!editingLevel4Cost) return;

    const plantationAreaHa = toNumberOrNull(String(editingLevel4Cost.plantationAreaHa));
    if (plantationAreaHa === null) {
      setLevel4CostError("Área de plantación inválida");
      sileo.warning({
        title: "Datos inválidos",
        description: "Área de plantación inválida.",
      });
      return;
    }

    const result = await requestJson<Level4AdministrativeCostItem>("/api/forest/config/level4-costs", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingLevel4Cost.id,
        level4Id: editingLevel4Cost.level4Id ?? editingLevel4Cost.level4?.id ?? "",
        code: editingLevel4Cost.code,
        plantationAreaHa,
        rotationPhase: toNullableString(editingLevel4Cost.rotationPhase ?? ""),
        accountingDocumentId: editingLevel4Cost.accountingDocumentId || null,
        isActive: editingLevel4Cost.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setLevel4CostError, result.error ?? "No fue posible actualizar el costo nivel 4");
      return;
    }

    showCrudSuccess("Costo nivel 4 actualizado");
    setEditingLevel4Cost(null);
    await loadLevel4Costs();
  }

  async function deleteLevel4Cost(id: string) {
    const result = await requestJson<{ id: string }>("/api/forest/config/level4-costs", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setLevel4CostError, result.error ?? "No fue posible eliminar el costo nivel 4");
      return;
    }

    showCrudSuccess("Costo nivel 4 eliminado");
    await loadLevel4Costs();
  }

  function toggleLevel4CostSort(nextSortBy: string) {
    if (!isLevel4CostSortKey(nextSortBy)) return;

    const isSameColumn = level4CostSortBy === nextSortBy;
    setLevel4CostSortBy(nextSortBy);
    setLevel4CostSortOrder(isSameColumn ? (level4CostSortOrder === "asc" ? "desc" : "asc") : "asc");
    setLevel4CostPage(1);
  }

  async function downloadLevel4CostExport(format: "csv" | "xlsx") {
    try {
      setLevel4CostExporting(true);
      setLevel4CostError(null);

      const params = new URLSearchParams({
        format,
        limit: String(level4CostExportLimit),
        sortBy: level4CostSortBy,
        sortOrder: level4CostSortOrder,
      });

      const trimmedSearch = debouncedLevel4CostSearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/forest/config/level4-costs/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar costos nivel 4");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `level4_costs.${format}`;

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
        description: `Se generó el archivo correctamente (máx. ${level4CostExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      showCrudError(setLevel4CostError, message);
    } finally {
      setLevel4CostExporting(false);
    }
  }

  async function onImportLevel4Costs(file: File) {
    try {
      setLevel4CostImporting(true);
      setLevel4CostError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/config/level4-costs/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar costos nivel 4");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; code?: string; error: string }>;
          }
        | undefined;

      await loadLevel4Costs();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

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
      showCrudError(setLevel4CostError, message);
    } finally {
      setLevel4CostImporting(false);
      if (importLevel4CostInputRef.current) {
        importLevel4CostInputRef.current.value = "";
      }
    }
  }

  async function createProductType(event: FormEvent) {
    event.preventDefault();
    if (!canCreateProductType) return;

    const result = await requestJson<ProductTypeItem>("/api/forest/config/product-types", {
      method: "POST",
      body: JSON.stringify({
        code: productTypeForm.code,
        name: productTypeForm.name,
        minLengthM: toNumberOrNull(productTypeForm.minLengthM),
        maxLengthM: toNumberOrNull(productTypeForm.maxLengthM),
        minSmallEndDiameterCm: toNumberOrNull(productTypeForm.minSmallEndDiameterCm),
        maxSmallEndDiameterCm: toNumberOrNull(productTypeForm.maxSmallEndDiameterCm),
        recommendedHarvestType: productTypeForm.recommendedHarvestType,
        isActive: productTypeForm.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setProductTypeError, result.error ?? "No fue posible crear el tipo de producto");
      return;
    }

    showCrudSuccess("Tipo de producto creado");
    setProductTypeForm({
      code: "",
      name: "",
      minLengthM: "",
      maxLengthM: "",
      minSmallEndDiameterCm: "",
      maxSmallEndDiameterCm: "",
      recommendedHarvestType: "MECANIZADA",
      isActive: true,
    });
    setProductTypePage(1);
    await loadProductTypes();
  }

  async function updateProductType(event: FormEvent) {
    event.preventDefault();
    if (!editingProductType) return;

    const result = await requestJson<ProductTypeItem>("/api/forest/config/product-types", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingProductType.id,
        code: editingProductType.code,
        name: editingProductType.name,
        minLengthM: editingProductType.minLengthM == null ? null : toNumberOrNull(String(editingProductType.minLengthM)),
        maxLengthM: editingProductType.maxLengthM == null ? null : toNumberOrNull(String(editingProductType.maxLengthM)),
        minSmallEndDiameterCm:
          editingProductType.minSmallEndDiameterCm == null
            ? null
            : toNumberOrNull(String(editingProductType.minSmallEndDiameterCm)),
        maxSmallEndDiameterCm:
          editingProductType.maxSmallEndDiameterCm == null
            ? null
            : toNumberOrNull(String(editingProductType.maxSmallEndDiameterCm)),
        recommendedHarvestType: editingProductType.recommendedHarvestType,
        isActive: editingProductType.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setProductTypeError, result.error ?? "No fue posible actualizar el tipo de producto");
      return;
    }

    showCrudSuccess("Tipo de producto actualizado");
    setEditingProductType(null);
    await loadProductTypes();
  }

  async function deleteProductType(id: string) {
    const result = await requestJson<{ id: string }>("/api/forest/config/product-types", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setProductTypeError, result.error ?? "No fue posible eliminar el tipo de producto");
      return;
    }

    showCrudSuccess("Tipo de producto eliminado");
    await loadProductTypes();
  }

  function toggleProductTypeSort(nextSortBy: string) {
    if (!isProductTypeSortKey(nextSortBy)) return;

    const isSameColumn = productTypeSortBy === nextSortBy;
    setProductTypeSortBy(nextSortBy);
    setProductTypeSortOrder(isSameColumn ? (productTypeSortOrder === "asc" ? "desc" : "asc") : "asc");
    setProductTypePage(1);
  }

  async function downloadProductTypeExport(format: "csv" | "xlsx") {
    try {
      setProductTypeExporting(true);
      setProductTypeError(null);

      const params = new URLSearchParams({
        format,
        limit: String(productTypeExportLimit),
        sortBy: productTypeSortBy,
        sortOrder: productTypeSortOrder,
      });

      const trimmedSearch = debouncedProductTypeSearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/forest/config/product-types/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar tipos de productos");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `product_types.${format}`;

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
        description: `Se generó el archivo correctamente (máx. ${productTypeExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      showCrudError(setProductTypeError, message);
    } finally {
      setProductTypeExporting(false);
    }
  }

  async function onImportProductTypes(file: File) {
    try {
      setProductTypeImporting(true);
      setProductTypeError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/config/product-types/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar tipos de productos");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; code?: string; error: string }>;
          }
        | undefined;

      await loadProductTypes();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

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
      showCrudError(setProductTypeError, message);
    } finally {
      setProductTypeImporting(false);
      if (importProductTypeInputRef.current) {
        importProductTypeInputRef.current.value = "";
      }
    }
  }

  async function createLandUseType(event: FormEvent) {
    event.preventDefault();
    if (!canCreateLandUse) return;

    const result = await requestJson<LandUseTypeItem>("/api/forest/config/land-use-types", {
      method: "POST",
      body: JSON.stringify({
        code: landUseForm.code,
        name: landUseForm.name,
        category: landUseForm.category,
        isProductive: landUseForm.isProductive,
        isActive: landUseForm.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setLandUseError, result.error ?? "No fue posible crear el uso de suelos");
      return;
    }

    showCrudSuccess("Uso de suelos creado");
    setLandUseForm({
      code: "",
      name: "",
      category: LAND_USE_CATEGORIES[0],
      isProductive: false,
      isActive: true,
    });
    setLandUsePage(1);
    await loadLandUseTypes();
  }

  async function updateLandUseType(event: FormEvent) {
    event.preventDefault();
    if (!editingLandUse) return;

    const result = await requestJson<LandUseTypeItem>("/api/forest/config/land-use-types", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingLandUse.id,
        code: editingLandUse.code,
        name: editingLandUse.name,
        category: editingLandUse.category,
        isProductive: editingLandUse.isProductive,
        isActive: editingLandUse.isActive,
      }),
    });

    if (!result.success) {
      showCrudError(setLandUseError, result.error ?? "No fue posible actualizar el uso de suelos");
      return;
    }

    showCrudSuccess("Uso de suelos actualizado");
    setEditingLandUse(null);
    await loadLandUseTypes();
  }

  async function deleteLandUseType(id: string) {
    const result = await requestJson<{ id: string }>("/api/forest/config/land-use-types", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    if (!result.success) {
      showCrudError(setLandUseError, result.error ?? "No fue posible eliminar el uso de suelos");
      return;
    }

    showCrudSuccess("Uso de suelos eliminado");
    await loadLandUseTypes();
  }

  function toggleLandUseSort(nextSortBy: string) {
    if (!isLandUseSortKey(nextSortBy)) return;

    const isSameColumn = landUseSortBy === nextSortBy;
    setLandUseSortBy(nextSortBy);
    setLandUseSortOrder(isSameColumn ? (landUseSortOrder === "asc" ? "desc" : "asc") : "asc");
    setLandUsePage(1);
  }

  async function downloadLandUseExport(format: "csv" | "xlsx") {
    try {
      setLandUseExporting(true);
      setLandUseError(null);

      const params = new URLSearchParams({
        format,
        limit: String(landUseExportLimit),
        sortBy: landUseSortBy,
        sortOrder: landUseSortOrder,
      });

      const trimmedSearch = debouncedLandUseSearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/forest/config/land-use-types/export?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No fue posible exportar usos de suelos");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `land_use_types.${format}`;

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
        description: `Se generó el archivo correctamente (máx. ${landUseExportLimit} registros).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      showCrudError(setLandUseError, message);
    } finally {
      setLandUseExporting(false);
    }
  }

  async function onImportLandUseTypes(file: File) {
    try {
      setLandUseImporting(true);
      setLandUseError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/forest/config/land-use-types/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No fue posible importar usos de suelos");
      }

      const result = payload?.data as
        | {
            created: number;
            updated: number;
            skipped: number;
            errors: Array<{ row: number; code?: string; error: string }>;
          }
        | undefined;

      await loadLandUseTypes();

      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      const description = `Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}`;

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
      showCrudError(setLandUseError, message);
    } finally {
      setLandUseImporting(false);
      if (importLandUseInputRef.current) {
        importLandUseInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Configuración forestal</h1>
        <p className="text-sm text-muted-foreground">Catálogos base para manejo, inventario, IMA, continentes, países, regiones, estados, municipios, ciudades, desarrollo local, espaciamiento, costos nivel 4, tipos de productos, uso de suelos, especies vegetales, procedencias y materiales vegetales.</p>
      </div>

      {globalMessage ? <p className="rounded-md border px-3 py-2 text-sm">{globalMessage}</p> : null}

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Esquemas de manejo" subtitle="CRUD de catálogo ManagementScheme" />

        <div className="flex flex-wrap gap-2">
          <input
            className="hidden"
            ref={importSchemeInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportSchemes(file);
            }}
          />
          <button
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            disabled={schemeImporting}
            onClick={() => importSchemeInputRef.current?.click()}
            type="button"
          >
            {schemeImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            disabled={schemeExporting}
            onClick={() => void downloadSchemeExport("csv")}
            type="button"
          >
            {schemeExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            disabled={schemeExporting}
            onClick={() => void downloadSchemeExport("xlsx")}
            type="button"
          >
            {schemeExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>

        <form className="grid gap-3 md:grid-cols-4" onSubmit={createScheme}>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={schemeForm.code} onChange={(event) => setSchemeForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2 md:col-span-2" placeholder="Nombre" value={schemeForm.name} onChange={(event) => setSchemeForm((prev) => ({ ...prev, name: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={schemeForm.isActive} onChange={(event) => setSchemeForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateScheme} type="submit">
            Crear esquema
          </button>
        </form>

        <TableToolbar
          canExport
          exportLimit={schemeExportLimit}
          limit={schemePagination.limit}
          onExportLimitChange={setSchemeExportLimit}
          onLimitChange={(value) => {
            setSchemePage(1);
            setSchemePagination((prev) => ({ ...prev, limit: value }));
          }}
          onSearchChange={(value) => {
            setSchemePage(1);
            setSchemeSearch(value);
          }}
          search={schemeSearch}
          searchPlaceholder="Buscar por código o nombre"
          total={schemePagination.total}
        />
        {schemeError ? <p className="text-sm text-red-600">{schemeError}</p> : null}
        {schemeLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <SortableHeader label="Código" sortKey="code" sortBy={schemeSortBy} sortOrder={schemeSortOrder} onToggle={toggleSchemeSort} />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader label="Nombre" sortKey="name" sortBy={schemeSortBy} sortOrder={schemeSortOrder} onToggle={toggleSchemeSort} />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader label="Activo" sortKey="isActive" sortBy={schemeSortBy} sortOrder={schemeSortOrder} onToggle={toggleSchemeSort} />
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {schemeItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingScheme(item)} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteScheme(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={schemeLoading}
          onNext={() => setSchemePage((prev) => Math.min(schemePagination.totalPages, prev + 1))}
          onPrev={() => setSchemePage((prev) => Math.max(1, prev - 1))}
          page={schemePagination.page}
          total={schemePagination.total}
          totalPages={Math.max(1, schemePagination.totalPages)}
        />

        {editingScheme ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-4" onSubmit={updateScheme}>
            <input className="rounded-md border px-3 py-2" value={editingScheme.code} onChange={(event) => setEditingScheme((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2 md:col-span-2" value={editingScheme.name} onChange={(event) => setEditingScheme((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingScheme.isActive} onChange={(event) => setEditingScheme((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingScheme(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Tipos de inventario" subtitle="CRUD de catálogo ForestInventoryTypeCatalog" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportInventoryTypes(file);
            }}
            ref={importInventoryInputRef}
            type="file"
          />
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={inventoryImporting}
            onClick={() => importInventoryInputRef.current?.click()}
            type="button"
          >
            {inventoryImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={inventoryExporting}
            onClick={() => void downloadInventoryExport("csv")}
            type="button"
          >
            {inventoryExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={inventoryExporting}
            onClick={() => void downloadInventoryExport("xlsx")}
            type="button"
          >
            {inventoryExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={createInventoryType}>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={inventoryForm.code} onChange={(event) => setInventoryForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2 md:col-span-2" placeholder="Nombre" value={inventoryForm.name} onChange={(event) => setInventoryForm((prev) => ({ ...prev, name: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={inventoryForm.isActive} onChange={(event) => setInventoryForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateInventory} type="submit">
            Crear tipo
          </button>
        </form>

        <TableToolbar
          canExport
          exportLimit={inventoryExportLimit}
          limit={inventoryPagination.limit}
          onExportLimitChange={setInventoryExportLimit}
          onLimitChange={(value) => {
            setInventoryPage(1);
            setInventoryPagination((prev) => ({ ...prev, limit: value }));
          }}
          onSearchChange={(value) => {
            setInventoryPage(1);
            setInventorySearch(value);
          }}
          search={inventorySearch}
          searchPlaceholder="Buscar por código o nombre"
          total={inventoryPagination.total}
        />
        {inventoryError ? <p className="text-sm text-red-600">{inventoryError}</p> : null}
        {inventoryLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Código"
                    onToggle={toggleInventorySort}
                    sortBy={inventorySortBy}
                    sortKey="code"
                    sortOrder={inventorySortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Nombre"
                    onToggle={toggleInventorySort}
                    sortBy={inventorySortBy}
                    sortKey="name"
                    sortOrder={inventorySortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Activo"
                    onToggle={toggleInventorySort}
                    sortBy={inventorySortBy}
                    sortKey="isActive"
                    sortOrder={inventorySortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inventoryItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingInventory(item)} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteInventoryType(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={inventoryLoading}
          onNext={() => setInventoryPage((prev) => Math.min(inventoryPagination.totalPages, prev + 1))}
          onPrev={() => setInventoryPage((prev) => Math.max(1, prev - 1))}
          page={inventoryPagination.page}
          total={inventoryPagination.total}
          totalPages={Math.max(1, inventoryPagination.totalPages)}
        />

        {editingInventory ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-4" onSubmit={updateInventoryType}>
            <input className="rounded-md border px-3 py-2" value={editingInventory.code} onChange={(event) => setEditingInventory((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2 md:col-span-2" value={editingInventory.name} onChange={(event) => setEditingInventory((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingInventory.isActive} onChange={(event) => setEditingInventory((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingInventory(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Clases IMA" subtitle="CRUD de catálogo ImaClass" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportImaClasses(file);
            }}
            ref={importImaInputRef}
            type="file"
          />
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={imaImporting}
            onClick={() => importImaInputRef.current?.click()}
            type="button"
          >
            {imaImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={imaExporting}
            onClick={() => void downloadImaExport("csv")}
            type="button"
          >
            {imaExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={imaExporting}
            onClick={() => void downloadImaExport("xlsx")}
            type="button"
          >
            {imaExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
        <form className="grid gap-3 md:grid-cols-6" onSubmit={createImaClass}>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={imaForm.code} onChange={(event) => setImaForm((prev) => ({ ...prev, code: event.target.value }))} />
          <select className="rounded-md border px-3 py-2" value={imaForm.classification} onChange={(event) => setImaForm((prev) => ({ ...prev, classification: event.target.value as ImaClassification }))}>
            <option value="I">I</option>
            <option value="II">II</option>
            <option value="III">III</option>
            <option value="IV">IV</option>
            <option value="V">V</option>
          </select>
          <input className="rounded-md border px-3 py-2 md:col-span-2" placeholder="Nombre" value={imaForm.name} onChange={(event) => setImaForm((prev) => ({ ...prev, name: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Rango mínimo" value={imaForm.rangeMin} onChange={(event) => setImaForm((prev) => ({ ...prev, rangeMin: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Rango máximo" value={imaForm.rangeMax} onChange={(event) => setImaForm((prev) => ({ ...prev, rangeMax: event.target.value }))} />
          <textarea className="rounded-md border px-3 py-2 md:col-span-5" placeholder="Descripción" value={imaForm.description} onChange={(event) => setImaForm((prev) => ({ ...prev, description: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={imaForm.isActive} onChange={(event) => setImaForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateIma} type="submit">
            Crear clase IMA
          </button>
        </form>

        <TableToolbar
          canExport
          exportLimit={imaExportLimit}
          limit={imaPagination.limit}
          onExportLimitChange={setImaExportLimit}
          onLimitChange={(value) => {
            setImaPage(1);
            setImaPagination((prev) => ({ ...prev, limit: value }));
          }}
          onSearchChange={(value) => {
            setImaPage(1);
            setImaSearch(value);
          }}
          search={imaSearch}
          searchPlaceholder="Buscar por código, nombre o descripción"
          total={imaPagination.total}
        />
        {imaError ? <p className="text-sm text-red-600">{imaError}</p> : null}
        {imaLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Código"
                    onToggle={toggleImaSort}
                    sortBy={imaSortBy}
                    sortKey="code"
                    sortOrder={imaSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Clase"
                    onToggle={toggleImaSort}
                    sortBy={imaSortBy}
                    sortKey="classification"
                    sortOrder={imaSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Nombre"
                    onToggle={toggleImaSort}
                    sortBy={imaSortBy}
                    sortKey="name"
                    sortOrder={imaSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Rango</th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Activo"
                    onToggle={toggleImaSort}
                    sortBy={imaSortBy}
                    sortKey="isActive"
                    sortOrder={imaSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {imaItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.classification}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">
                    {item.rangeMin ?? "-"} / {item.rangeMax ?? "-"}
                  </td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingIma(item)} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteImaClass(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={imaLoading}
          onNext={() => setImaPage((prev) => Math.min(imaPagination.totalPages, prev + 1))}
          onPrev={() => setImaPage((prev) => Math.max(1, prev - 1))}
          page={imaPagination.page}
          total={imaPagination.total}
          totalPages={Math.max(1, imaPagination.totalPages)}
        />

        {editingIma ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-6" onSubmit={updateImaClass}>
            <input className="rounded-md border px-3 py-2" value={editingIma.code} onChange={(event) => setEditingIma((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <select className="rounded-md border px-3 py-2" value={editingIma.classification} onChange={(event) => setEditingIma((prev) => (prev ? { ...prev, classification: event.target.value as ImaClassification } : prev))}>
              <option value="I">I</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
              <option value="V">V</option>
            </select>
            <input className="rounded-md border px-3 py-2 md:col-span-2" value={editingIma.name} onChange={(event) => setEditingIma((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingIma.rangeMin ?? ""} onChange={(event) => setEditingIma((prev) => (prev ? { ...prev, rangeMin: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingIma.rangeMax ?? ""} onChange={(event) => setEditingIma((prev) => (prev ? { ...prev, rangeMax: event.target.value } : prev))} />
            <textarea className="rounded-md border px-3 py-2 md:col-span-5" value={editingIma.description ?? ""} onChange={(event) => setEditingIma((prev) => (prev ? { ...prev, description: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingIma.isActive} onChange={(event) => setEditingIma((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingIma(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Espaciamientos" subtitle="CRUD de catálogo Spacing" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportSpacings(file);
            }}
            ref={importSpacingInputRef}
            type="file"
          />
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={spacingImporting}
            onClick={() => importSpacingInputRef.current?.click()}
            type="button"
          >
            {spacingImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={spacingExporting}
            onClick={() => void downloadSpacingExport("csv")}
            type="button"
          >
            {spacingExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={spacingExporting}
            onClick={() => void downloadSpacingExport("xlsx")}
            type="button"
          >
            {spacingExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
        <form className="grid gap-3 md:grid-cols-6" onSubmit={createSpacing}>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={spacingForm.code} onChange={(event) => setSpacingForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={spacingForm.name} onChange={(event) => setSpacingForm((prev) => ({ ...prev, name: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Entre filas (m)" value={spacingForm.betweenRowsM} onChange={(event) => setSpacingForm((prev) => ({ ...prev, betweenRowsM: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Entre plantas (m)" value={spacingForm.betweenTreesM} onChange={(event) => setSpacingForm((prev) => ({ ...prev, betweenTreesM: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Densidad/ha" value={spacingForm.treeDensityPerHa} onChange={(event) => setSpacingForm((prev) => ({ ...prev, treeDensityPerHa: event.target.value }))} />
          <input className="rounded-md border px-3 py-2 md:col-span-4" placeholder="Descripción" value={spacingForm.description} onChange={(event) => setSpacingForm((prev) => ({ ...prev, description: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={spacingForm.isActive} onChange={(event) => setSpacingForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateSpacing} type="submit">
            Crear espaciamiento
          </button>
        </form>

        <TableToolbar
          canExport
          exportLimit={spacingExportLimit}
          limit={spacingPagination.limit}
          onExportLimitChange={setSpacingExportLimit}
          onLimitChange={(value) => {
            setSpacingPage(1);
            setSpacingPagination((prev) => ({ ...prev, limit: value }));
          }}
          onSearchChange={(value) => {
            setSpacingPage(1);
            setSpacingSearch(value);
          }}
          search={spacingSearch}
          searchPlaceholder="Buscar por código o nombre"
          total={spacingPagination.total}
        />
        {spacingError ? <p className="text-sm text-red-600">{spacingError}</p> : null}
        {spacingLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Código"
                    onToggle={toggleSpacingSort}
                    sortBy={spacingSortBy}
                    sortKey="code"
                    sortOrder={spacingSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Nombre"
                    onToggle={toggleSpacingSort}
                    sortBy={spacingSortBy}
                    sortKey="name"
                    sortOrder={spacingSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Entre filas</th>
                <th className="px-3 py-2 text-left">Entre plantas</th>
                <th className="px-3 py-2 text-left">Densidad/ha</th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Activo"
                    onToggle={toggleSpacingSort}
                    sortBy={spacingSortBy}
                    sortKey="isActive"
                    sortOrder={spacingSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {spacingItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.betweenRowsM ?? "-"}</td>
                  <td className="px-3 py-2">{item.betweenTreesM ?? "-"}</td>
                  <td className="px-3 py-2">{item.treeDensityPerHa ?? "-"}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingSpacing(item)} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteSpacing(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={spacingLoading}
          onNext={() => setSpacingPage((prev) => Math.min(spacingPagination.totalPages, prev + 1))}
          onPrev={() => setSpacingPage((prev) => Math.max(1, prev - 1))}
          page={spacingPagination.page}
          total={spacingPagination.total}
          totalPages={Math.max(1, spacingPagination.totalPages)}
        />

        {editingSpacing ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-6" onSubmit={updateSpacing}>
            <input className="rounded-md border px-3 py-2" value={editingSpacing.code} onChange={(event) => setEditingSpacing((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingSpacing.name} onChange={(event) => setEditingSpacing((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingSpacing.betweenRowsM ?? ""} onChange={(event) => setEditingSpacing((prev) => (prev ? { ...prev, betweenRowsM: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingSpacing.betweenTreesM ?? ""} onChange={(event) => setEditingSpacing((prev) => (prev ? { ...prev, betweenTreesM: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingSpacing.treeDensityPerHa ?? ""} onChange={(event) => setEditingSpacing((prev) => (prev ? { ...prev, treeDensityPerHa: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2 md:col-span-4" value={editingSpacing.description ?? ""} onChange={(event) => setEditingSpacing((prev) => (prev ? { ...prev, description: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingSpacing.isActive} onChange={(event) => setEditingSpacing((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingSpacing(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Costos nivel 4" subtitle="CRUD de catálogo Level4AdministrativeCost" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportLevel4Costs(file);
            }}
            ref={importLevel4CostInputRef}
            type="file"
          />
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={level4CostImporting}
            onClick={() => importLevel4CostInputRef.current?.click()}
            type="button"
          >
            {level4CostImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={level4CostExporting}
            onClick={() => void downloadLevel4CostExport("csv")}
            type="button"
          >
            {level4CostExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={level4CostExporting}
            onClick={() => void downloadLevel4CostExport("xlsx")}
            type="button"
          >
            {level4CostExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
        <form className="grid gap-3 md:grid-cols-6" onSubmit={createLevel4Cost}>
          <select className="rounded-md border px-3 py-2" value={level4CostForm.level4Id} onChange={(event) => setLevel4CostForm((prev) => ({ ...prev, level4Id: event.target.value }))}>
            <option value="">Seleccione unidad nivel 4</option>
            {level4Options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={level4CostForm.code} onChange={(event) => setLevel4CostForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Área plantación (ha)" value={level4CostForm.plantationAreaHa} onChange={(event) => setLevel4CostForm((prev) => ({ ...prev, plantationAreaHa: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Fase de rotación" value={level4CostForm.rotationPhase} onChange={(event) => setLevel4CostForm((prev) => ({ ...prev, rotationPhase: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Documento contable (UUID)" value={level4CostForm.accountingDocumentId} onChange={(event) => setLevel4CostForm((prev) => ({ ...prev, accountingDocumentId: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={level4CostForm.isActive} onChange={(event) => setLevel4CostForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateLevel4Cost} type="submit">
            Crear costo
          </button>
        </form>

        {level4Options.length === 0 ? <p className="text-xs text-muted-foreground">No hay unidades nivel 4 cargadas. Debes cargar unidades para registrar costos.</p> : null}

        <TableToolbar
          canExport
          exportLimit={level4CostExportLimit}
          limit={level4CostPagination.limit}
          onExportLimitChange={setLevel4CostExportLimit}
          onLimitChange={(value) => {
            setLevel4CostPage(1);
            setLevel4CostPagination((prev) => ({ ...prev, limit: value }));
          }}
          onSearchChange={(value) => {
            setLevel4CostPage(1);
            setLevel4CostSearch(value);
          }}
          search={level4CostSearch}
          searchPlaceholder="Buscar por código, fase o unidad"
          total={level4CostPagination.total}
        />
        {level4CostError ? <p className="text-sm text-red-600">{level4CostError}</p> : null}
        {level4CostLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">Unidad nivel 4</th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Código"
                    onToggle={toggleLevel4CostSort}
                    sortBy={level4CostSortBy}
                    sortKey="code"
                    sortOrder={level4CostSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Área (ha)"
                    onToggle={toggleLevel4CostSort}
                    sortBy={level4CostSortBy}
                    sortKey="plantationAreaHa"
                    sortOrder={level4CostSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Fase"
                    onToggle={toggleLevel4CostSort}
                    sortBy={level4CostSortBy}
                    sortKey="rotationPhase"
                    sortOrder={level4CostSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Documento</th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Activo"
                    onToggle={toggleLevel4CostSort}
                    sortBy={level4CostSortBy}
                    sortKey="isActive"
                    sortOrder={level4CostSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {level4CostItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.level4 ? `${item.level4.code} - ${item.level4.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.plantationAreaHa}</td>
                  <td className="px-3 py-2">{item.rotationPhase ?? "-"}</td>
                  <td className="px-3 py-2">
                    {item.accountingDocument ? `${item.accountingDocument.code} - ${item.accountingDocument.documentNumber}` : "-"}
                  </td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingLevel4Cost({ ...item, level4Id: item.level4Id ?? item.level4?.id ?? "" })} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteLevel4Cost(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={level4CostLoading}
          onNext={() => setLevel4CostPage((prev) => Math.min(level4CostPagination.totalPages, prev + 1))}
          onPrev={() => setLevel4CostPage((prev) => Math.max(1, prev - 1))}
          page={level4CostPagination.page}
          total={level4CostPagination.total}
          totalPages={Math.max(1, level4CostPagination.totalPages)}
        />

        {editingLevel4Cost ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-6" onSubmit={updateLevel4Cost}>
            <select className="rounded-md border px-3 py-2" value={editingLevel4Cost.level4Id ?? editingLevel4Cost.level4?.id ?? ""} onChange={(event) => setEditingLevel4Cost((prev) => (prev ? { ...prev, level4Id: event.target.value } : prev))}>
              <option value="">Seleccione unidad nivel 4</option>
              {level4Options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2" value={editingLevel4Cost.code} onChange={(event) => setEditingLevel4Cost((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingLevel4Cost.plantationAreaHa} onChange={(event) => setEditingLevel4Cost((prev) => (prev ? { ...prev, plantationAreaHa: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingLevel4Cost.rotationPhase ?? ""} onChange={(event) => setEditingLevel4Cost((prev) => (prev ? { ...prev, rotationPhase: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingLevel4Cost.accountingDocumentId ?? ""} onChange={(event) => setEditingLevel4Cost((prev) => (prev ? { ...prev, accountingDocumentId: event.target.value || null } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingLevel4Cost.isActive} onChange={(event) => setEditingLevel4Cost((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingLevel4Cost(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Tipos de productos" subtitle="CRUD de catálogo ProductType" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportProductTypes(file);
            }}
            ref={importProductTypeInputRef}
            type="file"
          />
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={productTypeImporting}
            onClick={() => importProductTypeInputRef.current?.click()}
            type="button"
          >
            {productTypeImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={productTypeExporting}
            onClick={() => void downloadProductTypeExport("csv")}
            type="button"
          >
            {productTypeExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={productTypeExporting}
            onClick={() => void downloadProductTypeExport("xlsx")}
            type="button"
          >
            {productTypeExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
        <form className="grid gap-3 md:grid-cols-6" onSubmit={createProductType}>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={productTypeForm.code} onChange={(event) => setProductTypeForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={productTypeForm.name} onChange={(event) => setProductTypeForm((prev) => ({ ...prev, name: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Longitud mín (m)" value={productTypeForm.minLengthM} onChange={(event) => setProductTypeForm((prev) => ({ ...prev, minLengthM: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Longitud máx (m)" value={productTypeForm.maxLengthM} onChange={(event) => setProductTypeForm((prev) => ({ ...prev, maxLengthM: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Diámetro mín (cm)" value={productTypeForm.minSmallEndDiameterCm} onChange={(event) => setProductTypeForm((prev) => ({ ...prev, minSmallEndDiameterCm: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Diámetro máx (cm)" value={productTypeForm.maxSmallEndDiameterCm} onChange={(event) => setProductTypeForm((prev) => ({ ...prev, maxSmallEndDiameterCm: event.target.value }))} />
          <select className="rounded-md border px-3 py-2" value={productTypeForm.recommendedHarvestType} onChange={(event) => setProductTypeForm((prev) => ({ ...prev, recommendedHarvestType: event.target.value as RecommendedHarvestType }))}>
            <option value="MECANIZADA">MECANIZADA</option>
            <option value="MANUAL">MANUAL</option>
          </select>
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={productTypeForm.isActive} onChange={(event) => setProductTypeForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateProductType} type="submit">
            Crear tipo
          </button>
        </form>

        <TableToolbar
          canExport
          exportLimit={productTypeExportLimit}
          limit={productTypePagination.limit}
          onExportLimitChange={setProductTypeExportLimit}
          onLimitChange={(value) => {
            setProductTypePage(1);
            setProductTypePagination((prev) => ({ ...prev, limit: value }));
          }}
          onSearchChange={(value) => {
            setProductTypePage(1);
            setProductTypeSearch(value);
          }}
          search={productTypeSearch}
          searchPlaceholder="Buscar por código o nombre"
          total={productTypePagination.total}
        />
        {productTypeError ? <p className="text-sm text-red-600">{productTypeError}</p> : null}
        {productTypeLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Código"
                    onToggle={toggleProductTypeSort}
                    sortBy={productTypeSortBy}
                    sortKey="code"
                    sortOrder={productTypeSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Nombre"
                    onToggle={toggleProductTypeSort}
                    sortBy={productTypeSortBy}
                    sortKey="name"
                    sortOrder={productTypeSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Longitud</th>
                <th className="px-3 py-2 text-left">Diámetro</th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Corte"
                    onToggle={toggleProductTypeSort}
                    sortBy={productTypeSortBy}
                    sortKey="recommendedHarvestType"
                    sortOrder={productTypeSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Activo"
                    onToggle={toggleProductTypeSort}
                    sortBy={productTypeSortBy}
                    sortKey="isActive"
                    sortOrder={productTypeSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productTypeItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">
                    {(item.minLengthM ?? "-")} / {(item.maxLengthM ?? "-")}
                  </td>
                  <td className="px-3 py-2">
                    {(item.minSmallEndDiameterCm ?? "-")} / {(item.maxSmallEndDiameterCm ?? "-")}
                  </td>
                  <td className="px-3 py-2">{item.recommendedHarvestType}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingProductType(item)} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteProductType(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={productTypeLoading}
          onNext={() => setProductTypePage((prev) => Math.min(productTypePagination.totalPages, prev + 1))}
          onPrev={() => setProductTypePage((prev) => Math.max(1, prev - 1))}
          page={productTypePagination.page}
          total={productTypePagination.total}
          totalPages={Math.max(1, productTypePagination.totalPages)}
        />

        {editingProductType ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-6" onSubmit={updateProductType}>
            <input className="rounded-md border px-3 py-2" value={editingProductType.code} onChange={(event) => setEditingProductType((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingProductType.name} onChange={(event) => setEditingProductType((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingProductType.minLengthM ?? ""} onChange={(event) => setEditingProductType((prev) => (prev ? { ...prev, minLengthM: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingProductType.maxLengthM ?? ""} onChange={(event) => setEditingProductType((prev) => (prev ? { ...prev, maxLengthM: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingProductType.minSmallEndDiameterCm ?? ""} onChange={(event) => setEditingProductType((prev) => (prev ? { ...prev, minSmallEndDiameterCm: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingProductType.maxSmallEndDiameterCm ?? ""} onChange={(event) => setEditingProductType((prev) => (prev ? { ...prev, maxSmallEndDiameterCm: event.target.value } : prev))} />
            <select className="rounded-md border px-3 py-2" value={editingProductType.recommendedHarvestType} onChange={(event) => setEditingProductType((prev) => (prev ? { ...prev, recommendedHarvestType: event.target.value as RecommendedHarvestType } : prev))}>
              <option value="MECANIZADA">MECANIZADA</option>
              <option value="MANUAL">MANUAL</option>
            </select>
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingProductType.isActive} onChange={(event) => setEditingProductType((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingProductType(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Uso de suelos" subtitle="CRUD de catálogo LandUseType" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportLandUseTypes(file);
            }}
            ref={importLandUseInputRef}
            type="file"
          />
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={landUseImporting}
            onClick={() => importLandUseInputRef.current?.click()}
            type="button"
          >
            {landUseImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={landUseExporting}
            onClick={() => void downloadLandUseExport("csv")}
            type="button"
          >
            {landUseExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={landUseExporting}
            onClick={() => void downloadLandUseExport("xlsx")}
            type="button"
          >
            {landUseExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
        <form className="grid gap-3 md:grid-cols-7" onSubmit={createLandUseType}>
          <select className="rounded-md border px-3 py-2" value={landUseForm.category} onChange={(event) => setLandUseForm((prev) => ({ ...prev, category: event.target.value as LandUseCategory }))}>
            {LAND_USE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={landUseForm.code} onChange={(event) => setLandUseForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={landUseForm.name} onChange={(event) => setLandUseForm((prev) => ({ ...prev, name: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={landUseForm.isProductive} onChange={(event) => setLandUseForm((prev) => ({ ...prev, isProductive: event.target.checked }))} type="checkbox" />
            Productivo
          </label>
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={landUseForm.isActive} onChange={(event) => setLandUseForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateLandUse} type="submit">
            Crear uso
          </button>
        </form>

        <TableToolbar
          canExport
          exportLimit={landUseExportLimit}
          limit={landUsePagination.limit}
          onExportLimitChange={setLandUseExportLimit}
          onLimitChange={(value) => {
            setLandUsePage(1);
            setLandUsePagination((prev) => ({ ...prev, limit: value }));
          }}
          onSearchChange={(value) => {
            setLandUsePage(1);
            setLandUseSearch(value);
          }}
          search={landUseSearch}
          searchPlaceholder="Buscar por código, nombre o categoría"
          total={landUsePagination.total}
        />
        {landUseError ? <p className="text-sm text-red-600">{landUseError}</p> : null}
        {landUseLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Código"
                    onToggle={toggleLandUseSort}
                    sortBy={landUseSortBy}
                    sortKey="code"
                    sortOrder={landUseSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Nombre"
                    onToggle={toggleLandUseSort}
                    sortBy={landUseSortBy}
                    sortKey="name"
                    sortOrder={landUseSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Categoría"
                    onToggle={toggleLandUseSort}
                    sortBy={landUseSortBy}
                    sortKey="category"
                    sortOrder={landUseSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Productivo"
                    onToggle={toggleLandUseSort}
                    sortBy={landUseSortBy}
                    sortKey="isProductive"
                    sortOrder={landUseSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Activo"
                    onToggle={toggleLandUseSort}
                    sortBy={landUseSortBy}
                    sortKey="isActive"
                    sortOrder={landUseSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {landUseItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.category}</td>
                  <td className="px-3 py-2">{item.isProductive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingLandUse(item)} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteLandUseType(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={landUseLoading}
          onNext={() => setLandUsePage((prev) => Math.min(landUsePagination.totalPages, prev + 1))}
          onPrev={() => setLandUsePage((prev) => Math.max(1, prev - 1))}
          page={landUsePagination.page}
          total={landUsePagination.total}
          totalPages={Math.max(1, landUsePagination.totalPages)}
        />

        {editingLandUse ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-7" onSubmit={updateLandUseType}>
            <select className="rounded-md border px-3 py-2" value={editingLandUse.category} onChange={(event) => setEditingLandUse((prev) => (prev ? { ...prev, category: event.target.value as LandUseCategory } : prev))}>
              {LAND_USE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2" value={editingLandUse.code} onChange={(event) => setEditingLandUse((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingLandUse.name} onChange={(event) => setEditingLandUse((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingLandUse.isProductive} onChange={(event) => setEditingLandUse((prev) => (prev ? { ...prev, isProductive: event.target.checked } : prev))} type="checkbox" />
              Productivo
            </label>
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingLandUse.isActive} onChange={(event) => setEditingLandUse((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingLandUse(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Especies vegetales" subtitle="CRUD de catálogo Species" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportSpecies(file);
            }}
            ref={importSpeciesInputRef}
            type="file"
          />
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={speciesImporting}
            onClick={() => importSpeciesInputRef.current?.click()}
            type="button"
          >
            {speciesImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={speciesExporting}
            onClick={() => void downloadSpeciesExport("csv")}
            type="button"
          >
            {speciesExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={speciesExporting}
            onClick={() => void downloadSpeciesExport("xlsx")}
            type="button"
          >
            {speciesExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={createSpecies}>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={speciesForm.code} onChange={(event) => setSpeciesForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2 md:col-span-2" placeholder="Nombre científico" value={speciesForm.scientificName} onChange={(event) => setSpeciesForm((prev) => ({ ...prev, scientificName: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={speciesForm.isActive} onChange={(event) => setSpeciesForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <input className="rounded-md border px-3 py-2" placeholder="Nombre común" value={speciesForm.commonName} onChange={(event) => setSpeciesForm((prev) => ({ ...prev, commonName: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Género" value={speciesForm.genus} onChange={(event) => setSpeciesForm((prev) => ({ ...prev, genus: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Familia" value={speciesForm.family} onChange={(event) => setSpeciesForm((prev) => ({ ...prev, family: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Orden taxonómico" value={speciesForm.taxonomicOrder} onChange={(event) => setSpeciesForm((prev) => ({ ...prev, taxonomicOrder: event.target.value }))} />
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateSpecies} type="submit">
            Crear especie
          </button>
        </form>

        <TableToolbar
          canExport
          exportLimit={speciesExportLimit}
          limit={speciesPagination.limit}
          onExportLimitChange={setSpeciesExportLimit}
          onLimitChange={(value) => {
            setSpeciesPage(1);
            setSpeciesPagination((prev) => ({ ...prev, limit: value }));
          }}
          onSearchChange={(value) => {
            setSpeciesPage(1);
            setSpeciesSearch(value);
          }}
          search={speciesSearch}
          searchPlaceholder="Buscar por código, nombre científico o común"
          total={speciesPagination.total}
        />
        {speciesError ? <p className="text-sm text-red-600">{speciesError}</p> : null}
        {speciesLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Código"
                    onToggle={toggleSpeciesSort}
                    sortBy={speciesSortBy}
                    sortKey="code"
                    sortOrder={speciesSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Nombre científico"
                    onToggle={toggleSpeciesSort}
                    sortBy={speciesSortBy}
                    sortKey="scientificName"
                    sortOrder={speciesSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Nombre común"
                    onToggle={toggleSpeciesSort}
                    sortBy={speciesSortBy}
                    sortKey="commonName"
                    sortOrder={speciesSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Activo"
                    onToggle={toggleSpeciesSort}
                    sortBy={speciesSortBy}
                    sortKey="isActive"
                    sortOrder={speciesSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {speciesItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.scientificName}</td>
                  <td className="px-3 py-2">{item.commonName ?? "-"}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingSpecies(item)} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteSpecies(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={speciesLoading}
          onNext={() => setSpeciesPage((prev) => Math.min(speciesPagination.totalPages, prev + 1))}
          onPrev={() => setSpeciesPage((prev) => Math.max(1, prev - 1))}
          page={speciesPagination.page}
          total={speciesPagination.total}
          totalPages={Math.max(1, speciesPagination.totalPages)}
        />

        {editingSpecies ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-4" onSubmit={updateSpecies}>
            <input className="rounded-md border px-3 py-2" value={editingSpecies.code} onChange={(event) => setEditingSpecies((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2 md:col-span-2" value={editingSpecies.scientificName} onChange={(event) => setEditingSpecies((prev) => (prev ? { ...prev, scientificName: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingSpecies.isActive} onChange={(event) => setEditingSpecies((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <input className="rounded-md border px-3 py-2" value={editingSpecies.commonName ?? ""} onChange={(event) => setEditingSpecies((prev) => (prev ? { ...prev, commonName: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingSpecies.genus ?? ""} onChange={(event) => setEditingSpecies((prev) => (prev ? { ...prev, genus: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingSpecies.family ?? ""} onChange={(event) => setEditingSpecies((prev) => (prev ? { ...prev, family: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingSpecies.taxonomicOrder ?? ""} onChange={(event) => setEditingSpecies((prev) => (prev ? { ...prev, taxonomicOrder: event.target.value } : prev))} />
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingSpecies(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Procedencias" subtitle="CRUD de catálogo Provenance" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportProvenances(file);
            }}
            ref={importProvenanceInputRef}
            type="file"
          />
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={provenanceImporting}
            onClick={() => importProvenanceInputRef.current?.click()}
            type="button"
          >
            {provenanceImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={provenanceExporting}
            onClick={() => void downloadProvenanceExport("csv")}
            type="button"
          >
            {provenanceExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={provenanceExporting}
            onClick={() => void downloadProvenanceExport("xlsx")}
            type="button"
          >
            {provenanceExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={createProvenance}>
          <select className="rounded-md border px-3 py-2" value={provenanceForm.countryId} onChange={(event) => setProvenanceForm((prev) => ({ ...prev, countryId: event.target.value }))}>
            <option value="">Seleccione país</option>
            {countryOptions.map((country) => (
              <option key={country.id} value={country.id}>
                {country.code} - {country.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={provenanceForm.code} onChange={(event) => setProvenanceForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={provenanceForm.name} onChange={(event) => setProvenanceForm((prev) => ({ ...prev, name: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={provenanceForm.isActive} onChange={(event) => setProvenanceForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateProvenance} type="submit">
            Crear procedencia
          </button>
        </form>

        {countryOptions.length === 0 ? <p className="text-xs text-muted-foreground">No hay países activos cargados. Debes cargar países para registrar procedencias.</p> : null}

        <TableToolbar
          canExport
          exportLimit={provenanceExportLimit}
          limit={provenancePagination.limit}
          onExportLimitChange={setProvenanceExportLimit}
          onLimitChange={(value) => {
            setProvenancePage(1);
            setProvenancePagination((prev) => ({ ...prev, limit: value }));
          }}
          onSearchChange={(value) => {
            setProvenancePage(1);
            setProvenanceSearch(value);
          }}
          search={provenanceSearch}
          searchPlaceholder="Buscar por código, nombre o país"
          total={provenancePagination.total}
        />
        {provenanceError ? <p className="text-sm text-red-600">{provenanceError}</p> : null}
        {provenanceLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="País"
                    onToggle={toggleProvenanceSort}
                    sortBy={provenanceSortBy}
                    sortKey="countryName"
                    sortOrder={provenanceSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Código"
                    onToggle={toggleProvenanceSort}
                    sortBy={provenanceSortBy}
                    sortKey="code"
                    sortOrder={provenanceSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Nombre"
                    onToggle={toggleProvenanceSort}
                    sortBy={provenanceSortBy}
                    sortKey="name"
                    sortOrder={provenanceSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Activo"
                    onToggle={toggleProvenanceSort}
                    sortBy={provenanceSortBy}
                    sortKey="isActive"
                    sortOrder={provenanceSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {provenanceItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.country ? `${item.country.code} - ${item.country.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingProvenance(item)} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteProvenance(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={provenanceLoading}
          onNext={() => setProvenancePage((prev) => Math.min(provenancePagination.totalPages, prev + 1))}
          onPrev={() => setProvenancePage((prev) => Math.max(1, prev - 1))}
          page={provenancePagination.page}
          total={provenancePagination.total}
          totalPages={Math.max(1, provenancePagination.totalPages)}
        />

        {editingProvenance ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-4" onSubmit={updateProvenance}>
            <select className="rounded-md border px-3 py-2" value={editingProvenance.countryId} onChange={(event) => setEditingProvenance((prev) => (prev ? { ...prev, countryId: event.target.value } : prev))}>
              <option value="">Seleccione país</option>
              {countryOptions.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.code} - {country.name}
                </option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2" value={editingProvenance.code} onChange={(event) => setEditingProvenance((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingProvenance.name} onChange={(event) => setEditingProvenance((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingProvenance.isActive} onChange={(event) => setEditingProvenance((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingProvenance(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Material vegetal" subtitle="CRUD de catálogo VegetalMaterial" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onImportMaterials(file);
            }}
            ref={importMaterialInputRef}
            type="file"
          />
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={materialImporting}
            onClick={() => importMaterialInputRef.current?.click()}
            type="button"
          >
            {materialImporting ? "Importando..." : "Importar"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={materialExporting}
            onClick={() => void downloadMaterialExport("csv")}
            type="button"
          >
            {materialExporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            disabled={materialExporting}
            onClick={() => void downloadMaterialExport("xlsx")}
            type="button"
          >
            {materialExporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={createMaterial}>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={materialForm.code} onChange={(event) => setMaterialForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={materialForm.name} onChange={(event) => setMaterialForm((prev) => ({ ...prev, name: event.target.value }))} />
          <select className="rounded-md border px-3 py-2" value={materialForm.speciesId} onChange={(event) => setMaterialForm((prev) => ({ ...prev, speciesId: event.target.value }))}>
            <option value="">Seleccione especie</option>
            {speciesOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} - {item.scientificName}
              </option>
            ))}
          </select>
          <select className="rounded-md border px-3 py-2" value={materialForm.provenanceId} onChange={(event) => setMaterialForm((prev) => ({ ...prev, provenanceId: event.target.value }))}>
            <option value="">Sin procedencia</option>
            {provenanceOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>
          <select className="rounded-md border px-3 py-2" value={materialForm.materialType} onChange={(event) => setMaterialForm((prev) => ({ ...prev, materialType: event.target.value as VegetalMaterialType }))}>
            <option value="PURA">PURA</option>
            <option value="HIBRIDA">HIBRIDA</option>
          </select>
          <select className="rounded-md border px-3 py-2" value={materialForm.plantType} onChange={(event) => setMaterialForm((prev) => ({ ...prev, plantType: event.target.value as PlantType }))}>
            <option value="PROGENIE">PROGENIE</option>
            <option value="CLON">CLON</option>
            <option value="INJERTO">INJERTO</option>
            <option value="IN_VITRO">IN_VITRO</option>
          </select>
          <select className="rounded-md border px-3 py-2" value={materialForm.plantOrigin} onChange={(event) => setMaterialForm((prev) => ({ ...prev, plantOrigin: event.target.value as PlantOrigin }))}>
            <option value="NATIVA">NATIVA</option>
            <option value="EXOTICA">EXOTICA</option>
            <option value="NATURALIZADA">NATURALIZADA</option>
            <option value="INTRODUCIDA">INTRODUCIDA</option>
            <option value="ENDEMICA">ENDEMICA</option>
            <option value="CULTIVADA">CULTIVADA</option>
          </select>
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={materialForm.isActive} onChange={(event) => setMaterialForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateMaterial} type="submit">
            Crear material
          </button>
        </form>

        <TableToolbar
          canExport
          exportLimit={materialExportLimit}
          limit={materialPagination.limit}
          onExportLimitChange={setMaterialExportLimit}
          onLimitChange={(value) => {
            setMaterialPage(1);
            setMaterialPagination((prev) => ({ ...prev, limit: value }));
          }}
          onSearchChange={(value) => {
            setMaterialPage(1);
            setMaterialSearch(value);
          }}
          search={materialSearch}
          searchPlaceholder="Buscar por código, nombre, especie o procedencia"
          total={materialPagination.total}
        />
        {materialError ? <p className="text-sm text-red-600">{materialError}</p> : null}
        {materialLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Código"
                    onToggle={toggleMaterialSort}
                    sortBy={materialSortBy}
                    sortKey="code"
                    sortOrder={materialSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Nombre"
                    onToggle={toggleMaterialSort}
                    sortBy={materialSortBy}
                    sortKey="name"
                    sortOrder={materialSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Especie"
                    onToggle={toggleMaterialSort}
                    sortBy={materialSortBy}
                    sortKey="speciesName"
                    sortOrder={materialSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Procedencia"
                    onToggle={toggleMaterialSort}
                    sortBy={materialSortBy}
                    sortKey="provenanceName"
                    sortOrder={materialSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Tipo"
                    onToggle={toggleMaterialSort}
                    sortBy={materialSortBy}
                    sortKey="materialType"
                    sortOrder={materialSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <SortableHeader
                    label="Activo"
                    onToggle={toggleMaterialSort}
                    sortBy={materialSortBy}
                    sortKey="isActive"
                    sortOrder={materialSortOrder}
                  />
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {materialItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.species ? `${item.species.code} - ${item.species.scientificName}` : "-"}</td>
                  <td className="px-3 py-2">{item.provenance ? `${item.provenance.code} - ${item.provenance.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.materialType}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingMaterial(item)} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteMaterial(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          loading={materialLoading}
          onNext={() => setMaterialPage((prev) => Math.min(materialPagination.totalPages, prev + 1))}
          onPrev={() => setMaterialPage((prev) => Math.max(1, prev - 1))}
          page={materialPagination.page}
          total={materialPagination.total}
          totalPages={Math.max(1, materialPagination.totalPages)}
        />

        {editingMaterial ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-4" onSubmit={updateMaterial}>
            <input className="rounded-md border px-3 py-2" value={editingMaterial.code} onChange={(event) => setEditingMaterial((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingMaterial.name} onChange={(event) => setEditingMaterial((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <select className="rounded-md border px-3 py-2" value={editingMaterial.speciesId} onChange={(event) => setEditingMaterial((prev) => (prev ? { ...prev, speciesId: event.target.value } : prev))}>
              <option value="">Seleccione especie</option>
              {speciesOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.scientificName}
                </option>
              ))}
            </select>
            <select className="rounded-md border px-3 py-2" value={editingMaterial.provenanceId ?? ""} onChange={(event) => setEditingMaterial((prev) => (prev ? { ...prev, provenanceId: event.target.value || null } : prev))}>
              <option value="">Sin procedencia</option>
              {provenanceOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
            <select className="rounded-md border px-3 py-2" value={editingMaterial.materialType} onChange={(event) => setEditingMaterial((prev) => (prev ? { ...prev, materialType: event.target.value as VegetalMaterialType } : prev))}>
              <option value="PURA">PURA</option>
              <option value="HIBRIDA">HIBRIDA</option>
            </select>
            <select className="rounded-md border px-3 py-2" value={editingMaterial.plantType} onChange={(event) => setEditingMaterial((prev) => (prev ? { ...prev, plantType: event.target.value as PlantType } : prev))}>
              <option value="PROGENIE">PROGENIE</option>
              <option value="CLON">CLON</option>
              <option value="INJERTO">INJERTO</option>
              <option value="IN_VITRO">IN_VITRO</option>
            </select>
            <select className="rounded-md border px-3 py-2" value={editingMaterial.plantOrigin} onChange={(event) => setEditingMaterial((prev) => (prev ? { ...prev, plantOrigin: event.target.value as PlantOrigin } : prev))}>
              <option value="NATIVA">NATIVA</option>
              <option value="EXOTICA">EXOTICA</option>
              <option value="NATURALIZADA">NATURALIZADA</option>
              <option value="INTRODUCIDA">INTRODUCIDA</option>
              <option value="ENDEMICA">ENDEMICA</option>
              <option value="CULTIVADA">CULTIVADA</option>
            </select>
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingMaterial.isActive} onChange={(event) => setEditingMaterial((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingMaterial(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
