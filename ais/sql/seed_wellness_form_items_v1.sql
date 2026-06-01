-- =============================================================================
-- Wellness form items + thresholds — default template for all target orgs
-- Safe to re-run (ON CONFLICT DO NOTHING).
-- =============================================================================

BEGIN;

-- Default IIS org
INSERT INTO public.wellness_form_items
  (org_id, key, label, input_type, scale_min, scale_max,
   scale_min_label, scale_max_label, direction, sort_order,
   is_required, label_translations)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'fatigue', 'How fatigued are you feeling this morning?', 'slider', 1, 5, 'Very Fresh', 'Very Tired', 'lower_better', 1, true, '{"hi": "आज सुबह आप कितना थका हुआ महसूस कर रहे हैं?"}'),
  ('a1000000-0000-0000-0000-000000000001', 'soreness', 'Do you have general muscle soreness this morning?', 'slider', 1, 5, 'Zero Muscle Soreness', 'High Muscle Soreness', 'lower_better', 2, true, '{"hi": "क्या आज सुबह आपको अपनी मांसपेशियों में सामान्य दर्द है?"}'),
  ('a1000000-0000-0000-0000-000000000001', 'sleep_quality', 'Rate your quality of sleep', 'slider', 1, 5, 'Very Poor', 'Very Restful', 'higher_better', 3, true, '{"hi": "अपनी नींद की गुणवत्ता का मूल्यांकन करें"}'),
  ('a1000000-0000-0000-0000-000000000001', 'sleep_hours', 'How many hours of sleep did you have last night?', 'slider', 0, 10, '0 hours', '10 hours', 'higher_better', 4, true, '{"hi": "पिछली रात आपने कितने घंटे सोए?"}'),
  ('a1000000-0000-0000-0000-000000000001', 'mood', 'Describe your mood this morning', 'slider', 1, 5, 'Very Poor', 'Very Positive', 'higher_better', 5, true, '{"hi": "आज सुबह अपने मूड का वर्णन करें"}'),
  ('a1000000-0000-0000-0000-000000000001', 'motivation', 'Describe your motivation to train today', 'slider', 1, 5, 'Not Motivated', 'Very Motivated', 'higher_better', 6, true, '{"hi": "आज अभ्यास के लिए अपनी प्रेरणा का वर्णन करें"}'),
  ('a1000000-0000-0000-0000-000000000001', 'performance_satisfaction', 'How satisfied are you with yesterday''s performance?', 'slider', 1, 5, 'I can do better', 'Yes, mostly', 'higher_better', 7, true, '{"hi": "आप अपने कल के प्रदर्शन से कितने संतुष्ट हैं?"}'),
  ('a1000000-0000-0000-0000-000000000001', 'plan_adherence', 'Did yesterday go as per your plan?', 'slider', 1, 5, 'No, could be better', 'Yes, mostly', 'higher_better', 8, true, '{"hi": "क्या कल सब कुछ आपकी योजना के अनुसार गया?"}'),
  ('a1000000-0000-0000-0000-000000000001', 'gut_health', 'How is your gut health this morning?', 'radio', null, null, null, null, 'higher_better', 9, true, '{"hi": "आज सुबह आपके पेट का स्वास्थ्य कैसा है?"}'),
  ('a1000000-0000-0000-0000-000000000001', 'soreness_areas', 'Please indicate any areas of soreness', 'body_map', null, null, null, null, 'lower_better', 10, false, '{"hi": "कृपया दर्द वाले किसी भी क्षेत्र को इंगित करें"}')
ON CONFLICT (org_id, key) DO NOTHING;

UPDATE public.wellness_form_items
SET options = '["Acidic", "Constipated", "Gasseous", "Good"]'::jsonb
WHERE org_id = 'a1000000-0000-0000-0000-000000000001'::uuid
  AND key = 'gut_health';

INSERT INTO public.wellness_thresholds (org_id, item_key, threshold) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'fatigue', 4),
  ('a1000000-0000-0000-0000-000000000001', 'soreness', 4),
  ('a1000000-0000-0000-0000-000000000001', 'sleep_quality', 2),
  ('a1000000-0000-0000-0000-000000000001', 'sleep_hours', 5),
  ('a1000000-0000-0000-0000-000000000001', 'mood', 2),
  ('a1000000-0000-0000-0000-000000000001', 'motivation', 2)
ON CONFLICT (org_id, item_key) DO NOTHING;

-- Haryana Steelers Academy
INSERT INTO public.wellness_form_items
  (org_id, key, label, input_type, scale_min, scale_max,
   scale_min_label, scale_max_label, direction, sort_order,
   is_required, label_translations)
VALUES
  ('a3000000-0000-0000-0000-000000000001', 'fatigue', 'How fatigued are you feeling this morning?', 'slider', 1, 5, 'Very Fresh', 'Very Tired', 'lower_better', 1, true, '{"hi": "आज सुबह आप कितना थका हुआ महसूस कर रहे हैं?"}'),
  ('a3000000-0000-0000-0000-000000000001', 'soreness', 'Do you have general muscle soreness this morning?', 'slider', 1, 5, 'Zero Muscle Soreness', 'High Muscle Soreness', 'lower_better', 2, true, '{"hi": "क्या आज सुबह आपको अपनी मांसपेशियों में सामान्य दर्द है?"}'),
  ('a3000000-0000-0000-0000-000000000001', 'sleep_quality', 'Rate your quality of sleep', 'slider', 1, 5, 'Very Poor', 'Very Restful', 'higher_better', 3, true, '{"hi": "अपनी नींद की गुणवत्ता का मूल्यांकन करें"}'),
  ('a3000000-0000-0000-0000-000000000001', 'sleep_hours', 'How many hours of sleep did you have last night?', 'slider', 0, 10, '0 hours', '10 hours', 'higher_better', 4, true, '{"hi": "पिछली रात आपने कितने घंटे सोए?"}'),
  ('a3000000-0000-0000-0000-000000000001', 'mood', 'Describe your mood this morning', 'slider', 1, 5, 'Very Poor', 'Very Positive', 'higher_better', 5, true, '{"hi": "आज सुबह अपने मूड का वर्णन करें"}'),
  ('a3000000-0000-0000-0000-000000000001', 'motivation', 'Describe your motivation to train today', 'slider', 1, 5, 'Not Motivated', 'Very Motivated', 'higher_better', 6, true, '{"hi": "आज अभ्यास के लिए अपनी प्रेरणा का वर्णन करें"}'),
  ('a3000000-0000-0000-0000-000000000001', 'performance_satisfaction', 'How satisfied are you with yesterday''s performance?', 'slider', 1, 5, 'I can do better', 'Yes, mostly', 'higher_better', 7, true, '{"hi": "आप अपने कल के प्रदर्शन से कितने संतुष्ट हैं?"}'),
  ('a3000000-0000-0000-0000-000000000001', 'plan_adherence', 'Did yesterday go as per your plan?', 'slider', 1, 5, 'No, could be better', 'Yes, mostly', 'higher_better', 8, true, '{"hi": "क्या कल सब कुछ आपकी योजना के अनुसार गया?"}'),
  ('a3000000-0000-0000-0000-000000000001', 'gut_health', 'How is your gut health this morning?', 'radio', null, null, null, null, 'higher_better', 9, true, '{"hi": "आज सुबह आपके पेट का स्वास्थ्य कैसा है?"}'),
  ('a3000000-0000-0000-0000-000000000001', 'soreness_areas', 'Please indicate any areas of soreness', 'body_map', null, null, null, null, 'lower_better', 10, false, '{"hi": "कृपया दर्द वाले किसी भी क्षेत्र को इंगित करें"}')
ON CONFLICT (org_id, key) DO NOTHING;

UPDATE public.wellness_form_items
SET options = '["Acidic", "Constipated", "Gasseous", "Good"]'::jsonb
WHERE org_id = 'a3000000-0000-0000-0000-000000000001'::uuid
  AND key = 'gut_health';

INSERT INTO public.wellness_thresholds (org_id, item_key, threshold) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'fatigue', 4),
  ('a3000000-0000-0000-0000-000000000001', 'soreness', 4),
  ('a3000000-0000-0000-0000-000000000001', 'sleep_quality', 2),
  ('a3000000-0000-0000-0000-000000000001', 'sleep_hours', 5),
  ('a3000000-0000-0000-0000-000000000001', 'mood', 2),
  ('a3000000-0000-0000-0000-000000000001', 'motivation', 2)
ON CONFLICT (org_id, item_key) DO NOTHING;

COMMIT;

SELECT org_id, count(*) AS item_count
FROM public.wellness_form_items
WHERE org_id IN (
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'a3000000-0000-0000-0000-000000000001'::uuid
)
GROUP BY org_id
ORDER BY org_id;
