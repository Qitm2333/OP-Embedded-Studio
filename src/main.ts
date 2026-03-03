import { createApp } from 'vue'

import './app.css'
import { preloadFonts } from '@/engine/fonts'

import App from './App.vue'
import router from './router'

preloadFonts()
createApp(App).use(router).mount('#app')
