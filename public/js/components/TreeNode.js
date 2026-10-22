import { ref, computed, watch } from '../vue.js';

export const TreeNode = {
  name: 'TreeNode',
  template: `
    <div>
      <div class="tree-item" :class="{ active: isSelected }" @click="toggle">
        <i class="ti flex-shrink-0" :class="iconClass"></i>
        <span class="tree-name">{{ item.name }}</span>
        <button v-if="item.type === 'dir'" type="button" class="tree-add" title="New file in this folder"
          @click.stop="$emit('create', item.path)">
          <i class="ti ti-file-plus"></i>
        </button>
        <i v-if="item.type === 'dir'" class="ti ti-chevron-right tree-chevron" :class="{ open }"></i>
      </div>
      <div v-if="item.type === 'dir' && open" class="tree-children">
        <tree-node
          v-for="child in item.children"
          :key="child.path"
          :item="child"
          :selected-path="selectedPath"
          :depth="depth + 1"
          @select="$emit('select', $event)"
          @create="$emit('create', $event)"
        />
      </div>
    </div>
  `,
  props: { item: Object, selectedPath: String, depth: { type: Number, default: 0 } },
  emits: ['select', 'create'],
  setup(props, { emit }) {
    const open       = ref(props.depth === 0);
    const isSelected = computed(() => props.item.path === props.selectedPath);

    // Expand folders on the way to the selected file, e.g. one just created
    watch(() => props.selectedPath, path => {
      if (props.item.type !== 'dir' || !path?.startsWith(props.item.path)) return;
      const next = path[props.item.path.length];
      if (next === '/' || next === '\\') open.value = true;
    }, { immediate: true });
    const iconClass  = computed(() => {
      if (props.item.type === 'dir')
        return open.value ? 'ti-folder-open text-yellow' : 'ti-folder text-yellow';
      return 'ti-markdown text-azure';
    });
    const toggle = () => {
      if (props.item.type === 'dir') open.value = !open.value;
      else emit('select', props.item);
    };
    return { open, isSelected, iconClass, toggle };
  },
};
