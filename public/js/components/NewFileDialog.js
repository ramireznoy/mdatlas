import { ref, computed, watch, onMounted } from '../vue.js';
import { apiFetch } from '../auth.js';

// "docs/adr/0001" → folder part "docs/adr/" and the text after the last slash
function splitPath(value) {
  const clean = value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  const i = clean.lastIndexOf('/');
  return { dir: clean.slice(0, i + 1), leaf: clean.slice(i + 1) };
}

// "getting-started.md" → "# Getting started"
function headingFor(path) {
  const title = path.split('/').pop().replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim();
  return title ? `# ${title[0].toUpperCase()}${title.slice(1)}\n\n` : '';
}

export const NewFileDialog = {
  name: 'NewFileDialog',
  template: `
    <div class="modal modal-blur fade show d-block" tabindex="-1" role="dialog" @click.self="$emit('close')">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <form class="modal-content new-file-dialog" @submit.prevent="create">
          <div class="modal-header">
            <h5 class="modal-title">New file</h5>
            <button type="button" class="btn-close" @click="$emit('close')"></button>
          </div>
          <div class="modal-body">
            <label class="form-label" for="new-file-path">Path</label>
            <input id="new-file-path" ref="input" v-model="value" class="form-control font-monospace"
              placeholder="docs/getting-started.md" autocomplete="off" spellcheck="false" @keydown="onKey">

            <div v-if="options.length" class="list-group list-group-flush new-file-dirs">
              <button v-for="(opt, i) in options" :key="opt" type="button" tabindex="-1"
                class="list-group-item list-group-item-action d-flex align-items-center gap-2"
                :class="{ active: i === highlighted }" @click="choose(opt)">
                <i class="ti" :class="opt === '..' ? 'ti-arrow-up' : 'ti-folder text-yellow'"></i>
                <span class="text-truncate">{{ opt === '..' ? 'Parent folder' : opt }}</span>
              </button>
              <div v-if="truncated" class="list-group-item new-file-more text-muted">
                More folders not shown, keep typing to narrow down
              </div>
            </div>

            <div class="new-file-hints">
              <div v-if="error" class="text-danger">
                <i class="ti ti-alert-circle"></i><span>{{ error }}</span>
              </div>
              <template v-else>
                <div v-if="missing" class="text-warning">
                  <i class="ti ti-folder-plus"></i><span>Will also create folder <code>{{ missing }}/</code></span>
                </div>
                <div v-if="finalPath" class="text-muted">
                  <i class="ti ti-file-plus"></i><span>Creates <code>{{ finalPath }}</code></span>
                </div>
                <div v-else class="text-muted">Type a file name, or pick a folder to go into it.</div>
              </template>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" @click="$emit('close')">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="!finalPath || creating">
              <span v-if="creating" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="ti ti-file-plus me-1"></i>Create
            </button>
          </div>
        </form>
      </div>
    </div>
    <div class="modal-backdrop fade show"></div>
  `,
  props: { dir: { type: String, default: '' } },
  emits: ['close', 'created'],
  setup(props, { emit }) {
    const input       = ref(null);
    const value       = ref(props.dir ? props.dir.replace(/\\/g, '/') + '/' : '');
    const dirs        = ref([]);
    const truncated   = ref(false);
    const missing     = ref('');
    const listError   = ref('');
    const createError = ref('');
    const highlighted = ref(-1);
    const creating    = ref(false);

    const parts   = computed(() => splitPath(value.value));
    const options = computed(() => [...(parts.value.dir ? ['..'] : []), ...dirs.value]);
    const error   = computed(() => createError.value || listError.value);

    const finalPath = computed(() => {
      const { dir, leaf } = parts.value;
      if (!leaf.trim()) return '';
      return dir + (/\.md$/i.test(leaf) ? leaf : `${leaf}.md`);
    });

    // One folder level per request, so large repos stay fast. Responses that
    // arrive after the input has moved on are dropped.
    let timer, seq = 0;
    async function fetchDirs() {
      const { dir, leaf } = parts.value;
      const mine = ++seq;
      try {
        const params = new URLSearchParams({ path: dir.replace(/\/$/, ''), q: leaf });
        const res    = await apiFetch(`/api/dirs?${params}`);
        const data   = await res.json();
        if (mine !== seq) return;
        if (!res.ok) throw new Error(data.error);
        dirs.value      = data.dirs;
        truncated.value = data.truncated;
        missing.value   = data.missing;
        listError.value = '';
      } catch (e) {
        if (mine !== seq) return;
        dirs.value      = [];
        truncated.value = false;
        missing.value   = '';
        listError.value = e.message;
      }
    }

    watch(value, () => {
      createError.value = '';
      highlighted.value = -1;
      clearTimeout(timer);
      timer = setTimeout(fetchDirs, 120);
    });

    function choose(opt) {
      const { dir } = parts.value;
      value.value = opt === '..'
        ? dir.replace(/[^/]*\/$/, '')
        : `${dir}${opt}/`;
      input.value?.focus();
    }

    function onKey(e) {
      const count = options.value.length;
      if (e.key === 'ArrowDown' && count) {
        e.preventDefault();
        highlighted.value = (highlighted.value + 1) % count;
      } else if (e.key === 'ArrowUp' && count) {
        e.preventDefault();
        highlighted.value = (highlighted.value - 1 + count) % count;
      } else if (e.key === 'Enter' && highlighted.value >= 0) {
        e.preventDefault();
        choose(options.value[highlighted.value]);
      } else if (e.key === 'Tab' && parts.value.leaf && dirs.value.length) {
        e.preventDefault();
        choose(highlighted.value >= 0 ? options.value[highlighted.value] : dirs.value[0]);
      } else if (e.key === 'Escape') {
        emit('close');
      }
    }

    async function create() {
      if (!finalPath.value || creating.value) return;
      creating.value = true;
      try {
        const res  = await apiFetch(`/api/file?path=${encodeURIComponent(finalPath.value)}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ content: headingFor(finalPath.value) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        emit('created', data);
      } catch (e) {
        createError.value = e.message;
      } finally {
        creating.value = false;
      }
    }

    onMounted(() => {
      input.value.focus();
      input.value.setSelectionRange(value.value.length, value.value.length);
      fetchDirs();
    });

    return { input, value, options, truncated, missing, error, highlighted, creating, finalPath, choose, onKey, create };
  },
};
