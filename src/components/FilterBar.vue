<script setup>
/**
 * FilterBar.vue - Die 7 Filter-Dropdowns oben im Dashboard
 * 
 * Filter:
 * 1. Firma (select) - bestimmt verfügbare Jobs
 * 2. Job-Status (select) - filtert Jobs
 * 3. Person (select) - aus Timeline-Daten
 * 4. Kommunikations-Typ (select) - hardcoded Enum
 * 5. Kommunikations-Status (select) - aus Backend Enum
 * 6. Datum (date picker) - "from" Parameter
 * 7. (Pagination ist in Timeline-Komponente)
 * 
 * Props/Emit:
 * - Data kommt von useData() Composable
 * - Änderungen triggern Filter-Methoden
 */

import { computed } from 'vue';

const props = defineProps({
  filters: Object, // filters reactive object
  companies: Array,
  currentCompany: Object,
  jobs: Array, // Array von Jobs der aktuellen Firma
  jobStatuses: Array,
  communicationStatuses: Array,
  communicationTypes: Array,
  availablePeople: Array,
});

const emit = defineEmits([
  'update:companyId',
  'update:jobId',
  'update:jobStatus',
  'update:person',
  'update:communicationType',
  'update:communicationStatus',
  'update:fromDate',
  'reset',
]);

/**
 * Handler für Filter-Änderungen
 * Diese Methoden triggen die parent Component um Daten zu laden
 */

const handleCompanyChange = (companyId) => {
  emit('update:companyId', companyId);
};

const handleJobChange = (jobId) => {
  emit('update:jobId', jobId);
};

const handleJobStatusChange = (status) => {
  emit('update:jobStatus', status);
};

const handlePersonChange = (person) => {
  emit('update:person', person);
};

const handleCommunicationTypeChange = (type) => {
  emit('update:communicationType', type);
};

const handleCommunicationStatusChange = (status) => {
  emit('update:communicationStatus', status);
};

const handleFromDateChange = (date) => {
  emit('update:fromDate', date);
};

/**
 * Styling Klassen für Dropdowns
 */
const filterClass = 'form-select form-select-sm';
</script>

<template>
  <div class="filter-bar">
    <!-- Container mit Grid Layout -->
    <div class="filter-container">
      <!-- Header -->
      <div class="filter-header">
        <h5 class="mb-0">🔍 Filter</h5>
      </div>

      <!-- Filter Inputs (Grid 7 Spalten) -->
      <div class="filter-grid">
        <!-- 1️⃣ Firma -->
        <div class="filter-item">
          <label for="filter-company" class="form-label small">Firma</label>
          <select
            id="filter-company"
            :class="filterClass"
            :value="filters.companyId || ''"
            @change="(e) => handleCompanyChange(e.target.value ? Number(e.target.value) : null)"
          >
            <option value="">— Alle Firmen —</option>
            <option v-for="company in companies" :key="company.id" :value="company.id">
              {{ company.name }}
            </option>
          </select>
        </div>

        <!-- 1️⃣.5️⃣ Job -->
        <div class="filter-item">
          <label for="filter-job" class="form-label small">Job</label>
          <select
            id="filter-job"
            :class="filterClass"
            :value="filters.jobId || ''"
            @change="(e) => handleJobChange(Number(e.target.value) || null)"
          >
            <option value="">— Alle Jobs —</option>
            <option v-for="job in jobs" :key="job.id" :value="job.id">
              {{ job.source }} ({{ job.status }})
            </option>
          </select>
        </div>

        <!-- 2️⃣ Job-Status -->
        <div class="filter-item">
          <label for="filter-job-status" class="form-label small">Job-Status</label>
          <select
            id="filter-job-status"
            :class="filterClass"
            :value="filters.jobStatus || ''"
            @change="(e) => handleJobStatusChange(e.target.value || null)"
          >
            <option value="">— Alle Status —</option>
            <option v-for="status in jobStatuses" :key="status" :value="status">
              {{ status }}
            </option>
          </select>
        </div>

        <!-- 3️⃣ Person -->
        <div class="filter-item">
          <label for="filter-person" class="form-label small">Person</label>
          <select
            id="filter-person"
            :class="filterClass"
            :value="filters.person || ''"
            @change="(e) => handlePersonChange(e.target.value || null)"
          >
            <option value="">— Alle Personen —</option>
            <option v-for="person in availablePeople" :key="person" :value="person">
              {{ person }}
            </option>
          </select>
        </div>

        <!-- 4️⃣ Kommunikations-Typ -->
        <div class="filter-item">
          <label for="filter-com-type" class="form-label small">Kom.-Typ</label>
          <select
            id="filter-com-type"
            :class="filterClass"
            :value="filters.communicationType || ''"
            @change="(e) => handleCommunicationTypeChange(e.target.value || null)"
          >
            <option value="">— Alle Typen —</option>
            <option v-for="type in communicationTypes" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
        </div>

        <!-- 5️⃣ Kommunikations-Status -->
        <div class="filter-item">
          <label for="filter-com-status" class="form-label small">Kom.-Status</label>
          <select
            id="filter-com-status"
            :class="filterClass"
            :value="filters.communicationStatus || ''"
            @change="(e) => handleCommunicationStatusChange(e.target.value || null)"
          >
            <option value="">— Alle Status —</option>
            <option v-for="status in communicationStatuses" :key="status" :value="status">
              {{ status }}
            </option>
          </select>
        </div>

        <!-- 6️⃣ Datum (from) -->
        <div class="filter-item">
          <label for="filter-date" class="form-label small">Datum (ab)</label>
          <input
            id="filter-date"
            type="date"
            class="form-control form-control-sm"
            :value="filters.fromDate || ''"
            @change="(e) => handleFromDateChange(e.target.value || null)"
          />
        </div>

        <!-- Reset Button -->
        <div class="filter-item filter-reset">
          <button
            class="btn btn-sm btn-outline-secondary w-100 mt-2"
            @click="$emit('reset')"
            title="Alle Filter zurücksetzen"
          >
            🔄 Reset
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/**
 * Filter Bar - sticky oben unter Header
 */

.filter-bar {
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  padding: 1rem 0;
}

.filter-container {
  padding: 0 1rem;
}

.filter-header {
  margin-bottom: 0.75rem;
}

.filter-header h5 {
  font-weight: 600;
  color: #333;
}

/**
 * Grid Layout: 7 Spalten (responsive)
 */
.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-item label {
  font-weight: 500;
  color: #555;
  margin-bottom: 0.25rem;
}

.filter-item .form-label {
  margin-bottom: 0.25rem;
}

.form-select-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-select-sm:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
}

.form-control-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

/**
 * Reset Button - separate Spalte
 */
.filter-reset {
  align-self: flex-end;
}

.filter-reset button {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
}

/**
 * Mobile Responsive
 */
@media (max-width: 768px) {
  .filter-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.75rem;
  }

  .filter-container {
    padding: 0 0.75rem;
  }

  .filter-header h5 {
    font-size: 0.95rem;
  }

  .form-select-sm,
  .form-control-sm {
    font-size: 0.8rem;
  }
}
</style>
