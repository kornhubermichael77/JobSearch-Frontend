/**
 * Auth Composable - verwaltet Authentifizierung und User-State
 * 
 * Nutzt jetzt Cookie-basierte Sessions statt Basic Auth
 * Cookies werden von Axios automatisch gesendet (withCredentials: true)
 */

import { ref } from 'vue';
import { authApi, logout as apiLogout } from '@/services/api.js';

// Reactive State
const user = ref(null);
const loading = ref(false);
const error = ref(null);
const isLoggedIn = ref(false);

/**
 * Login mit Username und Password
 * Backend setzt Session-Cookie automatisch
 */
export const login = async (username, password) => {
  loading.value = true;
  error.value = null;

  try {
    // API: POST /api/auth/login
    // Backend setzt Set-Cookie Header automatisch
    const response = await authApi.login(username, password);

    // Speichere User-Info
    user.value = response.data;
    isLoggedIn.value = true;

    return response.data;
  } catch (err) {
    isLoggedIn.value = false;
    error.value = err.response?.data?.error || 'Login fehlgeschlagen';
    throw err;
  } finally {
    loading.value = false;
  }
};

/**
 * Registrierung neuer User
 */
export const register = async (username, password, email) => {
  loading.value = true;
  error.value = null;

  try {
    // API: POST /api/auth/register
    const response = await authApi.register(username, password, email);

    // Nach erfolgreicher Registrierung automatisch einloggen
    user.value = response.data;
    isLoggedIn.value = true;

    return response.data;
  } catch (err) {
    isLoggedIn.value = false;
    error.value = err.response?.data?.error || 'Registrierung fehlgeschlagen';
    throw err;
  } finally {
    loading.value = false;
  }
};

/**
 * Logout
 * Sagt Backend Bescheid, um Session zu löschen
 */
export const logout = async () => {
  await apiLogout();
  user.value = null;
  isLoggedIn.value = false;
  error.value = null;
};

/**
 * Forgot Password - Anfrage zum Zurücksetzen des Passworts
 */
export const forgotPassword = async (email) => {
  loading.value = true;
  error.value = null;

  try {
    // API: POST /api/auth/forgot-password
    // Backend sendet Reset-Link per Email
    await authApi.forgotPassword(email);
    return { success: true, message: 'Check deine E-Mail für Reset-Link' };
  } catch (err) {
    error.value = err.response?.data?.error || 'Anfrage fehlgeschlagen';
    throw err;
  } finally {
    loading.value = false;
  }
};

/**
 * Reset Password - Setzt neues Passwort mit Token
 */
export const resetPassword = async (token, newPassword) => {
  loading.value = true;
  error.value = null;

  try {
    // API: POST /api/auth/reset-password
    await authApi.resetPassword(token, newPassword);
    return { success: true, message: 'Passwort erfolgreich geändert' };
  } catch (err) {
    error.value = err.response?.data?.error || 'Passwort-Änderung fehlgeschlagen';
    throw err;
  } finally {
    loading.value = false;
  }
};

/**
 * Compose Function — gibt alle Auth-Features zurück
 */
export function useAuth() {
  return {
    // State
    user,
    loading,
    error,
    isLoggedIn,

    // Methods
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
  };
}

export default useAuth;
