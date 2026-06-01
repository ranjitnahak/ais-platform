/** DEXA scan field names — must match `dexa_scans` table columns. */

export const DEXA_EXTRACTION_FIELDS = [
  'scan_date',
  'scan_id',
  'machine_model',
  'analysis_version',
  'height_cm',
  'weight_kg',
  'bmi',
  'total_bmd',
  'total_bmc',
  't_score',
  'z_score',
  'l_arm_bmc',
  'r_arm_bmc',
  'trunk_bmc',
  'l_leg_bmc',
  'r_leg_bmc',
  'l_arm_fat',
  'r_arm_fat',
  'trunk_fat',
  'l_leg_fat',
  'r_leg_fat',
  'l_arm_lean',
  'r_arm_lean',
  'trunk_lean',
  'l_leg_lean',
  'r_leg_lean',
  'l_arm_fat_pct',
  'r_arm_fat_pct',
  'trunk_fat_pct',
  'l_leg_fat_pct',
  'r_leg_fat_pct',
  'total_fat_g',
  'total_lean_g',
  'total_fat_pct',
  'android_fat_g',
  'gynoid_fat_g',
  'android_gynoid_ratio',
  'fat_trunk_fat_legs_ratio',
  'trunk_limb_fat_mass_ratio',
  'fat_mass_height2',
  'vat_mass_g',
  'vat_volume_cm3',
  'vat_area_cm2',
  'lean_height2',
  'appen_lean_height2',
];

export const DEXA_NUMERIC_FIELDS = new Set(
  DEXA_EXTRACTION_FIELDS.filter((key) => key !== 'scan_date' && key !== 'scan_id' && key !== 'machine_model' && key !== 'analysis_version'),
);

export const DEXA_POPULATION_ORDER = [...DEXA_EXTRACTION_FIELDS];

export const DEXA_UI_SECTIONS = [
  {
    title: 'SCAN INFORMATION',
    fields: [
      { label: 'Scan Date', fieldKey: 'scan_date', type: 'date' },
      { label: 'Scan ID', fieldKey: 'scan_id', type: 'text' },
      { label: 'Machine Model', fieldKey: 'machine_model', type: 'text' },
      { label: 'Height (cm)', fieldKey: 'height_cm', type: 'number' },
      { label: 'Weight (kg)', fieldKey: 'weight_kg', type: 'number' },
      { label: 'BMI', fieldKey: 'bmi', type: 'number' },
    ],
  },
  {
    title: 'BONE MINERAL DENSITY',
    fields: [
      { label: 'Total BMD', fieldKey: 'total_bmd', type: 'number' },
      { label: 'Total BMC', fieldKey: 'total_bmc', type: 'number' },
      { label: 'T-Score', fieldKey: 't_score', type: 'number' },
      { label: 'Z-Score', fieldKey: 'z_score', type: 'number' },
    ],
  },
  {
    title: 'TOTALS',
    fields: [
      { label: 'Total Fat (g)', fieldKey: 'total_fat_g', type: 'number' },
      { label: 'Total Lean (g)', fieldKey: 'total_lean_g', type: 'number' },
      { label: 'Total Body % Fat', fieldKey: 'total_fat_pct', type: 'number' },
    ],
  },
  {
    title: 'ADIPOSE INDICES',
    fields: [
      { label: 'Android/Gynoid Ratio', fieldKey: 'android_gynoid_ratio', type: 'number' },
      { label: 'VAT Mass (g)', fieldKey: 'vat_mass_g', type: 'number' },
      { label: 'VAT Volume (cm³)', fieldKey: 'vat_volume_cm3', type: 'number' },
      { label: 'VAT Area (cm²)', fieldKey: 'vat_area_cm2', type: 'number' },
      { label: 'Fat Mass/Height²', fieldKey: 'fat_mass_height2', type: 'number' },
      { label: '% Fat Trunk/% Fat Legs', fieldKey: 'fat_trunk_fat_legs_ratio', type: 'number' },
      { label: 'Trunk/Limb Fat Ratio', fieldKey: 'trunk_limb_fat_mass_ratio', type: 'number' },
    ],
  },
  {
    title: 'LEAN INDICES',
    fields: [
      { label: 'Lean/Height²', fieldKey: 'lean_height2', type: 'number' },
      { label: 'Appendicular Lean/Height²', fieldKey: 'appen_lean_height2', type: 'number' },
    ],
  },
];

export const DEXA_REGIONAL_ROWS = [
  { label: 'L Arm', fat: 'l_arm_fat', lean: 'l_arm_lean', bmc: 'l_arm_bmc', fatPct: 'l_arm_fat_pct' },
  { label: 'R Arm', fat: 'r_arm_fat', lean: 'r_arm_lean', bmc: 'r_arm_bmc', fatPct: 'r_arm_fat_pct' },
  { label: 'Trunk', fat: 'trunk_fat', lean: 'trunk_lean', bmc: 'trunk_bmc', fatPct: 'trunk_fat_pct' },
  { label: 'L Leg', fat: 'l_leg_fat', lean: 'l_leg_lean', bmc: 'l_leg_bmc', fatPct: 'l_leg_fat_pct' },
  { label: 'R Leg', fat: 'r_leg_fat', lean: 'r_leg_lean', bmc: 'r_leg_bmc', fatPct: 'r_leg_fat_pct' },
];

export function buildDexaExtractionSystemPrompt() {
  const fieldList = DEXA_EXTRACTION_FIELDS.join(', ');
  return `You are a precise data extraction assistant. Extract all fields from this DEXA scan report and return ONLY a valid JSON object with no preamble, no markdown, no backticks. Use exactly these field names: ${fieldList}. Return null for any field not present in the report. Return scan_date as YYYY-MM-DD format. All numeric values as numbers, not strings.`;
}
