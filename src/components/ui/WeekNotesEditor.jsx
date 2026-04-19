import { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { supabase } from '../../lib/supabaseClient';
import { getCurrentUser } from '../../lib/auth';

export default function WeekNotesEditor({ planId, weekStartIso }) {
  const user = getCurrentUser();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: {
      attributes: {
        class: 'min-h-[80px] outline-none text-sm text-white',
      },
    },
  });

  // Load this week's notes, falling back to previous week's notes
  const loadNotes = useCallback(async () => {
    if (!planId || !weekStartIso || !editor) return;

    // Try current week first
    const { data: current } = await supabase
      .from('plan_week_notes')
      .select('content')
      .eq('plan_id', planId)
      .eq('org_id', user.orgId)
      .eq('week_start_iso', weekStartIso)
      .maybeSingle();

    if (current?.content) {
      editor.commands.setContent(current.content);
      setLoaded(true);
      return;
    }

    // Fall back to previous week's notes as a starting point
    const prevWeek = new Date(weekStartIso + 'T12:00:00');
    prevWeek.setDate(prevWeek.getDate() - 7);
    const prevIso = prevWeek.toISOString().slice(0, 10);

    const { data: prev } = await supabase
      .from('plan_week_notes')
      .select('content')
      .eq('plan_id', planId)
      .eq('org_id', user.orgId)
      .eq('week_start_iso', prevIso)
      .maybeSingle();

    if (prev?.content) {
      editor.commands.setContent(prev.content);
    } else {
      editor.commands.setContent('');
    }
    setLoaded(true);
  }, [planId, weekStartIso, editor, user.orgId]);

  useEffect(() => {
    setLoaded(false);
    loadNotes();
  }, [planId, weekStartIso, loadNotes]);

  async function handleSave() {
    if (!editor || !planId || !weekStartIso) return;
    setSaving(true);
    setSaved(false);
    try {
      const html = editor.getHTML();
      // First check if a record exists
      const { data: existing } = await supabase
        .from('plan_week_notes')
        .select('id')
        .eq('plan_id', planId)
        .eq('org_id', user.orgId)
        .eq('week_start_iso', weekStartIso)
        .maybeSingle();

      let error;
      if (existing?.id) {
        const { error: updateErr } = await supabase
          .from('plan_week_notes')
          .update({
            content: html,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('org_id', user.orgId);
        error = updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('plan_week_notes')
          .insert({
            plan_id: planId,
            org_id: user.orgId,
            week_start_iso: weekStartIso,
            content: html,
          });
        error = insertErr;
      }
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (!editor) return null;

  const btnBase =
    'px-1.5 py-0.5 text-[10px] font-bold rounded border border-white/10 ' +
    'text-gray-400 hover:text-white hover:bg-white/10 transition-colors';
  const btnActive = 'bg-white/20 text-white border-white/30';

  return (
    <>
      <style>{`
        .tiptap-editor ul {
          list-style-type: disc;
          padding-left: 1.25rem;
          margin: 0.25rem 0;
        }
        .tiptap-editor ol {
          list-style-type: decimal;
          padding-left: 1.25rem;
          margin: 0.25rem 0;
        }
        .tiptap-editor li {
          margin: 0.1rem 0;
          color: white;
        }
        .tiptap-editor p {
          margin: 0.2rem 0;
          color: white;
        }
        .tiptap-editor strong {
          font-weight: 700;
          color: white;
        }
        .tiptap-editor em {
          font-style: italic;
          color: white;
        }
        .tiptap-editor h3 {
          font-size: 0.95rem;
          font-weight: 600;
          color: white;
          margin: 0.4rem 0 0.2rem;
        }
        .tiptap-editor .ProseMirror:focus {
          outline: none;
        }
      `}</style>
      <div className="mt-3 rounded-lg border border-white/10 bg-[#252528] p-3" aria-busy={!loaded}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase text-gray-500">Week notes</span>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-[#F97316] text-black disabled:opacity-40"
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 mb-2 pb-2 border-b border-white/10 flex-wrap">
          <button
            type="button"
            className={`${btnBase} font-bold ${editor.isActive('bold') ? btnActive : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className={`${btnBase} italic ${editor.isActive('italic') ? btnActive : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            type="button"
            className={`${btnBase} ${editor.isActive('bulletList') ? btnActive : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • List
          </button>
          <button
            type="button"
            className={`${btnBase} ${editor.isActive('orderedList') ? btnActive : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1. List
          </button>
          <button
            type="button"
            className={`${btnBase} ${editor.isActive('heading', { level: 3 }) ? btnActive : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            H
          </button>
          <button type="button" className={`${btnBase}`} onClick={() => editor.chain().focus().undo().run()}>
            ↩
          </button>
          <button type="button" className={`${btnBase}`} onClick={() => editor.chain().focus().redo().run()}>
            ↪
          </button>
        </div>

        {/* Editor area */}
        <div
          className="tiptap-editor bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 min-h-[80px] cursor-text"
          onClick={() => editor.commands.focus()}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}
