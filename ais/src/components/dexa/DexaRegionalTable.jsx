import { DEXA_REGIONAL_ROWS } from '../../lib/dexaFieldConfig';
import DexaFieldInput from './DexaFieldInput';

const HEADER_CLASS =
  'px-2 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]';

export default function DexaRegionalTable({
  extractedFields,
  populatedFields,
  highlightedKeys,
  step,
  onChange,
}) {
  const showPanel = ['extracting', 'reviewing', 'saving', 'saved'].includes(step);

  if (!showPanel) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
        BODY COMPOSITION — REGIONAL
      </h3>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-outline-variant)]">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-container)]">
              <th className={HEADER_CLASS}>Region</th>
              <th className={HEADER_CLASS}>Fat (g)</th>
              <th className={HEADER_CLASS}>Lean (g)</th>
              <th className={HEADER_CLASS}>BMC (g)</th>
              <th className={HEADER_CLASS}>% Fat</th>
            </tr>
          </thead>
          <tbody>
            {DEXA_REGIONAL_ROWS.map((row, index) => (
              <tr
                key={row.label}
                className={index % 2 === 1 ? 'bg-[var(--color-surface-container-high)]' : 'bg-[var(--color-surface)]'}
              >
                <td className="px-2 py-2 text-xs font-bold text-[var(--color-on-surface)]">{row.label}</td>
                <td className="px-2 py-2">
                  <DexaFieldInput
                    label=""
                    fieldKey={row.fat}
                    value={extractedFields?.[row.fat]}
                    type="number"
                    isPopulated={populatedFields.has(row.fat)}
                    isHighlighted={highlightedKeys.has(row.fat)}
                    onChange={onChange}
                  />
                </td>
                <td className="px-2 py-2">
                  <DexaFieldInput
                    label=""
                    fieldKey={row.lean}
                    value={extractedFields?.[row.lean]}
                    type="number"
                    isPopulated={populatedFields.has(row.lean)}
                    isHighlighted={highlightedKeys.has(row.lean)}
                    onChange={onChange}
                  />
                </td>
                <td className="px-2 py-2">
                  <DexaFieldInput
                    label=""
                    fieldKey={row.bmc}
                    value={extractedFields?.[row.bmc]}
                    type="number"
                    isPopulated={populatedFields.has(row.bmc)}
                    isHighlighted={highlightedKeys.has(row.bmc)}
                    onChange={onChange}
                  />
                </td>
                <td className="px-2 py-2">
                  <DexaFieldInput
                    label=""
                    fieldKey={row.fatPct}
                    value={extractedFields?.[row.fatPct]}
                    type="number"
                    isPopulated={populatedFields.has(row.fatPct)}
                    isHighlighted={highlightedKeys.has(row.fatPct)}
                    onChange={onChange}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
