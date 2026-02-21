const HEXAGON_AREA_FACTOR = (3 * Math.sqrt(3)) / 2;

function toNumber(value?: string | number | null) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

export function calculatePlotAreaM2(input: {
  shapeType: "RECTANGULAR" | "CUADRADA" | "CIRCULAR" | "HEXAGONAL";
  dimension1M?: string | number | null;
  dimension2M?: string | number | null;
  dimension3M?: string | number | null;
  dimension4M?: string | number | null;
}) {
  const d1 = toNumber(input.dimension1M);
  const d2 = toNumber(input.dimension2M);
  const d3 = toNumber(input.dimension3M);
  const d4 = toNumber(input.dimension4M);

  switch (input.shapeType) {
    case "RECTANGULAR":
    case "CUADRADA": {
      if (!d1 || !d2) {
        return null;
      }
      return d1 * d2;
    }
    case "CIRCULAR": {
      if (!d3) {
        return null;
      }
      return Math.PI * d3 * d3;
    }
    case "HEXAGONAL": {
      if (!d4) {
        return null;
      }
      return HEXAGON_AREA_FACTOR * d4 * d4;
    }
    default:
      return null;
  }
}
