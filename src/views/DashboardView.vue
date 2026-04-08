<script setup>
/**
 * DashboardView.vue - Hauptansicht nach Login
 * 
 * Integriert:
 * ✅ Header (sticky, Logout)
 * ✅ FilterBar (7 Dropdowns)
 * ✅ HierarchicalDataTree (Firma > Job > Timeline)
 * ✅ Data Fetching (useData Composable)
 * ✅ Error Handling + Loading States
 * 
 * Flow:
 * 1. Mount: loadCompanies() + loadEnums()
 * 2. User wählt Filter: Daten neu laden
 * 3. User klickt Job: Timeline laden (lazy loading)
 */

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth.js';
import { useData } from '@/composables/useData.js';
import FilterBar from '@/components/FilterBar.vue';
import HierarchicalDataTree from '@/components/HierarchicalDataTree.vue';
import SkeletonCard from '@/components/SkeletonCard.vue';

const router = useRouter();
const { user, logout } = useAuth();

/**
 * ============================================
 * Filter Panel State
 * ============================================
 */
const showFilters = ref(true); // Toggle Filter-Panel Sichtbarkeit

const {
  companies,
  jobs,
  timelines,
  loading,
  loadingCompanies,
  loadingJobsMap: loadingJobs,
  loadingTimelineMap: loadingTimeline,
  error,
  filters,
  jobStatuses,
  communicationStatuses,
  communicationTypes,
  allJobsForFilter,
  currentCompany,
  filteredCompanies,
  currentJobs,
  availablePeople,
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
  resetFilters,
} = useData();

/**
 * ============================================
 * Initialization (onMounted)
 * ============================================
 */

onMounted(async () => {
  // Lade Enums (Job-Status, Communication-Status)
  await loadEnums();

  // Lade alle Firmen
  await loadCompanies();

  // Lade Jobs für erste Firma
  if (filters.companyId) {
    await loadJobsForCompany(filters.companyId);
  }
});

/**
 * ============================================
 * Filter Handlers
 * ============================================
 */

const handleCompanyChange = async (companyId) => {
  await setCompanyFilter(companyId);
};

const handleJobChange = async (jobId) => {
  await setJobFilter(jobId);
};

const handleJobStatusChange = async (status) => {
  await setJobStatusFilter(status);
};

const handleReset = async () => {
  resetFilters();
  if (filters.companyId) {
    await loadJobsForCompany(filters.companyId);
  }
};

/**
 * ============================================
 * Data Loading Handlers (von HierarchicalDataTree)
 * ============================================
 */

const handleLoadJobs = async (companyId) => {
  await loadJobsForCompany(companyId);
};

const handleLoadTimeline = async (jobId) => {
  await loadTimelineForJob(jobId);
};

/**
 * ============================================
 * Edit/Delete Handlers (später implementiert)
 * ============================================
 */

const handleLogout = () => {
  logout();
  router.push('/login');
};
</script>

<template>
  <div class="dashboard-wrapper">
    <!-- ============================================ -->
    <!-- HEADER (Sticky) -->
    <!-- ============================================ -->
    <header class="dashboard-header sticky-top">
      <div class="container-fluid">
        <div class="header-content d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            <h1 class="h4 mb-0">📋 JobSearch</h1>
            <span v-if="user" class="text-muted">👤 {{ user.username }}</span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <!-- Filter Toggle Button -->
            <button
              @click="showFilters = !showFilters"
              class="btn btn-outline-secondary btn-sm"
              :title="showFilters ? 'Filter ausblenden' : 'Filter anzeigen'"
            >
              {{ showFilters ? '🔽' : '▶️' }} Filter
            </button>
            <!-- Logout Button -->
            <button
              @click="handleLogout"
              class="btn btn-outline-danger btn-sm"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- ============================================ -->
    <!-- FILTER SECTION (Sticky unter Header, nicht scrollbar) -->
    <!-- ============================================ -->
    <div class="filter-section sticky-top" v-if="showFilters">
      <div class="container-fluid">
        <FilterBar
          :filters="filters"
          :companies="companies"
          :jobs="currentJobs"
          :current-company="currentCompany"
          :all-jobs-for-filter="allJobsForFilter"
          :job-statuses="jobStatuses"
          :communication-statuses="communicationStatuses"
          :communication-types="communicationTypes"
          :available-people="availablePeople"
          @update:companyId="handleCompanyChange"
          @update:jobId="handleJobChange"
          @update:jobStatus="handleJobStatusChange"
          @update:person="setPersonFilter"
          @update:communicationType="setCommunicationTypeFilter"
          @update:communicationStatus="setCommunicationStatusFilter"
          @update:fromDate="setFromDateFilter"
          @reset="handleReset"
        />
      </div>
    </div>

    <!-- ============================================ -->
    <!-- MAIN CONTENT (Scrollbar) -->
    <!-- ============================================ -->
    <main class="dashboard-content">
      <div class="container-fluid">
        <!-- Error Alert -->
        <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
          <strong>⚠️ Error:</strong> {{ error }}
          <button
            type="button"
            class="btn-close"
            @click="error = null"
          ></button>
        </div>

        <!-- Loading State (Skeleton) -->
        <div v-if="loadingCompanies">
          <SkeletonCard :count="5" />
        </div>

        <!-- Main Tree (Data Display) -->
        <div v-else>
          <HierarchicalDataTree
            :companies="filteredCompanies"
            :jobs-map="jobs"
            :all-jobs-for-filter="allJobsForFilter"
            :timelines-map="timelines"
            :loading-jobs-map="loadingJobs"
            :loading-timeline-map="loadingTimeline"
            :filters="filters"
            :communication-statuses="communicationStatuses"
            :job-statuses="jobStatuses"
            @load-jobs="handleLoadJobs"
            @load-timeline="handleLoadTimeline"
            @next-page="(jobId) => loadTimelineForJob(jobId, (timelines[jobId]?.currentPage || 0) + 1)"
            @prev-page="(jobId) => loadTimelineForJob(jobId, Math.max(0, (timelines[jobId]?.currentPage || 1) - 1))"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/**
 * Dashboard Layout: Header (sticky) + Filter (sticky unter Header) + Content (scroll)
 */

.dashboard-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/**
 * Header (nicht mitscrollend)
 */
.dashboard-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 6px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.dashboard-header h1 {
  font-weight: 700;
}

.header-content {
  padding: 0.5rem 0;
}

/**
 * Filter Section (nicht scrollend, aber kollapsibel)
 */
.filter-section {
  background: #ffffff;
  border-bottom: 1px solid #e9ecef;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: 99;
  padding: 1rem 0;
}

.filter-section .container-fluid {
  padding: 0 1rem;
}

/**
 * Main Content (scrollbar)
 */
.dashboard-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 1rem;
  background: #f8f9fa;
}

html {
  scrollbar-gutter: stable;
}

.dashboard-content .container-fluid {
  width: 100%;
  max-width: 1600px !important;
  margin-left: auto;
  margin-right: auto;
}

/**
 * Responsive
 */
@media (max-width: 768px) {
  .dashboard-header {
    padding: 0.15rem 0;
    box-shadow: 0px 5px 25px rgb(44, 17, 117);
  }

  .dashboard-header h1 {
    font-size: 1.2rem;
  }

  .dashboard-content {
    padding: 1rem 0;
  }
}
</style>
