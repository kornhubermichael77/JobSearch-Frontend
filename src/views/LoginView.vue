<script setup>
/**
 * LoginView.vue - Login/Register Seite
 * 
 * Features:
 * - Tab zwischen Login und Registrierung umschalten
 * - Formularvalidierung (Frontend)
 * - Error Messages anzeigen
 * - Loading State während API-Call
 * 
 * TODO: Später Passwort-Reset Tab hinzufügen
 */

import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth.js';

const router = useRouter();
const route = useRoute();
const { login, register, forgotPassword, resetPassword, loading, error } = useAuth();

// Form Daten
const activeTab = ref('login'); // 'login', 'register', oder 'reset'
const username = ref('');
const password = ref('');
const email = ref('');
const confirmPassword = ref('');

// Password Reset Felder
const resetEmail = ref('');
const resetToken = ref('');
const resetNewPassword = ref('');
const resetConfirmPassword = ref('');
const resetSuccess = ref('');

// Validation Errors
const validationErrors = ref({});

/**
 * ============================================
 * Auto-detect Token from URL (Reset Password Flow)
 * ============================================
 */
onMounted(() => {
  const tokenFromURL = route.query.token;
  if (tokenFromURL) {
    // Token in URL gefunden → Reset-Tab anzeigen + Token prefüllen
    resetToken.value = tokenFromURL;
    activeTab.value = 'reset';
    resetSuccess.value = ''; // Clear any success message
  }
});

/**
 * ============================================
 * LOGIN Form
 * ============================================
 */

const validateLoginForm = () => {
  validationErrors.value = {};

  if (!username.value.trim()) {
    validationErrors.value.username = 'Username ist erforderlich';
  }
  if (!password.value) {
    validationErrors.value.password = 'Password ist erforderlich';
  }

  return Object.keys(validationErrors.value).length === 0;
};

const handleLogin = async () => {
  if (!validateLoginForm()) return;

  try {
    await login(username.value, password.value);
    // Erfolg → zu Dashboard navigieren
    router.push('/dashboard');
  } catch (err) {
    // Error wird in useAuth verwaltet und hier angezeigt
  }
};

/**
 * ============================================
 * REGISTER Form
 * ============================================
 */

const validateRegisterForm = () => {
  validationErrors.value = {};

  if (!username.value.trim()) {
    validationErrors.value.username = 'Username ist erforderlich';
  }
  if (username.value.length > 255) {
    validationErrors.value.username = 'Max 255 Zeichen';
  }

  if (!email.value.trim()) {
    validationErrors.value.email = 'E-Mail ist erforderlich';
  }
  if (!isValidEmail(email.value)) {
    validationErrors.value.email = 'Ungültige E-Mail';
  }

  if (!password.value) {
    validationErrors.value.password = 'Password ist erforderlich';
  }
  if (password.value.length < 6) {
    validationErrors.value.password = 'Min. 6 Zeichen';
  }

  if (password.value !== confirmPassword.value) {
    validationErrors.value.confirmPassword = 'Passwords stimmen nicht überein';
  }

  return Object.keys(validationErrors.value).length === 0;
};

const handleRegister = async () => {
  if (!validateRegisterForm()) return;

  try {
    await register(username.value, password.value, email.value);
    // Erfolg → zu Dashboard navigieren
    router.push('/dashboard');
  } catch (err) {
    // Error wird verwaltet
  }
};

/**
 * ============================================
 * Helper Functions
 * ============================================
 */

const isValidEmail = (email) => {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
};

// Felder nach Tab-Wechsel leeren
const switchTab = (tab) => {
  activeTab.value = tab;
  validationErrors.value = {};
  resetSuccess.value = '';
  
  try {
    error.value = null;
  } catch (e) {
    // error könnte readonly sein, ignorieren
  }
  
  // Leere alle Felder je nach Tab
  if (tab === 'login') {
    username.value = '';
    password.value = '';
    email.value = '';
    confirmPassword.value = '';
    resetEmail.value = '';
    resetToken.value = '';
    resetNewPassword.value = '';
    resetConfirmPassword.value = '';
  } else if (tab === 'register') {
    username.value = '';
    password.value = '';
    email.value = '';
    confirmPassword.value = '';
  } else if (tab === 'reset') {
    resetEmail.value = '';
    resetToken.value = '';
    resetNewPassword.value = '';
    resetConfirmPassword.value = '';
  }
};

/**
 * ============================================
 * PASSWORD RESET Form
 * ============================================
 */

const validateForgotPasswordForm = () => {
  validationErrors.value = {};

  if (!resetEmail.value.trim()) {
    validationErrors.value.resetEmail = 'E-Mail ist erforderlich';
  }
  if (!isValidEmail(resetEmail.value)) {
    validationErrors.value.resetEmail = 'Ungültige E-Mail';
  }

  return Object.keys(validationErrors.value).length === 0;
};

const handleForgotPassword = async () => {
  if (!validateForgotPasswordForm()) return;

  try {
    await forgotPassword(resetEmail.value);
    resetSuccess.value = '✅ Reset-Link wurde an deine E-Mail gesendet. Bitte überprüfe dein Postfach!';
    resetEmail.value = '';
  } catch (err) {
    // Error wird in useAuth verwaltet
  }
};

const validateResetPasswordForm = () => {
  validationErrors.value = {};

  if (!resetToken.value.trim()) {
    validationErrors.value.resetToken = 'Reset-Token ist erforderlich';
  }
  if (!resetNewPassword.value) {
    validationErrors.value.resetNewPassword = 'Neues Passwort ist erforderlich';
  }
  if (resetNewPassword.value.length < 6) {
    validationErrors.value.resetNewPassword = 'Min. 6 Zeichen';
  }
  if (resetNewPassword.value !== resetConfirmPassword.value) {
    validationErrors.value.resetConfirmPassword = 'Passwörter stimmen nicht überein';
  }

  return Object.keys(validationErrors.value).length === 0;
};

const handleResetPassword = async () => {
  if (!validateResetPasswordForm()) return;

  try {
    await resetPassword(resetToken.value, resetNewPassword.value);
    resetSuccess.value = '✅ Passwort erfolgreich geändert! Du kannst dich jetzt einloggen.';
    
    // Leere alle Felder
    resetToken.value = '';
    resetNewPassword.value = '';
    resetConfirmPassword.value = '';
    resetEmail.value = '';
    username.value = '';
    password.value = '';
    email.value = '';
    confirmPassword.value = '';
    validationErrors.value = {};
    
    setTimeout(() => {
      switchTab('login');
    }, 2000);
  } catch (err) {
    // Error wird in useAuth verwaltet
  }
};

const clearForm = () => {
  username.value = '';
  password.value = '';
  email.value = '';
  confirmPassword.value = '';
  validationErrors.value = {};
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <!-- Header -->
      <div class="login-header text-center mb-4">
        <h1 class="h2 mb-2">📋 JobSearch</h1>
        <p class="text-muted">Verwalte deine Jobsuche übersichtlich</p>
      </div>

      <!-- Tabs -->
      <ul class="nav nav-tabs mb-4" role="tablist">
        <li class="nav-item" role="presentation">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'login' }"
            @click="switchTab('login')"
            type="button"
            role="tab"
          >
            🔓 Login
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'register' }"
            @click="switchTab('register')"
            type="button"
            role="tab"
          >
            ✨ Registrierung
          </button>
        </li>
      </ul>

      <!-- Error Alert -->
      <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
        <strong>⚠️ Error:</strong> {{ error }}
        <button
          type="button"
          class="btn-close"
          @click="error = null"
        ></button>
      </div>

      <!-- LOGIN TAB -->
      <form v-if="activeTab === 'login'" @submit.prevent="handleLogin">
        <!-- Username -->
        <div class="mb-3">
          <label for="login-username" class="form-label">Username</label>
          <input
            id="login-username"
            v-model="username"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': validationErrors.username }"
            placeholder="test1"
            :disabled="loading"
          />
          <div v-if="validationErrors.username" class="invalid-feedback d-block">
            {{ validationErrors.username }}
          </div>
        </div>

        <!-- Password -->
        <div class="mb-3">
          <label for="login-password" class="form-label">Password</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            class="form-control"
            :class="{ 'is-invalid': validationErrors.password }"
            placeholder="test1234"
            :disabled="loading"
          />
          <div v-if="validationErrors.password" class="invalid-feedback d-block">
            {{ validationErrors.password }}
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="btn btn-primary w-100"
          :disabled="loading"
        >
          <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          {{ loading ? 'Wird eingeloggt...' : '🔓 Login' }}
        </button>

        <!-- Info Box -->
        <div class="alert alert-info mt-3 mb-2 small">
          <strong>Demo Credentials:</strong> username: <code>test1</code>, password: <code>test1234</code>
        </div>
        
        <!-- Forgot Password Link -->
        <button
          type="button"
          @click="switchTab('reset')"
          class="btn btn-link d-block w-100"
        >
          🔑 Passwort vergessen?
        </button>
      </form>

      <!-- REGISTER TAB -->
      <form v-if="activeTab === 'register'" @submit.prevent="handleRegister">
        <!-- Username -->
        <div class="mb-3">
          <label for="register-username" class="form-label">Username</label>
          <input
            id="register-username"
            v-model="username"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': validationErrors.username }"
            placeholder="Dein Username"
            maxlength="255"
            :disabled="loading"
          />
          <div v-if="validationErrors.username" class="invalid-feedback d-block">
            {{ validationErrors.username }}
          </div>
        </div>

        <!-- Email -->
        <div class="mb-3">
          <label for="register-email" class="form-label">E-Mail</label>
          <input
            id="register-email"
            v-model="email"
            type="email"
            class="form-control"
            :class="{ 'is-invalid': validationErrors.email }"
            placeholder="deine@email.com"
            :disabled="loading"
          />
          <div v-if="validationErrors.email" class="invalid-feedback d-block">
            {{ validationErrors.email }}
          </div>
        </div>

        <!-- Password -->
        <div class="mb-3">
          <label for="register-password" class="form-label">Password (min. 6 Zeichen)</label>
          <input
            id="register-password"
            v-model="password"
            type="password"
            class="form-control"
            :class="{ 'is-invalid': validationErrors.password }"
            placeholder="Mindestens 6 Zeichen"
            :disabled="loading"
          />
          <div v-if="validationErrors.password" class="invalid-feedback d-block">
            {{ validationErrors.password }}
          </div>
        </div>

        <!-- Confirm Password -->
        <div class="mb-3">
          <label for="register-confirm" class="form-label">Password wiederholen</label>
          <input
            id="register-confirm"
            v-model="confirmPassword"
            type="password"
            class="form-control"
            :class="{ 'is-invalid': validationErrors.confirmPassword }"
            placeholder="Nochmal eingeben"
            :disabled="loading"
          />
          <div v-if="validationErrors.confirmPassword" class="invalid-feedback d-block">
            {{ validationErrors.confirmPassword }}
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="btn btn-success w-100"
          :disabled="loading"
        >
          <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          {{ loading ? 'Wird registriert...' : '✨ Registrieren' }}
        </button>
      </form>

      <!-- PASSWORD RESET TAB -->
      <form v-if="activeTab === 'reset'" @submit.prevent="handleForgotPassword">
        <!-- Step 1: Forgot Password -->
        <div v-if="!resetToken">
          <h5 class="mb-3">🔑 Passwort zurücksetzen</h5>
          
          <!-- Success Message -->
          <div v-if="resetSuccess" class="alert alert-success alert-dismissible fade show">
            {{ resetSuccess }}
            <button type="button" class="btn-close" @click="resetSuccess = ''"></button>
          </div>

          <!-- Email -->
          <div class="mb-3">
            <label for="resetEmail" class="form-label">E-Mail Adresse</label>
            <input
              id="resetEmail"
              v-model="resetEmail"
              type="email"
              class="form-control"
              :class="{ 'is-invalid': validationErrors.resetEmail }"
              placeholder="deine@email.de"
            />
            <div v-if="validationErrors.resetEmail" class="invalid-feedback d-block">
              {{ validationErrors.resetEmail }}
            </div>
          </div>

          <!-- Submit -->
          <button type="submit" class="btn btn-primary w-100" :disabled="loading">
            {{ loading ? 'Lädt...' : 'Reset-Link senden' }}
          </button>
        </div>

        <!-- Step 2: Reset Password (nach Token-Erhalt) -->
        <div v-else>
          <h5 class="mb-3">🔐 Neues Passwort setzen</h5>

          <!-- Success Message -->
          <div v-if="resetSuccess" class="alert alert-success alert-dismissible fade show">
            {{ resetSuccess }}
            <button type="button" class="btn-close" @click="resetSuccess = ''"></button>
          </div>

          <!-- Reset Token -->
          <div v-if="!resetToken" class="mb-3">
            <label for="resetToken" class="form-label">Reset-Token (aus E-Mail)</label>
            <input
              id="resetToken"
              v-model="resetToken"
              type="text"
              class="form-control"
              :class="{ 'is-invalid': validationErrors.resetToken }"
              placeholder="Token aus E-Mail einfügen"
            />
            <div v-if="validationErrors.resetToken" class="invalid-feedback d-block">
              {{ validationErrors.resetToken }}
            </div>
          </div>

          <!-- Reset Token Success Indicator (only when from URL) -->
          <div v-else class="alert alert-success mb-3">
            ✅ Reset-Token erkannt
          </div>

          <!-- New Password -->
          <div class="mb-3">
            <label for="resetNewPassword" class="form-label">Neues Passwort</label>
            <input
              id="resetNewPassword"
              v-model="resetNewPassword"
              type="password"
              class="form-control"
              :class="{ 'is-invalid': validationErrors.resetNewPassword }"
              placeholder="Min. 6 Zeichen"
            />
            <div v-if="validationErrors.resetNewPassword" class="invalid-feedback d-block">
              {{ validationErrors.resetNewPassword }}
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="mb-3">
            <label for="resetConfirmPassword" class="form-label">Passwort wiederholen</label>
            <input
              id="resetConfirmPassword"
              v-model="resetConfirmPassword"
              type="password"
              class="form-control"
              :class="{ 'is-invalid': validationErrors.resetConfirmPassword }"
              placeholder="Passwort wiederholen"
            />
            <div v-if="validationErrors.resetConfirmPassword" class="invalid-feedback d-block">
              {{ validationErrors.resetConfirmPassword }}
            </div>
          </div>

          <!-- Submit -->
          <button
            type="button"
            @click="handleResetPassword"
            class="btn btn-primary w-100"
            :disabled="loading"
          >
            {{ loading ? 'Lädt...' : 'Passwort ändern' }}
          </button>

          <!-- Back Button (nur wenn Token manuell eingegeben) -->
          <button
            v-if="!route.query.token"
            type="button"
            @click="switchTab('reset')"
            class="btn btn-link w-100 mt-2"
          >
            ← Zurück
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
/**
 * Modernes Login-Layout mit zentrierter Card
 */

.login-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
}

.login-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  width: 100%;
  max-width: 400px;
}

.login-header h1 {
  font-weight: 700;
  color: #333;
}

.login-header p {
  font-size: 0.95rem;
}

.nav-tabs {
  border-bottom: 2px solid #e9ecef;
}

.nav-link {
  color: #6c757d;
  border: none;
  border-bottom: 3px solid transparent;
  outline: none;
  transition: all 0.3s ease;
}

.nav-link:hover {
  color: #667eea;
  border-bottom-color: #667eea;
}

.nav-link.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: transparent;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  padding: 0.75rem;
  font-weight: 600;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #5568d3 0%, #6a3d91 100%);
  border: none;
}

.btn-success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  border: none;
  padding: 0.75rem;
  font-weight: 600;
}

.btn-success:hover {
  background: linear-gradient(135deg, #0f8476 0%, #2dcd6f 100%);
  border: none;
}

.alert {
  border-radius: 8px;
  border: none;
}

.alert-info {
  background-color: #e7f3ff;
  color: #004085;
}

.alert-danger {
  background-color: #f8d7da;
  color: #721c24;
}

code {
  background: #f5f5f5;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.9rem;
}

.login-footer {
  animation: fadeIn 1s ease-in-out;
}

/* Placeholder Styling */
.form-control::placeholder {
  color: #aaa;
  opacity: 1;
}

.form-control::-webkit-input-placeholder {
  color: #aaa;
}

.form-control::-moz-placeholder {
  color: #aaa;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Mobile Responsive */
@media (max-width: 576px) {
  .login-card {
    padding: 1.5rem;
  }

  .login-header h1 {
    font-size: 1.5rem;
  }
}
</style>
