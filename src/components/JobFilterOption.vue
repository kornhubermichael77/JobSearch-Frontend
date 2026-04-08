<script setup>
/**
 * JobFilterOption.vue - Zweizeilige Job-Dropdown Option
 * 
 * Layout:
 * Zeile 1: text (source)
 *   - text: 3/4 der Breite, ellipsis bei Überlauf oder nach Enter-Zeichen
 *   - source: 1/4 der Breite, rechtsbündig, NICHT beschnitten
 * 
 * Zeile 2: @ companyName (status)
 *   - companyName: beschnitten falls nötig, ellipsis
 *   - status: NIEMALS beschnitten, rechtsbündig, fest
 * 
 * Props:
 * - job: { id, text, source, status, companyName, companyId }
 */

import { computed } from 'vue';

const props = defineProps({
  job: {
    type: Object,
    required: true,
  },
});

/**
 * Berechnet die Darstellung der oberen Zeile
 * Nimmt nur die erste Zeile (splittet bei \n)
 */
const displayText = computed(() => {
  if (!props.job?.text) return '';
  
  // Splitten bei Enter-Zeichen (nur erste Zeile nehmen)
  const firstLine = String(props.job.text).split('\n')[0];
  return firstLine || '';
});

/**
 * Style-Objekte für flexibles Layout
 */
const line1Style = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  width: '100%',
  gap: '0.25rem',
};

const textPartStyle = {
  flex: '3',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: '0',
};

const sourcePartStyle = {
  flex: '1',
  whiteSpace: 'nowrap',
  textAlign: 'right',
  flexShrink: 0,
  fontSize: '0.85em',
  color: '#666',
};

const line2Style = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  width: '100%',
  gap: '0.25rem',
  fontSize: '0.9em',
};

const companyPartStyle = {
  flex: '1',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: '0',
  color: '#555',
};

const statusPartStyle = {
  flex: 'none',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  fontWeight: '500',
  fontSize: '0.85em',
  padding: '0.125rem 0.375rem',
  borderRadius: '0.25rem',
  backgroundColor: '#e7f3ff',
  color: '#0066cc',
};
</script>

<template>
  <div class="job-filter-option">
    <!-- Zeile 1: text (source) -->
    <!-- text: 3/4 der Breite mit Ellipsis -->
    <!-- source: 1/4 der Breite, rechtsbündig, NIEMALS beschnitten -->
    <div :style="line1Style">
      <span :style="textPartStyle" :title="props.job?.text">
        {{ displayText }}
      </span>
      <span :style="sourcePartStyle" :title="props.job?.source">
        ({{ props.job?.source }})
      </span>
    </div>

    <!-- Zeile 2: @ companyName (status) -->
    <!-- companyName: beschnitten falls nötig -->
    <!-- status: NIEMALS beschnitten, rechtsbündig -->
    <div :style="line2Style">
      <span :style="companyPartStyle" :title="props.job?.companyName">
        @ {{ props.job?.companyName }}
      </span>
      <span :style="statusPartStyle" :title="props.job?.status">
        {{ props.job?.status }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.job-filter-option {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.375rem 0;
  line-height: 1.3;
}
</style>
