export const DEFAULT_WELLNESS_TEMPLATE_ORG_ID = 'a1000000-0000-0000-0000-000000000001';

export const WELLNESS_FORM_ITEM_SELECT =
  'id, key, label, label_translations, input_type, scale_min, scale_max, scale_min_label, scale_max_label, options, direction, sort_order, is_required, is_active';

export const INPUT_TYPES = ['slider', 'number', 'radio', 'body_map'];

export function slugifyWellnessKey(label) {
  return String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'question';
}

export function parseLabelTranslations(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function parseOptions(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
