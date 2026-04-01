<script setup>
/**
 * TimelineItem.vue - Ein einzelne Kommunikation (PHONE, MAIL, WEBFORM, etc.)
 * 
 * Props:
 * - communication: Das Kommunikationsobjekt
 * - isExpanded: Ist dieses Item expandiert?
 * 
 * Emits:
 * - toggle: User hat Toggle geklickt
 * - edit: User hat Bearbeiten geklickt
 * - delete: User hat Löschen geklickt
 * 
 * Features:
 * - Verschiedene Icons/Farben pro Type (PHONE 📞, MAIL 📧, etc.)
 * - Direction Pfeile (IN 📥, OUT 📤)
 * - Expand/Collapse mit allen Feldern anzeigen wenn expandiert
 * - Edit Mode (später)
 */

import { computed } from 'vue';

const props = defineProps({
  communication: {
    type: Object,
    required: true,
  },
  isExpanded: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['toggle', 'edit', 'delete']);

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

const config = computed(() => typeConfig[props.communication.type] || typeConfig.PHONE);

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
    ZUGESAGT: 'success',
    ABSAGE: 'danger',
    BEWORBEN: 'info',
    OFFEN: 'warning',
    INFORMATION_ERHALTEN: 'primary',
  };
  return colors[status] || 'secondary';
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
      <div class="type-indicator">
      </div>

      <!-- Summary  -->
      <div class="timeline-summary flex-grow-1">
        <strong><span v-if="directionIcon" class="direction-icon">{{ directionIcon }}</span> <span class="type-icon">{{ config.icon }}</span> {{ config.label }}</strong>
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
      </div>

      <!-- Edit/Delete Buttons (nur wenn expandiert) -->
      <div v-if="isExpanded" class="timeline-actions">
        <button
          class="btn btn-sm btn-outline-primary"
          @click.stop="emit('edit')"
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
    </div>

    <!-- Details (Expandiert) -->
    <div v-if="isExpanded" class="timeline-details">
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
      <template v-if="communication.type === 'PHONE'">
        <div v-if="communication.number" class="detail-field">
          <strong>Nummer:</strong> {{ communication.number }}
        </div>
      </template>

      <!-- MAIL -->
      <template v-if="communication.type === 'MAIL'">
        <div v-if="communication.address" class="detail-field">
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
      <template v-if="communication.type === 'WEBFORM'">
        <div v-if="communication.url" class="detail-field">
          <strong>URL:</strong>
          <a :href="communication.url" target="_blank">{{ communication.url }}</a>
        </div>
        <div v-if="communication.screenshot" class="detail-field">
          <strong>Screenshot:</strong> {{ communication.screenshot }}
        </div>
      </template>

      <!-- TALK, TRIAL, INTERVIEW -->
      <template v-if="communication.type === 'TALK'">
        <div v-if="communication.location" class="detail-field">
          <strong>Ort:</strong> {{ communication.location }}
        </div>
        <div v-if="communication.context" class="detail-field">
          <strong>Kontext:</strong> {{ communication.context }}
        </div>
      </template>

      <template v-if="['TRIAL', 'INTERVIEW'].includes(communication.type)">
        <div v-if="communication.duration" class="detail-field">
          <strong>Dauer:</strong> {{ communication.duration }}
        </div>
        <div v-if="communication.conclusion" class="detail-field">
          <strong>Fazit:</strong>
          <p class="mb-0">{{ communication.conclusion }}</p>
        </div>
      </template>

      <!-- Sidemarks (alle Typen) -->
      <div v-if="communication.sidemarks" class="detail-field">
        <strong>Notizen:</strong>
        <p class="mb-0 text-muted">{{ communication.sidemarks }}</p>
      </div>

      <!-- Status -->
      <!-- Redundant mit timeline-summary - nicht mehr anzeigen -->

      <!-- Datum (vollständig) -->
      <!-- Redundant mit timeline-summary - nicht mehr anzeigen -->
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

.timeline-details .detail-field {
  pointer-events: none;
}

.timeline-details a {
  pointer-events: auto;
}

.timeline-header {
  position: relative;
  z-index: 10;
  pointer-events: auto;
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

.text-muted {
  color: #666;
}

.badge {
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
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
}
</style>
