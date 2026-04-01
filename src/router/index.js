/**
 * Vue Router Configuration
 * 
 * Routing-Struktur:
 * /login → LoginView (Public)
 * /dashboard → DashboardView (Protected)
 * 
 * Route Guards:
 * - beforeEach: Prüft ob Route protected ist
 * - Falls nicht authentifiziert → zurück zu /login
 */

import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '@/composables/useAuth.js';

// Views lazy-loaden (bessere Performance)
const LoginView = () => import('@/views/LoginView.vue');
const DashboardView = () => import('@/views/DashboardView.vue');

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { requiresAuth: false, title: 'Login | JobSearch' },
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: LoginView,
    meta: { requiresAuth: false, title: 'Passwort zurücksetzen | JobSearch' },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: { requiresAuth: true, title: 'Dashboard | JobSearch' },
  },
  // Default redirect
  {
    path: '/',
    redirect: () => {
      // Nutze useAuth um Auth-State zu prüfen
      const { isLoggedIn } = useAuth();
      return isLoggedIn.value ? '/dashboard' : '/login';
    },
  },
  // 404 Fallback
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

/**
 * Route Guard: vor jedem Navigation prüfen
 * 
 * Neues Pattern (Vue Router 4+):
 * Statt next(value) verwenden wir return value
 */
router.beforeEach((to, from) => {
  // Document Title setzen
  document.title = to.meta.title || 'JobSearch';

  const { isLoggedIn } = useAuth();
  const isAuth = isLoggedIn.value;

  // Wenn Route Authentication erfordert, aber User nicht eingeloggt
  if (to.meta.requiresAuth && !isAuth) {
    return '/login';
  }

  // Wenn User eingeloggt auf /login gehen will → zu Dashboard
  if (to.path === '/login' && isAuth) {
    return '/dashboard';
  }

  // Sonst: normal fortfahren (undefined = continue)
});

export default router;
