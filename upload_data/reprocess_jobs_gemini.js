#!/usr/bin/env node

/**
 * reprocess_jobs_gemini.js — Re-run Gemini cleaning on all active jobs
 * 
 * Reads each job's raw/current description, sends to Gemini for:
 *   - Title cleaning
 *   - Description HTML formatting
 *   - Salary extraction
 *   - Education/qualifications extraction
 *   - Experience extraction
 *   - Location extraction
 *   - Highlights extraction
 * 
 * Then OVERWRITES all fields in Firestore.
 * 
 * Usage:
 *   node reprocess_jobs_gemini.js [--dry-run] [--jobId=SINGLE] [--limit=100] [--delay=1500] [--force-all] [--show-diff]
 * 
 * Options:
 *   --dry-run       Preview changes without writing
 *   --jobId         Reprocess a single job by document ID
 *   --limit         Max jobs to process (default: 500)
 *   --delay         Delay between Gemini calls in ms (default: 1500)
 *   --force-all     Reprocess ALL active jobs, even already processed ones
 *   --only-failed   Only reprocess jobs where geminiProcessed = 'error'
 *   --show-diff     Show before/after for each job
 * 
 * SAFE TO RE-RUN: Idempotent — reprocesses from current description every time.
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// ============================================
// FIREBASE INIT
// ============================================
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Parse CLI args
const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, val] = arg.substring(2).split('=');
    args[key] = val || true;
  }
});

const dryRun = args['dry-run'] === true;
const singleJobId = args.jobId || null;
const LIMIT = parseInt(args.limit) || 500;
const DELAY_MS = parseInt(args.delay) || 1500;
const forceAll = args['force-all'] === true;
const onlyFailed = args['only-failed'] === true;
const showDiff = args['show-diff'] === true;

// ============================================
// GEMINI PROMPT (exact copy from index.ts)
// ============================================
function buildJobCleaningPrompt(description, title, company) {
  return `You are a job listing formatter. Given raw job description text, clean and restructure it into well-formatted HTML.

TITLE CLEANING RULES:
- KEEP THE FULL TITLE — do NOT shorten, summarize, or remove meaningful parts
- Only clean formatting: fix capitalization to Title Case, replace underscores with spaces, fix encoding issues
- Keep company names, locations, specializations, and qualifiers that are part of the original title
- Remove only true junk: internal codes, random IDs, duplicate words
- If the title is already clean, return it as-is in Title Case

FORMATTING RULES:
- Use <h2> for section headings in Title Case (e.g., "Job Summary", "Key Responsibilities", "Qualifications", "Benefits", "How to Apply"). NEVER use ALL CAPS for headings — always use Title Case.
- Use <p> for paragraphs. Use <strong> for emphasis on key terms.
- Use <ul><li> for bullet/list items
- Use <em> for italic/notes
- Do NOT include any CSS, <style>, <html>, <body>, <head>, <div>, or wrapper tags
- Do NOT include the job title as <h1>
- Output ONLY the inner content HTML
- Clean up junk characters, fix encoding issues, remove messy formatting
- Split wall-of-text into proper sections with headings
- Do NOT change the actual content/meaning
- Do NOT add any information not in the original
- Remove any duplicate/repeated content

EXTRACTION RULES:
- Extract salary if mentioned ANYWHERE in the description (look for LPA, CTC, per annum, per month, /yr, /mo, salary range, compensation, stipend, pay, etc.). Return the salary as a clean string like "10-12 LPA" or "₹50,000/month". Return null ONLY if absolutely no salary/compensation info exists.
- Extract education/qualification requirements (degree, diploma, certification, bachelor's, master's, MBA, B.Tech, etc.). Return as a concise string. Return null ONLY if no education requirement is mentioned.
- Extract work experience requirement (years of experience mentioned, e.g., "3-5 years", "2+ years", "fresher", "0-1 years"). Look for patterns like "X years", "X+ years", "X-Y years of experience", "experience: X years". Return as a clean string like "3-6 years" or "2+ years" or "Fresher". Return null ONLY if no experience requirement is mentioned.
- Extract job location (city, area, state, country). Look for "Location:", "Based in", "Work location", or any address/city mentioned. Return as a clean string like "Andheri, Mumbai" or "Bangalore, Karnataka". Return null ONLY if no location is mentioned.
- Extract 3-5 short highlight phrases summarizing the most attractive aspects.

IMPORTANT: For extractedSalary, extractedEducation, extractedExperience, and extractedLocation, return the JSON null value (not the string "null") when not found.

Return ONLY valid JSON (no markdown fences):
{
  "cleanedTitle": "Clean Professional Job Title",
  "formattedDescription": "<h2>Job Summary</h2><p>...</p>",
  "extractedSalary": "salary string or null",
  "extractedEducation": "education string or null",
  "extractedExperience": "experience string or null",
  "extractedLocation": "location string or null",
  "highlights": ["highlight1", "highlight2", "highlight3"]
}

Job Title: ${title}
Company: ${company}

Raw Description:
${description}`;
}

// ============================================
// GEMINI API CALL
// ============================================
async function cleanJobWithGemini(job, geminiKey, geminiModel) {
  try {
    if (!job.description || job.description.length < 50) return null;

    const prompt = buildJobCleaningPrompt(job.description, job.title, job.company);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`  ⚠️ Gemini API error: HTTP ${response.status} — ${errText.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    text = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const result = JSON.parse(text);
    if (!result || !result.formattedDescription) return null;

    return {
      cleanedTitle: result.cleanedTitle || null,
      formattedDescription: result.formattedDescription,
      extractedSalary: (result.extractedSalary && result.extractedSalary !== 'null' && String(result.extractedSalary).trim().length > 0) ? String(result.extractedSalary).trim() : null,
      extractedEducation: (result.extractedEducation && result.extractedEducation !== 'null' && String(result.extractedEducation).trim().length > 0) ? String(result.extractedEducation).trim() : null,
      extractedExperience: (result.extractedExperience && result.extractedExperience !== 'null' && String(result.extractedExperience).trim().length > 0) ? String(result.extractedExperience).trim() : null,
      extractedLocation: (result.extractedLocation && result.extractedLocation !== 'null' && String(result.extractedLocation).trim().length > 0) ? String(result.extractedLocation).trim() : null,
      highlights: result.highlights || [],
    };
  } catch (error) {
    console.warn(`  ⚠️ Gemini cleaning failed for "${job.title}": ${error.message}`);
    return null;
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('='.repeat(80));
  console.log('REPROCESS JOBS WITH GEMINI — Reformat & Extract Fields');
  console.log(`  Target: ${singleJobId || (onlyFailed ? 'FAILED JOBS ONLY' : (forceAll ? 'ALL ACTIVE JOBS' : 'ALL ACTIVE JOBS'))}`);
  console.log(`  Limit: ${LIMIT}`);
  console.log(`  Delay: ${DELAY_MS}ms`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`  Show Diff: ${showDiff}`);
  console.log('='.repeat(80));

  // 1. Load Gemini credentials from Firestore settings
  const [keyDoc, modelDoc] = await Promise.all([
    db.collection('settings').doc('GEMINI_API_KEY').get(),
    db.collection('settings').doc('GEMINI_MODEL').get(),
  ]);

  const geminiKey = keyDoc.data()?.GEMINI_API_KEY || '';
  const geminiModel = modelDoc.data()?.GEMINI_MODEL || 'gemini-2.0-flash';

  if (!geminiKey) {
    console.error('\n❌ GEMINI_API_KEY not found in Firestore settings collection');
    process.exit(1);
  }

  console.log(`\n🤖 Using model: ${geminiModel}`);

  // 2. Fetch jobs
  let jobDocs = [];

  if (singleJobId) {
    const doc = await db.collection('jobs').doc(singleJobId).get();
    if (!doc.exists) {
      console.error(`\n❌ Job ${singleJobId} not found`);
      process.exit(1);
    }
    jobDocs = [doc];
  } else {
    let query = db.collection('jobs').where('status', '==', 'active');

    if (onlyFailed) {
      query = query.where('geminiProcessed', '==', 'error');
    }

    console.log(`\nFetching jobs...`);
    let lastDoc = null;
    let fetched = 0;

    while (fetched < LIMIT) {
      const batchSize = Math.min(100, LIMIT - fetched);
      let batchQuery = query.limit(batchSize);
      if (lastDoc) batchQuery = batchQuery.startAfter(lastDoc);
      const snapshot = await batchQuery.get();
      if (snapshot.empty) break;
      jobDocs.push(...snapshot.docs);
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      fetched += snapshot.size;
      process.stdout.write(`  Fetched ${fetched} jobs...\r`);
    }
    console.log(`  Fetched ${jobDocs.length} jobs                    `);
  }

  // 3. Process
  const stats = {
    total: jobDocs.length,
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    noDescription: 0,
  };

  console.log(`\nProcessing ${stats.total} job(s)...\n`);

  for (let i = 0; i < jobDocs.length; i++) {
    const doc = jobDocs[i];
    const jobId = doc.id;
    const data = doc.data();

    if ((i + 1) % 50 === 0 || i === 0) {
      console.log(`--- Progress: ${i + 1}/${stats.total} (updated: ${stats.updated}, failed: ${stats.failed}) ---`);
    }

    try {
      if (!data.description || data.description.length < 50) {
        stats.noDescription++;
        continue;
      }

      // Call Gemini
      const cleaned = await cleanJobWithGemini(
        { title: data.title || '', company: data.company || '', description: data.description || '' },
        geminiKey,
        geminiModel
      );

      stats.processed++;

      if (!cleaned) {
        stats.failed++;
        if (!dryRun) {
          await doc.ref.update({
            geminiProcessed: 'error',
            geminiProcessedAt: admin.firestore.Timestamp.now(),
            geminiError: 'No result from Gemini',
          });
        }
        continue;
      }

      // Build update
      const updateData = {
        geminiProcessed: true,
        geminiProcessedAt: admin.firestore.Timestamp.now(),
      };

      if (cleaned.formattedDescription) updateData.description = cleaned.formattedDescription;
      if (cleaned.cleanedTitle) updateData.title = cleaned.cleanedTitle;
      if (cleaned.extractedSalary) updateData.salary = cleaned.extractedSalary;
      if (cleaned.extractedEducation) updateData.qualifications = cleaned.extractedEducation;
      if (cleaned.extractedExperience) updateData.experience = cleaned.extractedExperience;
      if (cleaned.extractedLocation) updateData.extractedLocation = cleaned.extractedLocation;
      if (cleaned.highlights && cleaned.highlights.length > 0) updateData.highlights = cleaned.highlights;

      // Show diff
      if (showDiff || dryRun) {
        console.log(`\n  📋 [${jobId}] "${data.title}" — ${data.company}`);
        if (cleaned.cleanedTitle && cleaned.cleanedTitle !== data.title)
          console.log(`     title: "${data.title}" → "${cleaned.cleanedTitle}"`);
        if (cleaned.extractedSalary)
          console.log(`     salary: "${data.salary || 'null'}" → "${cleaned.extractedSalary}"`);
        if (cleaned.extractedEducation)
          console.log(`     qualifications: "${data.qualifications || 'null'}" → "${cleaned.extractedEducation}"`);
        if (cleaned.extractedExperience)
          console.log(`     experience: "${data.experience || 'null'}" → "${cleaned.extractedExperience}"`);
        if (cleaned.extractedLocation)
          console.log(`     extractedLocation: "${data.extractedLocation || 'null'}" → "${cleaned.extractedLocation}"`);
        if (cleaned.highlights && cleaned.highlights.length > 0)
          console.log(`     highlights: ${JSON.stringify(cleaned.highlights)}`);
        console.log(`     description: ${cleaned.formattedDescription ? `reformatted (${cleaned.formattedDescription.length} chars)` : 'unchanged'}`);
      }

      if (!dryRun) {
        await doc.ref.update(updateData);
      }

      stats.updated++;

      // Rate limit
      if (i < jobDocs.length - 1) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }

    } catch (err) {
      console.error(`  ❌ [${jobId}] ERROR: ${err.message}`);
      stats.failed++;
      if (!dryRun) {
        try {
          await doc.ref.update({
            geminiProcessed: 'error',
            geminiProcessedAt: admin.firestore.Timestamp.now(),
            geminiError: err.message,
          });
        } catch (_) {}
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('REPROCESS SUMMARY');
  console.log(`  Total jobs:          ${stats.total}`);
  console.log(`  Processed by Gemini: ${stats.processed}`);
  console.log(`  Updated:             ${stats.updated}`);
  console.log(`  Failed:              ${stats.failed}`);
  console.log(`  No description:      ${stats.noDescription}`);
  if (dryRun) console.log(`\n  ⚠️  DRY RUN — nothing was written`);
  console.log('='.repeat(80));
}

main()
  .then(() => { console.log('\nDone'); process.exit(0); })
  .catch(err => { console.error('\nFatal:', err); process.exit(1); });
