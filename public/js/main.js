import { createApp } from './vue.js';
import { TreeNode } from './components/TreeNode.js';
import { setup } from './app.js';

const app = createApp({ setup });
app.component('tree-node', TreeNode);
app.mount('#app');
