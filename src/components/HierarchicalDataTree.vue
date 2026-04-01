<script setup>
/**
 * HierarchicalDataTree.vue - Die Kern-Komponente des Dashboards
 * 
 * Zeigt 3-Level Hierarchie:
 * Level 1: 📦 Firmen (Expand/Collapse)
 *   ├─ Adressen (Collapse by default, separate collapsed-Flag)
 *   └─ Level 2: 💼 Jobs (Expand/Collapse)
 *       ├─ Address inline (street, number, city)
 *       └─ Level 3: 📞 Timeline/Kommunikationen
 *           ├─ Neueste expanded, Rest collapsed
 *           └─ Pagination + Action Buttons
 * 
 * Styling:
 * - Indentation: 20px pro Level (margin-left)
 * - Verschiedene Hintergrundfarben pro Level
 * - Direction Icons (📥/📤) für PHONE/MAIL
 * - Modern mit Bootstrap + Custom CSS
 */

import { ref, computed } from 'vue';
import TimelineItem from './TimelineItem.vue';
import { loadAddressForJob } from '@/composables/useData.js';

const props = defineProps({
  companies: Array,
  jobsMap: Object, // { [companyId]: [jobs...] }
  timelinesMap: Object, // { [jobId]: timeline_data }
  loadingJobsMap: Object,
  loadingTimelineMap: Object,
});

const emit = defineEmits([
  'load-jobs',
  'load-timeline',
  'next-page',
  'prev-page',
  'edit-company',
  'delete-company',
  'create-job',
  'filter-by-job',
  'filter-by-company',
  'create-communication',
  'reset',
]);

/**
 * State für Expand/Collapse
 * expandedCompanies = Set von Company IDs die expanded sind
 * expandedJobs = Set von Job IDs die expanded sind
 * expandedAddresses = Set von Address IDs die expanded sind
 * expandedCommunications = Set von Communication IDs die expanded sind
 */
const expandedCompanies = ref(new Set());
const expandedJobs = ref(new Set());
const expandedAddresses = ref(new Set());
const expandedJobAddresses = ref(new Set());
const expandedCommunications = ref(new Set());

// Initial: alle Firmen + alle Jobs collapsed, Adressen/Communications collapsed
const initializeExpanded = (companies) => {
  expandedCompanies.value = new Set();
};

// Watchers um initial state zu setzen
import { watch } from 'vue';
watch(
  () => props.companies,
  (newCompanies) => {
    if (newCompanies?.length > 0) {
      initializeExpanded(newCompanies);
    }
  },
  { immediate: true }
);

/**
 * Toggle Methods
 */
const toggleCompany = (companyId) => {
  if (expandedCompanies.value.has(companyId)) {
    expandedCompanies.value.delete(companyId);
  } else {
    expandedCompanies.value.add(companyId);
  }
};

const toggleJob = (jobId) => {
  if (expandedJobs.value.has(jobId)) {
    expandedJobs.value.delete(jobId);
  } else {
    expandedJobs.value.add(jobId);
    // Wenn Job expandiert wird, lade Timeline falls noch nicht geladen
    const job = Object.values(props.jobsMap || {})
      .flat()
      .find((j) => j.id === jobId);
    if (job && !props.timelinesMap?.[jobId]) {
      emit('load-timeline', jobId);
    }
  }
};

const toggleAddress = (addressId) => {
  if (expandedAddresses.value.has(addressId)) {
    expandedAddresses.value.delete(addressId);
  } else {
    expandedAddresses.value.add(addressId);
  }
};

const toggleJobAddress = async (jobId) => {
  if (expandedJobAddresses.value.has(jobId)) {
    expandedJobAddresses.value.delete(jobId);
  } else {
    expandedJobAddresses.value.add(jobId);
    // Wenn Job-Adresse expandiert wird, lade vollständige Adressdaten
    const job = Object.values(props.jobsMap || {})
      .flat()
      .find((j) => j.id === jobId);
    if (job) {
      await loadAddressForJob(job);
    }
  }
};

const toggleCommunication = (commId) => {
  if (expandedCommunications.value.has(commId)) {
    expandedCommunications.value.delete(commId);
  } else {
    expandedCommunications.value.add(commId);
  }
};

/**
 * Computed: ist Company expandiert?
 */
const isCompanyExpanded = (companyId) =>
  expandedCompanies.value.has(companyId);
const isJobExpanded = (jobId) => expandedJobs.value.has(jobId);
const isAddressExpanded = (addressId) =>
  expandedAddresses.value.has(addressId);
const isJobAddressExpanded = (jobId) =>
  expandedJobAddresses.value.has(jobId);
const isCommunicationExpanded = (commId) =>
  expandedCommunications.value.has(commId);

/**
 * Lade Jobs wenn Firma expandiert wird (lazy loading)
 */
const handleCompanyClick = (company) => {
  toggleCompany(company.id);
  // Lazy load Jobs falls noch nicht geladen
  if (!props.jobsMap?.[company.id]) {
    emit('load-jobs', company.id);
  }
};

/**
 * Helper: Hole Jobs für Firma
 */
const getJobsForCompany = (companyId) => {
  return props.jobsMap?.[companyId] || [];
};

/**
 * Helper: Hole Timeline für Job
 */
const getTimelineForJob = (jobId) => {
  return props.timelinesMap?.[jobId];
};

/**
 * Helper: ist Timeline gerade am Laden?
 */
const isTimelineLoading = (jobId) => {
  return props.loadingTimelineMap?.[jobId];
};
</script>

<template>
  <div class="hierarchical-tree">
    <!-- Firmen (Level 1) -->
    <div v-if="companies && companies.length > 0" class="companies-list">
      <div
        v-for="company in companies"
        :key="company.id"
        class="company-item"
      >
        <!-- COMPANY HEADER -->
        <div class="company-header" :class="{ expanded: isCompanyExpanded(company.id) }">
          <!-- LEFT: Toggle Button + Actions (nur Actions im expanded) -->
          <div class="company-header-left">
            <button
              class="toggle-btn"
              :aria-expanded="isCompanyExpanded(company.id)"
              @click="handleCompanyClick(company)"
              title="Expand/Collapse"
            >
              {{ isCompanyExpanded(company.id) ? '▼' : '▶' }}
            </button>

            <!-- Action Buttons (nur im expanded) -->
            <div v-if="isCompanyExpanded(company.id)" class="company-actions">
              <button class="btn btn-sm btn-outline-primary" title="Bearbeiten">
                ✏️
              </button>
              <button class="btn btn-sm btn-outline-danger" title="Löschen">
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
            <div v-if="isCompanyExpanded(company.id)" class="company-details">
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

          <!-- RIGHT: Badges (nur im collapsed-Zustand, untereinander) -->
          <div v-if="!isCompanyExpanded(company.id)" class="company-badges">
            <span class="badge bg-light text-dark">
              {{ company.addresses?.length || 0 }} 📍
            </span>
            <span class="badge bg-light text-dark">
              {{ company.jobCount || 0 }} 💼
            </span>
          </div>
        </div>

        <!-- ADRESSEN (zwischen Header und Content) -->
        <div v-if="isCompanyExpanded(company.id) && company.addresses && company.addresses.length > 0" class="addresses-list">
          <div v-for="address in company.addresses" :key="address.id" class="address-row">
            <!-- LEFT: Toggle Button + Actions (vertikal) -->
            <div class="address-row-left">
              <button
                class="toggle-btn"
                :aria-expanded="isAddressExpanded(address.id)"
                @click="toggleAddress(address.id)"
              >
                {{ isAddressExpanded(address.id) ? '▼' : '▶' }}
              </button>

              <!-- Address Actions (nur bei expanded) -->
              <div v-if="isAddressExpanded(address.id)" class="address-actions">
                <button class="btn btn-sm btn-outline-primary" title="Bearbeiten">✏️</button>
                <button class="btn btn-sm btn-outline-danger" title="Löschen">🗑️</button>
              </div>
            </div>

            <!-- MIDDLE: Address Summary (nur collapsed) -->
            <div v-if="!isAddressExpanded(address.id)" class="address-summary">
              📍 {{ address.city }}, {{ address.street }} {{ address.number }}
            </div>

            <!-- Details wenn Address expanded -->
            <div v-if="isAddressExpanded(address.id)" class="address-details-expanded">
              <div class="address-field">
                <strong>Straße:</strong> {{ address.street }} {{ address.number }}
              </div>
              <div class="address-field">
                <strong>PLZ/Stadt:</strong> {{ address.postcode }} {{ address.city }}
              </div>
              <div class="address-field">
                <strong>Land:</strong> {{ address.country }}
              </div>
              <div v-if="address.distance" class="address-field">
                <strong>Distanz:</strong> {{ address.distance }} km
              </div>
            </div>
          </div>
        </div>

        <!-- Create Address Button (immer sichtbar wenn Firma expandiert) -->
        <div v-if="isCompanyExpanded(company.id)" class="create-address-section">
          <button class="btn btn-sm btn-info">
            + Neue Adresse für {{ company.name }}
          </button>
        </div>

        <!-- COMPANY CONTENT (expandiert) -->
        <div v-if="isCompanyExpanded(company.id)" class="company-content">
          <div class="jobs-section">
            <div
              v-if="!getJobsForCompany(company.id).length"
              class="text-muted text-center py-2"
            >
              <em>Keine Jobs vorhanden</em>
            </div>

            <div
              v-for="job in getJobsForCompany(company.id)"
              :key="job.id"
              class="job-item"
            >
              <!-- JOB HEADER -->
              <div class="job-header" :class="{ expanded: isJobExpanded(job.id) }">
                <!-- LEFT: Toggle Button + Actions (vertikal) -->
                <div class="job-header-left">
                  <button
                    class="toggle-btn"
                    :aria-expanded="isJobExpanded(job.id)"
                    @click="toggleJob(job.id)"
                  >
                    {{ isJobExpanded(job.id) ? '▼' : '▶' }}
                  </button>

                  <!-- Action Buttons (vertikal angeordnet) - nur wenn expanded -->
                  <div v-if="isJobExpanded(job.id)" class="job-actions">
                    <button class="btn btn-sm btn-outline-primary" title="Bearbeiten">
                      ✏️
                    </button>
                    <button class="btn btn-sm btn-outline-danger" title="Löschen">
                      🗑️
                    </button>
                  </div>
                </div>

                <!-- MIDDLE: Job Info Header (Title, Features, Meta) -->
                <div class="job-header-center">
                  <!-- Zeile 1: Erste Zeile von Text (links) and Status (rechts in Klammern) -->
                  <div class="job-title-row">
                    <h5 class="job-title">{{ job.text?.split('\n')[0]?.substring(0, 50) || job.source }}</h5>
                    <span class="job-status">({{ job.status }})</span>
                  </div>

                  <!-- Zeile 2: Features -->
                  <h6 v-if="job.features" class="job-features">{{ job.features }}</h6>

                  <!-- Zeile 3: Meta (Datum, Link, Kommunikationen) + Badge -->
                  <p class="job-meta">
                    <span class="job-meta-source">Quelle: {{ job.source }}</span>
                    <span v-if="job.found" class="small">
                      📅 {{ new Date(job.found).toLocaleDateString('de-DE') }}
                    </span>
                    <span v-if="job.url" class="small ms-2">
                      <a :href="job.url" target="_blank">Link</a>
                    </span>
                    <span v-if="job.communicationCount" class="job-meta-badge">
                      <span class="badge bg-light text-dark">
                        {{ job.communicationCount }} 💬
                      </span>
                    </span>
                  </p>
                </div>
              </div>

              <!-- JOB ADDRESS ROW (analog zu address-row) -->
              <div v-if="job.city || job.street || job.postcode" class="job-address-row">
                <!-- LEFT: Toggle Button + Actions (vertikal) -->
                <div class="job-address-row-left">
                  <button
                    class="toggle-btn"
                    :aria-expanded="isJobAddressExpanded(job.id)"
                    @click="toggleJobAddress(job.id)"
                  >
                    {{ isJobAddressExpanded(job.id) ? '▼' : '▶' }}
                  </button>

                  <!-- Job Address Actions (nur bei expanded) -->
                  <div v-if="isJobAddressExpanded(job.id)" class="address-actions">
                    <button class="btn btn-sm btn-outline-primary" title="Bearbeiten">✏️</button>
                    <button class="btn btn-sm btn-outline-danger" title="Löschen">🗑️</button>
                  </div>
                </div>

                <!-- MIDDLE: Address Summary (nur collapsed) -->
                <div v-if="!isJobAddressExpanded(job.id)" class="job-address-summary">
                  📍 {{ job.postcode }} {{ job.city }}<span v-if="job.street">, {{ job.street }} {{ job.number }}</span>
                </div>

                <!-- Details wenn Address expanded -->
                <div v-if="isJobAddressExpanded(job.id)" class="job-address-expanded">
                  <div class="address-field">
                    <strong>Straße:</strong> {{ job.street }} {{ job.number }}
                  </div>
                  <div class="address-field">
                    <strong>PLZ/Stadt:</strong> {{ job.postcode }} {{ job.city }}
                  </div>
                  <div class="address-field">
                    <strong>Land:</strong> {{ job.country }}
                  </div>
                  <div v-if="job.distance" class="address-field">
                    <strong>Distanz:</strong> {{ job.distance }} km
                  </div>
                </div>
              </div>

              <!-- JOB CONTENT (expandiert - wächst inline) -->
              <!-- Job-Details wachsen direkt in job-item, nicht separate Box -->
              <div v-if="isJobExpanded(job.id)" class="job-details-collapsed-container">
                <!-- Job Expanded Details mit Text zusammen -->
                <div class="job-expanded-section">
                  <!-- Job Details Text -->
                  <div v-if="job.text" class="job-text">
                    <strong>Beschreibung:</strong> {{ job.text }}
                  </div>

                  <!-- Features -->
                  <div v-if="job.features" class="job-text">
                    <strong>Features:</strong> {{ job.features }}
                  </div>

                  <!-- Job Details - Kontakt & Extras -->
                  <div class="job-details-grid">
                    <!-- Kontakt Informationen -->
                    <div v-if="job.mail || job.tel" class="job-details-section">
                      <h6 class="section-title">📧 Kontakt</h6>
                      <div v-if="job.mail || job.mailPerson" class="detail-line">
                        <span class="label">E-Mail:</span>
                        <span v-if="job.mail" class="value"><a :href="`mailto:${job.mail}`">{{ job.mail }}</a></span>
                        <span v-if="job.mailPerson" class="value">{{ job.mailPerson }}</span>
                      </div>
                      <div v-if="job.tel || job.telPerson" class="detail-line">
                        <span class="label">Telefon:</span>
                        <span v-if="job.tel" class="value"><a :href="`tel:${job.tel}`">{{ job.tel }}</a></span>
                        <span v-if="job.telPerson" class="value">{{ job.telPerson }}</span>
                      </div>
                    </div>

                    <!-- Arbeitsplatz Details -->
                    <div v-if="job.teilzeit || job.gleitzeit || job.homeoffice" class="job-details-section">
                      <h6 class="section-title">⚙️ Arbeitsplatz</h6>
                      <div v-if="job.teilzeit" class="detail-line">
                        <span class="label">Teilzeit:</span>
                        <span class="value">{{ job.teilzeit }}</span>
                      </div>
                      <div v-if="job.gleitzeit" class="detail-line">
                        <span class="label">Gleitzeit:</span>
                        <span class="value">{{ job.gleitzeit }}</span>
                      </div>
                      <div v-if="job.homeoffice" class="detail-line">
                        <span class="label">Home Office:</span>
                        <span class="value">{{ job.homeoffice }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Timeline (Level 3) - kompakt ohne Überschrift -->
                <div v-if="getTimelineForJob(job.id)" class="timeline-container">
                  <!-- Loading State -->
                  <div v-if="isTimelineLoading(job.id)" class="text-center py-2">
                    <span class="spinner-border spinner-border-sm"></span>
                    Lädt...
                  </div>

                  <!-- Timeline Items -->
                  <div v-else class="timeline-items">
                    <TimelineItem
                      v-for="(comm, index) in getTimelineForJob(job.id).content"
                      :key="comm.id ? `${job.id}-${comm.id}` : `${job.id}-temp-${index}`"
                      :communication="comm"
                      :is-expanded="isCommunicationExpanded(comm.id)"
                      @toggle="() => toggleCommunication(comm.id)"
                      @edit="emit('edit-communication', comm)"
                      @delete="emit('delete-communication', comm.id)"
                    />
                  </div>

                  <!-- Pagination + Action Buttons (in einer Zeile) -->
                  <div class="timeline-controls">
                    <!-- Create Communication Button (ganz links) -->
                    <button class="btn btn-sm btn-success">
                      + Kommunikation
                    </button>

                    <!-- Pagination Info (nur wenn Timeline nicht leer) -->
                    <div v-if="getTimelineForJob(job.id)?.content?.length > 0" class="pagination-info">
                      <small class="text-muted">
                        Seite {{ (getTimelineForJob(job.id).currentPage || 0) + 1 }} /
                        {{ getTimelineForJob(job.id).totalPages }}
                      </small>
                    </div>

                    <!-- Pagination Buttons Container -->
                    <span class="timeline-buttons">
                      <button
                        v-if="(getTimelineForJob(job.id).currentPage || 0) > 0"
                        class="btn btn-sm btn-outline-secondary"
                        @click="emit('prev-page', job.id)"
                      >
                        ← Vorherige
                      </button>
                      <button
                        v-if="!getTimelineForJob(job.id).last"
                        class="btn btn-sm btn-outline-secondary"
                        @click="emit('next-page', job.id)"
                      >
                        Nächste →
                      </button>
                    </span>

                    <!-- Filter Buttons Container -->
                    <div class="timeline-filters">
                      <button
                        class="btn btn-sm btn-info"
                        @click="emit('filter-by-company')"
                        title="Filter auf diese Firma setzen"
                      >
                        🔍 Firma
                      </button>
                      <button
                        class="btn btn-sm btn-info"
                        @click="emit('filter-by-job')"
                        title="Filter auf diesen Job setzen"
                      >
                        🔍 Job
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Create new Job Button -->
            <div class="create-job-section">
              <button class="btn btn-sm btn-success">
                + Neuer Job für {{ company.name }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Create new Company Button -->
      <div class="create-company-section">
        <button class="btn btn-primary">
          + Neue Firma
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state text-center py-5">
      <p class="text-muted">🏢 Noch keine Firmen vorhanden</p>
      <button class="btn btn-primary">+ Erste Firma erstellen</button>
    </div>
  </div>
</template>

<style scoped>
/**
 * Hierarchical Tree Styling
 */

.hierarchical-tree {
  padding: 1rem 0;
}

/**
 * ============================================
 * LEVEL 1: COMPANIES
 * ============================================
 */

.companies-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.company-item {
  margin-left: 0; /* Level 1: no indent */
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.2s;
}

.company-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

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
 * LEFT: Toggle + Actions (vertikal angeordnet mit space-between)
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

.company-content {
  padding: 0;
  background: linear-gradient(135deg, #667eea08 0%, #764ba208 100%);
}

/**
 * ============================================
 * ADRESSEN (integrierte Zeilen)
 * ============================================
 */

.addresses-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  gap: 0.5rem;
  margin-bottom: -0.5rem;
}

.address-row {
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #ffe6e6;
  border-left: none;
  border-radius: 4px;
  transition: background 0.2s;
  flex-wrap: wrap;
}

.address-row:hover {
  background: #ffcccc;
}

/**
 * LEFT: Toggle Button + Actions (vertikal)
 */
.address-row-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.25rem;
  flex-shrink: 0;
}

.address-summary {
  flex: 1;
  font-size: 0.9rem;
  color: #333;
}

.address-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.address-actions button {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem !important;
}

/* Details wenn Address expanded */
.address-details-expanded {
  padding: 0.5rem 0 0 0;
  background: transparent;
  border: none;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  flex: 1;
}

.address-field {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.address-field strong {
  min-width: 100px;
  flex-shrink: 0;
  color: #667eea;
}

/**
 * ============================================
 * LEVEL 2: JOB ADDRESS ROW (analog zu LEVEL 1: ADDRESS ROW)
 * ============================================
 */

.job-address-row {
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #ffe6e6;
  border-left: 4px solid #667eea;
  border-radius: 4px;
  margin-top: 0;
  margin-left: 0;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.job-address-row:hover {
  background: #ffcccc;
}

.job-address-row-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.25rem;
  flex-shrink: 0;
}

.job-address-row .toggle-btn {
  font-size: 0.9rem;
}

.job-address-summary {
  flex: 1;
  color: #666;
  padding: 0.25rem 0;
}

.job-address-expanded {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  padding: 0;
}

.address-field {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.address-field strong {
  min-width: 80px;
  flex-shrink: 0;
  color: #667eea;
}

/**
 * ============================================
 * LEVEL 2: JOBS
 * ============================================
 */

.jobs-section {
  margin-left: 20px; /* Level 2: indent */
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.job-item {
  background: white;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.job-header {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-left: 4px solid #667eea;
  cursor: pointer;
  transition: background 0.2s;
}

.job-header:hover {
  background: linear-gradient(135deg, #667eea25 0%, #764ba225 100%);
}

/**
 * LEFT: Toggle + Actions (vertikal angeordnet mit space-between)
 */
.job-header-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

/**
 * Job Actions (vertikal angeordnet)
 */
.job-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.job-actions button {
  font-size: 0.85rem;
  padding: 0.3rem 0.4rem !important;
  min-width: 32px;
}

/**
 * Job Header Center: Title-Row, Features, Meta
 */
.job-header-center {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.job-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* Zeile 1: Quelle (links) + Status (rechts) */
.job-title-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.job-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
  color: #333;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.job-status {
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
}

/* Zeile 2: Features */
.job-features {
  font-size: 0.85rem;
  font-weight: 500;
  margin: 0;
  color: #555;
  text-align: left;
}

/* Zeile 3: Meta */
.job-meta {
  font-size: 0.8rem;
  color: #666;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.job-meta-source {
  font-weight: 500;
}

.job-meta a {
  color: #667eea;
  text-decoration: none;
}

.job-meta a:hover {
  text-decoration: underline;
}

.job-meta-badge {
  margin-left: auto;
}

.job-meta-badge .badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

/* Zeile 4+: Expandierte Details */
.job-expanded-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.job-work-conditions {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: #555;
}

.job-condition {
  padding-left: 0;
}

.job-person {
  font-size: 0.9rem;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.job-person strong {
  color: #333;
  white-space: nowrap;
}

.job-person a {
  color: #667eea;
  text-decoration: none;
}

.job-person a:hover {
  text-decoration: underline;
}

/* Adresse des Jobs (expanded) */
.job-address-expanded {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: #555;
}

.job-address-expanded strong {
  color: #333;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.address-line {
  padding-left: 1rem;
}

.job-meta a {
  color: #667eea;
  text-decoration: none;
}

/**
 * RIGHT section: Job Address (collapsed & expanded)
 */
.job-address-section {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-width: 150px;
}

.job-address-summary {
  font-size: 0.8rem;
  color: #666;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  padding: 0 0.5rem;
}

.job-meta-badge {
  display: flex;
  align-items: center;
  margin-left: 0.5rem;
  flex-shrink: 0;
}

.job-meta-badge .badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

/* Job Details - wächst inline in job-item */
.job-details-collapsed-container {
  padding: 1rem;
  background: transparent;
  border-top: none;
  border-left: 4px solid #667eea;
  animation: slideDown 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
}

.job-text {
  padding: 0.75rem;
  background: #f8f9fa;
  border: 1px solid #bbb;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
}

.job-expanded-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Job Details Grid für Kontakt/Extras */
.job-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.job-details-section {
  padding: 0.75rem;
  background: #f8f9fa;
  border: 1px solid #bbb;
  border-radius: 4px;
  font-size: 0.85rem;
}

.job-details-section .section-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 0.5rem;
  margin-top: 0;
}

.job-details-section .detail-line {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.3125rem;
  flex-wrap: wrap;
}

.job-details-section .detail-line:last-child {
  margin-bottom: 0;
}

.job-details-section .label {
  font-weight: 600;
  color: #333;
  font-size: 0.8rem;
}

.job-details-section .value {
  color: #666;
  word-break: break-word;
}

.job-details-section a {
  color: #667eea;
  text-decoration: none;
}

.job-details-section a:hover {
  text-decoration: underline;
}

/**
 * ============================================
 * LEVEL 3: TIMELINE/COMMUNICATIONS
 * ============================================
 */

.timeline-section {
  margin-left: 20px; /* Level 3: indent */
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border-left: 4px solid #11998e;
}

.timeline-container {
  margin-left: 20px; /* Level 3: indent */
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #333;
}

.timeline-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.timeline-pagination {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin: 1rem 0;
  padding: 0.75rem;
  background: #f0f0f0;
  border-radius: 4px;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
  border-top: 1px solid #e9ecef;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.timeline-filters {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.pagination-info small {
  font-size: 0.8rem;
}

.timeline-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
  flex-basis: auto;
  min-width: fit-content;
}

.timeline-controls .btn {
  font-size: 0.85rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.timeline-controls .btn-outline-secondary {
  padding: 0.375rem 0.75rem !important;
}

.timeline-controls .btn-success {
  padding: 0.375rem 0.75rem !important;
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  border: none;
  color: white;
}

.timeline-controls .btn-success:hover {
  background: linear-gradient(135deg, #0f8476 0%, #2dcd6f 100%) !important;
}

.timeline-controls .btn-info {
  padding: 0.375rem 0.75rem !important;
  background: #17a2b8;
  border: none;
  color: white;
}

.timeline-controls .btn-info:hover {
  background: #138496 !important;
}

.timeline-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.timeline-actions button {
  font-size: 0.875rem;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/**
 * ============================================
 * BUTTONS
 * ============================================
 */

.create-job-section {
  margin-left: 20px;
  margin-top: 0.75rem;
  padding: 0.75rem;
  text-align: center;
  background: #f0f8ff;
  border-radius: 4px;
  border: 1px dashed #667eea;
}

.create-address-section {
  padding: 0.75rem 1rem;
  text-align: center;
  background: #e3f2fd;
  border-radius: 4px;
  border: 1px dashed #2196f3;
}

.create-company-section {
  margin-top: 2rem;
  padding: 1rem;
  text-align: center;
  background: #f0f8ff;
  border-radius: 8px;
  border: 2px dashed #667eea;
}

.empty-state {
  background: white;
  border-radius: 8px;
  padding: 3rem 1rem;
}

.btn-success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  border: none;
}

.btn-success:hover {
  background: linear-gradient(135deg, #0f8476 0%, #2dcd6f 100%);
  border: none;
}

.btn-info {
  background: #17a2b8;
  border: none;
}

.btn-info:hover {
  background: #138496;
  border: none;
}

/**
 * Responsive
 */
@media (max-width: 1024px) {
  .job-header {
    gap: 0.5rem;
  }

  .job-address-inline {
    flex-basis: 100%;
    order: 3;
    border-left: none;
    padding: 0.5rem 0 0 0;
    margin-top: 0.25rem;
  }
}

@media (max-width: 768px) {
  .hierarchical-tree {
    padding: 0.5rem;
  }

  .companies-list {
    gap: 0.75rem;
  }

  .company-header {
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .company-name {
    font-size: 1rem;
  }

  .company-actions {
    width: 100%;
    margin-left: 0;
    justify-content: flex-end;
  }

  .company-content {
    padding: 0.75rem;
  }

  .addresses-list {
    margin-bottom: 0.75rem;
    gap: 0.25rem;
  }

  .address-row {
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
  }

  .address-summary {
    font-size: 0.85rem;
  }

  .job-header {
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .job-title {
    font-size: 0.9rem;
  }

  .job-address-inline {
    order: 3;
    flex-basis: 100%;
    border-left: none;
    padding: 0.5rem 0 0 0;
    margin-top: 0.25rem;
  }

  .job-actions {
    width: 100%;
    margin-left: 0;
  }

  .job-details {
    padding: 0.75rem;
  }

  .timeline-container {
    margin-left: 16px;
  }

  .timeline-controls {
    gap: 0.5rem;
  }

  .pagination-info {
    margin-right: 0;
    justify-content: center;
  }

  .create-job-section {
    margin-left: 16px;
  }

  .jobs-section {
    margin-left: 16px;
    gap: 0.75rem;
  }
}

@media (max-width: 480px) {
  .company-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .company-actions {
    order: 4;
    width: 100%;
    margin-left: 0 !important;
  }

  .job-address-inline {
    padding: 0.5rem 0 0 0;
  }

  .job-actions {
    order: 4;
    width: 100%;
  }

  .company-name {
    font-size: 0.95rem;
  }

  .job-title {
    font-size: 0.85rem;
  }
}
</style>
