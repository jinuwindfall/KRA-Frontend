export const APPRAISAL_TYPE_OPTIONS = [
  'Annual',
  'Half Yearly',
  'Quarterly',
  'Monthly',
  'Probation',
  'Special',
];

export const DEFAULT_FRAME_CONFIG = {
  appraisal_options: {
    default_type: 'Annual',
    period_from: '',
    period_to: '',
    special_appraisal_text: '',
    target_scope: 'selected_staff',
    target_department_ids: [],
    target_staff_ids: [],
  },
  steps: {
    kra_objectives: true,
    competencies: true,
    behaviour: true,
    appraiser_details: true,
    remarks: true,
    performance_ratings: true,
  },
  appraiser_fields: {
    strong_areas: true,
    weak_areas: true,
    training_need_a: true,
    training_need_b: true,
    training_need_c: true,
    eligible_for_confirmation: true,
    considered_for_additional_responsibilities: true,
  },
  step_weights: {
    kra_objectives: 60,
    competencies: 20,
    behaviour: 20,
  },
  rating_settings: {
    formula_mode: 'custom_formula',
    formula_expression: '((appraisee * 20) + (appraiser * 40) + (reviewer * 40)) / 100',
    formula_weights: {
      appraisee: 20,
      appraiser: 40,
      reviewer: 40,
    },
    memo_penalty: 0,
    bands: [
      { min: 91, label: 'Exceeds Expectations' },
      { min: 81, label: 'Perfectly Meets Expectations' },
      { min: 66, label: 'Fairly Meets Expectations' },
      { min: 51, label: 'Somewhat Meets Expectations (PIP)' },
      { min: 0, label: 'Not Meeting Expectations' },
    ],
  },
  custom_fields: [],
};

export const FRAME_STEP_OPTIONS = [
  { key: 'kra_objectives', label: 'KRA Objectives' },
  { key: 'competencies', label: 'Competencies' },
  { key: 'behaviour', label: 'Behaviour' },
  { key: 'appraiser_details', label: 'Appraiser Assessment' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'performance_ratings', label: 'Performance Ratings' },
];

export const APPRAISER_FIELD_OPTIONS = [
  { key: 'strong_areas', label: 'Strong Areas' },
  { key: 'weak_areas', label: 'Areas for Improvement' },
  { key: 'training_need_a', label: 'Training Need A' },
  { key: 'training_need_b', label: 'Training Need B' },
  { key: 'training_need_c', label: 'Training Need C' },
  { key: 'eligible_for_confirmation', label: 'Eligible for Confirmation' },
  {
    key: 'considered_for_additional_responsibilities',
    label: 'Additional Responsibilities',
  },
];

export function normalizeFrameConfig(config = {}) {
  const legacyTypeOptions = Array.isArray(config?.appraisal_options?.type_options)
    ? config.appraisal_options.type_options
    : [];
  const legacyDefaultType = legacyTypeOptions.find((option) => APPRAISAL_TYPE_OPTIONS.includes(option));
  const defaultType = APPRAISAL_TYPE_OPTIONS.includes(config?.appraisal_options?.default_type)
    ? config.appraisal_options.default_type
    : legacyDefaultType || DEFAULT_FRAME_CONFIG.appraisal_options.default_type;
  const periodFrom = typeof config?.appraisal_options?.period_from === 'string'
    ? config.appraisal_options.period_from
    : DEFAULT_FRAME_CONFIG.appraisal_options.period_from;
  const periodTo = typeof config?.appraisal_options?.period_to === 'string'
    ? config.appraisal_options.period_to
    : DEFAULT_FRAME_CONFIG.appraisal_options.period_to;
  const specialAppraisalText = typeof config?.appraisal_options?.special_appraisal_text === 'string'
    ? config.appraisal_options.special_appraisal_text
    : DEFAULT_FRAME_CONFIG.appraisal_options.special_appraisal_text;
  const rawTargetScope = config?.appraisal_options?.target_scope;
  const targetScope = ['selected_staff', 'department'].includes(rawTargetScope)
    ? rawTargetScope
    : (rawTargetScope === 'all_staff' ? 'selected_staff' : DEFAULT_FRAME_CONFIG.appraisal_options.target_scope);
  const targetDepartmentIds = Array.isArray(config?.appraisal_options?.target_department_ids)
    ? config.appraisal_options.target_department_ids.map((id) => `${id}`)
    : (config?.appraisal_options?.target_department_id != null && config.appraisal_options.target_department_id !== ''
      ? [`${config.appraisal_options.target_department_id}`]
      : DEFAULT_FRAME_CONFIG.appraisal_options.target_department_ids);
  const targetStaffIds = Array.isArray(config?.appraisal_options?.target_staff_ids)
    ? config.appraisal_options.target_staff_ids.map((id) => `${id}`)
    : DEFAULT_FRAME_CONFIG.appraisal_options.target_staff_ids;

  const customFields = Array.isArray(config?.custom_fields)
    ? config.custom_fields
        .map((field, index) => {
          if (typeof field === 'string') {
            return {
              key: `custom_${index + 1}`,
              label: field,
              type: 'text',
            };
          }

          return {
            key: field?.key || `custom_${index + 1}`,
            label: field?.label || `Extra Field ${index + 1}`,
            type: field?.type || 'text',
          };
        })
        .filter((field) => field.label?.trim())
    : [];

  const ratingBands = Array.isArray(config?.rating_settings?.bands)
    ? config.rating_settings.bands
        .map((band, index) => ({
          min: Math.max(0, Number(band?.min) || 0),
          label: band?.label?.trim() || DEFAULT_FRAME_CONFIG.rating_settings.bands[index]?.label || `Band ${index + 1}`,
        }))
        .sort((a, b) => b.min - a.min)
    : DEFAULT_FRAME_CONFIG.rating_settings.bands;

  const formulaMode = ['weighted_average', 'latest_available', 'custom_formula'].includes(
    config?.rating_settings?.formula_mode
  )
    ? config.rating_settings.formula_mode
    : DEFAULT_FRAME_CONFIG.rating_settings.formula_mode;

  const formulaExpression = config?.rating_settings?.formula_expression?.trim()
    || DEFAULT_FRAME_CONFIG.rating_settings.formula_expression;

  return {
    appraisal_options: {
      default_type: defaultType,
      period_from: periodFrom,
      period_to: periodTo,
      special_appraisal_text: specialAppraisalText,
      target_scope: targetScope,
      target_department_ids: targetDepartmentIds,
      target_staff_ids: targetStaffIds,
    },
    steps: {
      ...DEFAULT_FRAME_CONFIG.steps,
      ...(config?.steps || {}),
    },
    appraiser_fields: {
      ...DEFAULT_FRAME_CONFIG.appraiser_fields,
      ...(config?.appraiser_fields || {}),
    },
    step_weights: {
      ...DEFAULT_FRAME_CONFIG.step_weights,
      ...(config?.step_weights || {}),
    },
    rating_settings: {
      formula_mode: formulaMode,
      formula_expression: formulaExpression,
      formula_weights: {
        appraisee: Math.max(0, Number(config?.rating_settings?.formula_weights?.appraisee) || DEFAULT_FRAME_CONFIG.rating_settings.formula_weights.appraisee),
        appraiser: Math.max(0, Number(config?.rating_settings?.formula_weights?.appraiser) || DEFAULT_FRAME_CONFIG.rating_settings.formula_weights.appraiser),
        reviewer: Math.max(0, Number(config?.rating_settings?.formula_weights?.reviewer) || DEFAULT_FRAME_CONFIG.rating_settings.formula_weights.reviewer),
      },
      memo_penalty: Math.max(0, Number(config?.rating_settings?.memo_penalty) || 0),
      bands: ratingBands,
    },
    custom_fields: customFields,
  };
}
