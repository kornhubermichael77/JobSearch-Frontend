<script setup>
/**
 * CompanyItem.vue - Eine einzelne Firma (Company/Arbeitgeber)
 * 
 * Features:
 * - View Mode: Anzeige aller Company-Felder
 * - Edit Mode: Inline Editing mit Save/Discard
 * - Create Mode: Leere Felder, wird aus DOM entfernt bei Discard
 * - Delete mit Bestätigung
 */

import { ref, reactive, nextTick, watch } from 'vue';
import { companyApi } from '@/services/api.js';

const props = defineProps({
  company: {
    type: Object,
    default: null,  // null für create-mode
  },
  mode: {
    type: String,
    enum: ['view', 'edit', 'create'],
    default: 'view',
  },
  isExpanded: {
    type: Boolean,
    default: false,  // Für View-Mode: ist die Firma gerade expanded?
  },
  jobCount: {
    type: Number,
    default: 0,  // Für View-Mode Badges: Anzahl der Jobs
  },
});

const emit = defineEmits(['update', 'delete', 'cancel', 'toggle', 'edit-request']);

/**
 * State Management
 */
const isEditMode = ref(false);
const isSaving = ref(false);
const errorMessage = ref('');
const showDeleteConfirm = ref(false);
const showUndoConfirm = ref(false);

// Store original values for undo
const originalData = ref({});

// Edited form data
const formData = reactive({
  name: '',         // String: max 255 (erforderlich)
  summary: '',      // String: max 500 (optional)
  url: '',          // String: max 500 (optional)
  urlJobs: '',      // String: max 500 (optional)
  mail: '',         // String: max 150 (optional)
  mailPerson: '',   // String: max 100 (optional)
  tel: '',          // String: max 25 (optional)
  telPerson: '',    // String: max 100 (optional)
});

/**
 * Auto-Aktiviere Edit-Modus wenn CREATE oder EDIT Mode startet
 * WICHTIG: Wird aufgerufen von:
 * 1. Create-Mode: Neue CompanyItem wird mit mode="create" gerendert
 * 2. Edit-Mode: Richtiger Button klickt startEditCompany() → editingCompanyId wird gesetzt → CompanyItem mit mode="edit" gerendert
 */
watch(
  () => props.mode,
  async (newMode) => {
    if (newMode === 'create' || newMode === 'edit') {
      await nextTick();
      startEdit();
    }
  },
  { immediate: true }
);

/**
 * Starte Edit Mode
 * Wird aufgerufen von watch() wenn mode='create' oder mode='edit'
 */
const startEdit = () => {
  if (props.mode === 'create') {
    // CREATE: Leere Felder
    formData.name = '';
    formData.summary = '';
    formData.url = '';
    formData.urlJobs = '';
    formData.mail = '';
    formData.mailPerson = '';
    formData.tel = '';
    formData.telPerson = '';
    originalData.value = {};
  } else {
    // EDIT: Kopiere Company-Daten
    originalData.value = {
      name: props.company?.name || '',
      summary: props.company?.summary || '',
      url: props.company?.url || '',
      urlJobs: props.company?.urlJobs || '',
      mail: props.company?.mail || '',
      mailPerson: props.company?.mailPerson || '',
      tel: props.company?.tel || '',
      telPerson: props.company?.telPerson || '',
    };
    Object.assign(formData, originalData.value);
  }
  isEditMode.value = true;
};

/**
 * Speichern
 */
const saveChanges = async () => {
  try {
    isSaving.value = true;
    errorMessage.value = '';

    // Validierung: name ist erforderlich
    if (!formData.name || !formData.name.trim()) {
      errorMessage.value = 'Firmenname ist erforderlich';
      return;
    }

    // Baue Payload
    const payload = {
      name: formData.name.trim(),
      summary: formData.summary?.trim() || null,
      url: formData.url?.trim() || null,
      urlJobs: formData.urlJobs?.trim() || null,
      mail: formData.mail?.trim() || null,
      mailPerson: formData.mailPerson?.trim() || null,
      tel: formData.tel?.trim() || null,
      telPerson: formData.telPerson?.trim() || null,
    };

    let response;
    if (props.mode === 'create') {
      // POST /api/companies
      response = await companyApi.create(payload);
    } else {
      // PUT /api/companies/{id}
      response = await companyApi.update(props.company.id, payload);
    }

    // Emit updated company
    emit('update', response.data);

    // Mode beenden
    isEditMode.value = false;
  } catch (err) {
    errorMessage.value = 'Fehler beim Speichern: ' + (err.response?.data?.message || err.message);
    console.error('Save error:', err);
  } finally {
    isSaving.value = false;
  }
};

/**
 * Undo mit Bestätigung
 */
const requestUndo = () => {
  showUndoConfirm.value = true;
};

/**
 * Bestätige Undo
 */
const confirmUndo = () => {
  // Im CREATE-Mode: Ganze CompanyItem aus UI entfernen
  if (props.mode === 'create') {
    emit('delete');
    return;
  }

  // Im EDIT-Mode: Informiere Parent dass Edit abgebrochen wurde
  // Parent (HierarchicalDataTree) wird editingCompanyId auf null setzen
  emit('cancel');
};

/**
 * Abbrechen ohne Speichern
 */
const cancelUndo = () => {
  showUndoConfirm.value = false;
};

/**
 * Bestätige Löschen - Öffne Sicherheitsmodal
 */
const requestDelete = () => {
  showDeleteConfirm.value = true;
};

/**
 * Bestätige Löschen wirklich - Emit zum Parent
 */
const confirmDelete = () => {
  emit('delete', props.company.id);
  showDeleteConfirm.value = false;
};

/**
 * Abbrechen Löschen
 */
const cancelDelete = () => {
  showDeleteConfirm.value = false;
};
</script>

<template>
  <div class="company-item-editor" :class="`company-item--${mode}`">
    <!-- View Mode: Company Header (aus HierarchicalDataTree verschoben) -->
    <div v-if="mode === 'view' && props.company" class="company-header" :class="{ expanded: isExpanded }">
      <!-- LEFT: Toggle Button + Actions (nur Actions im expanded) -->
      <div class="company-header-left">
        <button
          class="toggle-btn"
          :aria-expanded="isExpanded"
          @click="$emit('toggle')"
          title="Expand/Collapse"
        >
          {{ isExpanded ? '▼' : '▶' }}
        </button>

        <!-- Action Buttons (nur im expanded) -->
        <div v-if="isExpanded" class="company-actions">
          <button 
            class="btn btn-sm btn-outline-primary" 
            title="Bearbeiten"
            @click="$emit('edit-request')"
          >
            ✏️
          </button>
          <button 
            class="btn btn-sm btn-outline-danger" 
            title="Löschen"
            @click="requestDelete"
          >
            🗑️
          </button>
        </div>
      </div>

      <!-- MIDDLE: Company Info (Name, Summary, URLs, Personen) -->
      <div class="company-info flex-grow-1">
        <h4 class="company-name">{{ company.name }}</h4>
        
        <!-- Summary -->
        <h5 v-if="company.summary" class="company-summary">{{ company.summary }}</h5>

        <!-- Expandierte Details: URLs und Personen -->
        <div v-if="isExpanded" class="company-details">
          <!-- URLs -->
          <div v-if="company.url || company.urlJobs" class="company-links">
            <a v-if="company.url" :href="company.url" target="_blank">
              {{ company.url }}
            </a>
            <a v-if="company.urlJobs" :href="company.urlJobs" target="_blank" class="ms-2">
              (Jobs)
            </a>
          </div>

          <!-- Tel Person -->
          <div v-if="company.telPerson || company.tel" class="company-person">
            <strong>   Ansprechperson (Tel):</strong>
            <span v-if="company.telPerson">{{ company.telPerson }}</span>
            <span v-if="company.tel" class="ms-2">
              <a :href="`tel:${company.tel}`">{{ company.tel }}</a>
            </span>
          </div>

          <!-- Mail Person -->
          <div v-if="company.mailPerson || company.mail" class="company-person">
            <strong>   Ansprechperson (Mail):</strong>
            <span v-if="company.mailPerson">{{ company.mailPerson }}</span>
            <span v-if="company.mail" class="ms-2">
              <a :href="`mailto:${company.mail}`">{{ company.mail }}</a>
            </span>
          </div>
        </div>
      </div>

      <!-- RIGHT: Badges (nur im collapsed-Zustand) -->
      <div v-if="!isExpanded" class="company-badges">
        <span class="badge bg-light text-dark">
          {{ company.addresses?.length || 0 }} 📍
        </span>
        <span class="badge bg-light text-dark">
          {{ jobCount }} 💼
        </span>
      </div>
    </div>

    <!-- Edit/Create Mode Form -->
    <div v-else-if="isEditMode" class="company-edit-form">
      <!-- Error Message -->
      <div v-if="errorMessage" class="alert alert-danger">
        {{ errorMessage }}
      </div>

      <!-- Form Fields -->
      <div class="form-group mb-3">
        <label for="company-name" class="form-label">Firmenname *</label>
        <input
          id="company-name"
          v-model="formData.name"
          type="text"
          class="form-control"
          placeholder="z.B. Google, Apple, Microsoft"
          maxlength="255"
          required
        />
      </div>

      <div class="form-group mb-3">
        <label for="company-summary" class="form-label">Zusammenfassung</label>
        <textarea
          id="company-summary"
          v-model="formData.summary"
          class="form-control"
          rows="2"
          placeholder="Kurze Beschreibung der Firma"
          maxlength="500"
        ></textarea>
      </div>

      <div class="form-group mb-3">
        <label for="company-url" class="form-label">Website-URL</label>
        <input
          id="company-url"
          v-model="formData.url"
          type="url"
          class="form-control"
          placeholder="https://example.com"
          maxlength="500"
        />
      </div>

      <div class="form-group mb-3">
        <label for="company-jobs-url" class="form-label">Jobs-URL</label>
        <input
          id="company-jobs-url"
          v-model="formData.urlJobs"
          type="url"
          class="form-control"
          placeholder="https://example.com/jobs"
          maxlength="500"
        />
      </div>

      <div class="form-group mb-3">
        <label for="company-mail" class="form-label">E-Mail</label>
        <input
          id="company-mail"
          v-model="formData.mail"
          type="email"
          class="form-control"
          placeholder="contact@example.com"
          maxlength="150"
        />
      </div>

      <div class="form-group mb-3">
        <label for="company-mail-person" class="form-label">Ansprechperson (E-Mail)</label>
        <input
          id="company-mail-person"
          v-model="formData.mailPerson"
          type="text"
          class="form-control"
          placeholder="z.B. Max Mustermann"
          maxlength="100"
        />
      </div>

      <div class="form-group mb-3">
        <label for="company-tel" class="form-label">Telefon</label>
        <input
          id="company-tel"
          v-model="formData.tel"
          type="tel"
          class="form-control"
          placeholder="+49 123 456789"
          maxlength="25"
        />
      </div>

      <div class="form-group mb-3">
        <label for="company-tel-person" class="form-label">Ansprechperson (Telefon)</label>
        <input
          id="company-tel-person"
          v-model="formData.telPerson"
          type="text"
          class="form-control"
          placeholder="z.B. Max Mustermann"
          maxlength="100"
        />
      </div>

      <!-- Form Action Buttons -->
      <div class="form-actions d-flex gap-2">
        <button
          class="btn btn-success"
          @click="saveChanges"
          :disabled="isSaving"
          title="Änderungen speichern"
        >
          {{ isSaving ? '💾 Speichert...' : '💾 Speichern' }}
        </button>
        <button
          class="btn btn-warning"
          @click="requestUndo"
          :disabled="isSaving"
          title="Änderungen verwerfen"
        >
          ↶ Verwerfen
        </button>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="modal d-block" style="background: rgba(0, 0, 0, 0.5);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">🗑️ Firma löschen?</h5>
            <button type="button" class="btn-close" @click="cancelDelete"></button>
          </div>
          <div class="modal-body">
            <p>Soll die Firma <strong>{{ props.company.name }}</strong> wirklich gelöscht werden?</p>
            <p class="text-muted">⚠️ Diese Aktion kann nicht rückgängig gemacht werden.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="cancelDelete">
              Abbrechen
            </button>
            <button
              type="button"
              class="btn btn-danger"
              @click="confirmDelete"
              :disabled="isSaving"
            >
              {{ isSaving ? '⏳ Wird gelöscht...' : '🗑️ Ja, löschen' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Undo Confirmation Modal -->
    <div v-if="showUndoConfirm" class="modal d-block" style="background: rgba(0, 0, 0, 0.5);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">↶ Änderungen verwerfen?</h5>
            <button type="button" class="btn-close" @click="cancelUndo"></button>
          </div>
          <div class="modal-body">
            <p>Sollen alle Änderungen verworfen werden?</p>
            <p v-if="props.mode === 'create'" class="text-muted">
              💡 Diese neue Firma wird aus der Liste entfernt.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="cancelUndo">
              Abbrechen
            </button>
            <button
              type="button"
              class="btn btn-warning"
              @click="confirmUndo"
            >
              ↶ Ja, verwerfen
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.company-item-editor {
  padding: 1rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
}

/* ============================================
   VIEW MODE: Company Header Styling
   ============================================ */

.company-header {
  display: flex;
  align-items: stretch;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.company-header:hover {
  background: linear-gradient(135deg, #5568d3 0%, #6a3d91 100%);
}

/**
 * LEFT: Toggle + Actions (vertikal angeordnet)
 */
.company-header-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.toggle-btn {
  background: none;
  border: none;
  color: currentColor;
  cursor: pointer;
  padding: 0;
  font-size: 1rem;
  min-width: 24px;
  text-align: center;
  transition: transform 0.2s;
}

.toggle-btn:hover {
  transform: scale(1.1);
}

/**
 * MIDDLE: Company Info (Name, Summary, URLs, Personen)
 */
.company-info {
  flex: 1;
}

.company-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  margin-bottom: 0.25rem;
}

.company-summary {
  font-size: 0.95rem;
  font-weight: 500;
  margin: 0.25rem 0;
  color: rgba(255, 255, 255, 0.9);
  font-style: italic;
}

.company-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
  margin-bottom: 0;
}

.company-meta .badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

/**
 * Expandierte Details
 */
.company-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
}

.company-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.company-links a {
  color: rgba(255, 255, 255, 0.95);
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.company-links a:hover {
  background: rgba(255, 255, 255, 0.2);
  text-decoration: underline;
}

.company-person {
  font-size: 0.9rem;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.company-person strong {
  color: rgba(255, 255, 255, 0.95);
  white-space: nowrap;
}

.company-person a {
  color: rgba(255, 255, 255, 0.95);
  text-decoration: none;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  transition: background 0.2s;
}

.company-person a:hover {
  background: rgba(255, 255, 255, 0.2);
  text-decoration: underline;
}

/**
 * RIGHT: Badges (nur im collapsed, untereinander)
 */
.company-badges {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
}

.company-badges .badge {
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
  white-space: nowrap;
}

/**
 * LEFT: Action Buttons (nur im expanded)
 */
.company-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.company-actions button {
  font-size: 0.85rem;
  padding: 0.3rem 0.4rem !important;
  min-width: 32px;
}

/* ============================================
   EDIT/CREATE MODE: Form Styling
   ============================================ */

.company-edit-form {
  background: white;
  padding: 1.5rem;
  border-radius: 0.375rem;
}

.company-edit-view {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.company-edit-buttons {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.company-edit-display {
  flex: 1;
}

.company-edit-name {
  margin: 0 0 0.5rem 0;
  font-weight: 500;
}

.company-edit-summary {
  font-size: 0.9rem;
  color: #6c757d;
  margin-bottom: 0.5rem;
}

.company-edit-links {
  font-size: 0.9rem;
}

.company-edit-links a {
  color: #0d6efd;
  text-decoration: none;
  margin-right: 1rem;
}

.company-edit-links a:hover {
  text-decoration: underline;
}

.form-actions {
  margin-top: 1rem;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
}

.modal-dialog {
  width: 100%;
  margin: 0;
  max-width: 500px;
}

.modal-dialog-centered {
  display: flex;
  align-items: center;
  min-height: calc(100% - 1rem);
}

.modal-content {
  border-radius: 0.375rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  font-weight: 600;
  font-size: 1.1rem;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  background-color: #f8f9fa;
  border-top: 1px solid #dee2e6;
  padding: 1rem;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

/* ============================================
   Responsive Design
   ============================================ */

@media (max-width: 768px) {
  .company-header {
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .company-name {
    font-size: 1rem;
  }

  .company-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .company-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .company-header-left {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .toggle-btn {
    order: 1;
  }

  .company-actions {
    order: 2;
    width: auto;
    flex-direction: row;
  }

  .company-info {
    order: 3;
    width: 100%;
  }

  .company-badges {
    order: 4;
    width: 100%;
  }

  .company-name {
    font-size: 0.95rem;
  }
}
</style>
