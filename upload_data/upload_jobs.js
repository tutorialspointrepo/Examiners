#!/usr/bin/env node

/**
 * Upload scraped jobs JSON to Firestore
 * 
 * Usage:
 *   node upload_jobs.js --file jobs_india_2026-02-15.json
 *   node upload_jobs.js --file jobs_india_2026-02-15.json --project examiners-app
 */

const admin = require('firebase-admin');
const fs = require('fs');

// ─── CLI Arguments ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const FILE = getArg('--file');
const PROJECT = getArg('--project') || 'examiners-app';

if (!FILE) {
  console.log('Usage: node upload_jobs.js --file jobs_india_2026-02-15.json');
  process.exit(1);
}

if (!fs.existsSync(FILE)) {
  console.log(`File not found: ${FILE}`);
  process.exit(1);
}

// ─── Category Mapping ───────────────────────────────────────────────────────
const CATEGORY_MAP = {
  'software engineer': 'IT & Software',
  'developer': 'IT & Software',
  'IT support': 'IT & Software',
  'cloud computing': 'IT & Software',
  'cybersecurity': 'IT & Software',
  'data engineer': 'Data Science & AI',
  'data scientist': 'Data Science & AI',
  'machine learning': 'Data Science & AI',
  'artificial intelligence': 'Data Science & AI',
  'accountant': 'Finance & Accounting',
  'finance': 'Finance & Accounting',
  'banking': 'Finance & Accounting',
  'auditor': 'Finance & Accounting',
  'marketing': 'Marketing & Sales',
  'sales executive': 'Marketing & Sales',
  'digital marketing': 'Marketing & Sales',
  'human resources': 'HR & Admin',
  'recruitment': 'HR & Admin',
  'administration': 'HR & Admin',
  'operations manager': 'Operations & Management',
  'business analyst': 'Operations & Management',
  'civil engineer': 'Engineering',
  'mechanical engineer': 'Engineering',
  'electrical engineer': 'Engineering',
  'manager': 'Management & Consulting',
  'analyst': 'Management & Consulting',
  'consultant': 'Management & Consulting',
  'executive': 'Management & Consulting',
  'fresher jobs': 'Fresher Jobs',
  'jobs hiring': 'Fresher Jobs',
  'work from home': 'Work From Home',
  'internship': 'Internship',
  // Fallbacks from old queries
  'software developer': 'IT & Software',
  'web developer': 'IT & Software',
  'frontend developer': 'IT & Software',
  'backend developer': 'IT & Software',
  'full stack developer': 'IT & Software',
  'python developer': 'IT & Software',
  'java developer': 'IT & Software',
  'react developer': 'IT & Software',
  'QA engineer': 'IT & Software',
  'cloud engineer': 'IT & Software',
  'machine learning engineer': 'Data Science & AI',
  'product manager tech': 'Management & Consulting',
  'UI UX designer': 'IT & Software',
  'database administrator': 'IT & Software',
  'content writer': 'Marketing & Sales',
  'video editor': 'Marketing & Sales',
  'graphic designer': 'Marketing & Sales',
  'legal': 'Management & Consulting',
  'compliance': 'Finance & Accounting',
  'professor': 'Management & Consulting',
  'training': 'Management & Consulting',
  'logistics': 'Operations & Management',
  'supply chain': 'Operations & Management',
  'manufacturing': 'Engineering',
};

function guessCategory(job) {
  // If job already has a category field from scraper
  if (job.category && CATEGORY_MAP[job.category]) {
    return CATEGORY_MAP[job.category];
  }
  if (job.category) return job.category;

  // Try to match from title
  const title = (job.title || '').toLowerCase();
  if (title.includes('data scien') || title.includes('machine learning') || title.includes('ai ') || title.includes('artificial intelligence') || title.includes('data engineer')) return 'Data Science & AI';
  if (title.includes('developer') || title.includes('software') || title.includes('devops') || title.includes('frontend') || title.includes('backend') || title.includes('full stack') || title.includes('cloud') || title.includes('cyber')) return 'IT & Software';
  if (title.includes('engineer') && !title.includes('civil') && !title.includes('mechanical') && !title.includes('electrical')) return 'IT & Software';
  if (title.includes('civil') || title.includes('mechanical') || title.includes('electrical') || title.includes('manufacturing')) return 'Engineering';
  if (title.includes('accountant') || title.includes('finance') || title.includes('banking') || title.includes('audit')) return 'Finance & Accounting';
  if (title.includes('marketing') || title.includes('sales') || title.includes('seo') || title.includes('content')) return 'Marketing & Sales';
  if (title.includes('hr ') || title.includes('human resource') || title.includes('recruit')) return 'HR & Admin';
  if (title.includes('manager') || title.includes('consultant') || title.includes('executive') || title.includes('analyst')) return 'Management & Consulting';
  if (title.includes('intern')) return 'Internship';
  if (title.includes('fresher')) return 'Fresher Jobs';

  return 'Other';
}

// ─── Parse relative time string to actual timestamp ─────────────────────────
function parsePostedAt(postedAtStr, referenceMs) {
  if (!postedAtStr) return null;
  try {
    // Normalize Arabic/Eastern digits to Western
    const normalized = postedAtStr.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    const lower = normalized.toLowerCase();
    const numMatch = lower.match(/(\d+)/);
    const num = numMatch ? parseInt(numMatch[1], 10) : 0;
    if (num > 0) {
      let msAgo = 0;
      if (/minute|minuto|دقيق/.test(lower)) msAgo = num * 60 * 1000;
      else if (/hour|hora|ساع/.test(lower)) msAgo = num * 3600 * 1000;
      else if (/day|dia|día|يوم/.test(lower)) msAgo = num * 86400 * 1000;
      else if (/week|semana|أسبوع/.test(lower)) msAgo = num * 7 * 86400 * 1000;
      else if (/month|mes|mês|شهر/.test(lower)) msAgo = num * 30 * 86400 * 1000;
      if (msAgo > 0) {
        return admin.firestore.Timestamp.fromMillis(referenceMs - msAgo);
      }
    }
  } catch (_e) { /* fallback */ }
  return null;
}

// ─── Init Firebase ──────────────────────────────────────────────────────────
const SERVICE_ACCOUNT = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT),
  projectId: PROJECT,
});
const db = admin.firestore();

async function main() {
  console.log(`\n📂 Reading ${FILE}...`);
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const jobs = raw.jobs || [];

  console.log(`📊 Found ${jobs.length} jobs to upload`);
  console.log(`🔥 Target: Firestore project "${PROJECT}" → collection "jobs"\n`);

  const now = admin.firestore.Timestamp.now();
  const todayStr = new Date().toISOString().split('T')[0];
  // Use fetchedAt from the JSON as reference point for relative time parsing
  const fetchedAt = raw.meta?.fetchedAt || raw.fetchedAt;
  const referenceMs = fetchedAt ? new Date(fetchedAt).getTime() : Date.now();
  console.log(`⏰ Reference time (fetchedAt): ${fetchedAt || 'now'}\n`);
  let newJobs = 0;
  let updatedJobs = 0;
  let skipped = 0;

  // Process in batches of 400
  const batchSize = 400;
  for (let i = 0; i < jobs.length; i += batchSize) {
    const chunk = jobs.slice(i, i + batchSize);
    const batch = db.batch();
    let batchOps = 0;

    for (const job of chunk) {
      const jobId = job.jobId;
      if (!jobId) { skipped++; continue; }

      // Create safe doc ID from job_id
      const docId = Buffer.from(jobId).toString('base64').replace(/[/+=]/g, '_').substring(0, 128);
      const docRef = db.collection('jobs').doc(docId);

      // Check if exists
      const existing = await docRef.get();

      if (existing.exists) {
        const existingData = existing.data();
        const updateData = {
          lastSeen: now,
          status: 'active',
        };
        // Backfill postedTimestamp if missing
        if (!existingData.postedTimestamp) {
          const postedAtStr = existingData.postedAt || job.postedAt || '';
          const refMs = existingData.firstSeen?.toMillis ? existingData.firstSeen.toMillis() : referenceMs;
          const computed = parsePostedAt(postedAtStr, refMs);
          if (computed) updateData.postedTimestamp = computed;
        }
        batch.update(docRef, updateData);
        updatedJobs++;
      } else {
        const category = guessCategory(job);

        // Skip jobs that don't fit our categories
        if (category === 'Other') { skipped++; continue; }

        batch.set(docRef, {
          jobId: jobId,
          title: job.title || '',
          company: job.company || '',
          location: job.location || '',
          description: job.description || '',
          via: job.via || '',
          scheduleType: job.scheduleType || '',
          isRemote: job.isRemote || false,
          category: category,
          salary: job.salary || null,
          postedAt: job.postedAt || '',
          postedTimestamp: parsePostedAt(job.postedAt, referenceMs) || now,
          firstSeen: now,
          lastSeen: now,
          scrapedDate: todayStr,
          status: 'active',
          applyOptions: (job.applyOptions || []).map(o => ({
            source: o.source || '',
            link: o.link || '',
          })),
          shareLink: job.shareLink || '',
          qualifications: job.qualifications || '',
          highlights: job.highlights || [],
          thumbnail: job.thumbnail || null,
        });
        newJobs++;
      }
      batchOps++;
    }

    if (batchOps > 0) {
      await batch.commit();
      console.log(`  ✅ Batch ${Math.floor(i / batchSize) + 1}: ${batchOps} jobs committed [new: ${newJobs}, updated: ${updatedJobs}]`);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  📊 Upload Complete`);
  console.log(`  New:     ${newJobs}`);
  console.log(`  Updated: ${updatedJobs}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${jobs.length}`);
  console.log(`${'═'.repeat(50)}\n`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
