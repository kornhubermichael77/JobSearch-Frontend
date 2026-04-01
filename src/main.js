/**
 * === MAIN ENTRY POINT ===
 * Initialisiert Vue App mit:
 * - Vue Router (Navigation)
 * - Bootstrap 5 (CSS Framework)
 * - Global Styles
 */

import { createApp } from 'vue';
import './style.css';
// Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.css';
import App from './App.vue';
import router from './router/index.js';

// Erstelle Vue App
const app = createApp(App);

// Integriere Router
app.use(router);

// Mounte App zum #app Element
app.mount('#app');
