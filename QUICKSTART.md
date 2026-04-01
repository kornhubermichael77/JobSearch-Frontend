# Quick Start Guide: Testing the Dashboard

## 🚀 Get Started in 30 Seconds

### Step 1: Open Browser
```
Go to: http://localhost:5174
```

### Step 2: Expand a Company
Click on any company header (e.g., "Techstart GmbH")

### Step 3: See the Jobs
Company expands to show:
- Addresses with details
- Jobs with multi-line headers

### Step 4: Expand a Job
Click on any job header to see:
- Full job details
- Contact information
- Work conditions
- Communications/Timeline

### Step 5: Done! ✅
You're now seeing the complete hierarchical view.

---

## 📋 What You Should See

### Companies Level
```
Techstart GmbH
├─ 2 Addresses (📍 Berlin, Stuttgart)
└─ 3 Jobs

InnovateLabs AG
├─ 1 Address (📍 Cottbus)
└─ 2 Jobs

Digital Solutions AG
├─ 1 Address (📍 Dachau)
└─ 1 Job
```

### Job Header (When Collapsed)
```
▶ Frontend Developer (Vue.js) | Vue.js, TypeScript, REST APIs
  Quelle: ... | 📅 15.01.2024 | Link | 3 💬 | 📍 Berlin
```

### Job Header (When Expanded)
```
▼ Frontend Developer (Vue.js) | Vue.js, TypeScript, REST APIs
  Quelle: ... | 📅 15.01.2024 | Link | 3 💬
  
  Additional Details:
  - Work Conditions: Homeoffice 3 Tage, Flexible times, Full-time
  - Ansprechperson (Tel): Anna Klein +49 30 123456-10
  - Ansprechperson (Mail): anna.klein@techstart.de
  - Arbeitsort: Mainzer Str. 42, 10115 Berlin
```

---

## 🔍 How to Check It's Working

### Console (F12 → Console Tab)
You should see:
```
⚠️ API fehler, nutze Mock-Daten: [error details]
✅ Geladen 3 Jobs für companyId 1
✅ Geladen 2 Jobs für companyId 2
✅ Geladen 1 Jobs für companyId 3
```

**These warning messages mean everything is working!**

### What They Mean
- ⚠️ = API not available, using mock data (expected)
- ✅ = Mock data loaded successfully

---

## 🎯 Visual Test Checklist

Quick 2-minute validation:

- [ ] Page loads without errors
- [ ] See 3 companies in list
- [ ] Can expand/collapse company
- [ ] Addresses visible when company expanded
- [ ] Jobs visible when company expanded
- [ ] Job header shows 3 lines (title, features, meta)
- [ ] Can expand job to see details
- [ ] Contact info visible when job expanded
- [ ] Timeline/Communications visible
- [ ] No broken layouts or missing text

**If all checkmarks pass: ✅ Dashboard is working!**

---

## 📚 More Detailed Testing

For comprehensive testing with all 20+ scenarios, see:
- 📖 `/TESTING.md` - Complete testing guide
- 📊 `/PROJECT_STATUS.md` - Project overview
- 📝 `/SESSION_SUMMARY.md` - What was built today

---

## 🐛 Troubleshooting

### Problem: Page won't load
**Solution:** 
1. Check http://localhost:5174 is correct URL
2. Refresh page (Ctrl+R or Cmd+R)
3. Check console for errors (F12)

### Problem: No data showing
**Solution:**
1. Open console (F12)
2. Look for error messages
3. Reload page
4. Try different company

### Problem: Layout looks wrong
**Solution:**
1. Make browser window wider
2. Check for horizontal scrollbars
3. Press F12 to open dev tools
4. Use bottom-right resize corner

### Problem: Dates look weird
**Solution:** This is OK - dates are in German format (DD.MM.YYYY)

---

## 🎨 UI Features to Explore

### Expand/Collapse
- Click ▶ to expand, ▼ to collapse
- Smooth animation between states
- Icons rotate with state

### Multi-Line Job Header
- Row 1: Job title + Status
- Row 2: Skills/features
- Row 3: Source, date, link, communication count
- More rows when expanded

### Color Scheme
- **Company:** Purple gradient background
- **Job:** Light purple/pink background
- **Timeline:** Green left border
- **Contact links:** Blue color, underlined

### Responsive Design
- Looks good on desktop (1920px)
- Looks good on laptop (1366px)
- Looks good on tablet (768px)
- Works on mobile (320px)

---

## 💡 Pro Tips

### Use Browser Console
```javascript
// See what's loaded
window.debugTest.info()

// Get test companies
const companies = window.debugTest.getMockCompanies()
console.log(companies)

// Get jobs for company ID 1
const jobs = window.debugTest.getMockJobs(1)
console.log(jobs)
```

### Inspect Elements
Press F12 → Right-click element → "Inspect Element"
Shows HTML and CSS for any element

### Check Network Tab
See what API calls are being made (even though they fail and fallback to mock)

### View Source
Right-click → "View Page Source" to see generated HTML

---

## ✅ Validation Checklist

**Before you say "Dashboard works":**

| Item | Check |
|------|-------|
| Page loads | ✅ |
| Companies display | ✅ |
| Jobs display under companies | ✅ |
| Addresses display | ✅ |
| Job header has 3+ lines | ✅ |
| Job expands to show details | ✅ |
| Timeline displays | ✅ |
| Contact links are blue | ✅ |
| No broken HTML (missing text) | ✅ |
| Console shows fallback warnings | ✅ |

**If all pass: Your dashboard is ready! 🎉**

---

## 📞 Need Help?

1. **Check the console (F12)** - Most issues show there
2. **Refresh the page** - Fixes most loading issues
3. **Read `/TESTING.md`** - Detailed testing guide
4. **Read `/PROJECT_STATUS.md`** - Project architecture
5. **Check `/SESSION_SUMMARY.md`** - What was built

---

## 🎓 Learning Resources

### Understanding the Code
```
Entry point: src/main.js
Router setup: src/router/
Main view: src/views/DashboardView.vue
Components: src/components/HierarchicalDataTree.vue
Data layer: src/composables/useData.js
API client: src/services/api.js
Mock data: src/utils/mockData.js (NEW)
```

### Key Concepts Used
- Vue 3 Composition API
- Lazy loading (jobs load only when company expanded)
- Computed properties (reactive filtering)
- Component composition (parent/child relationships)
- Flexbox layouts (responsive design)
- Promise/async-await (API calls)

---

## 🚀 Next Steps

### If Backend is Ready
1. Update API endpoint in `/vite.config.js`
2. Reload page
3. Real data will load instead of mock

### For Further Development
1. Edit/Delete functionality (modals needed)
2. Create new company/job/communication forms
3. Full filtering implementation
4. Search functionality
5. Export/reporting features

### For Production
1. Run: `npm run build`
2. Deploy `dist/` folder
3. Update backend API endpoint
4. Set up HTTPS/SSL

---

## 📊 Stats to Know

```
Companies:        3 (Techstart GmbH, InnovateLabs AG, Digital Solutions AG)
Jobs:             6 (Frontend Dev, Backend Dev, ML Engineer, Data Scientist, DevOps, Consultant)
Communications:   5 (Mix of phone, email, interviews)
Job Fields:       15+ (title, status, features, contact info, address, work conditions, etc.)
Timeline Items:   5 total (with realistic dates and notes)
```

---

## 🎉 You're All Set!

Everything is ready to test. Go ahead and explore the dashboard!

**Quick Start:** http://localhost:5174

---

*Last Updated: 2025-01-26*  
*Difficulty Level: Beginner (no coding needed)*  
*Time to Completion: 2-5 minutes*
