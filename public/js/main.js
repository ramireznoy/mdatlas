import { createApp } from './vue.js';
import { TreeNode } from './components/TreeNode.js';
import { NewFileDialog } from './components/NewFileDialog.js';
import { setup } from './app.js';

const app = createApp({ setup });
app.component('tree-node', TreeNode);
app.component('new-file-dialog', NewFileDialog);
app.mount('#app');
