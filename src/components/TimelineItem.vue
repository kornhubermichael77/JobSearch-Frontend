<script setup>
/**
 * TimelineItem.vue - Ein einzelne Kommunikation (PHONE, MAIL, WEBFORM, etc.)
 * 
 * Features:
 * - Verschiedene Icons/Farben pro Type (PHONE 📞, MAIL 📧, etc.)
 * - Direction Pfeile (IN 📥, OUT 📤)
 * - Expand/Collapse mit allen Feldern anzeigen wenn expandiert
 * - Edit Mode mit inline Editing
 * - Save/Undo Buttons mit Bestätigung
 * - Datum-Picker mit Flatpickr
 * - Status-Dropdown
 */

import { computed, ref, reactive, nextTick, watch } from 'vue';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { communicationApi } from '@/services/api.js';

const props = defineProps({
  // Bei Edit-Mode: Kommunikation mit Daten
  // Bei Create-Mode: null
  communication: {
    type: Object,
    default: null,
  },
  isExpanded: {
    type: Boolean,
    default: false,
  },
  jobId: {
    type: Number,
    required: true,
  },
  communicationStatuses: {
    type: Array,
    default: () => [],
  },
  // ✨ NEW: Mode ('edit' oder 'create')
  mode: {
    type: String,
    enum: ['edit', 'create'],
    default: 'edit',
  },
  // ✨ NEW: Bei Create-Mode: welcher Typ wird erstellt
  communicationType: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['toggle', 'edit', 'delete', 'update']);

/**
 * ✨ Auto-Aktiviere Edit-Modus wenn CREATE-Mode startet
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
const showUndoConfirm = ref(false);

// Store original values for undo
const originalData = ref({});

// Edited form data
const formData = reactive({
  date: '',
  person: '',
  role: '',
  content: '',
  sidemarks: '',
  status: '',
  // Type-spezifische Felder
  address: '',
  subject: '',
  attachments: '',
  number: '',
  direction: '',
  url: '',
  screenshot: '',
  location: '',
  context: '',
  duration: '',
  conclusion: '',
});

/**
 * Datepicker ref
 */
const datePickerInstance = ref(null);

/**
 * Type-spezifische Icons und Farben
 */
const typeConfig = {
  PHONE: { icon: '📞', color: 'primary', label: 'Telefon', bgColor: '#d4edff' },
  MAIL: { icon: '✉️', color: 'info', label: 'E-Mail', bgColor: '#fff4e6' },
  WEBFORM: { icon: '🌐', color: 'success', label: 'Web-Formular', bgColor: '#e8f5e9' },
  TALK: { icon: '👥', color: 'warning', label: 'Gespräch', bgColor: '#fff8e1' },
  TRIAL: { icon: '🧪', color: 'secondary', label: 'Test', bgColor: '#f3e5f5' },
  INTERVIEW: { icon: '👔', color: 'danger', label: 'Interview', bgColor: '#ffebee' },
};

const config = computed(() => {
  const type = props.mode === 'edit' ? props.communication?.type : props.communicationType;
  return typeConfig[type] || typeConfig.PHONE;
});

/**
 * Status Enum Values (von Parent oder Fallback)
 */
const statusValues = computed(() => {
  if (props.communicationStatuses && props.communicationStatuses.length > 0) {
    return props.communicationStatuses.map(s => s.id || s);
  }
  // Fallback: Von API laden (sollte nicht mehr nötig sein)
  return ['PENDING', 'COMPLETED', 'CANCELLED', 'SCHEDULED'];
});

/**
 * Direction Enum Values
 */
const directionValues = ['IN', 'OUT'];

/**
 * Direction Icon (IN/OUT)
 */
const directionIcon = computed(() => {
  const dir = props.communication.direction;
  if (dir === 'IN') return '→';
  if (dir === 'OUT') return '←';
  return '';
});

/**
 * Formatiere Datetime
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Status Badge Farbe
 */
const statusBadgeColor = (status) => {
  const colors = {
    // API Standard Statuses
    PENDING: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger',
    SCHEDULED: 'info',
    // Legacy Mock Data Statuses (deprecated aber noch vorhanden)
    ZUGESAGT: 'success',
    ABSAGE: 'danger',
    BEWORBEN: 'info',
    OFFEN: 'warning',
    INFORMATION_ERHALTEN: 'primary',
  };
  return colors[status] || 'secondary';
};

/**
 * Bearbeitungsmodus aktivieren (Edit) oder Erstellungsmodus starten (Create)
 */
const startEdit = async () => {
  isEditMode.value = true;
  errorMessage.value = '';
  
  if (props.mode === 'edit') {
    // ✅ EDIT MODE: Kopiere aktuelle Daten
    originalData.value = JSON.parse(JSON.stringify(props.communication));
    Object.assign(formData, props.communication);
    
    // ✅ Entferne Sekunden aus Datum (falls vorhanden)
    if (formData.date) {
      // Format: "2026-04-03T10:30:45" oder "2026-04-03 10:30:45" → "2026-04-03 10:30"
      formData.date = formData.date.substring(0, 16).replace('T', ' ');
    }
  } else {
    // ✅ CREATE MODE: Leere Felder, Type vorgesetzt
    originalData.value = {};
    Object.assign(formData, {
      date: '',
      person: '',
      role: '',
      content: '',
      sidemarks: '',
      status: '',
      address: '',
      subject: '',
      attachments: '',
      number: '',
      direction: 'OUT', // Standard: Outgoing
      url: '',
      screenshot: '',
      location: '',
      context: '',
      duration: '',
      conclusion: '',
    });
    // Datum auf jetzt setzen (ohne Sekunden)
    const now = new Date();
    now.setSeconds(0, 0); // Setze Sekunden und Millisekunden auf 0
    formData.date = now
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ');
  }
  
  // Initialisiere Datepicker nach nextTick
  await nextTick();
  initDatePicker();
};

/**
 * Initialisiere Flatpickr Datepicker
 */
const initDatePicker = () => {
  const dateInput = document.querySelector('[data-testid="date-picker-input"]');
  if (dateInput) {
    if (datePickerInstance.value) {
      datePickerInstance.value.destroy();
    }
    
    datePickerInstance.value = flatpickr(dateInput, {
      mode: 'single',
      enableTime: true,
      dateFormat: 'Y-m-d H:i',     // UI Anzeigeformat: YYYY-MM-DD HH:MM
      time_24hr: true,             // ✅ 24-Stunden-Format
      weekNumbers: false,
      firstDayOfWeek: 2,           // Test: 2 statt 1 für Montag-Start
      defaultDate: formData.date ? new Date(formData.date.replace(' ', 'T')) : new Date(),
      // locale nicht gesetzt = English fallback (kein undefined-Fehler)
      clickOpens: false,           // ✅ Nur Icon öffnet Picker, nicht Textfeld
      appendTo: document.body,     // Append to body wie üblich
      static: false,
      onChange: (selectedDates) => {
        if (selectedDates[0]) {
          // Format to YYYY-MM-DD HH:MM mit Leerzeichen (kein T)
          const d = selectedDates[0];
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          formData.date = `${year}-${month}-${day} ${hours}:${minutes}`;
        }
      },
    });
  }
};

/**
 * Setze Datum auf jetzt
 */
const setDateToNow = () => {
  const now = new Date();
  // Display Format: YYYY-MM-DD HH:MM (mit Leerzeichen für UI)
  const displayFormat = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)  // YYYY-MM-DDTHH:MM
    .replace('T', ' '); // Ersetze T mit Leerzeichen für UI
  
  // ✅ WICHTIG: Speichere displayFormat (mit Leerzeichen)
  // Der Picker konvertiert es automatisch, und der User sieht das Leerzeichen
  formData.date = displayFormat;
  
  // Aktualisiere Datepicker
  if (datePickerInstance.value) {
    datePickerInstance.value.setDate(now);
  }
};

/**
 * Speichern mit API-Call
 */
const saveChanges = async () => {
  isSaving.value = true;
  errorMessage.value = '';
  
  try {
    // ✅ Validierung: jobId muss vorhanden sein
    if (!props.jobId) {
      throw new Error('jobId fehlt! Die Kommunikation gehört zu keinem Job.');
    }
    
    // ✅ EDIT MODE: Communication-ID muss vorhanden sein
    if (props.mode === 'edit' && !props.communication.id) {
      throw new Error('Communication-ID fehlt! Die Kommunikation hat keine gültige ID.');
    }
    
    // ✅ CREATE MODE: Type muss vorhanden sein
    if (props.mode === 'create' && !props.communicationType) {
      throw new Error('Kommunikationstyp nicht gesetzt!');
    }
    
    const jobId = props.jobId;
    const communicationType = props.mode === 'create' ? props.communicationType : props.communication.type;
    
    // Baue Payload (gleich für edit und create)
    const payload = {
      jobId: jobId,
      type: communicationType,
      date: formData.date,
      person: formData.person || null,
      role: formData.role || null,
      content: formData.content || null,
      sidemarks: formData.sidemarks || null,
      status: formData.status,
      // Type-spezifische Felder
      address: formData.address || null,
      subject: formData.subject || null,
      attachments: formData.attachments || null,
      number: formData.number || null,
      direction: formData.direction || (props.mode === 'edit' ? props.communication.direction : 'OUT'),
      url: formData.url || null,
      screenshot: formData.screenshot || null,
      location: formData.location || null,
      context: formData.context || null,
      duration: formData.duration || null,
      conclusion: formData.conclusion || null,
    };
    
    // API Call: unterschiedlich je nach Mode
    let response;
    if (props.mode === 'create') {
      // ✨ CREATE: POST /api/communications
      response = await communicationApi.create(payload);
    } else {
      // EDIT: PUT /api/communications/{id}?id={id}
      response = await communicationApi.update(props.communication.id, payload);
    }
    
    // Emit update Event mit neuen Daten
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
  // Im CREATE-Mode: Ganze TimelineItem aus UI entfernen
  if (props.mode === 'create') {
    emit('delete');
    return;
  }
  
  // Im EDIT-Mode: Änderungen zurücksetzen
  Object.assign(formData, originalData.value);
  isEditMode.value = false;
  showUndoConfirm.value = false;
  errorMessage.value = '';
  
  if (datePickerInstance.value) {
    datePickerInstance.value.destroy();
    datePickerInstance.value = null;
  }
};

/**
 * Abbrechen ohne Speichern
 */
const cancelUndo = () => {
  showUndoConfirm.value = false;
};

/**
 * Prüfe ob Feld für Type sichtbar sein soll
 */
const getCommunicationType = () => {
  if (props.mode === 'edit') {
    return props.communication?.type;
  }
  return props.communicationType;
};

const shouldShowField = (fieldName) => {
  const typeFieldMap = {
    // PHONE, MAIL, WEBFORM, TALK, TRIAL, INTERVIEW
    number: ['PHONE'],
    address: ['MAIL'],
    subject: ['MAIL'],
    attachments: ['MAIL'],
    url: ['WEBFORM'],
    screenshot: ['WEBFORM'],
    location: ['TALK'],
    context: ['TALK'],
    duration: ['TRIAL', 'INTERVIEW'],
    conclusion: ['TRIAL', 'INTERVIEW'],
    // Gemeinsame Felder
    direction: ['PHONE', 'MAIL'],
  };
  
  const allowedTypes = typeFieldMap[fieldName];
  if (!allowedTypes) return true; // Zeige Feld standardmäßig
  
  const type = props.mode === 'edit' ? props.communication?.type : props.communicationType;
  return allowedTypes.includes(type);
};
</script>

<template>
  <!-- Communication Item Container -->
  <div
    class="timeline-item"
    :style="{ backgroundColor: config.bgColor }"
  >
    <!-- Header (Toggle + Summary) -->
    <div class="timeline-header" @click="emit('toggle')">
      <!-- Toggle Button -->
      <button
        class="toggle-btn"
        :aria-expanded="isExpanded"
        @click.stop="emit('toggle')"
      >
        {{ isExpanded ? '▼' : '▶' }}
      </button>

      <!-- Type Icon + Direction -->
      <div class="type-indicator"></div>

      <!-- Summary  -->
      <div class="timeline-summary flex-grow-1">
        <!-- EDIT MODE: Alle Infos anzeigen -->
        <template v-if="props.mode === 'edit' && communication">
          <strong>
            <span v-if="directionIcon" class="direction-icon">{{ directionIcon }}</span>
            <span class="type-icon">{{ config.icon }}</span>
            {{ config.label }}
          </strong>
          <span class="text-muted ms-2">
            {{ formatDate(communication.date) }}
          </span>
          <span v-if="communication.person" class="text-muted ms-2">
            👤 {{ communication.person }}
          </span>
          <span v-if="communication.status" class="ms-2">
            <span class="badge" :class="`bg-${statusBadgeColor(communication.status)}`">
              {{ communication.status }}
            </span>
          </span>
        </template>
        
        <!-- CREATE MODE: Nur Type anzeigen -->
        <template v-else-if="props.mode === 'create'">
          <strong>
            <span class="type-icon">{{ config.icon }}</span>
            ➕ Neue {{ config.label }}
          </strong>
          <span class="text-muted ms-2" v-if="!isEditMode">
            (Klicken zum bearbeiten)
          </span>
        </template>
      </div>

      <!-- Action Buttons (EDIT MODE, nicht im isEditMode) -->
      <div v-if="isExpanded && !isEditMode && props.mode === 'edit'" class="timeline-actions">
        <button
          class="btn btn-sm btn-outline-primary"
          @click.stop="startEdit"
          title="Bearbeiten"
        >
          ✏️
        </button>
        <button
          class="btn btn-sm btn-outline-danger"
          @click.stop="emit('delete')"
          title="Löschen"
        >
          🗑️
        </button>
      </div>

      <!-- Action Buttons (CREATE MODE, nicht im isEditMode) -->
      <div v-if="isExpanded && !isEditMode && props.mode === 'create'" class="timeline-actions">
        <button
          class="btn btn-sm btn-outline-primary"
          @click.stop="startEdit"
          title="Bearbeiten"
        >
          ✏️ Bearbeiten
        </button>
      </div>

      <!-- Edit-Mode Buttons (Save/Undo) -->
      <div v-if="isEditMode" class="timeline-actions">
        <button
          class="btn btn-sm btn-success"
          @click.stop="saveChanges"
          :disabled="isSaving"
          title="Speichern"
        >
          <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
          {{ isSaving ? 'Speichert...' : '✅ Speichern' }}
        </button>
        <button
          class="btn btn-sm btn-outline-secondary"
          @click.stop="requestUndo"
          :disabled="isSaving"
          title="Änderungen verwerfen"
        >
          ↩️ Verwerfen
        </button>
      </div>
    </div>

    <!-- Details (Expandiert) -->
    <div v-if="isExpanded" class="timeline-details">
      <!-- Edit Mode -->
      <template v-if="isEditMode">
        <!-- Error Message -->
        <div v-if="errorMessage" class="alert alert-danger small mb-0">
          {{ errorMessage }}
        </div>

        <!-- Datum/Zeit mit Picker -->
        <div class="edit-field">
          <label>Datum/Zeit:</label>
          <div class="edit-field-content date-picker-container">
            <input
              v-model="formData.date"
              type="text"
              class="form-control form-control-sm"
              data-testid="date-picker-input"
              placeholder="YYYY-MM-DD HH:MM"
            />
          </div>
        </div>

        <!-- Status -->
        <div class="edit-field">
          <label>Status:</label>
          <select v-model="formData.status" class="form-select form-select-sm">
            <option value="">-- Wählen --</option>
            <option v-for="status in statusValues" :key="status" :value="status">
              {{ status }}
            </option>
          </select>
        </div>

        <!-- Type-spezifische Felder (sortiert nach Relevanz) -->
        <!-- MAIL: E-Mail -->
        <template v-if="getCommunicationType() === 'MAIL' && shouldShowField('address')">
          <div class="edit-field">
            <label>E-Mail:</label>
            <input v-model="formData.address" type="email" class="form-control form-control-sm" />
          </div>
        </template>

        <!-- PHONE/MAIL: Richtung -->
        <template v-if="shouldShowField('direction')">
          <div class="edit-field">
            <label>Richtung:</label>
            <select v-model="formData.direction" class="form-select form-select-sm">
              <option value="">-- Wählen --</option>
              <option v-for="dir in directionValues" :key="dir" :value="dir">
                {{ dir === 'IN' ? '→ Eingehend' : '← Ausgehend' }}
              </option>
            </select>
          </div>
        </template>

        <!-- PHONE: Nummer -->
        <template v-if="getCommunicationType() === 'PHONE' && shouldShowField('number')">
          <div class="edit-field">
            <label>Nummer:</label>
            <input v-model="formData.number" type="text" class="form-control form-control-sm" />
          </div>
        </template>

        <!-- Person -->
        <div class="edit-field">
          <label>Person:</label>
          <input v-model="formData.person" type="text" class="form-control form-control-sm" />
        </div>

        <!-- Rolle -->
        <div class="edit-field">
          <label>Rolle:</label>
          <input v-model="formData.role" type="text" class="form-control form-control-sm" />
        </div>

        <!-- MAIL: Betreff -->
        <template v-if="getCommunicationType() === 'MAIL' && shouldShowField('subject')">
          <div class="edit-field">
            <label>Betreff:</label>
            <input v-model="formData.subject" type="text" class="form-control form-control-sm" />
          </div>
        </template>

        <!-- Inhalt (Content) -->
        <div class="edit-field">
          <label>Inhalt:</label>
          <textarea
            v-model="formData.content"
            class="form-control form-control-sm"
            rows="4"
            placeholder="Inhalte der Kommunikation..."
          ></textarea>
        </div>

        <!-- MAIL: Anhang -->
        <template v-if="getCommunicationType() === 'MAIL' && shouldShowField('attachments')">
          <div class="edit-field">
            <label>Anhang:</label>
            <input v-model="formData.attachments" type="text" class="form-control form-control-sm" />
          </div>
        </template>

        <!-- WEBFORM: URL + Screenshot -->
        <template v-if="getCommunicationType() === 'WEBFORM'">
          <div v-if="shouldShowField('url')" class="edit-field">
            <label>URL:</label>
            <input v-model="formData.url" type="url" class="form-control form-control-sm" />
          </div>
          <div v-if="shouldShowField('screenshot')" class="edit-field">
            <label>Screenshot:</label>
            <input v-model="formData.screenshot" type="text" class="form-control form-control-sm" />
          </div>
        </template>

        <!-- TALK: Ort + Kontext -->
        <template v-if="getCommunicationType() === 'TALK'">
          <div v-if="shouldShowField('location')" class="edit-field">
            <label>Ort:</label>
            <input v-model="formData.location" type="text" class="form-control form-control-sm" />
          </div>
          <div v-if="shouldShowField('context')" class="edit-field">
            <label>Kontext:</label>
            <input v-model="formData.context" type="text" class="form-control form-control-sm" />
          </div>
        </template>

        <!-- TRIAL/INTERVIEW: Dauer + Fazit -->
        <template v-if="['TRIAL', 'INTERVIEW'].includes(getCommunicationType())">
          <div v-if="shouldShowField('duration')" class="edit-field">
            <label>Dauer:</label>
            <input v-model="formData.duration" type="text" class="form-control form-control-sm" />
          </div>
          <div v-if="shouldShowField('conclusion')" class="edit-field">
            <label>Fazit:</label>
            <textarea
              v-model="formData.conclusion"
              class="form-control form-control-sm"
              rows="3"
              placeholder="Fazit/Ergebnis..."
            ></textarea>
          </div>
        </template>

        <!-- Notizen (alle Typen) -->
        <div class="edit-field">
          <label>Notizen:</label>
          <textarea
            v-model="formData.sidemarks"
            class="form-control form-control-sm"
            rows="3"
            placeholder="Persönliche Notizen..."
          ></textarea>
        </div>
      </template>

      <!-- Anzeige Mode (nicht Edit) - nur für EDIT mode mit communication -->
      <template v-else-if="props.mode === 'edit' && communication">
        <!-- Content -->
        <div v-if="communication.content" class="detail-field">
          <strong>Inhalt:</strong>
          <p class="mb-0">{{ communication.content }}</p>
        </div>

        <!-- Person + Role -->
        <div v-if="communication.person" class="detail-field">
          <strong>Person:</strong> {{ communication.person }}
          <span v-if="communication.role" class="text-muted">({{ communication.role }})</span>
        </div>

        <!-- Type-Spezifische Felder -->
        <!-- PHONE -->
        <template v-if="getCommunicationType() === 'PHONE'">
          <div v-if="communication && communication.number" class="detail-field">
            <strong>Nummer:</strong> {{ communication.number }}
          </div>
        </template>

        <!-- MAIL -->
        <template v-if="getCommunicationType() === 'MAIL'">
          <div v-if="communication && communication.address" class="detail-field">
            <strong>E-Mail:</strong>
            <a :href="`mailto:${communication.address}`">{{ communication.address }}</a>
          </div>
          <div v-if="communication.subject" class="detail-field">
            <strong>Betreff:</strong> {{ communication.subject }}
          </div>
          <div v-if="communication.attachments" class="detail-field">
            <strong>Anhang:</strong> {{ communication.attachments }}
          </div>
        </template>

        <!-- WEBFORM -->
        <template v-if="getCommunicationType() === 'WEBFORM'">
          <div v-if="communication && communication.url" class="detail-field">
            <strong>URL:</strong>
            <a :href="communication.url" target="_blank">{{ communication.url }}</a>
          </div>
          <div v-if="communication.screenshot" class="detail-field">
            <strong>Screenshot:</strong> {{ communication.screenshot }}
          </div>
        </template>

        <!-- TALK -->
        <template v-if="getCommunicationType() === 'TALK'">
          <div v-if="communication && communication.location" class="detail-field">
            <strong>Ort:</strong> {{ communication.location }}
          </div>
          <div v-if="communication.context" class="detail-field">
            <strong>Kontext:</strong> {{ communication.context }}
          </div>
        </template>

        <!-- TRIAL, INTERVIEW -->
        <template v-if="['TRIAL', 'INTERVIEW'].includes(getCommunicationType())">
          <div v-if="communication && communication.duration" class="detail-field">
            <strong>Dauer:</strong> {{ communication.duration }}
          </div>
          <div v-if="communication.conclusion" class="detail-field">
            <strong>Fazit:</strong>
            <p class="mb-0">{{ communication.conclusion }}</p>
          </div>
        </template>

        <!-- Notizen (alle Typen) -->
        <div v-if="communication.sidemarks" class="detail-field">
          <strong>Notizen:</strong>
          <p class="mb-0 text-muted">{{ communication.sidemarks }}</p>
        </div>
      </template>
    </div>
  </div>

  <!-- Undo Confirmation Modal -->
  <div v-if="showUndoConfirm" class="modal-backdrop">
    <div class="confirmation-modal">
      <div class="modal-content">
        <h5>Änderungen verwerfen?</h5>
        <p>Alle vorgenommenen Änderungen werden verworfen und die ursprünglichen Daten wiederhergestellt.</p>
        <div class="modal-buttons">
          <button class="btn btn-sm btn-danger" @click="confirmUndo">
            Ja, verwerfen
          </button>
          <button class="btn btn-sm btn-secondary" @click="cancelUndo">
            Nein, bearbeiten weiter
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/**
 * Timeline Item Styling
 */

.timeline-item {
  border-radius: 6px;
  border: 1px solid #ddd;
  overflow: hidden;
  transition: box-shadow 0.2s;
  margin-bottom: 0.5rem;
}

.timeline-item:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

/**
 * Header (Summary)
 */
.timeline-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
  background: rgba(255, 255, 255, 0.7);
}

.timeline-header:hover {
  background: rgba(255, 255, 255, 0.95);
}

.toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  min-width: 20px;
  text-align: center;
  transition: transform 0.2s;
  position: relative;
  z-index: 100;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-btn:hover {
  transform: scale(1.15);
}

/**
 * Type Indicator (Icon + Direction)
 */
.type-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 1.2rem;
}

.type-icon {
  display: inline;
  font-size: 1rem;
}

.direction-icon {
  font-size: 1rem;
  margin-right: 0.25rem;
}

/**
 * Summary
 */
.timeline-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
}

.timeline-summary strong {
  flex: 0 0 auto;
}

/**
 * Actions
 */
.timeline-actions {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.timeline-actions button {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem !important;
}

/**
 * Details (Expanded)
 */
.timeline-details {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 0.9rem;
  position: relative;
  z-index: 0;
}

.detail-field {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.detail-field strong {
  min-width: 100px;
  flex-shrink: 0;
  color: #333;
  font-weight: 600;
}

.detail-field p {
  margin: 0;
  padding: 0.75rem;
  background: #f5f5f5;
  border: 1px solid #bbb;
  border-radius: 4px;
  line-height: 1.5;
  flex: 1;
}

.detail-field a {
  color: #667eea;
  text-decoration: none;
  word-break: break-all;
}

.detail-field a:hover {
  text-decoration: underline;
}

/**
 * Edit Mode Fields
 */
.edit-field {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.edit-field label {
  font-weight: 600;
  color: #333;
  font-size: 0.85rem;
  min-width: 120px;
  flex-shrink: 0;
}

.edit-field-content {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex: 1;
  min-width: 200px;
}

/**
 * Date Picker Container & Icon
 */
.date-picker-container {
  position: relative;
}

.date-picker-container input[type="text"] {
  pointer-events: none;           /* ✅ Input nicht anclickbar */
  cursor: default;                /* Kein Text-Selection Cursor */
}

.edit-field input[type="text"],
.edit-field input[type="email"],
.edit-field input[type="url"],
.edit-field input[type="number"],
.edit-field textarea,
.edit-field select,
.edit-field-content {
  font-size: 0.9rem;
  width: 100%;
  flex: 1;
  min-width: 200px;
}

.edit-field textarea {
  resize: vertical;
  min-height: 80px;
}

/**
 * Util Classes
 */
.text-muted {
  color: #666;
}

.badge {
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
}

.alert {
  margin-bottom: 0.75rem;
}

/**
 * Modal Styling
 */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirmation-modal {
  width: 100%;
  max-width: 400px;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal-content h5 {
  margin-bottom: 0.75rem;
  color: #333;
}

.modal-content p {
  margin-bottom: 1.25rem;
  color: #666;
  font-size: 0.95rem;
}

.modal-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.modal-buttons button {
  flex: 1;
}

/**
 * Spinner
 */
.spinner-border-sm {
  width: 1rem;
  height: 1rem;
  border-width: 0.2em;
}

/**
 * Flatpickr Datum-Picker Styling
 */
:deep(.flatpickr-calendar) {
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  z-index: 99999 !important;
}

:deep(.flatpickr-calendar.arrowTop::before) {
  border-bottom-color: white;
}

:deep(.flatpickr-calendar.arrowTop::after) {
  border-bottom-color: #ccc;
}

:deep(.flatpickr-time) {
  padding: 0.75rem;
  border-top: 1px solid #e9ecef;
}

:deep(.numInputWrapper input) {
  font-size: 0.875rem;
}

/**
 * Responsive
 */
@media (max-width: 768px) {
  .timeline-header {
    gap: 0.5rem;
  }

  .timeline-summary {
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .timeline-actions {
    margin-left: auto;
  }

  .timeline-details {
    padding: 0.75rem;
  }

  .edit-field-content {
    flex-direction: column;
  }

  .edit-field-content button {
    width: 100%;
  }

  .modal-content {
    margin: 1rem;
  }
}
</style>
