import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getEffectiveOrgId } from '../lib/orgScope';
import { useUser } from '../context/UserContext';
import {
  buildDexaExtractionSystemPrompt,
  DEXA_EXTRACTION_FIELDS,
  DEXA_NUMERIC_FIELDS,
  DEXA_POPULATION_ORDER,
} from '../lib/dexaFieldConfig';

const STAGGER_MS = 60;
const HIGHLIGHT_MS = 300;
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

function parseExtractionJson(text) {
  const trimmed = (text ?? '').trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read PDF file.'));
        return;
      }
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read PDF file.'));
    reader.readAsDataURL(file);
  });
}

function coerceFieldValue(key, value) {
  if (value === '' || value == null) return null;
  if (key === 'scan_date' || key === 'scan_id' || key === 'machine_model' || key === 'analysis_version') {
    return String(value).trim() || null;
  }
  if (DEXA_NUMERIC_FIELDS.has(key)) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return value;
}

function pickDexaPayload(fields) {
  const payload = {};
  for (const key of DEXA_EXTRACTION_FIELDS) {
    if (fields && Object.prototype.hasOwnProperty.call(fields, key)) {
      payload[key] = fields[key] ?? null;
    }
  }
  return payload;
}

export function useDexaExtraction() {
  const { user, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);

  const [step, setStep] = useState('idle');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [extractedFields, setExtractedFields] = useState(null);
  const [populatedFields, setPopulatedFields] = useState(() => new Set());
  const [highlightedKeys, setHighlightedKeys] = useState(() => new Set());
  const [error, setError] = useState(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);

  const staggerTimeoutsRef = useRef([]);
  const highlightTimeoutsRef = useRef([]);

  const clearTimers = useCallback(() => {
    staggerTimeoutsRef.current.forEach(clearTimeout);
    highlightTimeoutsRef.current.forEach(clearTimeout);
    staggerTimeoutsRef.current = [];
    highlightTimeoutsRef.current = [];
  }, []);

  const animateFieldPopulation = useCallback((fields) => {
    clearTimers();
    setPopulatedFields(new Set());
    setHighlightedKeys(new Set());

    const keysInOrder = DEXA_POPULATION_ORDER.filter(
      (key) => fields && Object.prototype.hasOwnProperty.call(fields, key),
    );

    keysInOrder.forEach((key, index) => {
      const timeoutId = setTimeout(() => {
        setPopulatedFields((prev) => new Set(prev).add(key));
        setHighlightedKeys((prev) => new Set(prev).add(key));

        const highlightId = setTimeout(() => {
          setHighlightedKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, HIGHLIGHT_MS);
        highlightTimeoutsRef.current.push(highlightId);

        if (index === keysInOrder.length - 1) {
          setStep('reviewing');
        }
      }, index * STAGGER_MS);
      staggerTimeoutsRef.current.push(timeoutId);
    });

    if (!keysInOrder.length) {
      setStep('reviewing');
    }
  }, [clearTimers]);

  const extractFromPdf = useCallback(async (base64) => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key is not configured (VITE_ANTHROPIC_API_KEY).');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        system: buildDexaExtractionSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: 'Extract all DEXA scan fields from this report as JSON.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Extraction failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (!text) throw new Error('No extraction response from AI.');

    const parsed = parseExtractionJson(text);
    const payload = pickDexaPayload(parsed);
    setExtractedFields(payload);
    animateFieldPopulation(payload);
  }, [animateFieldPopulation]);

  const handleFileSelect = useCallback(async (file) => {
    try {
      setError(null);
      if (!file) return;
      if (file.type !== 'application/pdf') {
        throw new Error('Please upload a PDF file.');
      }
      if (!selectedAthleteId) {
        throw new Error('Select an athlete before uploading.');
      }

      setStep('uploading');
      setPdfFile(file);
      const base64 = await readFileAsBase64(file);
      setPdfBase64(base64);
      setStep('extracting');
      setExtractedFields(null);
      setPopulatedFields(new Set());
      setHighlightedKeys(new Set());
      await extractFromPdf(base64);
    } catch (err) {
      console.error('[DexaExtraction]', err);
      setStep('error');
      setError(err?.message ?? 'Failed to extract scan data.');
    }
  }, [extractFromPdf, selectedAthleteId]);

  const updateField = useCallback((key, value) => {
    setExtractedFields((prev) => ({
      ...(prev ?? {}),
      [key]: coerceFieldValue(key, value),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setError(null);
      if (!effectiveOrgId) throw new Error('Organisation context is missing.');
      if (!selectedAthleteId) throw new Error('Select an athlete before saving.');
      if (!extractedFields) throw new Error('No scan data to save.');

      setStep('saving');
      const row = {
        org_id: effectiveOrgId,
        athlete_id: selectedAthleteId,
        source: 'ai_extracted',
        created_by: user?.id ?? null,
        ...pickDexaPayload(extractedFields),
      };

      const { error: insertError } = await supabase.from('dexa_scans').insert(row);
      if (insertError) throw insertError;
      setStep('saved');
    } catch (err) {
      console.error('[DexaExtraction]', err);
      setStep('error');
      setError(err?.message ?? 'Failed to save scan.');
    }
  }, [effectiveOrgId, extractedFields, selectedAthleteId]);

  const reset = useCallback(() => {
    clearTimers();
    setStep('idle');
    setPdfFile(null);
    setPdfBase64(null);
    setExtractedFields(null);
    setPopulatedFields(new Set());
    setHighlightedKeys(new Set());
    setError(null);
  }, [clearTimers]);

  return {
    step,
    pdfFile,
    pdfBase64,
    extractedFields,
    populatedFields,
    highlightedKeys,
    error,
    selectedAthleteId,
    setSelectedAthleteId,
    handleFileSelect,
    updateField,
    handleSave,
    reset,
  };
}
