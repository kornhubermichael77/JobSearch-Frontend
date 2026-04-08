/**
 * useData.js - Data Management Composable für Dashboard
 * 
 * Verwaltet:
 * ✅ Alle Daten laden (Firmen, Jobs, Timeline)
 * ✅ Filter-State (7 Dropdowns)
 * ✅ Pagination (für Timeline)
 * ✅ Daten aktualisieren (nach Edit/Delete)
 * 
 * Gedanken:
 * - Kein großer Vuex Store nötig, Composable reicht
 * - Reactive mit ref() für Daten, computed() für gefilterte Ergebnisse
 * - Lazy Loading: Jobs/Timeline nur wenn nötig laden
 */

import { ref, computed, reactive } from 'vue';
import { companyApi, jobApi, communicationApi, addressApi } from '@/services/api.js';
import { generateMockCompanies, generateMockJobsForCompany, generateMockTimeline, generateMockEnums } from '@/utils/mockData.js';

/**
 * ============================================
 * State
 * ============================================
 */

// Rohdaten
const companies = ref([]);
const jobs = ref({}); // { [companyId]: [jobs...] } - geladen on-demand
const timelines = ref({}); // { [jobId]: { content: [...], ...pageable } }

// Loading States
const loading = ref(false);
const loadingCompanies = ref(false);
const loadingJobs = ref({});
const loadingTimeline = ref({});

// Error
const error = ref(null);

// Filter State (7 Filterkriterien)
const filters = reactive({
  companyId: null, // (1) Firma
  jobId: null, // (1b) Job (neu!)
  jobStatus: null, // (2) Job-Status
  person: null, // (3) Person
  communicationType: null, // (4) Kommunikations-Typ
  communicationStatus: null, // (5) Kommunikations-Status
  fromDate: null, // (6) Datum (from)
  // (7) Pagination für Timeline (in Daten-Struktur)
});

// Enum-Werte (Cache)
const jobStatuses = ref([]); // Alle möglichen Job-States (OFFEN, BEWORBEN, etc.)
const communicationStatuses = ref([]); // Vom Backend geholt
const communicationTypes = [
  'MAIL',
  'PHONE',
  'TALK',
  'TRIAL',
  'INTERVIEW',
  'WEBFORM',
];

// Jobs für Filter-Dropdown (alle Jobs mit notwendigen Infos)
const allJobsForFilter = ref([]);

/**
 * ============================================
 * Exported Data
 * ============================================
 */

/**
 * lade Firmen (beim Dashboard-Mount)
 */
export const loadCompanies = async () => {
  loadingCompanies.value = true;
  error.value = null;

  try {
    const response = await companyApi.getAll();
    companies.value = response.data;

    // Filter auf "alle Firmen" setzen (keine Vorauswahl)
    filters.companyId = null;
  } catch (err) {
    // Fallback: Nutze Mock Data für lokale Tests wenn Backend nicht verfügbar
    console.warn('⚠️ API fehler, nutze Mock-Daten:', err.message);
    companies.value = generateMockCompanies();
    filters.companyId = null;
  } finally {
    loadingCompanies.value = false;
  }
};

/**
 * Lade Jobs für eine Firma mit dem /api/jobs?companyId=x Endpoint
 */
export const loadJobsForCompany = async (companyId) => {
  if (!companyId) return;

  // Gib an dass diese Company gerade lädt
  loadingJobs.value[companyId] = true;
  error.value = null;

  try {
    // GET /api/jobs?companyId=x → liefert alle Jobs dieser Firma
    const params = { companyId };
    
    // Optional: Filtere nach jobStatus falls gesetzt
    if (filters.jobStatus) {
      params.status = filters.jobStatus;
    }
    
    const response = await jobApi.getAll(params);
    const companyjobs = response.data || [];
    
    jobs.value[companyId] = companyjobs;
    console.log(`✅ Geladen ${companyjobs.length} Jobs für companyId ${companyId}`);
  } catch (err) {
    // Fallback: Nutze Mock Data für lokale Tests wenn Backend nicht verfügbar
    console.warn(`⚠️ API fehler, nutze Mock-Daten für companyId ${companyId}:`, err.message);
    jobs.value[companyId] = generateMockJobsForCompany(companyId);
  } finally {
    loadingJobs.value[companyId] = false;
  }
};

/**
 * Lade Timeline für einen Job (mit allen Filtern)
 * 
 * Parameters:
 * - jobId: required
 * - page: optional (default 0)
 * - size: optional (default 20)
 */
export const loadTimelineForJob = async (jobId, page = 0, size = 20) => {
  if (!jobId) return;

  loadingTimeline.value[jobId] = true;
  error.value = null;

  try {
    const params = {
      jobId,
      page,
      size,
    };

    // Optionale Filter
    if (filters.communicationType) {
      params.type = filters.communicationType;
    }
    if (filters.person) {
      params.person = filters.person;
    }
    if (filters.communicationStatus) {
      params.status = filters.communicationStatus;
    }
    if (filters.fromDate) {
      params.from = filters.fromDate; // ISO date string
    }

    const response = await communicationApi.getTimeline(params);
    timelines.value[jobId] = {
      ...response.data,
      currentPage: page, // Speichere aktuelle Page
    };
  } catch (err) {
    // Fallback: Nutze Mock Data für lokale Tests wenn Backend nicht verfügbar
    console.warn(`⚠️ API fehler, nutze Mock-Daten für jobId ${jobId}:`, err.message);
    timelines.value[jobId] = generateMockTimeline(jobId);
  } finally {
    loadingTimeline.value[jobId] = false;
  }
};

/**
 * Lade vollständige Adressdaten für einen Job
 * 
 * Der /api/jobs?companyId=x Endpunkt liefert nur:
 * - addressId (für lazy-loading)
 * - Basis-Adressfelder (street, city, postcode, number)
 * 
 * Diese Funktion lädt die vollständigen Daten von /api/addresses/{addressId}:
 * - Land, Distanz, und weitere Details
 * 
 * Die geladenen Daten werden mit dem Job-Objekt zusammengeführt
 */
export const loadAddressForJob = async (job) => {
  if (!job || !job.addressId) return;

  try {
    const response = await addressApi.getById(job.addressId);
    const addressData = response.data;

    // Merge: Alle Adressfelder vom Backend zum Job hinzufügen
    Object.assign(job, {
      country: addressData.country,
      distance: addressData.distance,
      // Weitere Felder falls vorhanden:
      // ...addressData
    });

    console.log(`✅ Adressdaten geladen für Job ${job.id}`, job);
  } catch (err) {
    console.warn(`⚠️ Fehler beim Laden der Adressdaten für Job ${job.id}:`, err.message);
    // Fallback: Nutze Mock-Werte falls vorhanden
    if (!job.country) job.country = 'Deutschland';
    if (!job.distance) job.distance = null;
  }
};

/**
 * Lade alle nötigen Enum-Werte vom Backend
 */
export const loadEnums = async () => {
  try {
    // Communication-Status vom Backend holen (nur für Communication Timeline)
    const statusResponse = await communicationApi.getStatuses();
    communicationStatuses.value = statusResponse.data;
    console.log('[useData] ✅ Communication-Status geladen');

    // Job-Status vom Backend holen (neuer Endpoint für Job Status Auswahl)
    const jobStatusResponse = await jobApi.getStatuses();
    jobStatuses.value = jobStatusResponse.data;
    console.log('[useData] ✅ Job-Status geladen');

    // ALLE Jobs für Filter-Dropdown laden (ohne Filter) - WICHTIG VOR COMPANIES!
    console.log('[useData] 📡 API-Call: GET /jobs/for-filter startet...');
    const allJobsResponse = await jobApi.getAllForFilter();
    allJobsForFilter.value = allJobsResponse.data;
    console.log('[useData] ✅ getAllForFilter() erfolgreich:', {
      count: allJobsForFilter.value.length,
      firstJob: allJobsForFilter.value[0],
      sample: allJobsForFilter.value.slice(0,2).map(j => ({ id: j.id, text: j.text, companyId: j.companyId }))
    });
  } catch (err) {
    console.error('[useData] ❌ API-Fehler beim Laden von allJobsForFilter:', {
      message: err.message,
      status: err.response?.status,
      url: err.config?.url
    });
    
    // Kein Fallback auf Mock-Daten - echte Fehler sollten sichtbar sein
    allJobsForFilter.value = [];
  }
};

/**
 * ============================================
 * Filter Handling
 * ============================================
 */

/**
 * Firma wechseln → andere Jobs laden
 */
export const setCompanyFilter = async (companyId) => {
  filters.companyId = companyId;
  filters.jobId = null; // Reset Job-Filter wenn Firma wechselt
  await loadJobsForCompany(companyId);
};

/**
 * Job filtern → nur dieser Job anzeigen
 * Lädt keine neuen Daten, wird nur in Timeline-Filter verwendet
 */
export const setJobFilter = (jobId) => {
  filters.jobId = jobId;
};

/**
 * Job-Status Filter → Jobs neu laden
 */
export const setJobStatusFilter = async (status) => {
  filters.jobStatus = status;
  if (filters.companyId) {
    await loadJobsForCompany(filters.companyId);
  }
};

/**
 * Kommunikations-Filter (Person, Type, Status, Datum)
 * → Timeline(s) neu laden
 * 
 * Note: Person, Type, Status, Date beeinflussen sich NICHT gegenseitig
 * Sie alle beeinflussen nur die Timeline
 */
export const setCommunicationTypeFilter = (type) => {
  filters.communicationType = type;
  // Timeline wird automatisch neu geladen wenn in View gebraucht
};

export const setCommunicationStatusFilter = (status) => {
  filters.communicationStatus = status;
};

export const setPersonFilter = (person) => {
  filters.person = person;
};

export const setFromDateFilter = (date) => {
  filters.fromDate = date;
};

/**
 * Alle Filter zurücksetzen
 */
export const resetFilters = () => {
  filters.companyId = null; // "Alle Firmen"
  filters.jobId = null;
  filters.jobStatus = null;
  filters.person = null;
  filters.communicationType = null;
  filters.communicationStatus = null;
  filters.fromDate = null;
};

/**
 * ============================================
 * Computed Properties - abgeleitete Daten
 * ============================================
 */

/**
 * Aktuelle kompanie (basierend auf Filter)
 */
const currentCompany = computed(() => {
  return companies.value.find((c) => c.id === filters.companyId);
});

/**
 * Gefilterte Firmen: zeige nur die ausgewählte Firma, oder alle wenn keine ausgewählt
 */
const filteredCompanies = computed(() => {
  if (!filters.companyId) {
    // "Alle Firmen" - zeige alle
    return companies.value;
  }
  // Nur eine Firma - zeige nur die ausgewählte
  const company = companies.value.find((c) => c.id === filters.companyId);
  return company ? [company] : [];
});

/**
 * Jobs der aktuellen Firma oder alle Jobs wenn keine Firma ausgewählt
 * Wird für Job-Filter Dropdown verwendet
 */
const currentJobs = computed(() => {
  // Wenn keine Firma ausgewählt: alle Jobs aus allen Firmen
  if (!filters.companyId) {
    return Object.values(jobs.value).flat();
  }
  return jobs.value[filters.companyId] || [];
});

/**
 * Extrahiere alle unique Personen aus Timeline Communications
 * (für Person-Dropdown)
 */
const availablePeople = computed(() => {
  const people = new Set();

  // Durchlaufe alle geladenen Timelines
  Object.values(timelines.value).forEach((timeline) => {
    if (timeline.content) {
      timeline.content.forEach((comm) => {
        if (comm.person) {
          people.add(comm.person);
        }
      });
    }
  });

  return Array.from(people).sort();
});

/**
 * ============================================
 * Job Save Event - Filter Adjustment
 * ============================================
 */

/**
 * Nach Job CREATE/UPDATE aufrufen
 * 
 * 1. Refresh allJobsForFilter (um neuen/geänderten Job in Dropdown zu zeigen)
 * 2. Überprüfe aktive Filter - wenn zu restriktiv für neuen Job → lockern
 * 
 * Beispiel: User erstellt Job mit Status "REJECTED", aber Filter ist auf "APPLIED"
 *          → lockere Filter zurück auf null, damit neuer Job sofort sichtbar ist
 */
export const refreshJobFilterAfterSave = async (savedJob) => {
  try {
    console.log('[useData] 🔄 refreshJobFilterAfterSave aufgerufen für Job:', {
      jobId: savedJob.id,
      status: savedJob.status,
      currentFilters: { jobId: filters.jobId, jobStatus: filters.jobStatus }
    });

    // 1. Lade allJobsForFilter neu vom Backend
    const allJobsResponse = await jobApi.getAllForFilter();
    allJobsForFilter.value = allJobsResponse.data;
    console.log('[useData] ✅ allJobsForFilter aktualisiert:', {
      newCount: allJobsForFilter.value.length,
      savedJobNow: allJobsForFilter.value.find(j => j.id === savedJob.id)
    });

    // 2. Validiere Filter: sind sie noch kompatibel mit dem neuen/geänderten Job?
    const filterAdjustment = {
      statusAdjusted: false,
      jobIdAdjusted: false
    };

    // Wenn jobStatus Filter aktiv: Prüfe ob savedJob diesen Status hat
    if (filters.jobStatus !== null) {
      const jobHasFilteredStatus = savedJob.status === filters.jobStatus;
      
      if (!jobHasFilteredStatus) {
        console.log('[useData] 🔧 Filter-Anpassung: jobStatus ist zu restriktiv');
        console.log(`         Job hat Status "${savedJob.status}", aber Filter erfordert "${filters.jobStatus}"`);
        console.log('         → Lockere jobStatus auf null');
        
        filters.jobStatus = null;
        filterAdjustment.statusAdjusted = true;
      }
    }

    // Wenn jobId Filter aktiv: Prüfe ob savedJob die selbe ID hat
    if (filters.jobId !== null) {
      const isSelectedJob = savedJob.id === filters.jobId;
      
      if (!isSelectedJob) {
        console.log('[useData] 🔧 Filter-Anpassung: jobId ist zu restriktiv');
        console.log(`         Job ID ist "${savedJob.id}", aber Filter erfordert "${filters.jobId}"`);
        console.log('         → Lockere jobId auf null');
        
        filters.jobId = null;
        filterAdjustment.jobIdAdjusted = true;
      }
    }

    if (filterAdjustment.statusAdjusted || filterAdjustment.jobIdAdjusted) {
      console.log('[useData] ✅ Filter angepasst, UI aktualisiert sich automatisch via Watcher');
    } else {
      console.log('[useData] ℹ️ Filter sind kompatibel, keine Anpassung nötig');
    }

    return filterAdjustment;
  } catch (err) {
    console.error('[useData] ❌ Fehler in refreshJobFilterAfterSave:', {
      message: err.message,
      jobId: savedJob?.id
    });
    throw err; // Bubble up zum Aufrufer
  }
};

/**
 * ============================================
 * CRUD Operationen (Phase 3+)
 * ============================================
 */

// TODO: Später implementieren
// export const createCompany = async (data) => { ... }
// export const updateCompany = async (id, data) => { ... }
// export const deleteCompany = async (id) => { ... }
// export const createJob = async (data) => { ... }
// etc.

/**
 * ============================================
 * Compose Function
 * ============================================
 */

export function useData() {
  return {
    // Rohdaten
    companies,
    jobs,
    timelines,

    // Loading States
    loading,
    loadingCompanies,
    loadingJobs,
    loadingTimeline,

    // Error
    error,

    // Filter State
    filters,
    jobStatuses,
    communicationStatuses,
    communicationTypes,
    allJobsForFilter,

    // Computed
    currentCompany,
    filteredCompanies,
    currentJobs,
    availablePeople,

    // Methoden
    loadCompanies,
    loadJobsForCompany,
    loadTimelineForJob,
    loadEnums,
    setCompanyFilter,
    setJobFilter,
    setJobStatusFilter,
    setCommunicationTypeFilter,
    setCommunicationStatusFilter,
    setPersonFilter,
    setFromDateFilter,
    resetFilters,    refreshJobFilterAfterSave,  };
}

export default useData;
