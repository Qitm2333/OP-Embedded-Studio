import { createRouter, createWebHistory } from 'vue-router'

import EditorView from './views/EditorView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: EditorView },
    { path: '/share/:roomId', component: EditorView }
  ]
})

export default router
