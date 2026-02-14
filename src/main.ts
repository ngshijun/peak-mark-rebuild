import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { piniaResetPlugin } from '@/lib/piniaResetPlugin'
import './style.css'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaResetPlugin)
app.use(pinia)
app.use(router)

// Safety net for uncaught errors in the component tree
app.config.errorHandler = (err) => {
  console.error('[Uncaught Error]', err)
}

app.mount('#app')
