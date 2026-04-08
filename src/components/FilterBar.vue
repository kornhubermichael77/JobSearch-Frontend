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

import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import JobFilterOption from './JobFilterOption.vue';

const props = defineProps({
  filters: Object, // filters reactive object
  companies: Array,
  currentCompany: Object,
  jobs: Array, // Array von Jobs der aktuellen Firma
  allJobsForFilter: Array, // ALLE Jobs für Dropdown (auch nicht geöffnete Firmen)
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
 * Smart Job-Filtering:
 * - Wenn companyId Filter aktiv: nur Jobs dieser Firma
 * - Wenn jobStatus Filter aktiv: nur Jobs mit diesem Status
 * - Kombiniert beide Filter (AND-Logic)
 * 
 * Priority:
 * 1. Verwende allJobsForFilter wenn vorhanden
 * 2. Fallback zu props.jobs wenn allJobsForFilter leer/undefined ist
 */
const visibleJobsForDropdown = computed(() => {
  // Nutze ALLE Jobs wenn verfügbar, sonst fallback zu filtered Jobs
  const availableJobs = (props.allJobsForFilter && props.allJobsForFilter.length > 0) 
    ? props.allJobsForFilter 
    : (props.jobs && props.jobs.length > 0)
      ? props.jobs 
      : [];

  if (!availableJobs.length) {
    console.log('[FilterBar] ⚠️ Keine Jobs verfügbar:', {
      allJobsForFilter: props.allJobsForFilter?.length,
      jobs: props.jobs?.length,
    });
    return [];
  }

  let filtered = availableJobs;

  // Filter nach Company (wenn ausgewählt)
  if (props.filters?.companyId) {
    filtered = filtered.filter(job => job.companyId === props.filters.companyId);
    console.log('[FilterBar] 🏢 Nach Company gefiltert:', {
      companyId: props.filters.companyId,
      before: availableJobs.length,
      after: filtered.length
    });
  }

  // Filter nach Job-Status (wenn ausgewählt)
  if (props.filters?.jobStatus) {
    filtered = filtered.filter(job => job.status === props.filters.jobStatus);
    console.log('[FilterBar] 📊 Nach Status gefiltert:', {
      jobStatus: props.filters.jobStatus,
      before: availableJobs.length,
      after: filtered.length
    });
  }

  console.log('[FilterBar] ✅ visibleJobsForDropdown berechnet:', {
    source: props.allJobsForFilter?.length > 0 ? 'allJobsForFilter' : 'jobs fallback',
    totalAvailable: availableJobs.length,
    companyFilter: props.filters?.companyId ? `${props.filters.companyId}` : 'none',
    statusFilter: props.filters?.jobStatus ? `${props.filters.jobStatus}` : 'none',
    resultCount: filtered.length,
    samples: filtered.slice(0, 3).map(j => ({ id: j.id, source: j.source }))
  });

  return filtered;
});

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

/**
 * State für Bootstrap Dropdown (Job)
 */
const showJobDropdown = ref(false);
const jobDropdownRef = ref(null);

/**
 * Click-Away Handler - schließe Dropdown wenn daneben geklickt
 */
const handleClickOutside = (event) => {
  if (jobDropdownRef.value && !jobDropdownRef.value.contains(event.target)) {
    showJobDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  console.log('[FilterBar] 🎬 Mounted, Props beim Mount:', {
    allJobsForFilter: props.allJobsForFilter?.length || 0,
    jobs: props.jobs?.length || 0,
    filters: props.filters
  });
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  console.log('[FilterBar] 🛑 Unmounted');
});

/**
 * Watcher: Beobachte allJobsForFilter auf Änderungen
 * (DEBUG: Zeige, wenn Daten geladen werden)
 */
watch(() => props.allJobsForFilter, (newJobs) => {
  console.log('[FilterBar] 👁️ Watcher triggered: allJobsForFilter changed:', {
    newCount: newJobs?.length || 0,
    oldCount: 'N/A',
    firstFewJobs: newJobs?.slice(0, 2).map(j => ({ id: j.id, text: j.text, companyId: j.companyId }))
  });
}, { deep: false });

/**
 * Watcher: Beobachte Filter Änderungen
 */
watch(() => props.filters, (newFilters) => {
  console.log('[FilterBar] 👁️ Watcher triggered: filters changed:', {
    companyId: newFilters?.companyId,
    jobStatus: newFilters?.jobStatus,
    jobId: newFilters?.jobId
  });
}, { deep: true });
</script>

<template>
  <div class="filter-bar">
    <!-- Container mit Grid Layout -->
    <div class="filter-container">
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

        <!-- 1️⃣.5️⃣ Job (Bootstrap Dropdown mit Custom-Items) -->
        <div class="filter-item">
          <label class="form-label small">Job</label>
          <div 
            ref="jobDropdownRef"
            class="dropdown filter-dropdown"
          >
            <button
              class="btn btn-sm btn-outline-secondary dropdown-toggle w-100 text-start"
              type="button"
              @click="showJobDropdown = !showJobDropdown"
              :aria-expanded="showJobDropdown"
            >
              <span v-if="!filters.jobId" class="text-muted">— Alle Jobs —</span>
              <span v-else>
                {{
                  visibleJobsForDropdown.find(j => j.id === filters.jobId)?.source ||
                  '(Job nicht gefunden)'
                }}
              </span>
            </button>

            <!-- Dropdown Menu (Bootstrap) -->
            <ul
              class="dropdown-menu w-100"
              :class="{ show: showJobDropdown }"
              @click.stop="showJobDropdown = false"
            >
              <!-- "Alle Jobs" Option -->
              <li>
                <a
                  href="#"
                  class="dropdown-item"
                  :class="{ active: !filters.jobId }"
                  @click.prevent="handleJobChange(null)"
                >
                  — Alle Jobs —
                </a>
              </li>

              <li><hr class="dropdown-divider" /></li>

              <!-- Job Items mit Custom Component -->
              <li v-for="job in visibleJobsForDropdown" :key="job.id">
                <a
                  href="#"
                  class="dropdown-item job-option"
                  :class="{ active: filters.jobId === job.id }"
                  @click.prevent="handleJobChange(job.id)"
                >
                  <JobFilterOption :job="job" />
                </a>
              </li>
            </ul>
          </div>
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
 * Job Filter Dropdown (Bootstrap Dropdown mit Custom Items)
 */
.filter-dropdown {
  position: relative;
  width: 100%;
}

.filter-dropdown .dropdown-toggle {
  color: #212529;
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  border-color: #dee2e6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-dropdown .dropdown-toggle::after {
  margin-left: auto;
  flex-shrink: 0;
}

.filter-dropdown .dropdown-menu {
  max-height: 300px;
  overflow-y: auto;
  font-size: 0.875rem;
  min-width: auto;
  width: 100%;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}

.filter-dropdown .dropdown-item {
  padding: 0.375rem 0.75rem;
  white-space: normal;
  word-wrap: break-word;
}

.filter-dropdown .dropdown-item.job-option {
  padding: 0.5rem 0.75rem;
  display: block;
}

.filter-dropdown .dropdown-item:hover,
.filter-dropdown .dropdown-item.active {
  background-color: #e7f3ff;
  color: #0066cc;
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

  .form-select-sm,
  .form-control-sm {
    font-size: 0.8rem;
  }
}
</style>
