import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from './vue.js';
import { initAuth, apiFetch, getToken } from './auth.js';
import { createEditor } from './editor.js';

marked.use({ gfm: true, breaks: false });

const MERMAID_SRC = '/vendor/mermaid/mermaid.min.js';

export function setup() {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const authReady = ref(false);
  const authError = ref(false);

  // ── App state ─────────────────────────────────────────────────────────────
  const tree            = ref([]);
  const rootPath        = ref('');
  const selectedFile    = ref(null);
  const fileContent     = ref('');
  const originalContent = ref('');
  const fileMtime       = ref(null);
  const editMode        = ref(false);
  const isDark          = ref(false);
  const sidebarOpen     = ref(true);
  const loading         = ref(false);
  const loadingFile     = ref(false);
  const saving          = ref(false);
  const toast           = ref({ show: false, type: 'success', message: '' });
  const editorContainer = ref(null);

  let cmEditor          = null;
  let toastTimer        = null;
  let evtSource         = null;
  const scrollPositions = new Map();
  const serverDown      = ref(false);
  const showShortcuts   = ref(false);
  const newFileDir      = ref(null); // folder the New File dialog opens in; null when closed

  const isDirty      = computed(() => fileContent.value !== originalContent.value);
  const renderedHtml = computed(() => {
    if (!fileContent.value) return '';
    try {
      // Markdown can carry raw HTML; sanitize before it reaches v-html.
      // If DOMPurify failed to load this throws and we show the error instead.
      return DOMPurify.sanitize(marked.parse(fileContent.value))
        .replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
    }
    catch (e) { return `<pre class="text-danger">Parse error: ${e.message}</pre>`; }
  });

  function showToast(msg, type = 'success') {
    clearTimeout(toastTimer);
    toast.value = { show: true, type, message: msg };
    toastTimer  = setTimeout(() => { toast.value.show = false; }, 3000);
  }

  // ── CodeMirror lifecycle ─────────────────────────────────────────────────
  function initCM() {
    if (!editorContainer.value) return;
    cmEditor = createEditor(editorContainer.value, {
      value:        fileContent.value,
      dark:         isDark.value,
      onChange:     val => { fileContent.value = val; },
    });
  }

  watch(editMode, isEdit => { if (!isEdit) cmEditor = null; });

  // @after-enter fires once the entering element is fully in the DOM.
  // With mode="out-in" the leave animation finishes first, so the CM container
  // doesn't exist until this hook — nextTick() inside the watcher is too early.
  function applyHighlighting() {
    convertMermaidBlocks();
    renderMermaid();
    if (!window.hljs) return;
    document.querySelectorAll('.markdown-body pre code').forEach(el => {
      delete el.dataset.highlighted;
      window.hljs.highlightElement(el);
    });
  }

  // ── Mermaid ──────────────────────────────────────────────────────────────
  // Loaded lazily so documents without diagrams never pay for the bundle.
  let mermaidPromise = null;
  function loadMermaid() {
    mermaidPromise ??= new Promise((resolve, reject) => {
      const script   = document.createElement('script');
      script.src     = MERMAID_SRC;
      script.onload  = () => resolve(window.mermaid);
      script.onerror = () => reject(new Error(`could not load ${MERMAID_SRC}`));
      document.head.appendChild(script);
    });
    return mermaidPromise;
  }

  // Swap ```mermaid code blocks for containers before hljs sees them.
  // The source is kept in data-source so diagrams can be re-rendered on theme change.
  function convertMermaidBlocks() {
    document.querySelectorAll('.markdown-body pre > code.language-mermaid').forEach(code => {
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.dataset.source = code.textContent;
      code.parentElement.replaceWith(div);
    });
  }

  async function renderMermaid() {
    const nodes = [...document.querySelectorAll('.markdown-body .mermaid[data-source]')];
    if (!nodes.length) return;
    try {
      const mermaid = await loadMermaid();
      mermaid.initialize({
        startOnLoad:   false,
        securityLevel: 'strict',
        theme:         isDark.value ? 'dark' : 'default',
      });
      nodes.forEach(n => {
        n.removeAttribute('data-processed');
        n.textContent = n.dataset.source;
      });
      await mermaid.run({ nodes, suppressErrors: true });
    } catch (e) {
      mermaidPromise = null;
      showToast('Failed to render diagram: ' + e.message, 'danger');
    }
  }

  function onAfterEnter() {
    if (editMode.value && editorContainer.value && !cmEditor) initCM();
    else if (!editMode.value) applyHighlighting();
  }

  watch(fileContent, val => {
    if (cmEditor && cmEditor.getValue() !== val) cmEditor.setValue(val);
  });

  watch(isDark, dark => {
    if (cmEditor) cmEditor.setOption('theme', dark ? 'dracula' : 'default');
    else renderMermaid();
  });

  // ── Data loading ─────────────────────────────────────────────────────────
  async function loadTree() {
    loading.value = true;
    try {
      const res  = await apiFetch('/api/tree');
      const data = await res.json();
      tree.value     = data.tree;
      rootPath.value = data.root;
    } catch (e) {
      showToast('Failed to load tree: ' + e.message, 'danger');
    } finally {
      loading.value = false;
    }
  }

  async function openFile(file) {
    if (isDirty.value && !confirm('You have unsaved changes. Discard and open new file?')) return;
    if (selectedFile.value) scrollPositions.set(selectedFile.value.path, window.scrollY);
    selectedFile.value   = file;
    loadingFile.value    = true;
    editMode.value       = false;
    window.location.hash = '#' + encodeURIComponent(file.path);
    try {
      const res  = await apiFetch(`/api/file?path=${encodeURIComponent(file.path)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      fileContent.value     = data.content;
      originalContent.value = data.content;
      fileMtime.value       = data.mtime;
    } catch (e) {
      showToast('Failed to load file: ' + e.message, 'danger');
    } finally {
      loadingFile.value = false;
      await nextTick();
      window.scrollTo({ top: scrollPositions.get(file.path) ?? 0, behavior: 'instant' });
    }
  }

  function putFile(body) {
    return apiFetch(`/api/file?path=${encodeURIComponent(selectedFile.value.path)}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  }

  async function saveFile() {
    if (!selectedFile.value || saving.value) return;
    saving.value = true;
    try {
      const content = fileContent.value;
      let res = await putFile({ content, mtime: fileMtime.value });
      if (res.status === 409) {
        if (!confirm('This file was changed on disk since you opened it. Overwrite those changes?')) {
          showToast('Save cancelled, file changed on disk', 'warning');
          return;
        }
        res = await putFile({ content });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      originalContent.value = content;
      fileMtime.value       = data.mtime;
      showToast('Saved successfully');
    } catch (e) {
      showToast('Save failed: ' + e.message, 'danger');
    } finally {
      saving.value = false;
    }
  }

  function openNewFile(dir = '') {
    newFileDir.value = dir;
  }

  async function onCreated({ path }) {
    newFileDir.value = null;
    await loadTree();
    await openFile({ type: 'file', name: path.split(/[\\/]/).pop(), path });
    if (selectedFile.value?.path === path) editMode.value = true;
    showToast(`Created ${path}`);
  }

  function startResize(e) {
    const root   = document.documentElement;
    const startX = e.clientX;
    const startW = parseInt(getComputedStyle(root).getPropertyValue('--sidebar-width')) || 240;

    document.body.classList.add('is-resizing');

    const onMove = e => {
      const w = Math.max(160, Math.min(520, startW + e.clientX - startX));
      root.style.setProperty('--sidebar-width', w + 'px');
    };
    const onUp = () => {
      document.body.classList.remove('is-resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function toggleTheme() {
    isDark.value = !isDark.value;
    document.documentElement.setAttribute('data-bs-theme', isDark.value ? 'dark' : 'light');
    document.getElementById('hljs-light').media = isDark.value ? 'print' : 'all';
    document.getElementById('hljs-dark').media  = isDark.value ? 'all'   : 'print';
  }

  watch(renderedHtml, async () => {
    if (editMode.value) return;
    await nextTick();
    applyHighlighting();
  }, { flush: 'post' });

  function loadFromHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const filePath = decodeURIComponent(hash);
    function find(items) {
      for (const item of items) {
        if (item.type === 'file' && item.path === filePath) return item;
        if (item.type === 'dir') { const f = find(item.children); if (f) return f; }
      }
      return null;
    }
    const file = find(tree.value);
    if (file) openFile(file);
  }

  const onGlobalKey = e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (editMode.value && selectedFile.value) saveFile();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      if (selectedFile.value) editMode.value = !editMode.value;
      return;
    }
    if (e.key === 'F1') {
      e.preventDefault();
      showShortcuts.value = !showShortcuts.value;
      return;
    }
  };

  function connectEvents() {
    evtSource = new EventSource(`/api/events?token=${getToken()}`);
    evtSource.onopen  = () => { serverDown.value = false; };
    evtSource.onerror = () => { serverDown.value = true; evtSource.close(); };
  }

  onMounted(async () => {
    const result = await initAuth();
    authReady.value = result.ready;
    authError.value = result.error;
    if (!authReady.value) return;
    await loadTree();
    loadFromHash();
    connectEvents();
    window.addEventListener('hashchange', loadFromHash);
    window.addEventListener('keydown', onGlobalKey);
  });

  onBeforeUnmount(() => {
    evtSource?.close();
    window.removeEventListener('hashchange', loadFromHash);
    window.removeEventListener('keydown', onGlobalKey);
  });

  return {
    tree, rootPath, selectedFile, fileContent, editMode,
    isDirty, isDark, sidebarOpen, loading, loadingFile, saving, toast, serverDown,
    authReady, authError, newFileDir, openNewFile, onCreated,
    renderedHtml, editorContainer, loadTree, openFile, saveFile, toggleTheme, onAfterEnter, startResize, showShortcuts,
  };
}
