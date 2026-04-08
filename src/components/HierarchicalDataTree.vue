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

import { ref, computed, nextTick } from 'vue';
import TimelineItem from './TimelineItem.vue';
import AddressItem from './AddressItem.vue';
import JobItem from './JobItem.vue';
import { addressApi, jobApi } from '@/services/api.js';
import { loadAddressForJob } from '@/composables/useData.js';

const props = defineProps({
  companies: Array,
  jobsMap: Object, // { [companyId]: [jobs...] }
  allJobsForFilter: Array, // ALLE Jobs vom Backend für Filter-Matching
  timelinesMap: Object, // { [jobId]: timeline_data }
  loadingJobsMap: Object,
  loadingTimelineMap: Object,
  filters: {
    type: Object,
    default: () => ({}),
  },
  communicationStatuses: {
    type: Array,
    default: () => [],
  },
  jobStatuses: {
    type: Array,
    default: () => [],
  },
});

console.log('[Filter Debug] HierarchicalDataTree Props empfangen:', { filters: props.filters });

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
const expandedCommunications = ref(new Set());

/**
 * State für Create-Mode einer neuen Kommunikation
 */
const creatingCommunicationForJobId = ref(null);
const selectedCommunicationType = ref(null);
const showCommunicationTypeMenu = ref(false);
const createCommButtonRefs = ref({});

/**
 * State für Create-Mode einer neuen Adresse (bei Company)
 */
const creatingAddressForCompanyId = ref(null);

/**
 * State für Create-Mode einer neuen Adresse (bei Job)
 */
const creatingAddressForJobId = ref(null);

/**
 * State für Address-Dropdown (zeige/verstecke Liste von Firmenadressen)
 * Schlüssel: jobId, Value: true/false
 */
const addressDropdownOpen = ref({});

/**
 * State für Create-Mode eines neuen Jobs (bei Company)
 */
const creatingJobForCompanyId = ref(null);

/**
 * Verfügbare Kommunikationstypen
 */
const communicationTypes = [
  { type: 'PHONE', icon: '📞', label: 'Telefon' },
  { type: 'MAIL', icon: '✉️', label: 'E-Mail' },
  { type: 'WEBFORM', icon: '🌐', label: 'Web-Formular' },
  { type: 'TALK', icon: '👥', label: 'Gespräch' },
  { type: 'TRIAL', icon: '🧪', label: 'Test' },
  { type: 'INTERVIEW', icon: '👔', label: 'Interview' },
];

// Initial: alle Firmen + alle Jobs collapsed, Adressen/Communications collapsed
const initializeExpanded = (companies) => {
  expandedCompanies.value = new Set();
};

/**
 * ============================================
 * Filter-Hilfsfunktionen für Job & Status Filter
 * ============================================
 */

/**
 * Prüfe ob Firma passende Jobs zum aktuellen Filter hat
 * 
 * Priorität:
 * 1. Nutze lokal gecachte Jobs (wenn Firma bereits aufgeklappt war)
 * 2. Fallback zu allJobsForFilter vom Backend (wenn Firma noch nicht aufgeklappt war)
 * 
 * WICHTIG: Diese Funktion wird nur aufgerufen wenn ein Filter aktiv ist!
 */
const hasMatchingJobs = (company) => {
  // Option 1: Jobs aus lokalem Cache (wenn Firma bereits aufgeklappt war)
  const cachedJobs = props.jobsMap?.[company.id] || [];
  
  // Option 2: Jobs aus allJobsForFilter (für alle Jobs auch von nicht geöffneten Firmen)
  const backendJobs = props.allJobsForFilter?.filter(j => j.companyId === company.id) || [];
  
  // Nutze gecachte Jobs wenn vorhanden, sonst Backend-Jobs
  const jobs = cachedJobs.length > 0 ? cachedJobs : backendJobs;
  
  if (jobs.length === 0) {
    console.log(`[Filter Debug] Firma ${company.id} (${company.name}) - keine lokalen oder Backend-Jobs gefunden`);
    return false;
  }
  
  // Job-Filter aktiv → hat diese Firma den gefilterten Job
  if (props.filters?.jobId) {
    const hasMatch = jobs.some(j => j.id === props.filters.jobId);
    console.log(`[Filter Debug] Firma ${company.id} (${company.name}) - Job-Filter ${props.filters.jobId}: ${hasMatch}`, { jobs: jobs.map(j => j.id), source: cachedJobs.length > 0 ? 'cache' : 'backend' });
    return hasMatch;
  }
  
  // Status-Filter aktiv → hat diese Firma einen Job mit diesem Status
  if (props.filters?.jobStatus) {
    const hasMatch = jobs.some(j => j.status === props.filters.jobStatus);
    console.log(`[Filter Debug] Firma ${company.id} (${company.name}) - Status-Filter ${props.filters.jobStatus}: ${hasMatch}`, { jobs: jobs.map(j => ({ id: j.id, status: j.status })), source: cachedJobs.length > 0 ? 'cache' : 'backend' });
    return hasMatch;
  }
  
  // Sollte nie vorkommen wenn der Caller korrekt überprüft ob Filter aktiv sind
  return false;
};

/**
 * Gib nur die sichtbaren Jobs einer Firma zurück (gefiltert)
 * 
 * Priority:
 * 1. Nutze lokal gecachte Jobs (wenn Firma bereits aufgeklappt war)
 * 2. Fallback zu allJobsForFilter vom Backend (wenn Firma noch nicht aufgeklappt war)
 */
const getVisibleJobsForCompany = (companyId) => {
  // Option 1: Jobs aus lokalem Cache (wenn Firma bereits aufgeklappt war)
  const cachedJobs = props.jobsMap?.[companyId] || [];
  
  // Option 2: Jobs aus allJobsForFilter (für alle Jobs auch von nicht geöffneten Firmen)
  const backendJobs = props.allJobsForFilter?.filter(j => j.companyId === companyId) || [];
  
  // Nutze gecachte Jobs wenn vorhanden, sonst Backend-Jobs
  const allJobs = cachedJobs.length > 0 ? cachedJobs : backendJobs;
  
  // Kein Filter aktiv → alle Jobs
  if (!props.filters?.jobId && !props.filters?.jobStatus) {
    console.log(`[Filter Debug] getVisibleJobsForCompany(${companyId}) kein Filter: ${allJobs.length} Jobs (source: ${cachedJobs.length > 0 ? 'cache' : 'backend'})`);
    return allJobs;
  }
  
  // Job-Filter aktiv → nur dieser Job
  if (props.filters?.jobId) {
    const visible = allJobs.filter(j => j.id === props.filters.jobId);
    console.log(`[Filter Debug] getVisibleJobsForCompany(${companyId}) Job-Filter ${props.filters.jobId}: ${visible.length} sichtbare Jobs von ${allJobs.length} (source: ${cachedJobs.length > 0 ? 'cache' : 'backend'})`, { visible: visible.map(j => j.id), all: allJobs.map(j => j.id) });
    return visible;
  }
  
  // Status-Filter aktiv → nur Jobs mit diesem Status
  if (props.filters?.jobStatus) {
    const visible = allJobs.filter(j => j.status === props.filters.jobStatus);
    console.log(`[Filter Debug] getVisibleJobsForCompany(${companyId}) Status-Filter ${props.filters.jobStatus}: ${visible.length} sichtbare Jobs von ${allJobs.length} (source: ${cachedJobs.length > 0 ? 'cache' : 'backend'})`, { visible: visible.map(j => ({ id: j.id, status: j.status })), all: allJobs.map(j => ({ id: j.id, status: j.status })) });
    return visible;
  }
  
  return allJobs;
};

/**
 * Finde die Job-Element zum Scrollen
 * 
 * Priority:
 * 1. Suche in lokal gecachten Jobs
 * 2. Fallback zu allJobsForFilter vom Backend
 */
const getJobElementForScroll = () => {
  if (!props.filters?.jobId) return null;
  
  // Finde den Job in den Daten
  for (const company of props.companies || []) {
    // Priority 1: Gecachte Jobs
    const cachedJobs = props.jobsMap?.[company.id] || [];
    let job = cachedJobs.find(j => j.id === props.filters.jobId);
    
    // Priority 2: Backend Jobs
    if (!job) {
      const backendJobs = props.allJobsForFilter?.filter(j => j.companyId === company.id) || [];
      job = backendJobs.find(j => j.id === props.filters.jobId);
    }
    
    if (job) {
      // Versuche Element zu finden
      const element = document.querySelector(`[data-job-id="${job.id}"]`);
      return element;
    }
  }
  return null;
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
 * ============================================
 * Watcher für Job/Status Filter
 * Auto-Expand Firmen mit matchenden Jobs
 * Auto-Collapse Firmen ohne matchende Jobs
 * Auto-Scroll zum gefilterten Job
 * ============================================
 */
watch(
  [() => props.filters?.jobId, () => props.filters?.jobStatus],
  ([newJobId, newStatus]) => {
    console.log('[Filter Debug] Watcher getriggert! Filter geändert:', { jobId: newJobId, status: newStatus });
    
    if (!props.companies) {
      console.warn('[Filter Debug] ⚠️ props.companies nicht verfügbar!');
      return;
    }
    
    // WICHTIG: Nur expandieren wenn tatsächlich ein Filter aktiv ist
    // Wenn beide null → alle collapsed
    const filterActive = newJobId !== null || newStatus !== null;
    console.log('[Filter Debug] Filter aktiv?', filterActive, { jobId: newJobId, status: newStatus });
    
    if (!filterActive) {
      console.log('[Filter Debug] ℹ️ Kein Filter aktiv → alle Companies werden zugeklappt');
      expandedCompanies.value = new Set();
      return;
    }
    
    console.log('[Filter Debug] Companies vorhanden:', props.companies.map(c => ({ id: c.id, name: c.name })));
    
    // Berechne welche Firmen expanded sein sollen
    const newExpandedSet = new Set();
    
    for (const company of props.companies) {
      if (hasMatchingJobs(company)) {
        newExpandedSet.add(company.id);
        console.log(`[Filter Debug] ✅ Firma ${company.id} ${company.name} wird EXPANDIERT`);
      } else {
        console.log(`[Filter Debug] ❌ Firma ${company.id} ${company.name} wird ZUGEKLAPPT`);
      }
    }
    
    console.log('[Filter Debug] Neue expandedCompanies:', Array.from(newExpandedSet));
    expandedCompanies.value = newExpandedSet;
    
    // Auto-Scroll zum gefilterten Job falls vorhanden
    // Wichtig: nextTick statt setTimeout um sicherzustellen, dass DOM updated ist
    nextTick(() => {
      const jobElement = getJobElementForScroll();
      if (jobElement) {
        console.log(`[Filter Debug] ✅ Job-Element gefunden, scroll zu:`, jobElement);
        jobElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        console.log('[Filter Debug] ⚠️ Kein Job-Element für Scroll gefunden');
      }
    });
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

const toggleCommunication = (commId) => {
  if (expandedCommunications.value.has(commId)) {
    expandedCommunications.value.delete(commId);
  } else {
    expandedCommunications.value.add(commId);
  }
};

/**
 * Update communication after edit
 */
const updateCommunication = (commId, updatedComm) => {
  // ✅ Nutze props.companies nicht companies.value
  if (!props.companies) {
    console.warn('⚠️ Props.companies sind nicht verfügbar');
    return;
  }
  
  // Finde Job mit dieser Kommunikation
  for (const company of props.companies) {
    // Prüfe ob Jobs vorhanden sind
    const jobs = props.jobsMap?.[company.id] || [];
    for (const job of jobs) {
      const timeline = getTimelineForJob(job.id);
      if (timeline && timeline.content) {
        const commIndex = timeline.content.findIndex(c => c.id === commId);
        if (commIndex !== -1) {
          // Update Kommunikation
          timeline.content[commIndex] = updatedComm;
          console.log('✅ Kommunikation aktualisiert:', commId, updatedComm);
          return;
        }
      }
    }
  }
};

/**
 * Create Communication Handlers
 */
const startCreateCommunication = (jobId) => {
  creatingCommunicationForJobId.value = jobId;
  selectedCommunicationType.value = null;
  showCommunicationTypeMenu.value = true;
};

const selectCommunicationType = (type) => {
  console.log('✅ Typ selected:', type);
  selectedCommunicationType.value = type;
  showCommunicationTypeMenu.value = false;
};

const cancelCreateCommunication = () => {
  creatingCommunicationForJobId.value = null;
  selectedCommunicationType.value = null;
  showCommunicationTypeMenu.value = false;
};

/**
 * Address Create Handlers
 */
const startCreateAddress = (companyId) => {
  creatingAddressForCompanyId.value = companyId;
};

const cancelCreateAddress = () => {
  creatingAddressForCompanyId.value = null;
};

const startCreateJobAddress = (jobId) => {
  creatingAddressForJobId.value = jobId;
};

const cancelCreateJobAddress = () => {
  creatingAddressForJobId.value = null;
};

/**
 * Weise eine bestehende Address einem Job zu
 * 
 * Logik:
 * 1. PATCH /api/jobs/{jobId}/addressId { addressId: selectedAddress.id }
 * 2. Update Job-Felder mit Address-Daten
 * 3. Schließe Dropdown
 */
const assignAddressToJob = async (job, address) => {
  if (!address || !address.id) {
    console.warn('⚠️ Keine Address ausgewählt');
    return;
  }
  
  try {
    console.log(`⚙️ PATCH Job ${job.id}: addressId → ${address.id}`);
    
    // PATCH den Job um addressId zu setzen
    await jobApi.updateAddressId(job.id, address.id);
    
    // Update Job-Objekt mit Address-Daten
    job.addressId = address.id;
    job.street = address.street || null;
    job.number = address.number || null;
    job.postcode = address.postcode || null;
    job.city = address.city || null;
    job.country = address.country || null;
    job.traveltime = address.traveltime || null;
    job.distance = address.distance || null;
    job.headquarter = address.headquarter ?? false;
    
    console.log(`✅ Job ${job.id} erhielt Address ${address.id}`);
    
    // Schließe Dropdown
    addressDropdownOpen.value[job.id] = false;
  } catch (err) {
    console.error('❌ Fehler beim Zuweisen der Adresse:', err);
    alert('Fehler beim Zuweisen der Adresse: ' + (err.response?.data?.message || err.message));
  }
};

/**
 * Toggle Address-Dropdown für einen Job
 */
const toggleAddressDropdown = (jobId) => {
  addressDropdownOpen.value[jobId] = !addressDropdownOpen.value[jobId];
};

/**
 * Helper: Formatiere Address zur Anzeige in Dropdown
 * Format: "Straße, Nummer, PLZ Stadt"
 */
const formatAddressForDropdown = (address) => {
  const parts = [];
  if (address.street) parts.push(address.street);
  if (address.number) parts[0] = `${parts[0]}, ${address.number}`;
  if (address.postcode || address.city) {
    parts.push(`${address.postcode || ''} ${address.city || ''}`.trim());
  }
  return parts.join(' ') || 'Adresse ohne Daten';
};

/**
 * Address Update Handler (for Companies)
 */
const handleAddressUpdate = (company, updatedAddress) => {
  // Aktualisiere die Adresse in der Company-Liste
  if (company.addresses) {
    const index = company.addresses.findIndex(a => a.id === updatedAddress.id);
    if (index !== -1) {
      // Ersetze die alte Adresse mit der neuen
      company.addresses.splice(index, 1, updatedAddress);
      console.log('✅ Adresse aktualisiert:', updatedAddress);
    }
  }
};

/**
 * Job Address Update Handler
 * When a job address is created or updated
 * 
 * Logik bei CREATE:
 * - Backend liefert Address mit companyId zurück
 * - Frontend fügt diese Address zu company.addresses hinzu (collapsed)
 * - Spart Reload und Datentrafik
 */
const handleJobAddressUpdate = (job, updatedAddress) => {
  if (!updatedAddress) return;
  
  // 🚨 WICHTIG: Speichernen ob wir in CREATE-Mode waren BEVOR wir cancelCreate aufrufen!
  const wasCreating = creatingAddressForJobId.value === job.id;
  
  // 1. Wenn Create-Mode war: Close the form
  if (wasCreating) {
    cancelCreateJobAddress();
  }
  
  // 2. Update Job mit neue addressId
  if (updatedAddress.id) {
    job.addressId = updatedAddress.id;
  }
  
  // 3. Local display refresh (alte Felder für Backward-Compat)
  job.street = updatedAddress.street || null;
  job.number = updatedAddress.number || null;
  job.postcode = updatedAddress.postcode || null;
  job.city = updatedAddress.city || null;
  job.country = updatedAddress.country || null;
  job.traveltime = updatedAddress.traveltime || null;
  job.distance = updatedAddress.distance || null;
  job.headquarter = updatedAddress.headquarter ?? false;
  
  // 4️⃣ NEU: Bei CREATE-Mode die neue Address zu Company-Adressen hinzufügen
  // Das Backend liefert die companyId in der Address zurück (nur beim CREATE)
  if (updatedAddress.companyId && wasCreating) {
    console.log('🎯 Neue Address für Company erstellt, füge zu company.addresses hinzu');
    
    // Finde die Company mit dieser companyId
    const company = props.companies?.find(c => c.id === updatedAddress.companyId);
    if (company) {
      // Stelle sicher dass company.addresses existiert
      if (!company.addresses) {
        company.addresses = [];
      }
      
      // Füge die neue Address hinzu (falls nicht bereits vorhanden)
      const alreadyExists = company.addresses.some(a => a.id === updatedAddress.id);
      if (!alreadyExists) {
        console.log(`✅ Address ${updatedAddress.id} zu Company ${company.id} hinzugefügt`);
        company.addresses.push(updatedAddress);
      }
    } else {
      console.warn(`⚠️ Company mit ID ${updatedAddress.companyId} nicht gefunden`);
    }
  }
  
  console.log('✅ Job-Adresse aktualisiert:', job);
};

/**
 * Address Delete Handler (Companies)
 */
/**
 * Address Delete Handler (Company-Adressen)
 * Muss betroffene Jobs finden & ihre FK auf null setzen BEVOR Adresse gelöscht wird
 * 
 * Logik:
 * 1. Durchsuche alle Jobs der Firma nach addressId === zu_löschende_id
 * 2. Für jeden betroffenen Job: PATCH /api/jobs/{id}/addressId { addressId: null }
 * 3. Update Job-Objekte im jobsMap (addressId nullen + Adressfelder)
 * 4. DELETE /api/addresses/{id}
 * 5. Entferne Adresse aus company.addresses
 */
const handleAddressDelete = async (company, addressId) => {
  try {
    console.log(`🔍 Suche betroffene Jobs für addressId=${addressId} in companyId=${company.id}`);
    
    // 1️⃣ Finde alle Jobs dieser Firma die diese addressId haben
    const affectedJobs = [];
    if (props.jobsMap && props.jobsMap[company.id]) {
      affectedJobs.push(
        ...props.jobsMap[company.id].filter(job => job.addressId === addressId)
      );
    }
    
    console.log(`📋 Gefundene Jobs mit addressId ${addressId}:`, affectedJobs.length);
    
    // 2️⃣ Für jeden betroffenen Job: PATCH addressId auf null
    for (const job of affectedJobs) {
      try {
        console.log(`⚙️ PATCH Job ${job.id}: addressId → null`);
        await jobApi.updateAddressId(job.id, null);
        
        // 3️⃣ Update Job-Objekt im jobsMap
        job.addressId = null;
        job.street = null;
        job.number = null;
        job.postcode = null;
        job.city = null;
        job.country = null;
        job.traveltime = null;
        job.distance = null;
        job.headquarter = false;
        
        console.log(`✅ Job ${job.id} aktualisiert`);
      } catch (err) {
        console.error(`❌ Fehler beim Patchen von Job ${job.id}:`, err);
        throw new Error(`Job ${job.id} konnte nicht aktualisiert werden: ${err.message}`);
      }
    }
    
    // 4️⃣ DELETE Adresse selbst
    console.log(`🗑️ DELETE /api/addresses/${addressId}`);
    await addressApi.delete(addressId);
    
    // 5️⃣ UI aktualisieren: Adresse aus Array entfernen
    if (company.addresses) {
      const index = company.addresses.findIndex(a => a.id === addressId);
      if (index !== -1) {
        company.addresses.splice(index, 1);
        console.log(`✅ Adresse ${addressId} gelöscht. ${affectedJobs.length} Jobs aktualisiert.`);
      }
    }
  } catch (err) {
    console.error('❌ Fehler beim Löschen der Adresse:', err);
    alert('Fehler beim Löschen der Adresse: ' + (err.response?.data?.message || err.message));
  }
};

/**
 * Address Delete Handler (Jobs)
 * Muss Adresse mit FK-Sicherung löschen:
 * 1. Job.addressId auf NULL setzen (mit PATCH)
 * 2. DANN die Adresse selbst löschen
 */
const handleJobAddressDelete = async (job) => {
  try {
    // 1. Job aktualisieren: addressId auf null setzen (via PATCH - nur dieses Feld)
    // ⚠️ WICHTIG: Adresse wird NICHT gelöscht! Sie bleibt in company.addresses
    // Das ist ein "Soft-Delete" für den Job - nur die FK wird nullifiziert
    await jobApi.updateAddressId(job.id, null);
    console.log('✅ Job.addressId auf null gesetzt (Adresse bleibt in Company)');
    
    // 2. UI aktualisieren: Job-Adressfelder zurücksetzen
    job.street = null;
    job.number = null;
    job.postcode = null;
    job.city = null;
    job.country = null;
    job.traveltime = null;
    job.distance = null;
    job.headquarter = false;
    job.addressId = null;
    
    console.log('✅ Job-Adresse vom Job getrennt (Adresse bleibt bei Company):', job.id);
  } catch (err) {
    console.error('❌ Fehler beim Trennen der Job-Adresse:', err);
    alert('Fehler beim Trennen der Adresse: ' + (err.response?.data?.message || err.message));
  }
};

/**
 * ============================================
 * JOB Handlers (Create/Update/Delete)
 * ============================================
 */

/**
 * Starte Create-Mode für neuen Job
 */
const startCreateJob = (companyId) => {
  creatingJobForCompanyId.value = companyId;
};

/**
 * Abbreche Create-Mode für neuen Job
 */
const cancelCreateJob = () => {
  creatingJobForCompanyId.value = null;
};

/**
 * Handle Job Created/Updated
 * Nach erfolgreichem POST oder PUT wird dieser Handler aufgerufen
 */
const handleJobUpdate = (job) => {
  // Der Job wurde vom Backend zurückgegeben
  // Wir müssen ihn in unsere lokale jobsMap integrieren
  
  if (!job?.id) {
    console.error('❌ Job ohne ID erhalten:', job);
    return;
  }

  const jobsForCompany = props.jobsMap[job.companyId];
  if (!jobsForCompany) {
    console.error('❌ Keine Jobs für Company:', job.companyId);
    return;
  }

  // Prüfe ob Job bereits existiert (Update) oder neu (Create)
  const existingIndex = jobsForCompany.findIndex(j => j.id === job.id);
  
  if (existingIndex !== -1) {
    // UPDATE: Ersetze bestehenden Job
    jobsForCompany[existingIndex] = job;
    console.log('✅ Job aktualisiert:', job.id);
  } else {
    // CREATE: Füge neuen Job am Anfang hinzu
    jobsForCompany.unshift(job);
    console.log('✅ Neuer Job erstellt:', job.id);
  }

  // Create-Mode beenden
  cancelCreateJob();
};

/**
 * Handle Job Deleted
 * Nach erfolgreichem DELETE wird dieser Handler aufgerufen
 * Das Backend löscht automatisch alle zugehörigen Timeline-Einträge (cascading)
 */
const handleJobDelete = async (jobId, companyId) => {
  try {
    // DELETE /api/jobs/{jobId}
    // Das Backend kümmert sich um Cascade-Löschen der Timelines
    await jobApi.delete(jobId);

    // UI aktualisieren: Job aus der Liste entfernen
    const jobsForCompany = props.jobsMap[companyId];
    if (jobsForCompany) {
      const index = jobsForCompany.findIndex(j => j.id === jobId);
      if (index !== -1) {
        jobsForCompany.splice(index, 1);
        console.log('✅ Job gelöscht:', jobId);
      }
    }

    // Cleanup: Wenn Timeline geladen war, entfernen
    if (props.timelinesMap && props.timelinesMap[jobId]) {
      delete props.timelinesMap[jobId];
    }
  } catch (err) {
    console.error('❌ Fehler beim Löschen des Jobs:', err);
    alert('Fehler beim Löschen des Jobs: ' + (err.response?.data?.message || err.message));
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
 * Helper: Hole gefilterte Jobs für Firma
 * Wendet Job- und Status-Filter an
 */
const getJobsForCompany = (companyId) => {
  const visibleJobs = getVisibleJobsForCompany(companyId);
  console.log(`[Filter Debug] getJobsForCompany(${companyId}) rendert ${visibleJobs.length} Jobs`);
  return visibleJobs;
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
        <div v-if="isCompanyExpanded(company.id)" class="addresses-list">
          <!-- Existierende Adressen -->
          <AddressItem
            v-for="address in company.addresses"
            :key="address.id"
            :address="address"
            :parent-type="'company'"
            :parent-id="company.id"
            :is-expanded="isAddressExpanded(address.id)"
            :mode="'view'"
            @toggle="toggleAddress(address.id)"
            @update="handleAddressUpdate(company, $event)"
            @delete="handleAddressDelete(company, $event)"
          />

          <!-- Create neue Adresse Button + Form -->
          <div v-if="!creatingAddressForCompanyId" class="create-address-button">
            <button
              class="btn btn-sm btn-info"
              @click.stop="startCreateAddress(company.id)"
            >
              + Neue Adresse für {{ company.name }}
            </button>
          </div>

          <!-- Create neue Adresse Form (wenn active) -->
          <AddressItem
            v-if="creatingAddressForCompanyId === company.id"
            :key="`create-${company.id}`"
            :address="null"
            :parent-type="'company'"
            :parent-id="company.id"
            :is-expanded="true"
            :mode="'create'"
            @update="(newAddress) => { company.addresses.push(newAddress); cancelCreateAddress(); }"
            @delete="cancelCreateAddress"
          />
        </div>

        <!-- COMPANY CONTENT (expandiert) -->
        <div v-if="isCompanyExpanded(company.id)" class="company-content">
          <div class="jobs-section">
            <!-- ============================================
                 JOBS (Level 2) 
                 Renderiert mit JobItem Komponente
                 ============================================ -->

            <!-- Empty State wenn keine Jobs -->
            <div
              v-if="!getJobsForCompany(company.id).length"
              class="text-muted text-center py-2"
            >
              <em>Keine Jobs vorhanden</em>
            </div>

            <!-- Jobs Loop: Rendere jeden Job mit JobItem -->
            <div
              v-for="job in getJobsForCompany(company.id)"
              :key="`job-${job.id}`"
              :data-job-id="job.id"
              class="job-wrapper"
            >
              <!-- 
                JobItem Komponente: 
                - Rendert Job in View/Edit/Create Mode
                - Zeigt alle Job-Details wenn expanded
                - Ermöglicht Edit direkt im Komponente
              -->
              <JobItem
                :job="job"
                :company-id="company.id"
                :is-expanded="isJobExpanded(job.id)"
                :mode="'view'"
                :job-statuses="props.jobStatuses"
                @toggle="toggleJob(job.id)"
                @update="handleJobUpdate($event)"
                @delete="handleJobDelete($event, company.id)"
              />

              <!-- 
                Job Address: Wird NACH dem Job gerendert
                Zeigt die Adresse des Jobs an (falls vorhanden)
              -->
              <AddressItem
                v-if="job.addressId || job.city || job.street || job.postcode"
                :address="{
                  id: job.addressId,
                  street: job.street || null,
                  number: job.number || null,
                  postcode: job.postcode || null,
                  city: job.city || null,
                  country: job.country || null,
                  traveltime: job.traveltime || null,
                  distance: job.distance || null,
                  headquarter: job.headquarter ?? false
                }"
                :parent-type="'job'"
                :parent-id="job.addressId"
                :is-expanded="isAddressExpanded(job.id)"
                :mode="'view'"
                @toggle="toggleAddress(job.id)"
                @update="handleJobAddressUpdate(job, $event)"
                @delete="handleJobAddressDelete(job)"
              />

              <!-- 
                Button/Dropdown zum Adresse zuweisen oder neu erstellen
                Nur sichtbar wenn:
                - Kein addressId vorhanden (max 1 Adresse pro Job)
                - Nicht gerade im Create-Mode für eine Adresse
              -->
              <div 
                v-if="!job.addressId && creatingAddressForJobId !== job.id"
                class="address-dropdown-container ms-2 mb-2"
              >
                <!-- Dropdown Button -->
                <button
                  class="btn btn-sm btn-outline-secondary dropdown-toggle"
                  @click="toggleAddressDropdown(job.id)"
                  :aria-expanded="addressDropdownOpen[job.id] ? 'true' : 'false'"
                >
                  📍 Adresse hinzufügen
                </button>

                <!-- Dropdown Menu (mit Firmenadressen + Create-Option) -->
                <div 
                  v-if="addressDropdownOpen[job.id]"
                  class="dropdown-menu show"
                >
                  <!-- Existierende Firmenadressen -->
                  <div v-if="company.addresses?.length > 0" class="dropdown-menu-addresses">
                    <small class="dropdown-header">Firmenadressen:</small>
                    <button
                      v-for="address in company.addresses"
                      :key="address.id"
                      type="button"
                      class="dropdown-item"
                      @click="assignAddressToJob(job, address)"
                    >
                      {{ formatAddressForDropdown(address) }}
                    </button>
                    <div class="dropdown-divider"></div>
                  </div>

                  <!-- Create New Address Option -->
                  <button
                    type="button"
                    class="dropdown-item"
                    @click="startCreateJobAddress(job.id); addressDropdownOpen[job.id] = false;"
                  >
                    ➕ Neue Adresse erstellen
                  </button>
                </div>
              </div>

              <!-- 
                Job Address Create Form
                Wird inline angezeigt wenn Benutzer "+ Adresse hinzufügen" klickt
              -->
              <AddressItem
                v-if="creatingAddressForJobId === job.id"
                :address="{}"
                :parent-type="'job'"
                :parent-id="job.id"
                :is-expanded="true"
                :mode="'create'"
                @update="handleJobAddressUpdate(job, $event); cancelCreateJobAddress();"
                @delete="cancelCreateJobAddress()"
              />

              <!-- 
                Timeline Container (Level 3)
                Nur rendern wenn Job expanded ist
              -->
              <div v-if="isJobExpanded(job.id) && getTimelineForJob(job.id)" class="timeline-container ms-3">
                <!-- Loading State -->
                <div v-if="isTimelineLoading(job.id)" class="text-center py-2">
                  <span class="spinner-border spinner-border-sm"></span>
                  Lädt Kommunikationen...
                </div>

                <!-- Timeline Items when loaded -->
                <div v-else class="timeline-items">
                  <!-- 
                    CREATE Mode TimelineItem
                    Wird am Anfang gerendert wenn Benutzer "+ Kommunikation" geklickt hat
                  -->
                  <TimelineItem
                    v-if="creatingCommunicationForJobId === job.id && selectedCommunicationType"
                    mode="create"
                    :communication-type="selectedCommunicationType"
                    :job-id="job.id"
                    :is-expanded="true"
                    :communication-statuses="props.communicationStatuses"
                    @toggle="() => {}"
                    @edit="() => {}"
                    @update="(newComm) => {
                      const timeline = getTimelineForJob(job.id);
                      if (timeline && timeline.content) {
                        timeline.content.unshift(newComm);
                      }
                      cancelCreateCommunication();
                    }"
                    @delete="() => cancelCreateCommunication()"
                  />

                  <!-- 
                    EDIT Mode TimelineItems
                    Existierende Kommunikationen
                  -->
                  <TimelineItem
                    v-for="(comm, index) in getTimelineForJob(job.id).content"
                    :key="comm.id ? `${job.id}-${comm.id}` : `${job.id}-temp-${index}`"
                    mode="edit"
                    :communication="comm"
                    :job-id="job.id"
                    :is-expanded="isCommunicationExpanded(comm.id)"
                    :communication-statuses="props.communicationStatuses"
                    @toggle="() => toggleCommunication(comm.id)"
                    @edit="emit('edit-communication', comm)"
                    @update="(updatedComm) => updateCommunication(comm.id, updatedComm)"
                    @delete="emit('delete-communication', comm.id)"
                  />
                </div>

                <!-- 
                  Timeline Controls: Pagination, Filter Buttons, Create Communication
                -->
                <div class="timeline-controls">
                  <!-- Create Communication Button mit Dropdown -->
                  <div class="btn-group" role="group">
                    <button
                      class="btn btn-sm btn-success"
                      @click.stop="startCreateCommunication(job.id)"
                    >
                      + Kommunikation
                    </button>

                    <!-- Dropdown Menu für Kommunikationstyp-Auswahl -->
                    <div
                      v-if="creatingCommunicationForJobId === job.id && showCommunicationTypeMenu"
                      class="communication-type-menu"
                    >
                      <div class="menu-header">Kommunikationstyp auswählen:</div>
                      <button
                        v-for="commType in communicationTypes"
                        :key="commType.type"
                        class="menu-item"
                        @click="selectCommunicationType(commType.type)"
                      >
                        <span class="icon">{{ commType.icon }}</span>
                        <span class="label">{{ commType.label }}</span>
                      </button>
                      <button
                        class="menu-item cancel"
                        @click="cancelCreateCommunication"
                      >
                        ✕ Abbrechen
                      </button>
                    </div>
                  </div>

                  <!-- Pagination Info -->
                  <div v-if="getTimelineForJob(job.id)?.content?.length > 0" class="pagination-info">
                    <small class="text-muted">
                      Seite {{ (getTimelineForJob(job.id).currentPage || 0) + 1 }} /
                      {{ getTimelineForJob(job.id).totalPages }}
                    </small>
                  </div>

                  <!-- Pagination Buttons -->
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

                  <!-- Filter Buttons -->
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

            <!-- 
              Create new Job Button und Create Form
              Button nur sichtbar wenn NICHT gerade im Create-Mode
            -->
            <div v-if="!creatingJobForCompanyId" class="create-job-section">
              <button
                class="btn btn-sm btn-success"
                @click="startCreateJob(company.id)"
              >
                💼 + Neuer Job für {{ company.name }}
              </button>
            </div>

            <!-- 
              Create new Job Form
              JobItem im CREATE-Mode
              Wird angezeigt wenn creatingJobForCompanyId === company.id
            -->
            <JobItem
              v-if="creatingJobForCompanyId === company.id"
              :job="null"
              :company-id="company.id"
              :is-expanded="true"
              :mode="'create'"
              :job-statuses="props.jobStatuses"
              @update="handleJobUpdate($event); cancelCreateJob();"
              @delete="cancelCreateJob()"
            />
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
 * Address Dropdown Styling
 * ============================================
 */

.address-dropdown-container {
  position: relative;
  display: inline-block;
}

.address-dropdown-container .dropdown-toggle::after {
  content: '';
  display: inline-block;
  margin-left: 0.5rem;
  vertical-align: 0.255em;
  border-top: 0.3em solid;
  border-right: 0.3em solid transparent;
  border-bottom: 0;
  border-left: 0.3em solid transparent;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  z-index: 1000;
  margin-top: 0.25rem;
}

.dropdown-menu-addresses {
  max-height: 300px;
  overflow-y: auto;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  text-align: left;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out;
}

.dropdown-item:hover {
  background-color: #f0f0f0;
}

.dropdown-item:first-child {
  border-radius: 0.375rem 0.375rem 0 0;
}

.dropdown-item:last-child {
  border-radius: 0 0 0.375rem 0.375rem;
}

.dropdown-header {
  display: block;
  padding: 0.5rem 1rem;
  margin-bottom: 0;
  color: #6c757d;
  font-weight: 600;
}

.dropdown-divider {
  height: 0;
  margin: 0.5rem 0;
  overflow: hidden;
  border-top: 1px solid #e9ecef;
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
  overflow: visible;
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
  overflow: visible;
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

.create-address-button {
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
}

.create-address-button .btn {
  font-size: 0.875rem;
}

/**
 * Job Address Inline (read-only)
 */
.job-address-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #f8f9fa;
  border-left: 2px solid #667eea;
  font-size: 0.875rem;
  color: #495057;
  margin: 0.5rem 0;
}

.job-address-inline .address-icon {
  font-size: 1rem;
}

.job-address-inline .address-text {
  flex: 1;
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
  overflow: visible;
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
  overflow: visible;
  position: relative;
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
  overflow: visible;
  position: relative;
  z-index: 50;
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
  overflow: visible;
  position: relative;
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
  position: relative;
  z-index: 100;
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

/**
 * Communication Type Menu (Dropdown)
 */
.communication-type-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 10000;
  min-width: 200px;
  margin-top: 0.25rem;
}

.menu-header {
  padding: 0.5rem 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  border-bottom: 1px solid #f0f0f0;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 0.9rem;
  color: #333;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover:not(.cancel) {
  background: #f8f9fa;
}

.menu-item.cancel {
  color: #dc3545;
  justify-content: center;
}

.menu-item.cancel:hover {
  background: #fff5f5;
}

.menu-item .icon {
  font-size: 1.1rem;
}

.menu-item .label {
  font-weight: 500;
}

.btn-group {
  position: relative;
  display: inline-block;
}
</style>
