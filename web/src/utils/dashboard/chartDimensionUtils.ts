import { canvasFont } from "@/utils/fonts";

// Cached 2D context for text measurement — canvas measureText is the same
// browser API ECharts measures its labels with, and it avoids the
// DOM-append + forced-reflow cost of measuring with a <span>, which adds up
// because this runs for every axis label of every panel on every render.
// `undefined` = not attempted yet, `null` = unavailable (headless).
let measureTextCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Calculates the width of a given text.
 * Useful to calculate nameGap for the left axis
 *
 * @param {string} text - The text to calculate the width of.
 * @param {string} fontSize - The font size of the text.
 * @return {number} The width of the text in pixels.
 */
// eslint-disable-next-line local/no-hardcoded-px -- measures text ECharts paints, and ECharts fontSize is a plain number = literal CSS px that never scales with the root; the measurement must use that same fixed px or it mis-reserves space
export const calculateWidthText = (text: string, fontSize: string = "12px"): number => {
  if (!text) return 0;

  if (measureTextCtx === undefined) {
    try {
      const canvas = document.createElement("canvas");
      measureTextCtx = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
    } catch {
      measureTextCtx = null;
    }
  }
  if (measureTextCtx) {
    // Must match the family ECharts renders axis labels with (set globally by
    // registerO2EChartsTheme), otherwise nameGap/width come out wrong.
    // eslint-disable-next-line local/no-hardcoded-px -- mirrors the caller's ECharts fontSize, which is literal CSS px (see the fallback on the signature above)
    measureTextCtx.font = canvasFont(fontSize || "12px", "sans");
    return Math.ceil(measureTextCtx.measureText(String(text)).width);
  }

  // no 2D context (e.g. jsdom) — deterministic estimate, avg glyph ≈ 0.6em
  const px = parseFloat(fontSize) || 12;
  return Math.ceil(String(text).length * px * 0.6);
};

/**
 * Tick values a value axis will render for the given extent, mirroring
 * ECharts' nice-interval algorithm (interval = "nice" of span/splitNumber,
 * where nice rounds to 1/2/3/5×10^n, and the extent is widened to interval
 * multiples). Kept local instead of importing ECharts' internal IntervalScale
 * so upgrades cannot break us; verified to produce identical ticks.
 *
 * @param lo - axis extent minimum
 * @param hi - axis extent maximum
 * @param splitNumber - desired number of intervals (ECharts default: 5)
 * @return {number[]} the tick values, lowest first
 */
export const calculateNiceTickValues = (
  lo: number,
  hi: number,
  splitNumber: number = 5,
): number[] => {
  const span = hi - lo;
  if (!(span > 0) || !Number.isFinite(span)) return [lo];

  const step = span / splitNumber;
  const exp10 = 10 ** Math.floor(Math.log10(step));
  const f = step / exp10;
  const nf = f < 1.5 ? 1 : f < 2.5 ? 2 : f < 4 ? 3 : f < 7 ? 5 : 10;
  const interval = nf * exp10;

  const ticks: number[] = [];
  for (let k = Math.floor(lo / interval); k <= Math.ceil(hi / interval); k++) {
    // toPrecision strips float noise like 0.30000000000000004
    ticks.push(parseFloat((k * interval).toPrecision(12)));
  }
  return ticks;
};

/**
 * The largest magnitude in a set of axis ticks - the one number a whole axis is
 * sized to, because every tick has to be printed in the unit that number picks.
 *
 * @param ticks - tick values the axis paints
 * @return {number} the largest absolute tick
 */
export const widestTickOf = (ticks: number[]): number =>
  (ticks ?? []).reduce((widest: number, tick: number) => Math.max(widest, Math.abs(tick)), 0);

/**
 * The magnitude every tick of a value axis must be sized to, so the whole axis
 * prints in one unit. Returns undefined when the extent is unusable (no data,
 * or data that is not a number), which is the caller's cue to leave the axis
 * unpinned rather than pin it on a guess.
 *
 * An axis label is a number *and* a unit. Sized per tick, each tick picks the
 * unit that flatters it, and the column stops being a scale: `1.43MB/s` printed
 * above `878.91KB/s` above `0.00B/s` reads as an axis that falls then rises,
 * because as bare numbers it does. Sizing once, on the largest tick the axis
 * actually paints, keeps every tick in one unit and the order readable.
 *
 * @param lo - lowest value the axis can show (data minimum, or a configured bound)
 * @param hi - highest value the axis can show
 * @param splitNumber - intervals the axis divides into; ECharts' value-axis default is 5
 * @return {number | undefined} the largest absolute tick, or undefined when unmeasurable
 */
export const calculateAxisTickExtent = (
  lo: number,
  hi: number,
  splitNumber: number = 5,
): number | undefined => {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return undefined;
  return widestTickOf(calculateNiceTickValues(lo, hi, splitNumber));
};

/**
 * The extent to size a value axis on, from what the panel plotted and what its
 * config pins. Two rules the axis itself obeys and a caller has to mirror:
 *
 * - A value axis is drawn from zero, not from the first sample, so a panel
 *   plotting 1.1-1.4 MB/s still shows a `0` tick. Sizing on the data alone
 *   would pick a unit the real top tick then disagrees with.
 * - A configured `y_axis_min`/`y_axis_max` replaces the data's own bound: the
 *   axis paints those, so those are what the ticks must be measured against.
 *
 * @param dataMin - lowest plotted value; Infinity when nothing was plotted
 * @param dataMax - highest plotted value; -Infinity when nothing was plotted
 * @param config - panel config, whose y_axis_min/y_axis_max bounds win over data
 * @param splitNumber - intervals the axis divides into; ECharts' default is 5
 * @return {number | undefined} the largest absolute tick, or undefined when the
 * panel has nothing to size on (no samples, no usable bound)
 */
export const calculateValueAxisExtent = (
  dataMin: number,
  dataMax: number,
  config: any,
  splitNumber: number = 5,
): number | undefined => {
  const cfgMin = Number(config?.y_axis_min);
  const cfgMax = Number(config?.y_axis_max);
  const boundMin =
    config?.y_axis_min !== null &&
    config?.y_axis_min !== undefined &&
    config?.y_axis_min !== "" &&
    Number.isFinite(cfgMin)
      ? Math.min(cfgMin, dataMin)
      : dataMin;
  const boundMax =
    config?.y_axis_max !== null &&
    config?.y_axis_max !== undefined &&
    config?.y_axis_max !== "" &&
    Number.isFinite(cfgMax)
      ? Math.max(cfgMax, dataMax)
      : dataMax;

  // Nothing plotted and no bound pinned: there is no honest extent to claim.
  if (!Number.isFinite(boundMin) && !Number.isFinite(boundMax)) return undefined;

  return calculateAxisTickExtent(
    Math.min(0, Number.isFinite(boundMin) ? boundMin : 0),
    Math.max(0, Number.isFinite(boundMax) ? boundMax : 0),
    splitNumber,
  );
};

/**
 * Calculates the optimal font size for a given text that fits the canvas width
 * and, when provided, the canvas height.
 * @param text - The text to calculate the font size for.
 * @param canvasWidth - canvas width in pixels
 * @param canvasHeight - optional canvas height in pixels; caps the font size so
 * the rendered line (~1.2em tall) also fits vertically
 * @returns {number} - The optimal font size in pixels.
 */
export const calculateOptimalFontSize = (
  text: string,
  canvasWidth: number,
  canvasHeight?: number,
) => {
  let minFontSize = 1; // Start with the smallest font size
  let maxFontSize = 90; // Set a maximum possible font size

  if (canvasHeight !== undefined && canvasHeight > 0) {
    maxFontSize = Math.max(minFontSize, Math.min(maxFontSize, Math.floor(canvasHeight / 1.2)));
  }

  let optimalFontSize = minFontSize;

  while (minFontSize <= maxFontSize) {
    const midFontSize = Math.floor((minFontSize + maxFontSize) / 2);
    const textWidth = calculateWidthText(text, `${midFontSize}px`);

    if (textWidth > canvasWidth) {
      maxFontSize = midFontSize - 1; // Text is too wide, reduce font size
    } else {
      optimalFontSize = midFontSize; // Text fits, but we try larger
      minFontSize = midFontSize + 1;
    }
  }

  return optimalFontSize; // Return the largest font size that fits
};

// x-axis tick-label band below the plot edge (12px font + 8px axisLabel margin)
export const X_AXIS_TICK_LABEL_BAND = 20;

/**
 * Widens the ECharts grid's left inset to the measured pixel width of the
 * widest formatted y-axis label. ECharts' containLabel under-measures rendered
 * label width, so wide labels clip at the left edge; we measure with the same
 * canvas API ECharts renders with and reserve exactly that much, disabling
 * containLabel so the two reservations don't stack.
 *
 * @param options - the ECharts options object (mutated in place).
 */
export const applyMeasuredYAxisLeftInset = (options: any): void => {
  const grid = options?.grid;
  const yAxis = options?.yAxis;

  // Arrays are gauge/trellis layouts that manage their own left spacing.
  const isPlainObject = (v: any) => v && typeof v === "object" && !Array.isArray(v);
  if (!isPlainObject(grid) || !isPlainObject(yAxis)) return;
  if (yAxis.type !== "value") return;

  const formatter = yAxis.axisLabel?.formatter;
  if (typeof formatter !== "function") return;

  let widest = 0;
  const series = Array.isArray(options?.series) ? options.series : [];
  for (const s of series) {
    const data = Array.isArray(s?.data) ? s.data : [];
    for (const point of data) {
      const y = Array.isArray(point) ? point[1] : point;
      const width = calculateWidthText(String(formatter(y)));
      if (width > widest) widest = width;
    }
  }

  if (widest > 0) {
    options.grid.left = widest + 12;
    if (grid.containLabel === true && typeof grid.bottom === "number") {
      grid.bottom += X_AXIS_TICK_LABEL_BAND;
    }
    options.grid.containLabel = false;
  }
};

/**
 * Calculates a dynamic nameGap for the x-axis based on label rotation.
 * When labels are rotated, we need more space between the labels and the axis name.
 *
 * @param {number} rotate - The rotation angle of the labels in degrees (0-90).
 * @param {number} labelWidth - The maximum width of truncated labels in pixels (default: 120).
 * @param {number} fontSize - The font size of the labels in pixels (default: 12).
 * @param {number} defaultNameGap - The default nameGap to use when rotation is 0 (default: 25).
 * @param {number} axisLabelMargin - The margin between axis and labels (default: 10).
 * @return {number} The calculated nameGap value.
 */
export const calculateDynamicNameGap = (
  rotate: number = 0,
  labelWidth: number = 120,
  fontSize: number = 12,
  defaultNameGap: number = 25,
  axisLabelMargin: number = 10,
): number => {
  // If no rotation, return the default nameGap
  if (rotate === 0) {
    return defaultNameGap;
  }

  // Convert rotation to radians
  const rotationInRadians = (Math.abs(rotate) * Math.PI) / 180;

  // Calculate the vertical height occupied by rotated label (Section Height)
  // When a label of width W is rotated by angle ╬╕:
  // - The vertical height = W * sin(╬╕) + fontSize * cos(╬╕)
  const verticalHeight =
    labelWidth * Math.sin(rotationInRadians) + fontSize * Math.cos(rotationInRadians);

  // Calculate nameGap: vertical height + axis label margin + small buffer (8px)
  // The buffer ensures there's slight spacing between longest label tip and axis name
  const calculatedNameGap = Math.ceil(verticalHeight + axisLabelMargin + 8);

  // Return the maximum of calculated and default to ensure minimum spacing
  return Math.max(calculatedNameGap, defaultNameGap);
};

/**
 * Calculates the additional bottom spacing needed for rotated x-axis labels.
 * This ensures rotated labels don't overlap with legends or get cut off.
 *
 * @param {number} rotate - The rotation angle of the labels in degrees (0-90).
 * @param {number} labelWidth - The maximum width of truncated labels in pixels (default: 120).
 * @param {number} fontSize - The font size of the labels in pixels (default: 12).
 * @param {boolean} hasAxisName - Whether the axis has a name/title (default: false).
 * @param {number} nameGap - The gap between axis and its name (optional).
 * @return {number} The additional spacing needed in pixels.
 */
export const calculateRotatedLabelBottomSpace = (
  rotate: number = 0,
  labelWidth: number = 120,
  fontSize: number = 12,
  hasAxisName: boolean = false,
  nameGap: number = 0,
): number => {
  // If no rotation, no additional space needed
  if (rotate === 0) {
    return 0;
  }

  // Convert rotation to radians
  const rotationInRadians = (Math.abs(rotate) * Math.PI) / 180;

  // Calculate the vertical height occupied by rotated label
  const verticalHeight =
    labelWidth * Math.sin(rotationInRadians) + fontSize * Math.cos(rotationInRadians);

  if (hasAxisName) {
    // If there's an axis name, nameGap already covers the label height.
    // We just need to add enough space for the axis name itself (~20px)
    // and some buffer.
    const axisNameEstimatedHeight = 20;
    const totalNeededSpace = (nameGap || verticalHeight + 10) + axisNameEstimatedHeight;

    // Default bottom spacing in charts is typically ~35-50px.
    // Only add if totalNeeded exceeds a reasonable base (e.g., 40px)
    return Math.max(0, Math.ceil(totalNeededSpace - 40));
  } else {
    // Without an axis name, grid's containLabel: true expands the grid to fit
    // rotated labels, so no extra bottom spacing is needed.
    return 10; // Let ECharts handle it with containLabel
  }
};
