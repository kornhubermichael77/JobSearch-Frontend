/**
 * Debug Utilities for UI Testing
 * 
 * Provides utilities to test UI with mock data when backend is unavailable.
 * Use in console: window.debugTest.loadMockData()
 */

import { generateMockCompanies, generateMockJobsForCompany, generateMockTimeline, generateMockEnums } from './mockData.js';

export const debugTest = {
  /**
   * Load mock data by simulating API responses
   * This allows testing the UI without a running backend
   */
  loadMockData: () => {
    // Store mock data in sessionStorage for composables to access
    const companies = generateMockCompanies();
    const enums = generateMockEnums();
    
    sessionStorage.setItem('mockCompanies', JSON.stringify(companies));
    sessionStorage.setItem('mockEnums', JSON.stringify(enums));
    
    // Pre-load jobs for all companies
    const allJobs = {};
    companies.forEach(company => {
      allJobs[company.id] = generateMockJobsForCompany(company.id);
    });
    sessionStorage.setItem('mockJobs', JSON.stringify(allJobs));
    
    // Pre-load timelines for all jobs
    const allTimelines = {};
    Object.values(allJobs).forEach(jobs => {
      jobs.forEach(job => {
        allTimelines[job.id] = generateMockTimeline(job.id);
      });
    });
    sessionStorage.setItem('mockTimelines', JSON.stringify(allTimelines));
    
    console.log('✅ Mock data loaded! Reload page to apply.');
    console.log('Companies:', companies);
    console.log('All Jobs:', allJobs);
    console.log('All Timelines:', allTimelines);
  },

  /**
   * Clear mock data from sessionStorage
   */
  clearMockData: () => {
    sessionStorage.removeItem('mockCompanies');
    sessionStorage.removeItem('mockJobs');
    sessionStorage.removeItem('mockTimelines');
    sessionStorage.removeItem('mockEnums');
    console.log('✅ Mock data cleared. Reload page.');
  },

  /**
   * Enable mock mode - intercepts API calls
   */
  enableMockMode: () => {
    sessionStorage.setItem('useMockData', 'true');
    debugTest.loadMockData();
    console.log('✅ Mock mode enabled.');
  },

  /**
   * Check if mock mode is active
   */
  isMockMode: () => {
    return sessionStorage.getItem('useMockData') === 'true';
  },

  /**
   * Get companies from mock data
   */
  getMockCompanies: () => {
    const data = sessionStorage.getItem('mockCompanies');
    return data ? JSON.parse(data) : [];
  },

  /**
   * Get jobs for specific company from mock data
   */
  getMockJobs: (companyId) => {
    const data = sessionStorage.getItem('mockJobs');
    const allJobs = data ? JSON.parse(data) : {};
    return allJobs[companyId] || [];
  },

  /**
   * Get timeline for specific job from mock data
   */
  getMockTimeline: (jobId) => {
    const data = sessionStorage.getItem('mockTimelines');
    const allTimelines = data ? JSON.parse(data) : {};
    return allTimelines[jobId] || { content: [], currentPage: 0, totalPages: 0, last: true };
  },

  /**
   * Print comprehensive testing info
   */
  info: () => {
    console.log('=== Dashboard UI Testing Info ===');
    console.log('Mock Mode Enabled:', debugTest.isMockMode());
    console.log('Companies Count:', debugTest.getMockCompanies().length);
    const allJobs = sessionStorage.getItem('mockJobs') ? JSON.parse(sessionStorage.getItem('mockJobs')) : {};
    const totalJobs = Object.values(allJobs).reduce((sum, jobs) => sum + jobs.length, 0);
    console.log('Total Jobs:', totalJobs);
    const allTimelines = sessionStorage.getItem('mockTimelines') ? JSON.parse(sessionStorage.getItem('mockTimelines')) : {};
    const totalComms = Object.values(allTimelines).reduce((sum, timeline) => sum + timeline.content.length, 0);
    console.log('Total Communications:', totalComms);
  },
};

// Export for use
export default debugTest;
