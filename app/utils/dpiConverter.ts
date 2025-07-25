// DPI conversion utilities for pixel to millimeter conversion

export const DPI_OPTIONS = [
  { value: 75, label: "75 DPI (Web/Screen)" },
  { value: 150, label: "150 DPI (Standard Print)" },
  { value: 300, label: "300 DPI (High Quality Print)" },
] as const;

export type DPIValue = typeof DPI_OPTIONS[number]['value'];

/**
 * Convert pixels to millimeters at a given DPI
 * Formula: mm = (pixels / DPI) * 25.4
 */
export function pixelsToMm(pixels: number, dpi: DPIValue): number {
  return (pixels / dpi) * 25.4;
}

/**
 * Convert millimeters to pixels at a given DPI
 * Formula: pixels = (mm * DPI) / 25.4
 */
export function mmToPixels(mm: number, dpi: DPIValue): number {
  return Math.round((mm * dpi) / 25.4);
}

/**
 * Format dimension for display
 */
export function formatDimension(pixels: number, dpi: DPIValue): string {
  const mm = pixelsToMm(pixels, dpi);
  return `${mm.toFixed(1)}mm`;
}

/**
 * Get dimension info for display
 */
export function getDimensionInfo(widthPx: number, heightPx: number) {
  return DPI_OPTIONS.map(({ value: dpi, label }) => ({
    dpi,
    label,
    width: formatDimension(widthPx, dpi),
    height: formatDimension(heightPx, dpi),
    dimensions: `${formatDimension(widthPx, dpi)} × ${formatDimension(heightPx, dpi)}`,
  }));
}