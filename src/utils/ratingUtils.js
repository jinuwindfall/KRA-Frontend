export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const DEFAULT_FORMULA_EXPRESSION =
  "((appraisee * 20) + (appraiser * 40) + (reviewer * 40)) / 100";

function evaluateCustomFormula(expression, values = {}) {
  if (!expression || typeof expression !== "string") {
    return null;
  }

  const normalized = expression
    .trim()
    .replace(/(\d+(?:\.\d+)?)\s*%/g, "($1 / 100)");

  if (!normalized) {
    return null;
  }

  const allowedCharacters = /^[a-z0-9_+\-*/().,\s]+$/i;
  if (!allowedCharacters.test(normalized)) {
    return null;
  }

  const identifiers = normalized.match(/[a-z_]+/gi) || [];
  const allowedIdentifiers = new Set([
    "appraisee",
    "appraiser",
    "reviewer",
    "min",
    "max",
    "round",
    "ceil",
    "floor",
  ]);

  if (identifiers.some((token) => !allowedIdentifiers.has(token.toLowerCase()))) {
    return null;
  }

  try {
    const result = Function(
      "appraisee",
      "appraiser",
      "reviewer",
      "min",
      "max",
      "round",
      "ceil",
      "floor",
      `"use strict"; return (${normalized});`
    )(
      toNumber(values.appraisee),
      toNumber(values.appraiser),
      toNumber(values.reviewer),
      Math.min,
      Math.max,
      Math.round,
      Math.ceil,
      Math.floor
    );

    const parsed = Number(result);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getRawMark(kra = {}, draftMark = {}, field) {
  const draftValue = draftMark?.[field];
  if (draftValue !== undefined && draftValue !== null && draftValue !== "") {
    return toNumber(draftValue);
  }

  const savedValue = kra?.[field];
  if (savedValue !== undefined && savedValue !== null && savedValue !== "") {
    return toNumber(savedValue);
  }

  return null;
}

export function getFinalMark(kra = {}, draftMark = {}, appraisal = {}) {
  const ratingSettings = appraisal?.frame_config?.rating_settings || {};
  const formulaMode = ratingSettings?.formula_mode || "weighted_average";
  const reviewer = getRawMark(kra, draftMark, "reviewer_mark");
  const appraiser = getRawMark(kra, draftMark, "appraiser_mark");
  const appraisee = getRawMark(kra, draftMark, "appraisee_mark");

  if (formulaMode === "custom_formula") {
    const computed = evaluateCustomFormula(
      ratingSettings?.formula_expression || DEFAULT_FORMULA_EXPRESSION,
      {
        appraisee: appraisee ?? 0,
        appraiser: appraiser ?? 0,
        reviewer: reviewer ?? 0,
      }
    );

    if (computed !== null) {
      return computed;
    }
  }

  if (formulaMode === "latest_available") {
    const candidates = [reviewer, appraiser, appraisee];
    for (const value of candidates) {
      if (value !== null) {
        return value;
      }
    }
    return 0;
  }

  const formulaWeights = ratingSettings?.formula_weights || {};
  const weightedMarks = [
    { value: appraisee, weight: toNumber(formulaWeights.appraisee) },
    { value: appraiser, weight: toNumber(formulaWeights.appraiser) },
    { value: reviewer, weight: toNumber(formulaWeights.reviewer) },
  ].filter((item) => item.value !== null && item.weight > 0);

  if (weightedMarks.length === 0) {
    const fallback = [reviewer, appraiser, appraisee].find((value) => value !== null);
    return fallback ?? 0;
  }

  const totalWeight = weightedMarks.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  const weightedScore = weightedMarks.reduce((sum, item) => sum + item.value * item.weight, 0);
  return weightedScore / totalWeight;
}

export function getSectionWeight(section, appraisal = {}) {
  const frameConfig = appraisal?.frame_config || {};
  const steps = frameConfig?.steps || {};
  const stepWeights = frameConfig?.step_weights || {};

  if (steps[section] === false) {
    return 0;
  }

  const configured = toNumber(stepWeights[section]);
  if (configured > 0) {
    return configured;
  }

  if (section === "kra_objectives") return 60;

  const allKras = appraisal?.kras || [];
  const attributeKras = allKras.filter((kra) => kra.section !== "kra_objectives");
  const attributeMax = attributeKras.reduce((sum, kra) => sum + toNumber(kra.max_mark), 0);
  const sectionMax = attributeKras
    .filter((kra) => kra.section === section)
    .reduce((sum, kra) => sum + toNumber(kra.max_mark), 0);

  return attributeMax > 0 ? (sectionMax / attributeMax) * 40 : 0;
}

export function getSectionMetrics(kras = [], marks = {}, weight = 0, appraisal = {}) {
  const max = kras.reduce((sum, kra) => sum + toNumber(kra.max_mark), 0);
  const score = kras.reduce(
    (sum, kra) => sum + getFinalMark(kra, marks[kra.id] || {}, appraisal),
    0
  );
  const ratio = max > 0 ? (score / max) * 100 : 0;
  const weighted = ratio * (weight / 100);

  return { max, score, ratio, weight, weighted };
}

export function getRatingSettings(appraisal = {}) {
  const ratingSettings = appraisal?.frame_config?.rating_settings || {};
  const bands = Array.isArray(ratingSettings?.bands) && ratingSettings.bands.length > 0
    ? [...ratingSettings.bands]
        .map((band, index) => ({
          min: Math.max(0, toNumber(band?.min)),
          label: band?.label || `Band ${index + 1}`,
        }))
        .sort((a, b) => b.min - a.min)
    : [
        { min: 91, label: "Exceeds Expectations" },
        { min: 81, label: "Perfectly Meets Expectations" },
        { min: 66, label: "Fairly Meets Expectations" },
        { min: 51, label: "Somewhat Meets Expectations (PIP)" },
        { min: 0, label: "Not Meeting Expectations" },
      ];

  return {
    memoPenalty: Math.max(0, toNumber(ratingSettings?.memo_penalty)),
    bands,
  };
}

export function getPerformanceBand(netRating, appraisal = {}) {
  const { bands } = getRatingSettings(appraisal);
  const matched = bands.find((band) => netRating >= band.min);
  return matched?.label || "Not Meeting Expectations";
}

export function getOverallPerformance(appraisal = {}, marks = {}) {
  const allKras = appraisal?.kras || [];
  const objectives = allKras.filter((kra) => kra.section === "kra_objectives");
  const competencies = allKras.filter((kra) => kra.section === "competencies");
  const behaviour = allKras.filter((kra) => kra.section === "behaviour");
  const attributes = [...competencies, ...behaviour];

  const objectivesMetrics = getSectionMetrics(
    objectives,
    marks,
    getSectionWeight("kra_objectives", appraisal),
    appraisal
  );
  const competenciesMetrics = getSectionMetrics(
    competencies,
    marks,
    getSectionWeight("competencies", appraisal),
    appraisal
  );
  const behaviourMetrics = getSectionMetrics(
    behaviour,
    marks,
    getSectionWeight("behaviour", appraisal),
    appraisal
  );

  const part2Max = attributes.reduce((sum, kra) => sum + toNumber(kra.max_mark), 0);
  const part2Score = attributes.reduce(
    (sum, kra) => sum + getFinalMark(kra, marks[kra.id] || {}, appraisal),
    0
  );
  const part2Rating = part2Max > 0 ? (part2Score / part2Max) * 100 : 0;

  const weightedPart1 = objectivesMetrics.weighted;
  const weightedPart2 = competenciesMetrics.weighted + behaviourMetrics.weighted;
  const totalRating = weightedPart1 + weightedPart2;
  const { bands } = getRatingSettings(appraisal);
  // Use the per-employee total memo deduction saved in extra_appraiser_data by MemoPage.
  const memoPenalty = Math.max(0, toNumber(appraisal?.extra_appraiser_data?.memo_total_deduction));
  const netRating = Math.max(0, totalRating - memoPenalty);

  return {
    objectivesMetrics,
    competenciesMetrics,
    behaviourMetrics,
    part1Rating: objectivesMetrics.ratio,
    part2Rating,
    weightedPart1,
    weightedPart2,
    totalRating,
    memoPenalty,
    netRating,
    ratingBands: bands,
    performanceBand: getPerformanceBand(netRating, appraisal),
  };
}
