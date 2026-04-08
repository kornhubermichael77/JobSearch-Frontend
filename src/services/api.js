/**
 * API Service - zentrale Stelle für alle HTTP-Requests zum Backend
 * 
 * Warum dieser Aufbau?
 * ✅ Alle API-Calls an einer Stelle → leicht zu maintainen
 * ✅ Error-Handling zentralisiert
 * ✅ Cookies automatisch mit jedem Request gesendet (withCredentials)
 * ✅ Session-basierte Authentifizierung
 * 
 * NOTE: Relative URL (/api) ermöglicht Vite Proxy Umleitung
 * In Development: localhost:5173/api → localhost:8080/api (Vite Proxy)
 * In Production: /api bleibt relativ (Frontend & Backend auf gleichem Origin)
 */

import axios from 'axios';

// WICHTIG: Relative URL damit Vite Proxy funktioniert!
const API_URL = '/api';

// Axios-Instanz mit Base-URL und Cookies
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Sendet Cookies automatisch mit jedem Request
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Interceptor: Fehlerbehandlung zentralisiert
 * 401 (Unauthorized) = Session abgelaufen → zurück zu Login
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session fehlgeschlagen oder abgelaufen
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * ============================================
 * AUTH Endpoints
 * ============================================
 */

export const authApi = {
  // POST /api/auth/register
  register: (username, password, email) =>
    axiosInstance.post('/auth/register', { username, password, email }),

  // POST /api/auth/login
  login: (username, password) =>
    axiosInstance.post('/auth/login', { username, password }),

  // POST /api/auth/forgot-password
  forgotPassword: (email) =>
    axiosInstance.post('/auth/forgot-password', { email }),

  // POST /api/auth/reset-password
  resetPassword: (token, newPassword) =>
    axiosInstance.post('/auth/reset-password', { token, newPassword }),
};

/**
 * ============================================
 * COMPANY Endpoints
 * ============================================
 */

export const companyApi = {
  // GET /api/companies
  getAll: () => axiosInstance.get('/companies'),

  // GET /api/companies/{id}
  getById: (id) => axiosInstance.get(`/companies/${id}`),

  // POST /api/companies
  create: (data) => axiosInstance.post('/companies', data),

  // PUT /api/companies/{id}
  update: (id, data) => axiosInstance.put(`/companies/${id}`, data),

  // DELETE /api/companies/{id}
  delete: (id) => axiosInstance.delete(`/companies/${id}`),
};

/**
 * ============================================
 * ADDRESS Endpoints
 * ============================================
 */

export const addressApi = {
  // GET /api/addresses/{id}
  getById: (id) => axiosInstance.get(`/addresses/${id}`),

  // POST /api/addresses (standalone, keine Company erforderlich)
  create: (data) => axiosInstance.post('/addresses', data),

  // POST /api/companies/{companyId}/addresses
  createForCompany: (companyId, data) =>
    axiosInstance.post(`/companies/${companyId}/addresses`, data),

  // PUT /api/addresses/{id}
  update: (id, data) => axiosInstance.put(`/addresses/${id}`, data),

  // DELETE /api/addresses/{id}
  delete: (id) => axiosInstance.delete(`/addresses/${id}`),
};

/**
 * ============================================
 * JOB Endpoints
 * ============================================
 */

export const jobApi = {
  // GET /api/jobs (alle oder gefiltert)
  // Params: status, companyId
  getAll: (params = {}) =>
    axiosInstance.get('/jobs', { params }),

  // GET /api/jobs/{id}
  getById: (id) => axiosInstance.get(`/jobs/${id}`),

  // POST /api/jobs
  create: (data) => axiosInstance.post('/jobs', data),

  // PUT /api/jobs/{id}
  update: (id, data) => axiosInstance.put(`/jobs/${id}`, data),

  // PATCH /api/jobs/{id}/addressId (aktualisiere nur die addressId)
  updateAddressId: (id, addressId) =>
    axiosInstance.patch(`/jobs/${id}/addressId`, { addressId }),

  // DELETE /api/jobs/{id}
  delete: (id) => axiosInstance.delete(`/jobs/${id}`),

  // GET /api/job-status (Enum-Werte für Job Status)
  getStatuses: () => axiosInstance.get('/job-status'),

  // GET /api/jobs/for-filter (Alle Jobs für Dropdown mit Filtermöglichkeit)
  // Params: companyId (optional), status (optional)
  getAllForFilter: (params = {}) =>
    axiosInstance.get('/jobs/for-filter', { params }),
};

/**
 * ============================================
 * COMMUNICATION Endpoints
 * ============================================
 */

export const communicationApi = {
  // GET /api/timeline (paginiert + gefiltert)
  // Params: jobId, type, person, from, status, page, size
  getTimeline: (params = {}) =>
    axiosInstance.get('/timeline', { params }),

  // GET /api/communications/{id}
  getById: (id) => axiosInstance.get(`/communications/${id}`),

  // POST /api/communications
  create: (data) => axiosInstance.post('/communications', data),

  // PUT /api/communications/{id}?id={id}
  // Backend erwartet: ID im Path UND Query-Param (redundant aber korrekt)
  update: (id, data) =>
    axiosInstance.put(`/communications/${id}`, data, { params: { id } }),

  // DELETE /api/communications/{id}
  delete: (id) => axiosInstance.delete(`/communications/${id}`),

  // GET /api/communication-status (Enum-Werte)
  getStatuses: () => axiosInstance.get('/communication-status'),
};

/**
 * ============================================
 * Utility Helper
 * ============================================
 */

/**
 * Logout: Informiert Backend um Session zu beenden
 */
export const logout = async () => {
  try {
    await axiosInstance.post('/auth/logout');
  } catch (err) {
    console.error('Logout request failed:', err);
  }
};

export default axiosInstance;