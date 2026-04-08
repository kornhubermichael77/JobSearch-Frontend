<script setup>
/**
 * AddressItem.vue - Eine einzelne Adresse (für Company oder Job)
 * 
 * Features:
 * - View Mode: Anzeige aller Adressfelder
 * - Edit Mode: Inline Editing mit Save/Discard
 * - Create Mode: Leere Felder mit Defaults, wird aus DOM entfernt bei Discard
 * - Expand/Collapse
 * - Delete mit Bestätigung
 * - Time Picker für traveltime (HH:MM only)
 * - Distance mit 2 Dezimalstellen
 * - Headquarter Boolean Checkbox
 */

import { ref, reactive, nextTick, watch } from 'vue';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { addressApi, jobApi } from '@/services/api.js';

const props = defineProps({
  address: {
    type: Object,
    default: null,  // null für create-mode
  },
  parentType: {
    type: String,
    enum: ['company', 'job'],
    required: true,
  },
  parentId: {
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
  street: '',
  number: '',
  postcode: '',
  city: '',
  country: '',
  traveltime: '00:00',      // HH:MM format only
  headquarter: true,        // Default true
  distance: 0.00,           // 0-999.99, 2 decimals
});

/**
 * Time Picker ref für traveltime
 */
const travelTimePickerInstance = ref(null);

/**
 * Watcher: Initialisiere Picker wenn EditMode aktiviert wird
 */
watch(
  () => isEditMode.value,
  async (newValue) => {
    if (newValue) {
      await nextTick();
      initTimePicker();
    }
  }
);

/**
 * Locale Decimal Separator für Dezimalzahlen
 */
const getDecimalSeparator = () => {
  const num = (1.5).toLocaleString(navigator.language);
  return num.substring(1, 2); // Extrahiere das Trennzeichen
};

const decimalSeparator = getDecimalSeparator();

/**
 * ⚠️ WICHTIG: Reagiere auf props.address Änderungen (z.B. nach API-Load oder Login)
 */
watch(
  () => props.address,
  (newAddress) => {
    // Immer aufrufen wenn Address vorhanden ist (außer wir sind gerade beim Editieren)
    if (newAddress) {
      if (isEditMode.value) {
        return;
      }
      
      // Verarbeite Traveltime: nur HH:MM speichern
      let traveltime = newAddress.traveltime;
      if (traveltime && traveltime.includes('T')) {
        const timePart = traveltime.split('T')[1];
        traveltime = timePart.substring(0, 5);
      } else if (traveltime && traveltime.includes(':')) {
        traveltime = traveltime.substring(0, 5);
      }
      
      // Verarbeite Distance: zu Number mit 2 Decimals
      let distance = newAddress.distance;
      if (distance != null) {
        let distanceStr = String(distance).replace(',', '.');
        distance = parseFloat(distanceStr);
        distance = parseFloat(distance.toFixed(2));
      }
      
      // ✅ Fülle originalData mit VERARBEITETEN Werten für die Anzeige
      originalData.value = {
        ...newAddress,
        traveltime: traveltime || null,
        distance: distance ?? null,
      };
      
      // ✅ Aktualisiere auch formData falls wir später editieren
      Object.assign(formData, {
        street: newAddress.street || '',
        number: newAddress.number || '',
        postcode: newAddress.postcode || '',
        city: newAddress.city || '',
        country: newAddress.country || '',
        traveltime: traveltime || '00:00',
        headquarter: newAddress.headquarter ?? true,
        distance: distance ?? 0.00,
      });
    }
  },
  { immediate: true, deep: true }
);

/**
 * Bearbeitungsmodus aktivieren (Edit) oder Erstellungsmodus starten (Create)
 */
const startEdit = async () => {
  isEditMode.value = true;
  errorMessage.value = '';
  
  if (props.mode === 'edit' || (props.mode === 'view' && props.address)) {
    // ✅ EDIT MODE: Kopiere aktuelle Daten
    originalData.value = JSON.parse(JSON.stringify(props.address));
    Object.assign(formData, props.address);
    
    // Traveltime: Extrahiere nur "HH:MM" aus "1970-01-01T HH:MM:00" oder "HH:MM:SS" ISO format
    if (formData.traveltime) {
      if (formData.traveltime.includes('T')) {
        // Format: 1970-01-01T01:30:00 → 01:30
        const timePart = formData.traveltime.split('T')[1];
        formData.traveltime = timePart.substring(0, 5); // HH:MM
      } else if (formData.traveltime.includes(':')) {
        // Falls schon nur HH:MM:SS oder HH:MM
        formData.traveltime = formData.traveltime.substring(0, 5); // HH:MM
      }
    }
    
    // Stelle sicher dass distance ein Number ist mit 2 decimals
    // Konvertiere Komma zu Punkt (für Locales die Komma verwenden)
    if (formData.distance != null) {
      let distanceStr = formData.distance.toString().replace(',', '.');
      if (typeof distanceStr === 'string') {
        formData.distance = parseFloat(distanceStr);
      }
      formData.distance = parseFloat(formData.distance.toFixed(2));
    } else {
      formData.distance = 0.00;
    }
  } else {
    // ✅ CREATE MODE: Leere Felder mit Defaults
    originalData.value = {};
    Object.assign(formData, {
      street: '',
      number: '',
      postcode: '',
      city: '',
      country: '',
      traveltime: '00:00',
      headquarter: true,
      distance: 0.00,
    });
  }
  
  // Der watcher wird isEditMode.value = true setzen und initTimePicker() aufrufen
};

/**
 * Initialisiere Flatpickr Time Picker für traveltime (HH:MM only)
 */
const initTimePicker = () => {
  const timeInput = document.querySelector('[data-testid="traveltime-picker-input"]');
  if (timeInput) {
    if (travelTimePickerInstance.value) {
      travelTimePickerInstance.value.destroy();
    }
    
    travelTimePickerInstance.value = flatpickr(timeInput, {
      mode: 'single',
      enableTime: true,
      noCalendar: true,                    // ✅ Nur Zeit, kein Kalendar
      dateFormat: 'H:i',                   // HH:MM format (KEINE Sekunden)
      time_24hr: true,
      enableSeconds: false,                // ✅ Keine Sekunden anzeigen
      defaultDate: formData.traveltime ? new Date(`1970-01-01T${formData.traveltime}:00`) : new Date(),
      clickOpens: false,                   // Nur Icon öffnet Picker
      appendTo: document.body,
      onChange: (selectedDates) => {
        if (selectedDates[0]) {
          const d = selectedDates[0];
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          formData.traveltime = `${hours}:${minutes}`;
        }
      },
    });
  }
};

/**
 * Speichern mit API-Call (PUT für edit, POST für create)
 */
const saveChanges = async () => {
  isSaving.value = true;
  errorMessage.value = '';
  
  try {
    // Validierung: Nur Required-Felder
    if (!formData.street?.trim() || !formData.postcode?.trim() || !formData.city?.trim()) {
      throw new Error('Straße, PLZ und Stadt sind erforderlich!');
    }
    
    // Validiere Distance: 0-999.99 mit 2 Dezimalstellen
    // Konvertiere Komma zu Punkt (für Locales die Komma verwenden)
    let distance = null;
    if (formData.distance != null && formData.distance !== 0) {
      let distanceStr = String(formData.distance).replace(',', '.');
      distance = parseFloat(distanceStr);
      if (isNaN(distance) || distance < 0 || distance > 999.99) {
        throw new Error('Distance muss zwischen 0 und 999.99 liegen!');
      }
      distance = parseFloat(distance.toFixed(2));
    } else if (formData.distance === 0 || formData.distance === '0' || formData.distance === '0.00') {
      distance = 0.00;
    }
    
    // Baue Payload mit nur nicht-leeren Feldern
    const payload = {
      street: formData.street.trim(),
      postcode: formData.postcode.trim(),
      city: formData.city.trim(),
      headquarter: formData.headquarter,
    };
    
    // Optional-Felder: nur senden wenn nicht leer
    if (formData.number?.trim()) {
      payload.number = formData.number.trim();
    } else {
      payload.number = null;
    }
    
    if (formData.country?.trim()) {
      payload.country = formData.country.trim();
    } else {
      payload.country = null;
    }
    
    // Traveltime: nur senden wenn nicht Default (00:00)
    if (formData.traveltime && formData.traveltime !== '00:00') {
      payload.traveltime = `1970-01-01T${formData.traveltime}:00`;
    } else {
      payload.traveltime = null;
    }
    
    // Distance: null oder Zahl mit 2 Dezimalstellen
    payload.distance = distance;
    
    // ⚠️ WICHTIG: Bei JOB-Address CREATE muss jobId mitgesendet werden
    // Backend nutzt jobId um companyId zu ermitteln und zu speichern
    if (props.mode === 'create' && props.parentType === 'job') {
      payload.jobId = props.parentId;
    }
    
    let response;
    if (props.mode === 'create') {
      // ✨ CREATE: Neue Adresse erstellen
      if (props.parentType === 'company') {
        // Company-Adresse: POST /api/companies/{parentId}/addresses
        response = await addressApi.createForCompany(props.parentId, payload);
      } else if (props.parentType === 'job') {
        // Job-Adresse: POST /api/addresses mit jobId + Backend-Logik
        // Backend wird: 
        // 1. companyId vom Job ermitteln
        // 2. In die neue Adresse speichern
        // 3. Address-ID im Job speichern (via FK)
        // 4. Komplettes Address-Objekt mit companyId zurückliefern
        response = await addressApi.create(payload);
      }
    } else {
      // EDIT: PUT /api/addresses/{id}
      response = await addressApi.update(props.address.id, payload);
    }
    
    // Update interne Daten
    originalData.value = JSON.parse(JSON.stringify(response.data));
    
    // Synchronisiere formData mit neuen Daten (für die Anzeige)
    Object.assign(formData, response.data);
    
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
  // Im CREATE-Mode: Ganze AddressItem aus UI entfernen
  if (props.mode === 'create') {
    emit('delete');
    return;
  }
  
  // Im EDIT-Mode: Änderungen zurücksetzen
  Object.assign(formData, originalData.value);
  isEditMode.value = false;
  showUndoConfirm.value = false;
  errorMessage.value = '';
  
  if (travelTimePickerInstance.value) {
    travelTimePickerInstance.value.destroy();
    travelTimePickerInstance.value = null;
  }
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
  emit('delete', props.address.id);
  showDeleteConfirm.value = false;
};

/**
 * Abbrechen Löschen
 */
const cancelDelete = () => {
  showDeleteConfirm.value = false;
};

/**
 * Formatiere Adresse zur Anzeige (nutze originalData nach Save)
 */
const formatAddress = () => {
  const addr = Object.keys(originalData.value).length > 0 ? originalData.value : props.address;
  if (!addr) return '';
  const parts = [addr.street];
  if (addr.number) parts.push(addr.number);
  parts.push((addr.postcode || '') + ' ' + (addr.city || ''));
  if (addr.country) parts.push(addr.country);
  return parts.join(', ');
};

/**
 * Traveltime formatieren für die Anzeige (nur HH:MM aus ISO-Format oder direkter Angabe)
 */
const formatTraveltime = (time) => {
  if (!time) return '—';
  
  // Format: "1970-01-01T01:30:00" oder "01:30:00" → "01:30"
  if (time.includes('T')) {
    const timePart = time.split('T')[1];
    return timePart.substring(0, 5); // HH:MM
  } else if (time.includes(':')) {
    // Falls schon nur HH:MM:SS oder HH:MM
    return time.substring(0, 5); // HH:MM
  }
  
  return time;
};

/**
 * Distance formatieren mit 2 Dezimalstellen und lokalem Dezimaltrennzeichen
 */
const formatDistance = (dist) => {
  if (dist == null) return '—';
  
  if (typeof dist === 'number') {
    const formatted = dist.toFixed(2);
    // Ersetze Punkt durch Locale-spezifisches Trennzeichen
    if (decimalSeparator !== '.') {
      return formatted.replace('.', decimalSeparator);
    }
    return formatted;
  }
  
  const parsed = parseFloat(dist);
  if (isNaN(parsed)) return '—';
  
  const formatted = parsed.toFixed(2);
  // Ersetze Punkt durch Locale-spezifisches Trennzeichen
  if (decimalSeparator !== '.') {
    return formatted.replace('.', decimalSeparator);
  }
  return formatted;
};
</script>

<template>
  <!-- Address Item Container -->
  <div class="address-item" :class="`address-item--${parentType}`">
    <!-- Header (View mode: Toggle + Summary | Edit mode: Action Buttons) -->
    <div class="address-header" :class="{ 'edit-mode': isEditMode }">
      <!-- View Mode: Toggle + Summary + Actions -->
      <div class="header-view" v-if="!isEditMode">
        <button
          class="toggle-btn"
          :aria-expanded="isExpanded"
          @click.stop="emit('toggle')"
        >
          {{ isExpanded ? '▼' : '▶' }}
        </button>

        <!-- Address Summary (collapsed view) -->
        <div class="address-summary">
          <span class="address-text">{{ formatAddress() }}</span>
        </div>

        <!-- Action Buttons (nur im expanded view) -->
        <div class="address-actions" @click.stop v-if="isExpanded && props.address">
          <button
            class="btn btn-sm btn-secondary"
            @click="startEdit"
            title="Adresse bearbeiten"
          >
            ✏️
          </button>
          <button
            class="btn btn-sm btn-danger"
            @click="requestDelete"
            title="Adresse löschen"
          >
            🗑️
          </button>
        </div>
      </div>

      <!-- Edit Mode: Form Actions -->
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
            v-if="props.address"
            class="btn btn-danger btn-sm"
            @click="requestDelete"
            :disabled="isSaving"
            title="Adresse löschen"
          >
            🗑️ Löschen
          </button>
        </div>
      </div>
    </div>

    <!-- Detailed View (expanded) -->
    <div class="address-details" v-if="isExpanded && !isEditMode">
      <!-- Nutze originalData für Anzeige (wird nach Save aktualisiert) -->
      <!-- Straße + Hausnummer (kombiniert) -->
      <div class="form-row-combined">
        <label class="form-label-combined">Straße, Nr.</label>
        <span class="detail-value">
          {{ [(originalData.street || props.address?.street), (originalData.number || props.address?.number)].filter(Boolean).join(' ') || '—' }}
        </span>
      </div>

      <!-- PLZ + Stadt (kombiniert) -->
      <div class="form-row-combined">
        <label class="form-label-combined">PLZ, Stadt</label>
        <span class="detail-value">
          {{ [(originalData.postcode || props.address?.postcode), (originalData.city || props.address?.city)].filter(Boolean).join(' ') || '—' }}
        </span>
      </div>

      <!-- Land -->
      <div class="form-row-combined form-row-country">
        <label class="form-label-combined">Land</label>
        <span class="detail-value">{{ originalData.country || props.address?.country || '—' }}</span>
      </div>

      <!-- Anfahrtszeit + Entfernung + Hauptsitz (nebeneinander) -->
      <div class="form-row-flex detail-view-flex">
        <div class="form-field-group">
          <label class="form-label-combined">Anfahrtszeit (HH:MM)</label>
          <span class="detail-value">{{ formatTraveltime(originalData.traveltime || props.address?.traveltime) }}</span>
        </div>
        <div class="form-field-group">
          <label class="form-label-combined">Entfernung (km)</label>
          <span class="detail-value">{{ formatDistance(originalData.distance ?? props.address?.distance) || '—' }} km</span>
        </div>
        <div class="form-field-group">
          <label class="form-label-combined">Hauptsitz</label>
          <span class="detail-value">{{ (originalData.headquarter !== undefined ? originalData.headquarter : props.address?.headquarter) ? '✔️ Ja' : '—' }}</span>
        </div>
      </div>
    </div>

    <!-- Edit/Create Form -->
    <div class="address-form" v-if="isEditMode">
      <!-- Error Message -->
      <div v-if="errorMessage" class="alert alert-danger">
        {{ errorMessage }}
      </div>

      <!-- Form Fields -->
      <div class="form-container">
        <!-- Straße + Hausnummer (kombiniertes Label) -->
        <div class="form-row-combined">
          <label class="form-label-combined">Straße, Nr.</label>
          <div class="form-inputs-group">
            <input
              id="street"
              v-model="formData.street"
              type="text"
              class="form-control form-control-wide"
              placeholder="Hauptstraße"
            />
            <input
              id="number"
              v-model="formData.number"
              type="text"
              class="form-control form-control-narrow"
              placeholder="123"
            />
          </div>
        </div>

        <!-- PLZ + Stadt (kombiniertes Label) -->
        <div class="form-row-combined">
          <label class="form-label-combined">PLZ, Stadt</label>
          <div class="form-inputs-group">
            <input
              id="postcode"
              v-model="formData.postcode"
              type="text"
              class="form-control form-control-narrow"
              placeholder="10115"
            />
            <input
              id="city"
              v-model="formData.city"
              type="text"
              class="form-control form-control-wide"
              placeholder="Berlin"
            />
          </div>
        </div>

        <!-- Land (inline mit Label in einer Zeile) -->
        <div class="form-row-combined form-row-country">
          <label for="country" class="form-label-combined">Land</label>
          <input
            id="country"
            v-model="formData.country"
            type="text"
            class="form-control form-control-country"
            placeholder="Deutschland"
          />
        </div>

        <!-- Anfahrtszeit + Entfernung + Hauptsitz (responsive nebeneinander) -->
        <div class="form-row-flex">
          <!-- Anfahrtszeit -->
          <div class="form-field-group">
            <label for="traveltime" class="form-label-combined">Anfahrtszeit (HH:MM)</label>
            <input
              id="traveltime"
              v-model="formData.traveltime"
              type="text"
              class="form-control"
              placeholder="00:00"
              data-testid="traveltime-picker-input"
              readonly
            />
          </div>

          <!-- Distance -->
          <div class="form-field-group">
            <label for="distance" class="form-label-combined">Entfernung (km)</label>
            <input
              id="distance"
              v-model.number="formData.distance"
              type="number"
              class="form-control"
              placeholder="0.00"
              min="0"
              max="999.99"
              step="0.01"
            />
          </div>

          <!-- Hauptsitz -->
          <div class="form-field-group">
            <label for="headquarter" class="form-label-combined">Hauptsitz</label>
            <input
              id="headquarter"
              v-model="formData.headquarter"
              type="checkbox"
              class="form-check-input"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Discard Confirmation Modal (außerhalb isEditMode) -->
    <div v-if="showUndoConfirm" class="modal-overlay" @click="cancelUndo">
      <div class="modal-dialog" @click.stop>
        <div class="modal-content">
          <h5 class="modal-title">
            {{ props.mode === 'create' ? 'Neue Adresse verwerfen?' : 'Änderungen verwerfen?' }}
          </h5>
          <p v-if="props.mode === 'create'">
            Die neue Adresse wird nicht gespeichert und aus der Liste entfernt.
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

    <!-- Delete Confirmation Modal (außerhalb isEditMode) -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click="cancelDelete">
      <div class="modal-dialog" @click.stop>
        <div class="modal-content">
          <h5 class="modal-title">Adresse löschen?</h5>
          <p>
            Die Adresse wird permanent gelöscht und kann nicht wiederhergestellt werden.
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
</template>

<style scoped>
/**
 * Address Item Container
 */
.address-item {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  margin-bottom: 0;
  background-color: #fafbfc;
  transition: all 0.2s ease;
}

.address-item:hover {
  border-color: #adb5bd;
  background-color: #f8f9fa;
}

/**
 * Parent-type specific styling
 */
.address-item--company {
  border-left: 4px solid #0d6efd;  /* Company blue */
}

.address-item--job {
  border-left: 4px solid #6f42c1;  /* Job purple */
}

/**
 * Header
 */
.address-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  user-select: none;
  border-bottom: 1px solid #dee2e6;
}

.address-header.edit-mode {
  background-color: #fff;
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
  display: flex;
  justify-content: flex-end;
}

.header-edit .form-actions {
  border-top: none;
  padding: 0;
  margin-bottom: 0;
  gap: 0.5rem;
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
.address-summary {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.address-text {
  font-weight: 500;
  color: #212529;
}

.address-text-muted {
  font-style: italic;
  color: #6c757d;
}

/**
 * Actions (collapsed)
 */
.address-actions {
  display: flex;
  gap: 0.25rem;
}

/**
 * Badge
 */
.badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  white-space: nowrap;
}

.badge-warning {
  background-color: #ffc107;
  color: #000;
}

/**
 * Details (expanded, read-only)
 */
.address-details {
  padding: 1rem;
  background-color: #fff;
}

.detail-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  min-height: 1.5rem;
}

.detail-label {
  flex: 0 0 150px;
  font-weight: 600;
  color: #495057;
}

.detail-value {
  flex: 1;
  color: #212529;
  word-break: break-word;
}

/**
 * Detail View (linksbündig, kompakt)
 */
.address-details .form-row-combined {
  gap: 0;
  align-items: flex-start;
}

.address-details .form-label-combined {
  margin-right: 0.25rem;
}

.address-details .form-row-combined .detail-value {
  flex: none;
}

.address-details .form-row-combined.form-row-country .detail-value {
  flex: none;
}

.address-details .form-row-flex.detail-view-flex {
  gap: 2rem;
}

.address-details .form-row-flex.detail-view-flex .form-field-group {
  flex: none;
  min-width: auto;
}

.address-details .form-row-flex.detail-view-flex .form-field-group .form-label-combined {
  display: block;
  margin-bottom: 0.25rem;
}

.address-details .form-row-flex.detail-view-flex .form-field-group .detail-value {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e9ecef;
  border-radius: 0.375rem;
  background-color: #f8f9fa;
  min-height: 2rem;
  display: flex;
  align-items: center;
}

/**
 * Form (edit/create)
 */
.address-form {
  padding: 1rem;
  background-color: #fff;
}

.form-container {
  margin-bottom: 1rem;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-bottom: 0;
}

/**
 * Form Row Combined (Label links, Inputs rechts)
 */
.form-row-combined {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

/**
 * Combined Label (fixed width)
 */
.form-label-combined {
  flex: 0 0 auto;
  min-width: 120px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
  margin: 0;
}

/**
 * Group von Inputs (z.B. Straße + Hausnummer)
 */
.form-inputs-group {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: 300px;
}

/**
 * Form Control Base
 */
.form-control {
  padding: 0.5rem 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}

/**
 * Wide Input (für Straße, Stadt)
 */
.form-control-wide {
  flex: 2;
  min-width: 200px;
}

/**
 * Narrow Input (für Hausnummer, PLZ)
 */
.form-control-narrow {
  flex: 1;
  min-width: 80px;
}

/**
 * Flex Row für Anfahrtszeit + Entfernung (nebeneinander responsive)
 */
.form-row-flex {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  margin-bottom: 0.75rem;
}

/**
 * Field Group (Anfahrtszeit, Entfernung)
 */
.form-field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 0 1 150px;
  min-width: 150px;
}

.form-field-group .form-label-combined {
  flex: none;
  min-width: none;
  margin-bottom: 0;
}

.form-field-group .form-control {
  width: 100%;
}

/**
 * Country Field (inline, nicht full-width)
 */
.form-row-country {
  align-items: center;
  gap: 1rem;
}

.form-control-country {
  flex: 0 1 250px;
}

.form-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.form-label {
  flex: 0 0 150px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 0;
}

/**
 * Input Group (Time Picker) - Button versteckt, flatpickr icon wird genutzt
 */
.input-group {
  display: flex;
  gap: 0.25rem;
  flex: 1;
  min-width: 200px;
}

.input-group .form-control {
  flex: 1;
}

/**
 * Checkbox Row
 */
.form-check-row {
  align-items: center;
  gap: 0.5rem;
}

.form-check-input {
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  margin: 0;
}

.form-check-label {
  flex: 0 0 150px;
  cursor: pointer;
  margin: 0;
  font-weight: normal;
  font-size: 0.875rem;
  color: #495057;
}

/**
 * Error Alert
 */
.alert {
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.alert-danger {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

/**
 * Action Buttons
 */
.form-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-success {
  background-color: #28a745;
  color: white;
  border-color: #28a745;
}

.btn-success:hover:not(:disabled) {
  background-color: #218838;
  border-color: #1e7e34;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border-color: #6c757d;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
  border-color: #545b62;
}

.btn-warning {
  background-color: #ffc107;
  color: #000;
  border-color: #ffc107;
}

.btn-warning:hover:not(:disabled) {
  background-color: #e0a800;
  border-color: #d39e00;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
  border-color: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
  border-color: #bb2d3b;
}

.btn-outline-secondary {
  background-color: transparent;
  color: #6c757d;
  border-color: #6c757d;
}

.btn-outline-secondary:hover:not(:disabled) {
  background-color: #6c757d;
  color: white;
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/**
 * Modal Overlay (Confirmation Dialogs)
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
  background-color: white;
  border-radius: 0.375rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  max-width: 500px;
  width: 90%;
}

.modal-content {
  padding: 1.5rem;
}

.modal-title {
  font-weight: 600;
  color: #212529;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
