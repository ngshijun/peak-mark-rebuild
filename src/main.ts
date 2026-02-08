import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Safety net for uncaught errors in the component tree
app.config.errorHandler = (err) => {
  console.error('[Uncaught Error]', err)
}

app.mount('#app')
