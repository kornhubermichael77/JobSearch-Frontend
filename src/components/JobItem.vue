<script setup>
/**
 * JobItem.vue - Ein einzelner Job (Company-spezifisch)
 * 
 * Features:
 * - View Mode: Anzeige aller Job-Felder
 * - Edit Mode: Inline Editing mit Save/Discard
 * - Create Mode: Leere Felder, wird aus DOM entfernt bei Discard
 * - Expand/Collapse
 * - Delete mit Bestätigung (mit Kommunikations-Warnung)
 * - Status als Select/Radio (APPLIED, INTERVIEW, REJECTED, etc.)
 */

import { ref, reactive, nextTick, watch } from 'vue';
import { jobApi } from '@/services/api.js';

const props = defineProps({
  job: {
    type: Object,
    default: null,  // null für create-mode
  },
  companyId: {
    type: Number,
    required: true,
  },
  isExpanded: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    enum: ['view', 'edit', 'create'],
    default: 'view',
  },
  jobStatuses: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['toggle', 'update', 'delete']);

/**
 * Auto-Aktiviere Edit-Modus wenn CREATE-Mode startet
 */
watch(
  () => props.mode,
  async (newMode) => {
    if (newMode === 'create') {
      await nextTick();
      startEdit();
    }
  },
  { immediate: true }
);

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
  found: '',              // Datum
  source: '',             // String: max 150
  url: '',                // String: max 500
  text: '',               // String: max 10000 (Beschreibung)
  status: 'APPLIED',      // Enum: APPLIED, INTERVIEW, REJECTED, etc.
  mail: '',               // String: max 150
  mailPerson: '',         // String: max 100
  tel: '',                // String: max 25
  telPerson: '',          // String: max 100
  teilzeit: '',           // String: max 100
  gleitzeit: '',          // String: max 100
  homeoffice: '',         // String: max 100
  features: '',           // String: max 2500
});

/**
 * Starte Edit Mode
 */
const startEdit = () => {
  if (props.mode === 'create') {
    // CREATE: Leere Felder, aber Status hat Default
    formData.status = 'APPLIED';
    originalData.value = {};
  } else {
    // EDIT: Kopiere Job-Daten
    // WICHTIG: found kann DateTime-String (2026-03-24T10:00:00) oder Date-Objekt sein
    // aber input type="date" braucht nur yyyy-MM-dd Format
    let foundDate = '';
    if (props.job?.found) {
      if (typeof props.job.found === 'string') {
        // String: extrahiere Date-Teil
        foundDate = props.job.found.split('T')[0];
      } else if (props.job.found instanceof Date) {
        // Date-Objekt: formatiere zu yyyy-MM-dd
        foundDate = props.job.found.toISOString().split('T')[0];
      }
    }
    
    originalData.value = {
      found: foundDate,
      source: props.job?.source || '',
      url: props.job?.url || '',
      text: props.job?.text || '',
      status: props.job?.status || 'OFFEN',
      mail: props.job?.mail || '',
      mailPerson: props.job?.mailPerson || '',
      tel: props.job?.tel || '',
      telPerson: props.job?.telPerson || '',
      teilzeit: props.job?.teilzeit || '',
      gleitzeit: props.job?.gleitzeit || '',
      homeoffice: props.job?.homeoffice || '',
      features: props.job?.features || '',
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

    // Validierung: status ist erforderlich
    if (!formData.status || !formData.status.trim()) {
      errorMessage.value = 'Status ist erforderlich';
      return;
    }

    // Baue Payload (nur nicht-leere Felder oder sinnvolle Defaults)
    const payload = {
      // Konvertiere Datum zu LocalDateTime Format (yyyy-MM-ddT00:00:00) für Backend
      found: formData.found ? `${formData.found}T00:00:00` : null,
      source: formData.source?.trim() || null,
      url: formData.url?.trim() || null,
      text: formData.text?.trim() || null,
      status: formData.status, // ERFORDERLICH
      mail: formData.mail?.trim() || null,
      mailPerson: formData.mailPerson?.trim() || null,
      tel: formData.tel?.trim() || null,
      telPerson: formData.telPerson?.trim() || null,
      teilzeit: formData.teilzeit?.trim() || null,
      gleitzeit: formData.gleitzeit?.trim() || null,
      homeoffice: formData.homeoffice?.trim() || null,
      features: formData.features?.trim() || null,
    };

    // Bei CREATE-Mode: füge companyId + addressId hinzu
    // Bei UPDATE-Mode: NICHT mitschicken (Backend akzeptiert keine Änderungen daran)
    if (props.mode === 'create') {
      payload.companyId = props.companyId;
      payload.addressId = props.job?.addressId || null;
    }

    let response;
    if (props.mode === 'create') {
      // POST /api/jobs
      response = await jobApi.create(payload);
    } else {
      // PUT /api/jobs/{id}
      response = await jobApi.update(props.job.id, payload);
    }

    // Emit updated job
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
  // Im CREATE-Mode: Ganze JobItem aus UI entfernen
  if (props.mode === 'create') {
    emit('delete');
    return;
  }

  // Im EDIT-Mode: Änderungen zurücksetzen
  Object.assign(formData, originalData.value);
  isEditMode.value = false;
  showUndoConfirm.value = false;
  errorMessage.value = '';
};

/**
 * Abbrechen ohne Speichern
 */
const cancelUndo = () => {
  showUndoConfirm.value = false;
};

/**
 * Delete mit Bestätigung
 */
const requestDelete = () => {
  showDeleteConfirm.value = true;
};

/**
 * Bestätige Löschen
 */
const confirmDelete = () => {
  emit('delete', props.job.id);
  showDeleteConfirm.value = false;
};

/**
 * Abbrechen Löschen
 */
const cancelDelete = () => {
  showDeleteConfirm.value = false;
};

/**
 * Formatiere Job-Summary für collapsed view
 */
const formatJobSummary = () => {
  if (!props.job) return '(neuer Job)';
  
  const parts = [];
  
  // Status
  if (props.job.status) {
    const statusLabels = {
      'APPLIED': '📮 Bewerbung gesendet',
      'INTERVIEW': '📞 Interview',
      'REJECTED': '❌ Abgelehnt',
      'OFFER': '✅ Angebot',
    };
    parts.push(statusLabels[props.job.status] || props.job.status);
  }
  
  // Source
  if (props.job.source) {
    parts.push(`📌 ${props.job.source}`);
  }
  
  // Datum
  if (props.job.found) {
    const date = new Date(props.job.found);
    parts.push(`📅 ${date.toLocaleDateString('de-DE')}`);
  }
  
  return parts.join(' · ') || '(Job)';
};

/**
 * Job Status Enum Values (von Parent über jobStatuses API)
 * Wenn nicht verfügbar, nutze Fallback-Werte
 */
const statusOptions = ref([]);

// Beobachte jobStatuses und aktualisiere statusOptions
watch(
  () => props.jobStatuses,
  (newStatuses) => {
    if (newStatuses && newStatuses.length > 0) {
      // Extrahiere Status-IDs aus jobStatuses Array
      statusOptions.value = newStatuses.map(s => s.id || s);
    } else {
      // Fallback: Hardcodierte Standard-Status
      statusOptions.value = ['OFFEN', 'BEWORBEN', 'INFORMATION_ERHALTEN', 'ZUSAGE', 'ABSAGE'];
    }
  },
  { immediate: true }
);

/**
 * Berechne CSS-Klasse für Status-Badge basierend auf Status
 */
const getStatusClass = (status) => {
  if (!status) return 'status-default';
  
  const normalized = status.toLowerCase();
  const validClasses = ['applied', 'interview', 'rejected', 'offer'];
  
  if (validClasses.includes(normalized)) {
    return `status-${normalized}`;
  }
  
  // Für unbekannte Status: verwende Default-Stil
  return 'status-default';
};
</script>

<template>
  <div class="job-item" :class="`job-item--${mode}`">
    <!-- Collapsed Header -->
    <div class="job-header" :class="{ 'edit-mode': isEditMode }">
      <!-- View Mode Header -->
      <div class="header-view" v-if="!isEditMode" @click="emit('toggle')">
        <!-- Toggle Button -->
        <button class="toggle-btn" :title="isExpanded ? 'Einklappen' : 'Ausklappen'">
          {{ isExpanded ? '▼' : '▶' }}
        </button>

        <!-- Job Summary -->
        <div class="job-summary">
          <!-- Erste Zeile von text (max 2 Zeilen, overflow hidden) -->
          <p v-if="props.job?.text" class="job-summary-text">
            {{ props.job.text.split('\n')[0] }}
          </p>

          <!-- Meta-Informationen: Datum, Quelle, Status (umgekehrte Reihenfolge) -->
          <span v-if="!isExpanded" class="job-text">
            <span v-if="props.job?.found" class="meta-part">
              📅 {{ new Date(props.job.found).toLocaleDateString('de-DE') }}
            </span>
            <span v-if="props.job?.source" class="meta-part">
              📌 {{ props.job.source }}
            </span>
            <span v-if="props.job?.status" class="meta-part">
              {{ props.job.status }}
            </span>
          </span>
        </div>
      </div>

      <!-- Edit Mode Header -->
      <div class="header-edit" v-if="isEditMode">
        <div class="form-actions">
          <button
            class="btn btn-success btn-sm"
            @click="saveChanges"
            :disabled="isSaving"
            title="Änderungen speichern"
          >
            {{ isSaving ? '💾 Speichert...' : '💾 Speichern' }}
          </button>
          <button
            class="btn btn-warning btn-sm"
            @click="requestUndo"
            :disabled="isSaving"
            title="Änderungen verwerfen"
          >
            ↶ Verwerfen
          </button>
          <button
            v-if="props.job"
            class="btn btn-danger btn-sm"
            @click="requestDelete"
            :disabled="isSaving"
            title="Job löschen"
          >
            🗑️ Löschen
          </button>
        </div>
      </div>

      <!-- Action Buttons (nur wenn expandiert und nicht editMode) -->
      <div v-if="isExpanded && props.job && !isEditMode" class="job-actions" @click.stop>
        <button
          class="btn btn-sm btn-secondary"
          @click="startEdit"
          title="Job bearbeiten"
        >
          ✏️
        </button>
        <button
          class="btn btn-sm btn-danger"
          @click="requestDelete"
          title="Job löschen"
        >
          🗑️
        </button>
      </div>
    </div>

    <!-- Detailed View (expanded) -->
    <div class="job-details" v-if="isExpanded && !isEditMode && props.job">
      <!-- Header mit Status und Meta-Info -->
      <div class="job-details-header">
        <!-- Meta Info (in neuer Reihenfolge): Datum, Quelle, Link, Status -->
        <div class="job-meta">
          <!-- Datum -->
          <span v-if="props.job.found" class="meta-date">
            {{ new Date(props.job.found).toLocaleDateString('de-DE') }}
          </span>
          
          <!-- Quelle -->
          <span v-if="props.job.source" class="meta-source">{{ props.job.source }}</span>
          
          <!-- Link -->
          <span v-if="props.job.url" class="meta-link">
            <a :href="props.job.url" target="_blank" title="Jobausschreibung öffnen">Link</a>
          </span>

          <!-- Status Badge mit Farbe (am Ende) -->
          <span class="status-badge" :class="getStatusClass(props.job.status)">
            {{ props.job.status }}
          </span>
        </div>
      </div>

      <!-- Beschreibung und Features (als Fieldsets) -->
      <div class="job-details-content">
        <!-- Beschreibung -->
        <fieldset v-if="props.job.text" class="details-fieldset">
          <legend>📝 Beschreibung</legend>
          <div class="fieldset-content">
            <p style="margin: 0; color: #212529; line-height: 1.5;">{{ props.job.text }}</p>
          </div>
        </fieldset>

        <!-- Features -->
        <fieldset v-if="props.job.features" class="details-fieldset">
          <legend>⭐ Features</legend>
          <div class="fieldset-content">
            <p style="margin: 0; color: #212529; line-height: 1.5;">{{ props.job.features }}</p>
          </div>
        </fieldset>
      </div>

      <!-- Kontakt Details (Fieldset) -->
      <fieldset v-if="props.job.mail || props.job.tel || props.job.mailPerson || props.job.telPerson" class="details-fieldset">
        <legend>📧 Kontakt</legend>
        <div class="fieldset-content">
          <div v-if="props.job.mail || props.job.mailPerson" class="detail-row">
            <span class="detail-label">E-Mail:</span>
            <span class="detail-value">
              <span v-if="props.job.mail">
                <a :href="`mailto:${props.job.mail}`">{{ props.job.mail }}</a>
              </span>
              <span v-if="props.job.mailPerson" class="text-muted ms-2">{{ props.job.mailPerson }}</span>
            </span>
          </div>
          <div v-if="props.job.tel || props.job.telPerson" class="detail-row">
            <span class="detail-label">Telefon:</span>
            <span class="detail-value">
              <span v-if="props.job.tel">
                <a :href="`tel:${props.job.tel}`">{{ props.job.tel }}</a>
              </span>
              <span v-if="props.job.telPerson" class="text-muted ms-2">{{ props.job.telPerson }}</span>
            </span>
          </div>
        </div>
      </fieldset>

      <!-- Arbeitsplatz Details (Fieldset) -->
      <fieldset v-if="props.job.teilzeit || props.job.gleitzeit || props.job.homeoffice" class="details-fieldset">
        <legend>⚙️ Arbeitsplatz</legend>
        <div class="fieldset-content">
          <div v-if="props.job.teilzeit" class="detail-row">
            <span class="detail-label">Teilzeit:</span>
            <span class="detail-value">{{ props.job.teilzeit }}</span>
          </div>
          <div v-if="props.job.gleitzeit" class="detail-row">
            <span class="detail-label">Gleitzeit:</span>
            <span class="detail-value">{{ props.job.gleitzeit }}</span>
          </div>
          <div v-if="props.job.homeoffice" class="detail-row">
            <span class="detail-label">Homeoffice:</span>
            <span class="detail-value">{{ props.job.homeoffice }}</span>
          </div>
        </div>
      </fieldset>
    </div>

    <!-- Edit/Create Form -->
    <div class="job-form" v-if="isEditMode">
      <!-- Error Message -->
      <div v-if="errorMessage" class="alert alert-danger">
        {{ errorMessage }}
      </div>

      <!-- Form Fields -->
      <div class="form-container">
        <!-- Status (erforderlich) -->
        <div class="form-row">
          <label for="status" class="form-label">Status *</label>
          <select
            id="status"
            v-model="formData.status"
            class="form-control"
            required
          >
            <option v-for="opt in statusOptions" :key="opt" :value="opt">
              {{ opt }}
            </option>
          </select>
        </div>

        <!-- Quelle -->
        <div class="form-row">
          <label for="source" class="form-label">Quelle</label>
          <input
            id="source"
            v-model="formData.source"
            type="text"
            class="form-control"
            placeholder="z.B. LinkedIn, Indeed"
          />
        </div>

        <!-- URL -->
        <div class="form-row">
          <label for="url" class="form-label">URL</label>
          <input
            id="url"
            v-model="formData.url"
            type="url"
            class="form-control"
            placeholder="https://..."
          />
        </div>

        <!-- Gefunden am -->
        <div class="form-row">
          <label for="found" class="form-label">Gefunden am</label>
          <input
            id="found"
            v-model="formData.found"
            type="date"
            class="form-control"
          />
        </div>

        <!-- Beschreibung (Fullwidth) -->
        <div class="form-row form-row--fullwidth">
          <label for="text" class="form-label">Beschreibung</label>
          <textarea
            id="text"
            v-model="formData.text"
            class="form-control"
            rows="4"
            placeholder="Jobausschreibung, Anforderungen, etc."
          ></textarea>
        </div>

        <!-- Features (Fullwidth) -->
        <div class="form-row form-row--fullwidth">
          <label for="features" class="form-label">Features</label>
          <textarea
            id="features"
            v-model="formData.features"
            class="form-control"
            rows="3"
            placeholder="Besondere Anforderungen oder Features"
          ></textarea>
        </div>

        <!-- Kontakt Section -->
        <fieldset class="form-section">
          <legend>📞 Kontakt</legend>
          
          <div class="form-row">
            <label for="mail" class="form-label">E-Mail</label>
            <input
              id="mail"
              v-model="formData.mail"
              type="email"
              class="form-control"
              placeholder="hr@example.com"
            />
          </div>

          <div class="form-row">
            <label for="mailPerson" class="form-label">Ansprechperson (E-Mail)</label>
            <input
              id="mailPerson"
              v-model="formData.mailPerson"
              type="text"
              class="form-control"
              placeholder="Name"
            />
          </div>

          <div class="form-row">
            <label for="tel" class="form-label">Telefon</label>
            <input
              id="tel"
              v-model="formData.tel"
              type="tel"
              class="form-control"
              placeholder="+43 1 123456"
            />
          </div>

          <div class="form-row">
            <label for="telPerson" class="form-label">Ansprechperson (Telefon)</label>
            <input
              id="telPerson"
              v-model="formData.telPerson"
              type="text"
              class="form-control"
              placeholder="Name"
            />
          </div>
        </fieldset>

        <!-- Arbeitsplatz Section -->
        <fieldset class="form-section">
          <legend>💼 Arbeitsplatz</legend>
          
          <div class="form-row">
            <label for="teilzeit" class="form-label">Teilzeit</label>
            <input
              id="teilzeit"
              v-model="formData.teilzeit"
              type="text"
              class="form-control"
              placeholder="ja / nein / optional"
            />
          </div>

          <div class="form-row">
            <label for="gleitzeit" class="form-label">Gleitzeit</label>
            <input
              id="gleitzeit"
              v-model="formData.gleitzeit"
              type="text"
              class="form-control"
              placeholder="ja / nein"
            />
          </div>

          <div class="form-row">
            <label for="homeoffice" class="form-label">Homeoffice</label>
            <input
              id="homeoffice"
              v-model="formData.homeoffice"
              type="text"
              class="form-control"
              placeholder="ja / nein / optional"
            />
          </div>
        </fieldset>
      </div>

      <!-- Undo Confirmation Modal -->
      <div v-if="showUndoConfirm" class="modal-overlay" @click="cancelUndo">
        <div class="modal-dialog" @click.stop>
          <div class="modal-content">
            <h5 class="modal-title">
              {{ props.mode === 'create' ? 'Neuen Job verwerfen?' : 'Änderungen verwerfen?' }}
            </h5>
            <p v-if="props.mode === 'create'">
              Der neue Job wird nicht gespeichert und aus der Liste entfernt.
            </p>
            <p v-else>
              Alle Änderungen werden verworfen und können nicht wiederhergestellt werden.
            </p>
            <div class="modal-actions">
              <button
                class="btn btn-secondary btn-sm"
                @click="cancelUndo"
              >
                Abbrechen
              </button>
              <button
                class="btn btn-warning btn-sm"
                @click="confirmUndo"
              >
                Ja, verwerfen
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteConfirm" class="modal-overlay" @click="cancelDelete">
        <div class="modal-dialog" @click.stop>
          <div class="modal-content">
            <h5 class="modal-title">Job löschen?</h5>
            <p>
              Dieser Job wird permanent gelöscht.
              <strong v-if="props.job?.communicationCount">
                Alle {{ props.job.communicationCount }} Kommunikation(en) werden ebenfalls gelöscht.
              </strong>
            </p>
            <div class="modal-actions">
              <button
                class="btn btn-secondary btn-sm"
                @click="cancelDelete"
              >
                Abbrechen
              </button>
              <button
                class="btn btn-danger btn-sm"
                @click="confirmDelete"
              >
                Ja, löschen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/**
 * Job Item Container
 */
.job-item {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  background-color: #fafbfc;
  transition: all 0.2s ease;
}

.job-item:hover {
  border-color: #adb5bd;
  background-color: #f8f9fa;
}

.job-item--create {
  background-color: #e7f3ff;
  border-color: #0d6efd;
}

/**
 * Header
 */
.job-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  user-select: none;
  border-bottom: 1px solid #dee2e6;
}

.job-header.edit-mode {
  background-color: #fff;
  justify-content: flex-end;
}

.header-view {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  cursor: pointer;
}

.header-edit {
  width: 100%;
}

.header-edit .form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.toggle-btn {
  background: none;
  border: none;
  color: #6c757d;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  min-width: 1.5rem;
  text-align: center;
  transition: color 0.2s;
}

.toggle-btn:hover {
  color: #495057;
}

/**
 * Summary
 */
.job-summary {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/**
 * Summary Text - erste Zeile von text-Feld
 * Max 2 Zeilen, overflow hidden (kein "..."), Text wird abgeschnitten
 */
.job-summary-text {
  margin: 0;
  padding: 0;
  font-weight: 500;
  color: #212529;
  font-size: 0.95rem;
  line-height: 1.4;
  
  /* Max 2 Zeilen */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/**
 * Meta Information (Datum, Quelle, Status)
 * Nur im collapsed state sichtbar
 */
.job-text {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: #6c757d;
  flex-wrap: wrap;
}

.meta-part {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.meta-part::after {
  content: '·';
  margin-left: 0.75rem;
  color: #bbb;
}

.meta-part:last-child::after {
  content: '';
  margin-left: 0;
}

/**
 * Actions (nur wenn expandiert)
 */
.job-actions {
  display: flex;
  gap: 0.25rem;
}

/**
 * Details View
 */
.job-details {
  padding: 1.5rem;
  background-color: #fff;
  border-top: 1px solid #dee2e6;
}

/**
 * Details Header: Status, Meta
 */
.job-details-header {
  margin-bottom: 1.5rem;
}

.job-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Status Badge mit Farben je nach Status */
.status-badge {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: 0.25rem;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-applied {
  background-color: #cfe2ff;
  color: #084298;
  border: 1px solid #b6d4fe;
}

.status-interview {
  background-color: #fff3cd;
  color: #664d03;
  border: 1px solid #ffecb5;
}

.status-rejected {
  background-color: #f8d7da;
  color: #842029;
  border: 1px solid #f5c2c7;
}

.status-offer {
  background-color: #d1e7dd;
  color: #0f5132;
  border: 1px solid #badbcc;
}

/* Default Status für unbekannte Status (z.B. NACHGEFRAGT) */
.status-default {
  background-color: #e2e3e5;
  color: #383d41;
  border: 1px solid #d3d6d8;
}

/* Meta Info: Quelle, Datum, Link */
.meta-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: #6c757d;
}

.meta-source {
  font-weight: 500;
}

.meta-date {
  font-size: 0.85rem;
}

.meta-link a {
  color: #0d6efd;
  text-decoration: none;
}

.meta-link a:hover {
  text-decoration: underline;
}

/**
 * Details Content: Beschreibung, Features
 */
.job-details-content {
  margin-bottom: 1.5rem;
}

.detail-box {
  background-color: #f8f9fa;
  padding: 0.875rem;
  border-radius: 0.375rem;
  margin-bottom: 0.75rem;
  border-left: 3px solid #0d6efd;
  line-height: 1.5;
  color: #212529;
}

.detail-box:last-child {
  margin-bottom: 0;
}

.detail-box strong {
  color: #495057;
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 600;
}

/**
 * Fieldsets für Kontakt & Arbeitsplatz
 */
.details-fieldset {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 1rem;
  background-color: #f8f9fa;
  margin-bottom: 1rem;
}

.details-fieldset:last-of-type {
  margin-bottom: 0;
}

.details-fieldset legend {
  font-weight: 700;
  color: #212529;
  padding: 0 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
}

.fieldset-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fieldset-content .detail-row {
  margin-bottom: 0;
  gap: 0.5rem;
  align-items: flex-start;
}

.fieldset-content .detail-label {
  min-width: auto;
  flex-shrink: 0;
  font-weight: 600;
  color: #495057;
}

.fieldset-content .detail-row {
  align-items: flex-start;
}

.fieldset-content .detail-value {
  flex: 1;
  text-align: left;
}

/**
 * Generic Detail Rows
 */
.detail-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.detail-label {
  font-weight: 600;
  color: #495057;
  min-width: 150px;
  flex-shrink: 0;
}

.detail-value {
  color: #212529;
  flex: 1;
  word-break: break-word;
}

.detail-value a {
  color: #0d6efd;
  text-decoration: none;
}

.detail-value a:hover {
  text-decoration: underline;
}

.text-muted {
  color: #6c757d;
  font-size: 0.9rem;
}

.ms-2 {
  margin-left: 0.5rem;
}

.detail-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
}

.section-title {
  font-weight: 700;
  color: #212529;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
}

/**
 * Form Styling
 */
.job-form {
  padding: 1.5rem;
  background-color: #fff;
  border-top: 1px solid #dee2e6;
}

.form-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

/* Responsive Grid: 2 Spalten bei breiterem Viewport */
@media (min-width: 768px) {
  .form-container {
    grid-template-columns: 1fr 1fr;
  }
}

/**
 * Form Row - bei schmal vertikal, bei breit horizontal (Label links, Input rechts)
 */
.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* Bei breiterem Viewport: Label und Input nebeneinander */
@media (min-width: 768px) {
  .form-row {
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
  }

  .form-row .form-label {
    flex: 0 0 120px;
    margin-bottom: 0;
  }

  .form-row .form-control {
    flex: 1;
  }
}

/**
 * Fullwidth Form Row - für Beschreibung und Features
 * Immer vertikal (Label oben, Textarea unten)
 * Nimmt beide Spalten bei breit ein
 */
.form-row--fullwidth {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

@media (min-width: 768px) {
  .form-row--fullwidth {
    grid-column: 1 / -1;
    flex-direction: column;
  }
}

.form-label {
  font-weight: 600;
  color: #495057;
  font-size: 0.95rem;
}

.form-label::after {
  content: '';
}

.form-control,
.form-check-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  font-size: 0.95rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-control:focus,
.form-check-input:focus {
  outline: none;
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}

textarea.form-control {
  resize: vertical;
  min-height: 80px;
  font-family: monospace;
}

.form-section {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 1rem;
  background-color: #f8f9fa;
}

.form-section legend {
  font-weight: 600;
  color: #212529;
  padding: 0 0.5rem;
  margin-bottom: 0.75rem;
}

.form-section .form-row {
  margin-bottom: 1rem;
}

.form-section .form-row:last-child {
  margin-bottom: 0;
}

/**
 * Buttons
 */
.btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-success {
  background-color: #198754;
  color: #fff;
  border-color: #198754;
}

.btn-success:hover:not(:disabled) {
  background-color: #157347;
  border-color: #157347;
}

.btn-warning {
  background-color: #ffc107;
  color: #000;
  border-color: #ffc107;
}

.btn-warning:hover:not(:disabled) {
  background-color: #ffb800;
  border-color: #ffb800;
}

.btn-danger {
  background-color: #dc3545;
  color: #fff;
  border-color: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
  border-color: #c82333;
}

.btn-secondary {
  background-color: #6c757d;
  color: #fff;
  border-color: #6c757d;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5c636a;
  border-color: #5c636a;
}

/**
 * Modal
 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  background-color: #fff;
  border-radius: 0.5rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}

.modal-content {
  padding: 1.5rem;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: #212529;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

/**
 * Alert
 */
.alert {
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
}

.alert-danger {
  background-color: #f8d7da;
  color: #842029;
  border: 1px solid #f5c2c7;
}
</style>
