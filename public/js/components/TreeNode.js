import { ref, computed } from '../vue.js';

export const TreeNode = {
  name: 'TreeNode',
  template: `
    <div>
      <div class="tree-item" :class="{ active: isSelected }" @click="toggle">
        <i class="ti flex-shrink-0" :class="iconClass"></i>
        <span class="tree-name">{{ item.name }}</span>
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
        />
      </div>
    </div>
  `,
  props: { item: Object, selectedPath: String, depth: { type: Number, default: 0 } },
  emits: ['select'],
  setup(props, { emit }) {
    const open       = ref(props.depth === 0);
    const isSelected = computed(() => props.item.path === props.selectedPath);
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
