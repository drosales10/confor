/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable */
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { ApiResponse, PaginatedResponse } from "@/types/api.types";
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
  continentId?: string | null;
  code: string;
  name: string;
  isProductive: boolean;
  isActive: boolean;
  createdAt: string;
  continent?: {
    id: string;
    code: string;
    name: string;
  } | null;
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

export default function ConfiguracionGeneralPage() {
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  const [schemeItems, setSchemeItems] = useState<SimpleItem[]>([]);
  const [schemeSearch, setSchemeSearch] = useState("");
  const [schemePage, setSchemePage] = useState(1);
  const [schemePagination, setSchemePagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [schemeLoading, setSchemeLoading] = useState(false);
  const [schemeError, setSchemeError] = useState<string | null>(null);
  const [schemeForm, setSchemeForm] = useState({ code: "", name: "", isActive: true });
  const [editingScheme, setEditingScheme] = useState<SimpleItem | null>(null);

  const [inventoryItems, setInventoryItems] = useState<SimpleItem[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPagination, setInventoryPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryForm, setInventoryForm] = useState({ code: "", name: "", isActive: true });
  const [editingInventory, setEditingInventory] = useState<SimpleItem | null>(null);

  const [imaItems, setImaItems] = useState<ImaItem[]>([]);
  const [imaSearch, setImaSearch] = useState("");
  const [imaPage, setImaPage] = useState(1);
  const [imaPagination, setImaPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [imaLoading, setImaLoading] = useState(false);
  const [imaError, setImaError] = useState<string | null>(null);
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
  const [landUseForm, setLandUseForm] = useState({
    continentId: "",
    code: "",
    name: "",
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
    const allItems = await fetchAllPages<SpeciesItem>("/api/general-config/species");
    const options = allItems.filter((item) => item.isActive);
    setSpeciesOptions(options);
    if (options.length === 0) return;
    setMaterialForm((prev) => ({ ...prev, speciesId: prev.speciesId || options[0]?.id || "" }));
  }, []);

  const loadProvenanceOptions = useCallback(async () => {
    const allItems = await fetchAllPages<ProvenanceItem>("/api/general-config/provenances");
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
    setLandUseForm((prev) => ({ ...prev, continentId: prev.continentId || active[0]?.id || "" }));
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
      `/api/general-config/spacings?page=${spacingPage}&limit=${spacingPagination.limit}${debouncedSpacingSearch ? `&search=${encodeURIComponent(debouncedSpacingSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setSpacingError(result.error ?? "No fue posible cargar espaciamientos");
      setSpacingLoading(false);
      return;
    }

    setSpacingItems(result.data.items);
    setSpacingPagination(result.data.pagination);
    setSpacingLoading(false);
  }, [debouncedSpacingSearch, spacingPage, spacingPagination.limit]);

  const loadLevel4Costs = useCallback(async () => {
    setLevel4CostLoading(true);
    setLevel4CostError(null);

    const result = await requestJson<PaginatedResponse<Level4AdministrativeCostItem>>(
      `/api/general-config/level4-costs?page=${level4CostPage}&limit=${level4CostPagination.limit}${debouncedLevel4CostSearch ? `&search=${encodeURIComponent(debouncedLevel4CostSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setLevel4CostError(result.error ?? "No fue posible cargar costos nivel 4");
      setLevel4CostLoading(false);
      return;
    }

    setLevel4CostItems(result.data.items);
    setLevel4CostPagination(result.data.pagination);
    setLevel4CostLoading(false);
  }, [debouncedLevel4CostSearch, level4CostPage, level4CostPagination.limit]);

  const loadProductTypes = useCallback(async () => {
    setProductTypeLoading(true);
    setProductTypeError(null);

    const result = await requestJson<PaginatedResponse<ProductTypeItem>>(
      `/api/general-config/product-types?page=${productTypePage}&limit=${productTypePagination.limit}${debouncedProductTypeSearch ? `&search=${encodeURIComponent(debouncedProductTypeSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setProductTypeError(result.error ?? "No fue posible cargar tipos de productos");
      setProductTypeLoading(false);
      return;
    }

    setProductTypeItems(result.data.items);
    setProductTypePagination(result.data.pagination);
    setProductTypeLoading(false);
  }, [debouncedProductTypeSearch, productTypePage, productTypePagination.limit]);

  const loadLandUseTypes = useCallback(async () => {
    setLandUseLoading(true);
    setLandUseError(null);

    const result = await requestJson<PaginatedResponse<LandUseTypeItem>>(
      `/api/general-config/land-use-types?page=${landUsePage}&limit=${landUsePagination.limit}${debouncedLandUseSearch ? `&search=${encodeURIComponent(debouncedLandUseSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setLandUseError(result.error ?? "No fue posible cargar usos de suelos");
      setLandUseLoading(false);
      return;
    }

    setLandUseItems(result.data.items);
    setLandUsePagination(result.data.pagination);
    setLandUseLoading(false);
  }, [debouncedLandUseSearch, landUsePage, landUsePagination.limit]);

  const loadSchemes = useCallback(async () => {
    setSchemeLoading(true);
    setSchemeError(null);

    const result = await requestJson<PaginatedResponse<SimpleItem>>(
      `/api/general-config/management-schemes?page=${schemePage}&limit=${schemePagination.limit}${debouncedSchemeSearch ? `&search=${encodeURIComponent(debouncedSchemeSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setSchemeError(result.error ?? "No fue posible cargar esquemas de manejo");
      setSchemeLoading(false);
      return;
    }

    setSchemeItems(result.data.items);
    setSchemePagination(result.data.pagination);
    setSchemeLoading(false);
  }, [debouncedSchemeSearch, schemePage, schemePagination.limit]);

  const loadInventoryTypes = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);

    const result = await requestJson<PaginatedResponse<SimpleItem>>(
      `/api/general-config/inventory-types?page=${inventoryPage}&limit=${inventoryPagination.limit}${debouncedInventorySearch ? `&search=${encodeURIComponent(debouncedInventorySearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setInventoryError(result.error ?? "No fue posible cargar tipos de inventario");
      setInventoryLoading(false);
      return;
    }

    setInventoryItems(result.data.items);
    setInventoryPagination(result.data.pagination);
    setInventoryLoading(false);
  }, [debouncedInventorySearch, inventoryPage, inventoryPagination.limit]);

  const loadImaClasses = useCallback(async () => {
    setImaLoading(true);
    setImaError(null);

    const result = await requestJson<PaginatedResponse<ImaItem>>(
      `/api/general-config/ima-classes?page=${imaPage}&limit=${imaPagination.limit}${debouncedImaSearch ? `&search=${encodeURIComponent(debouncedImaSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setImaError(result.error ?? "No fue posible cargar clases IMA");
      setImaLoading(false);
      return;
    }

    setImaItems(result.data.items);
    setImaPagination(result.data.pagination);
    setImaLoading(false);
  }, [debouncedImaSearch, imaPage, imaPagination.limit]);

  const loadSpecies = useCallback(async () => {
    setSpeciesLoading(true);
    setSpeciesError(null);

    const result = await requestJson<PaginatedResponse<SpeciesItem>>(
      `/api/general-config/species?page=${speciesPage}&limit=${speciesPagination.limit}${debouncedSpeciesSearch ? `&search=${encodeURIComponent(debouncedSpeciesSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setSpeciesError(result.error ?? "No fue posible cargar especies vegetales");
      setSpeciesLoading(false);
      return;
    }

    setSpeciesItems(result.data.items);
    setSpeciesPagination(result.data.pagination);
    setSpeciesLoading(false);
  }, [debouncedSpeciesSearch, speciesPage, speciesPagination.limit]);

  const loadProvenances = useCallback(async () => {
    setProvenanceLoading(true);
    setProvenanceError(null);

    const result = await requestJson<PaginatedResponse<ProvenanceItem>>(
      `/api/general-config/provenances?page=${provenancePage}&limit=${provenancePagination.limit}${debouncedProvenanceSearch ? `&search=${encodeURIComponent(debouncedProvenanceSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setProvenanceError(result.error ?? "No fue posible cargar procedencias");
      setProvenanceLoading(false);
      return;
    }

    setProvenanceItems(result.data.items);
    setProvenancePagination(result.data.pagination);
    setProvenanceLoading(false);
  }, [debouncedProvenanceSearch, provenancePage, provenancePagination.limit]);

  const loadVegetalMaterials = useCallback(async () => {
    setMaterialLoading(true);
    setMaterialError(null);

    const result = await requestJson<PaginatedResponse<VegetalMaterialItem>>(
      `/api/general-config/vegetal-materials?page=${materialPage}&limit=${materialPagination.limit}${debouncedMaterialSearch ? `&search=${encodeURIComponent(debouncedMaterialSearch)}` : ""}`,
    );

    if (!result.success || !result.data) {
      setMaterialError(result.error ?? "No fue posible cargar materiales vegetales");
      setMaterialLoading(false);
      return;
    }

    setMaterialItems(result.data.items);
    setMaterialPagination(result.data.pagination);
    setMaterialLoading(false);
  }, [debouncedMaterialSearch, materialPage, materialPagination.limit]);

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
    () => landUseForm.code.trim().length > 0 && landUseForm.name.trim().length > 0,
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

    const result = await requestJson<SimpleItem>("/api/general-config/management-schemes", {
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

    const result = await requestJson<SimpleItem>("/api/general-config/management-schemes", {
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
    const result = await requestJson<{ id: string }>("/api/general-config/management-schemes", {
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

  async function createInventoryType(event: FormEvent) {
    event.preventDefault();
    if (!canCreateInventory) return;

    const result = await requestJson<SimpleItem>("/api/general-config/inventory-types", {
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

    const result = await requestJson<SimpleItem>("/api/general-config/inventory-types", {
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
    const result = await requestJson<{ id: string }>("/api/general-config/inventory-types", {
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

  async function createImaClass(event: FormEvent) {
    event.preventDefault();
    if (!canCreateIma) return;

    const result = await requestJson<ImaItem>("/api/general-config/ima-classes", {
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

    const result = await requestJson<ImaItem>("/api/general-config/ima-classes", {
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
    const result = await requestJson<{ id: string }>("/api/general-config/ima-classes", {
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

  async function createSpecies(event: FormEvent) {
    event.preventDefault();
    if (!canCreateSpecies) return;

    const result = await requestJson<SpeciesItem>("/api/general-config/species", {
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

    const result = await requestJson<SpeciesItem>("/api/general-config/species", {
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
    const result = await requestJson<{ id: string }>("/api/general-config/species", {
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

  async function createProvenance(event: FormEvent) {
    event.preventDefault();
    if (!canCreateProvenance) return;

    const result = await requestJson<ProvenanceItem>("/api/general-config/provenances", {
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

    const result = await requestJson<ProvenanceItem>("/api/general-config/provenances", {
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
    const result = await requestJson<{ id: string }>("/api/general-config/provenances", {
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

  async function createMaterial(event: FormEvent) {
    event.preventDefault();
    if (!canCreateMaterial) return;

    const result = await requestJson<VegetalMaterialItem>("/api/general-config/vegetal-materials", {
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

    const result = await requestJson<VegetalMaterialItem>("/api/general-config/vegetal-materials", {
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
    const result = await requestJson<{ id: string }>("/api/general-config/vegetal-materials", {
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

    const result = await requestJson<SpacingItem>("/api/general-config/spacings", {
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

    const result = await requestJson<SpacingItem>("/api/general-config/spacings", {
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
    const result = await requestJson<{ id: string }>("/api/general-config/spacings", {
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

    const result = await requestJson<Level4AdministrativeCostItem>("/api/general-config/level4-costs", {
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

    const result = await requestJson<Level4AdministrativeCostItem>("/api/general-config/level4-costs", {
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
    const result = await requestJson<{ id: string }>("/api/general-config/level4-costs", {
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

  async function createProductType(event: FormEvent) {
    event.preventDefault();
    if (!canCreateProductType) return;

    const result = await requestJson<ProductTypeItem>("/api/general-config/product-types", {
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

    const result = await requestJson<ProductTypeItem>("/api/general-config/product-types", {
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
    const result = await requestJson<{ id: string }>("/api/general-config/product-types", {
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

  async function createLandUseType(event: FormEvent) {
    event.preventDefault();
    if (!canCreateLandUse) return;

    const result = await requestJson<LandUseTypeItem>("/api/general-config/land-use-types", {
      method: "POST",
      body: JSON.stringify({
        ...landUseForm,
        continentId: landUseForm.continentId || null,
      }),
    });

    if (!result.success) {
      showCrudError(setLandUseError, result.error ?? "No fue posible crear el uso de suelos");
      return;
    }

    showCrudSuccess("Uso de suelos creado");
    setLandUseForm((prev) => ({
      continentId: prev.continentId,
      code: "",
      name: "",
      isProductive: false,
      isActive: true,
    }));
    setLandUsePage(1);
    await loadLandUseTypes();
  }

  async function updateLandUseType(event: FormEvent) {
    event.preventDefault();
    if (!editingLandUse) return;

    const result = await requestJson<LandUseTypeItem>("/api/general-config/land-use-types", {
      method: "PATCH",
      body: JSON.stringify({
        id: editingLandUse.id,
        continentId: editingLandUse.continentId ?? editingLandUse.continent?.id ?? null,
        code: editingLandUse.code,
        name: editingLandUse.name,
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
    const result = await requestJson<{ id: string }>("/api/general-config/land-use-types", {
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

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Configuración general</h1>
        <p className="text-sm text-muted-foreground">Catálogos base para manejo, inventario, IMA, continentes, países, regiones, estados, municipios, ciudades, desarrollo local, espaciamiento, costos nivel 4, tipos de productos, uso de suelos, especies vegetales, procedencias y materiales vegetales.</p>
      </div>

      {globalMessage ? <p className="rounded-md border px-3 py-2 text-sm">{globalMessage}</p> : null}

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Continentes" subtitle="CRUD de catálogo Continent" />
        <form className="grid gap-3 md:grid-cols-4" onSubmit={createContinent}>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={continentForm.code} onChange={(event) => setContinentForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2 md:col-span-2" placeholder="Nombre" value={continentForm.name} onChange={(event) => setContinentForm((prev) => ({ ...prev, name: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={continentForm.isActive} onChange={(event) => setContinentForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateContinent} type="submit">
            Crear continente
          </button>
        </form>

        <input className="w-full rounded-md border px-3 py-2" placeholder="Buscar por código o nombre" value={continentSearch} onChange={(event) => setContinentSearch(event.target.value)} />
        {continentError ? <p className="text-sm text-red-600">{continentError}</p> : null}
        {continentLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Activo</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {continentItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingContinent(item)} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteContinent(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>Total: {continentPagination.total}</span>
          <div className="flex items-center gap-2">
            <button className="rounded border px-2 py-1" disabled={continentPagination.page <= 1} onClick={() => setContinentPage((prev) => Math.max(1, prev - 1))} type="button">Anterior</button>
            <span>
              Página {continentPagination.page} de {Math.max(1, continentPagination.totalPages)}
            </span>
            <button className="rounded border px-2 py-1" disabled={continentPagination.page >= continentPagination.totalPages} onClick={() => setContinentPage((prev) => prev + 1)} type="button">Siguiente</button>
          </div>
        </div>

        {editingContinent ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-4" onSubmit={updateContinent}>
            <input className="rounded-md border px-3 py-2" value={editingContinent.code} onChange={(event) => setEditingContinent((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2 md:col-span-2" value={editingContinent.name} onChange={(event) => setEditingContinent((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingContinent.isActive} onChange={(event) => setEditingContinent((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingContinent(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Países" subtitle="CRUD de catálogo Country" />
        <form className="grid gap-3 md:grid-cols-5" onSubmit={createCountry}>
          <select className="rounded-md border px-3 py-2" value={countryForm.continentId} onChange={(event) => setCountryForm((prev) => ({ ...prev, continentId: event.target.value }))}>
            <option value="">Seleccione continente</option>
            {activeContinents.map((continent) => (
              <option key={continent.id} value={continent.id}>
                {continent.code} - {continent.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={countryForm.code} onChange={(event) => setCountryForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={countryForm.name} onChange={(event) => setCountryForm((prev) => ({ ...prev, name: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={countryForm.isActive} onChange={(event) => setCountryForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateCountry} type="submit">
            Crear país
          </button>
        </form>

        {activeContinents.length === 0 ? <p className="text-xs text-muted-foreground">No hay continentes activos cargados. Debes cargar continentes para registrar países.</p> : null}

        <input className="w-full rounded-md border px-3 py-2" placeholder="Buscar por código o nombre" value={countrySearch} onChange={(event) => setCountrySearch(event.target.value)} />
        {countryError ? <p className="text-sm text-red-600">{countryError}</p> : null}
        {countryLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">Continente</th>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Activo</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {countryItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.continent ? `${item.continent.code} - ${item.continent.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingCountry({ ...item, continentId: item.continentId ?? item.continent?.id ?? "" })} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteCountry(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>Total: {countryPagination.total}</span>
          <div className="flex items-center gap-2">
            <button className="rounded border px-2 py-1" disabled={countryPagination.page <= 1} onClick={() => setCountryPage((prev) => Math.max(1, prev - 1))} type="button">Anterior</button>
            <span>
              Página {countryPagination.page} de {Math.max(1, countryPagination.totalPages)}
            </span>
            <button className="rounded border px-2 py-1" disabled={countryPagination.page >= countryPagination.totalPages} onClick={() => setCountryPage((prev) => prev + 1)} type="button">Siguiente</button>
          </div>
        </div>

        {editingCountry ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-5" onSubmit={updateCountry}>
            <select className="rounded-md border px-3 py-2" value={editingCountry.continentId ?? editingCountry.continent?.id ?? ""} onChange={(event) => setEditingCountry((prev) => (prev ? { ...prev, continentId: event.target.value } : prev))}>
              <option value="">Seleccione continente</option>
              {activeContinents.map((continent) => (
                <option key={continent.id} value={continent.id}>
                  {continent.code} - {continent.name}
                </option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2" value={editingCountry.code} onChange={(event) => setEditingCountry((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingCountry.name} onChange={(event) => setEditingCountry((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingCountry.isActive} onChange={(event) => setEditingCountry((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingCountry(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Regiones" subtitle="CRUD de catálogo Region" />
        <form className="grid gap-3 md:grid-cols-5" onSubmit={createRegion}>
          <select className="rounded-md border px-3 py-2" value={regionForm.countryId} onChange={(event) => setRegionForm((prev) => ({ ...prev, countryId: event.target.value }))}>
            <option value="">Seleccione país</option>
            {countryOptions.map((country) => (
              <option key={country.id} value={country.id}>
                {country.code} - {country.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={regionForm.code} onChange={(event) => setRegionForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={regionForm.name} onChange={(event) => setRegionForm((prev) => ({ ...prev, name: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={regionForm.isActive} onChange={(event) => setRegionForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateRegion} type="submit">
            Crear región
          </button>
        </form>

        {countryOptions.length === 0 ? <p className="text-xs text-muted-foreground">No hay países activos cargados. Debes cargar países para registrar regiones.</p> : null}

        <input className="w-full rounded-md border px-3 py-2" placeholder="Buscar por código o nombre" value={regionSearch} onChange={(event) => setRegionSearch(event.target.value)} />
        {regionError ? <p className="text-sm text-red-600">{regionError}</p> : null}
        {regionLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">País</th>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Activo</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {regionItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.country ? `${item.country.code} - ${item.country.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingRegion({ ...item, countryId: item.countryId ?? item.country?.id ?? "" })} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteRegion(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>Total: {regionPagination.total}</span>
          <div className="flex items-center gap-2">
            <button className="rounded border px-2 py-1" disabled={regionPagination.page <= 1} onClick={() => setRegionPage((prev) => Math.max(1, prev - 1))} type="button">Anterior</button>
            <span>
              Página {regionPagination.page} de {Math.max(1, regionPagination.totalPages)}
            </span>
            <button className="rounded border px-2 py-1" disabled={regionPagination.page >= regionPagination.totalPages} onClick={() => setRegionPage((prev) => prev + 1)} type="button">Siguiente</button>
          </div>
        </div>

        {editingRegion ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-5" onSubmit={updateRegion}>
            <select className="rounded-md border px-3 py-2" value={editingRegion.countryId ?? editingRegion.country?.id ?? ""} onChange={(event) => setEditingRegion((prev) => (prev ? { ...prev, countryId: event.target.value } : prev))}>
              <option value="">Seleccione país</option>
              {countryOptions.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.code} - {country.name}
                </option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2" value={editingRegion.code} onChange={(event) => setEditingRegion((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingRegion.name} onChange={(event) => setEditingRegion((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingRegion.isActive} onChange={(event) => setEditingRegion((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingRegion(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Estados / Departamentos" subtitle="CRUD de catálogo StateDepartment" />
        <form className="grid gap-3 md:grid-cols-5" onSubmit={createStateDepartment}>
          <select className="rounded-md border px-3 py-2" value={stateDepartmentForm.countryId} onChange={(event) => setStateDepartmentForm((prev) => ({ ...prev, countryId: event.target.value }))}>
            <option value="">Seleccione país</option>
            {countryOptions.map((country) => (
              <option key={country.id} value={country.id}>
                {country.code} - {country.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={stateDepartmentForm.code} onChange={(event) => setStateDepartmentForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={stateDepartmentForm.name} onChange={(event) => setStateDepartmentForm((prev) => ({ ...prev, name: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={stateDepartmentForm.isActive} onChange={(event) => setStateDepartmentForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateStateDepartment} type="submit">
            Crear estado
          </button>
        </form>

        {countryOptions.length === 0 ? <p className="text-xs text-muted-foreground">No hay países activos cargados. Debes cargar países para registrar estados/departamentos.</p> : null}

        <input className="w-full rounded-md border px-3 py-2" placeholder="Buscar por código o nombre" value={stateDepartmentSearch} onChange={(event) => setStateDepartmentSearch(event.target.value)} />
        {stateDepartmentError ? <p className="text-sm text-red-600">{stateDepartmentError}</p> : null}
        {stateDepartmentLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">País</th>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Activo</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {stateDepartmentItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.country ? `${item.country.code} - ${item.country.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingStateDepartment({ ...item, countryId: item.countryId ?? item.country?.id ?? "" })} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteStateDepartment(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>Total: {stateDepartmentPagination.total}</span>
          <div className="flex items-center gap-2">
            <button className="rounded border px-2 py-1" disabled={stateDepartmentPagination.page <= 1} onClick={() => setStateDepartmentPage((prev) => Math.max(1, prev - 1))} type="button">Anterior</button>
            <span>
              Página {stateDepartmentPagination.page} de {Math.max(1, stateDepartmentPagination.totalPages)}
            </span>
            <button className="rounded border px-2 py-1" disabled={stateDepartmentPagination.page >= stateDepartmentPagination.totalPages} onClick={() => setStateDepartmentPage((prev) => prev + 1)} type="button">Siguiente</button>
          </div>
        </div>

        {editingStateDepartment ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-5" onSubmit={updateStateDepartment}>
            <select className="rounded-md border px-3 py-2" value={editingStateDepartment.countryId ?? editingStateDepartment.country?.id ?? ""} onChange={(event) => setEditingStateDepartment((prev) => (prev ? { ...prev, countryId: event.target.value } : prev))}>
              <option value="">Seleccione país</option>
              {countryOptions.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.code} - {country.name}
                </option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2" value={editingStateDepartment.code} onChange={(event) => setEditingStateDepartment((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingStateDepartment.name} onChange={(event) => setEditingStateDepartment((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingStateDepartment.isActive} onChange={(event) => setEditingStateDepartment((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingStateDepartment(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Municipios / Distritos" subtitle="CRUD de catálogo MunicipalityDistrict" />
        <form className="grid gap-3 md:grid-cols-5" onSubmit={createMunicipality}>
          <select className="rounded-md border px-3 py-2" value={municipalityForm.stateId} onChange={(event) => setMunicipalityForm((prev) => ({ ...prev, stateId: event.target.value }))}>
            <option value="">Seleccione estado</option>
            {stateOptions.map((state) => (
              <option key={state.id} value={state.id}>
                {state.code} - {state.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={municipalityForm.code} onChange={(event) => setMunicipalityForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={municipalityForm.name} onChange={(event) => setMunicipalityForm((prev) => ({ ...prev, name: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={municipalityForm.isActive} onChange={(event) => setMunicipalityForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateMunicipality} type="submit">
            Crear municipio
          </button>
        </form>

        {stateOptions.length === 0 ? <p className="text-xs text-muted-foreground">No hay estados activos cargados. Debes cargar estados/departamentos para registrar municipios.</p> : null}

        <input className="w-full rounded-md border px-3 py-2" placeholder="Buscar por código o nombre" value={municipalitySearch} onChange={(event) => setMunicipalitySearch(event.target.value)} />
        {municipalityError ? <p className="text-sm text-red-600">{municipalityError}</p> : null}
        {municipalityLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">País</th>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Activo</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {municipalityItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.state ? `${item.state.code} - ${item.state.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.state?.country ? `${item.state.country.code} - ${item.state.country.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingMunicipality({ ...item, stateId: item.stateId ?? item.state?.id ?? "" })} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteMunicipality(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>Total: {municipalityPagination.total}</span>
          <div className="flex items-center gap-2">
            <button className="rounded border px-2 py-1" disabled={municipalityPagination.page <= 1} onClick={() => setMunicipalityPage((prev) => Math.max(1, prev - 1))} type="button">Anterior</button>
            <span>
              Página {municipalityPagination.page} de {Math.max(1, municipalityPagination.totalPages)}
            </span>
            <button className="rounded border px-2 py-1" disabled={municipalityPagination.page >= municipalityPagination.totalPages} onClick={() => setMunicipalityPage((prev) => prev + 1)} type="button">Siguiente</button>
          </div>
        </div>

        {editingMunicipality ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-5" onSubmit={updateMunicipality}>
            <select className="rounded-md border px-3 py-2" value={editingMunicipality.stateId ?? editingMunicipality.state?.id ?? ""} onChange={(event) => setEditingMunicipality((prev) => (prev ? { ...prev, stateId: event.target.value } : prev))}>
              <option value="">Seleccione estado</option>
              {stateOptions.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.code} - {state.name}
                </option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2" value={editingMunicipality.code} onChange={(event) => setEditingMunicipality((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingMunicipality.name} onChange={(event) => setEditingMunicipality((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingMunicipality.isActive} onChange={(event) => setEditingMunicipality((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingMunicipality(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Ciudades" subtitle="CRUD de catálogo City" />
        <form className="grid gap-3 md:grid-cols-5" onSubmit={createCity}>
          <select className="rounded-md border px-3 py-2" value={cityForm.municipalityId} onChange={(event) => setCityForm((prev) => ({ ...prev, municipalityId: event.target.value }))}>
            <option value="">Seleccione municipio</option>
            {municipalityOptions.map((municipality) => (
              <option key={municipality.id} value={municipality.id}>
                {municipality.code} - {municipality.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={cityForm.code} onChange={(event) => setCityForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={cityForm.name} onChange={(event) => setCityForm((prev) => ({ ...prev, name: event.target.value }))} />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={cityForm.isActive} onChange={(event) => setCityForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateCity} type="submit">
            Crear ciudad
          </button>
        </form>

        {municipalityOptions.length === 0 ? <p className="text-xs text-muted-foreground">No hay municipios activos cargados. Debes cargar municipios para registrar ciudades.</p> : null}

        <input className="w-full rounded-md border px-3 py-2" placeholder="Buscar por código o nombre" value={citySearch} onChange={(event) => setCitySearch(event.target.value)} />
        {cityError ? <p className="text-sm text-red-600">{cityError}</p> : null}
        {cityLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">Municipio</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">País</th>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Activo</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cityItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.municipality ? `${item.municipality.code} - ${item.municipality.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.municipality?.state ? `${item.municipality.state.code} - ${item.municipality.state.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.municipality?.state?.country ? `${item.municipality.state.country.code} - ${item.municipality.state.country.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingCity({ ...item, municipalityId: item.municipalityId ?? item.municipality?.id ?? "" })} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteCity(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>Total: {cityPagination.total}</span>
          <div className="flex items-center gap-2">
            <button className="rounded border px-2 py-1" disabled={cityPagination.page <= 1} onClick={() => setCityPage((prev) => Math.max(1, prev - 1))} type="button">Anterior</button>
            <span>
              Página {cityPagination.page} de {Math.max(1, cityPagination.totalPages)}
            </span>
            <button className="rounded border px-2 py-1" disabled={cityPagination.page >= cityPagination.totalPages} onClick={() => setCityPage((prev) => prev + 1)} type="button">Siguiente</button>
          </div>
        </div>

        {editingCity ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-5" onSubmit={updateCity}>
            <select className="rounded-md border px-3 py-2" value={editingCity.municipalityId ?? editingCity.municipality?.id ?? ""} onChange={(event) => setEditingCity((prev) => (prev ? { ...prev, municipalityId: event.target.value } : prev))}>
              <option value="">Seleccione municipio</option>
              {municipalityOptions.map((municipality) => (
                <option key={municipality.id} value={municipality.id}>
                  {municipality.code} - {municipality.name}
                </option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2" value={editingCity.code} onChange={(event) => setEditingCity((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingCity.name} onChange={(event) => setEditingCity((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingCity.isActive} onChange={(event) => setEditingCity((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingCity(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <CatalogHeader title="Desarrollo local" subtitle="CRUD de catálogo CommunityTerritory" />
        <form className="grid gap-3 md:grid-cols-6" onSubmit={createCommunity}>
          <select className="rounded-md border px-3 py-2" value={communityForm.cityId} onChange={(event) => setCommunityForm((prev) => ({ ...prev, cityId: event.target.value }))}>
            <option value="">Seleccione ciudad</option>
            {cityOptions.map((city) => (
              <option key={city.id} value={city.id}>
                {city.code} - {city.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border px-3 py-2" placeholder="Código" value={communityForm.code} onChange={(event) => setCommunityForm((prev) => ({ ...prev, code: event.target.value }))} />
          <input className="rounded-md border px-3 py-2" placeholder="Nombre" value={communityForm.name} onChange={(event) => setCommunityForm((prev) => ({ ...prev, name: event.target.value }))} />
          <select className="rounded-md border px-3 py-2" value={communityForm.type} onChange={(event) => setCommunityForm((prev) => ({ ...prev, type: event.target.value as CommunityType }))}>
            <option value="COMUNA">COMUNA</option>
            <option value="TERRITORIO_INDIGENA">TERRITORIO_INDIGENA</option>
            <option value="COMUNIDAD_CRIOLLA">COMUNIDAD_CRIOLLA</option>
            <option value="PARROQUIA">PARROQUIA</option>
          </select>
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input checked={communityForm.isActive} onChange={(event) => setCommunityForm((prev) => ({ ...prev, isActive: event.target.checked }))} type="checkbox" />
            Activo
          </label>
          <button className="rounded-md border px-3 py-2 text-sm" disabled={!canCreateCommunity} type="submit">
            Crear desarrollo
          </button>
        </form>

        {cityOptions.length === 0 ? <p className="text-xs text-muted-foreground">No hay ciudades activas cargadas. Debes cargar ciudades para registrar desarrollos locales.</p> : null}

        <input className="w-full rounded-md border px-3 py-2" placeholder="Buscar por código o nombre" value={communitySearch} onChange={(event) => setCommunitySearch(event.target.value)} />
        {communityError ? <p className="text-sm text-red-600">{communityError}</p> : null}
        {communityLoading ? <p className="text-sm">Cargando...</p> : null}

        <div className="overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left">Ciudad</th>
                <th className="px-3 py-2 text-left">Municipio</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Activo</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {communityItems.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="px-3 py-2">{item.city ? `${item.city.code} - ${item.city.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.city?.municipality ? `${item.city.municipality.code} - ${item.city.municipality.name}` : "-"}</td>
                  <td className="px-3 py-2">{item.type}</td>
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.isActive ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => setEditingCommunity({ ...item, cityId: item.cityId ?? item.city?.id ?? "" })} type="button">Editar</button>
                      <button className="rounded border px-2 py-1" onClick={() => void deleteCommunity(item.id)} type="button">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>Total: {communityPagination.total}</span>
          <div className="flex items-center gap-2">
            <button className="rounded border px-2 py-1" disabled={communityPagination.page <= 1} onClick={() => setCommunityPage((prev) => Math.max(1, prev - 1))} type="button">Anterior</button>
            <span>
              Página {communityPagination.page} de {Math.max(1, communityPagination.totalPages)}
            </span>
            <button className="rounded border px-2 py-1" disabled={communityPagination.page >= communityPagination.totalPages} onClick={() => setCommunityPage((prev) => prev + 1)} type="button">Siguiente</button>
          </div>
        </div>

        {editingCommunity ? (
          <form className="grid gap-3 rounded-lg border p-3 md:grid-cols-6" onSubmit={updateCommunity}>
            <select className="rounded-md border px-3 py-2" value={editingCommunity.cityId ?? editingCommunity.city?.id ?? ""} onChange={(event) => setEditingCommunity((prev) => (prev ? { ...prev, cityId: event.target.value } : prev))}>
              <option value="">Seleccione ciudad</option>
              {cityOptions.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.code} - {city.name}
                </option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2" value={editingCommunity.code} onChange={(event) => setEditingCommunity((prev) => (prev ? { ...prev, code: event.target.value } : prev))} />
            <input className="rounded-md border px-3 py-2" value={editingCommunity.name} onChange={(event) => setEditingCommunity((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
            <select className="rounded-md border px-3 py-2" value={editingCommunity.type} onChange={(event) => setEditingCommunity((prev) => (prev ? { ...prev, type: event.target.value as CommunityType } : prev))}>
              <option value="COMUNA">COMUNA</option>
              <option value="TERRITORIO_INDIGENA">TERRITORIO_INDIGENA</option>
              <option value="COMUNIDAD_CRIOLLA">COMUNIDAD_CRIOLLA</option>
              <option value="PARROQUIA">PARROQUIA</option>
            </select>
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input checked={editingCommunity.isActive} onChange={(event) => setEditingCommunity((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))} type="checkbox" />
              Activo
            </label>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" type="submit">Guardar</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingCommunity(null)} type="button">Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>


    </div>
  );
}