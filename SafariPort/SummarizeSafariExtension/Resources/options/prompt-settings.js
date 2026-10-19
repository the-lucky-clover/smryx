import {DEFAULT_SUMMARY_PROMPT} from '../shared/default-prompt.js';

// Use the extension's bundled React so Settings has a single React instance.
export function PromptSettings({React, storage, load, validate, revalidate, showSystemMessage}) {
  const h = React.createElement;
  const [prompts, setPrompts] = React.useState([]);
  const [activeId, setActiveId] = React.useState('');
  const [editorId, setEditorId] = React.useState('');
  const [drafts, setDrafts] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  const field = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    load().then(settings => {
      if (cancelled) return;
      setPrompts(settings.prompts);
      setActiveId(settings.activePromptId);
      setEditorId(settings.activePromptId);
    }).catch(err => {if (!cancelled) setError('Could not load prompts: ' + err.message);});
    return () => {cancelled = true;};
  }, [load]);

  const saved = prompts.find(prompt => prompt.id === editorId);
  const draft = drafts[editorId] || saved;
  const isDefault = saved?.title === 'Default Prompt';
  const dirty = draft && (!saved || ['title', 'question', 'systemMessage'].some(key => (draft[key] || '') !== (saved[key] || '')));
  function edit(patch) {
    setDrafts(previous => ({...previous, [editorId]: {...draft, ...patch}}));
    setStatus('');
    setError('');
  }
  async function commit(nextPrompts, nextActiveId, message) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await storage.set({promptSettings: {prompts: nextPrompts, activePromptId: nextActiveId}});
      setPrompts(nextPrompts);
      setActiveId(nextActiveId);
      setStatus(message);
      // The write has succeeded even if a cached settings refresh fails.
      await revalidate().catch(() => {});
      return true;
    } catch (err) {
      setError('Could not save prompt: ' + err.message + '. Your edits are still here; try Save again.');
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    if (lock.current || !draft) return;
    if (!draft.title.trim() || !draft.question.trim()) {
      setError('Enter a prompt title and summarization prompt.');
      return;
    }
    try {
      validate(draft.question);
      if (draft.systemMessage) validate(draft.systemMessage);
    } catch (err) {
      setError('Template error: ' + err.message);
      return;
    }
    const updated = {...draft, title: isDefault ? 'Default Prompt' : draft.title.trim()};
    const next = saved ? prompts.map(prompt => prompt.id === editorId ? updated : prompt) : [...prompts, updated];
    if (await commit(next, activeId || editorId, 'Prompt saved.')) {
      setDrafts(previous => {const result = {...previous}; delete result[editorId]; return result;});
    }
  }
  function start(copy) {
    const id = crypto.randomUUID();
    const prompt = {id, title: copy ? draft.title + ' (Copy)' : 'New Prompt', question: copy ? draft.question : DEFAULT_SUMMARY_PROMPT, systemMessage: copy ? draft.systemMessage || '' : ''};
    setDrafts(previous => ({...previous, [id]: prompt}));
    setEditorId(id);
    setStatus('');
    setError('');
  }
  function discard() {
    setDrafts(previous => {const result = {...previous}; delete result[editorId]; return result;});
    if (!saved) setEditorId(activeId);
    setStatus('Unsaved changes discarded.');
    setError('');
  }
  async function remove() {
    if (!saved || isDefault || prompts.length <= 1) return;
    const next = prompts.filter(prompt => prompt.id !== editorId);
    const nextActive = activeId === editorId ? next[0].id : activeId;
    if (await commit(next, nextActive, 'Prompt deleted.')) {
      setDrafts(previous => {const result = {...previous}; delete result[editorId]; return result;});
      setEditorId(nextActive);
    }
  }
  const button = (label, onClick, extra = {}) => h('button', {type: 'button', disabled: busy, onClick, ...extra}, label);
  return h('section', {className: 'bm-prompt-settings', 'aria-label': 'Prompt settings', 'aria-busy': busy},
    h('div', {className: 'bm-prompt-heading'}, h('h3', null, 'Summarization prompt'), button('Add Prompt', () => start())),
    prompts.length > 0 && h('div', {className: 'bm-prompt-picker'},
      h('label', {htmlFor: 'bm-prompt-select'}, 'Saved prompt'),
      h('select', {id: 'bm-prompt-select', value: saved ? editorId : '', disabled: busy, onChange: event => {setEditorId(event.target.value); setError(''); setStatus('');}},
        !saved && h('option', {value: '', disabled: true}, 'New prompt (unsaved)'),
        ...prompts.map(prompt => h('option', {key: prompt.id, value: prompt.id}, prompt.title + (activeId === prompt.id ? ' — Active' : '')))),
      saved && (activeId === editorId ? h('span', {className: 'bm-prompt-active'}, 'Active') : button('Use this prompt', () => commit(prompts, editorId, 'Active prompt changed.')))),
    draft && h('form', {onSubmit: save, noValidate: true},
      !isDefault && h('div', {className: 'bm-prompt-field'}, h('label', {htmlFor: 'bm-prompt-title'}, 'Prompt title'),
        h('input', {id: 'bm-prompt-title', value: draft.title, disabled: busy, onChange: event => edit({title: event.target.value})})),
      showSystemMessage && h('div', {className: 'bm-prompt-field'}, h('label', {htmlFor: 'bm-prompt-system'}, 'System message'),
        h('textarea', {id: 'bm-prompt-system', rows: 4, value: draft.systemMessage || '', disabled: busy, onChange: event => edit({systemMessage: event.target.value})})),
      h('div', {className: 'bm-prompt-field'}, h('label', {htmlFor: 'bm-summary-prompt'}, 'Summarization prompt'),
        h('p', {id: 'bm-prompt-help', className: 'bm-prompt-help'}, 'Edit directly below, then save. Changes apply to future summaries.'),
        h('textarea', {id: 'bm-summary-prompt', ref: field, rows: 18, value: draft.question, disabled: busy, spellCheck: false, 'aria-describedby': 'bm-prompt-help', onChange: event => edit({question: event.target.value})})),
      h('div', {className: 'bm-prompt-actions'},
        h('button', {type: 'submit', className: 'bm-prompt-save', disabled: busy || !dirty}, busy ? 'Saving…' : 'Save Prompt'),
        button('Discard changes', discard, {disabled: busy || !dirty}),
        button('Copy prompt', () => start(true)),
        isDefault && button('Restore default prompt', () => edit({question: DEFAULT_SUMMARY_PROMPT})),
        saved && !isDefault && button('Delete prompt', remove)),
      h('details', null, h('summary', null, 'Available placeholders'),
        h('p', {className: 'bm-prompt-help'}, 'Placeholders are optional. Source content and output language are included automatically. Click a placeholder to insert it at the cursor.'),
        h('div', {className: 'bm-prompt-placeholders'}, ...['{{TITLE}}', '{{CONTENT}}', '{{URL}}', '{{SELECTED_LANGUAGE}}'].map(value => button(value, () => {
          const input = field.current;
          const start = input.selectionStart, end = input.selectionEnd;
          edit({question: draft.question.slice(0, start) + value + draft.question.slice(end)});
          requestAnimationFrame(() => {input.focus(); input.setSelectionRange(start + value.length, start + value.length);});
        }, {key: value}))))),
    h('p', {role: 'status', className: 'bm-prompt-status'}, status || (dirty ? 'Unsaved changes' : '')),
    error && h('p', {role: 'alert', className: 'bm-prompt-error'}, error));
}
