export default function RichTextToolbar({ textareaRef, value, onChange }) {
  function wrap(before, after = before) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const newVal = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }

  function insertAtLineStart(prefix) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const already = value.slice(lineStart).startsWith(prefix);
    const newVal = already
      ? value.slice(0, lineStart) + value.slice(lineStart + prefix.length)
      : value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(newVal);
    setTimeout(() => el.focus(), 0);
  }

  const btnClass =
    'px-2 py-1 text-[10px] font-bold rounded border border-white/10 ' +
    'text-gray-400 hover:text-white hover:bg-white/10 transition-colors';

  return (
    <div className="flex items-center gap-1 mb-1 flex-wrap">
      <button type="button" className={btnClass} onClick={() => wrap('**')}>
        B
      </button>
      <button type="button" className={`${btnClass} italic`} onClick={() => wrap('_')}>
        I
      </button>
      <button type="button" className={btnClass} onClick={() => insertAtLineStart('• ')}>
        • List
      </button>
      <button type="button" className={btnClass} onClick={() => insertAtLineStart('1. ')}>
        1. List
      </button>
      <button type="button" className={btnClass} onClick={() => wrap('`')}>
        Code
      </button>
    </div>
  );
}
