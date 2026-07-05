#!/usr/bin/env node

/**
 * reprocess_jobs_gpt.js — Re-run job cleaning using GPT-4o-mini
 * 
 * KEY FIXES vs previous version:
 *   1. Strips existing HTML from description before sending to AI (avoids no-op reformatting)
 *   2. Writes extractedLocation → location field (not extractedLocation)
 *   3. Uses GPT-4o-mini instead of Gemini
 *   4. Improved location extraction: "City, State, Country" format
 * 
 * Usage:
 *   node reprocess_jobs_gpt.js --openai-key=sk-xxx [--dry-run] [--jobId=SINGLE] [--limit=100] [--delay=500] [--show-diff]
 * 
 * Options:
 *   --openai-key     OpenAI API key (REQUIRED)
 *   --dry-run        Preview changes without writing
 *   --jobId          Reprocess a single job by document ID
 *   --limit          Max jobs to process (default: 500)
 *   --delay          Delay between API calls in ms (default: 500)
 *   --only-failed    Only reprocess jobs where aiProcessed = 'error'
 *   --show-diff      Show before/after for each job
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
    const [key, ...rest] = arg.substring(2).split('=');
    args[key] = rest.join('=') || true;
  }
});

const dryRun = args['dry-run'] === true;
const singleJobId = args.jobId || null;
const LIMIT = parseInt(args.limit) || 500;
const DELAY_MS = parseInt(args.delay) || 500;
const onlyFailed = args['only-failed'] === true;
const showDiff = args['show-diff'] === true;
const OPENAI_KEY = args['openai-key'] || process.env.OPENAI_API_KEY || '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';
const OPENAI_ORG = 'org-8TalfbtaR3FJNxdhbEhMLKDT';
const OPENAI_PROJECT = 'proj_9bat3IRXDdJxQAT0pDL3h9X4';

// ============================================
// STRIP HTML → RAW TEXT (so AI gets raw content, not already-formatted HTML)
// ============================================
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================
// GPT-4o-mini PROMPT (improved)
// ============================================
function buildJobCleaningPrompt(rawDescription, title, company, currentLocation) {
  return `You are a job listing formatter and data extractor. Given a raw job description, do TWO things:

1. FORMAT the description as clean, well-structured HTML
2. EXTRACT key fields from the content

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
- extractedSalary: Extract salary/compensation if mentioned ANYWHERE (look for LPA, CTC, per annum, per month, /yr, /mo, salary range, compensation, stipend, pay, ₹, $, etc.). Return clean string like "10-12 LPA" or "₹50,000/month". Return null ONLY if absolutely NO salary/compensation info exists. Do NOT return generic phrases like "As per company norms" or "As per industry standards" — those are NOT salary data, return null for those.

- extractedEducation: Extract education/qualification requirements (degree, diploma, certification, bachelor's, master's, MBA, B.Tech, etc.). Return as a concise string. Return null if none mentioned.

- extractedExperience: Extract work experience requirement (e.g., "3-5 years", "2+ years", "Fresher", "0-1 years"). Return clean string. Return null if none mentioned.

- extractedLocation: Extract the job location in the format "City, State, Country". ALWAYS include all three parts when possible. Examples: "Nagpur, Maharashtra, India", "Bangalore, Karnataka, India", "Hyderabad, Telangana, India", "New York, NY, USA". The existing location field says "${currentLocation}" — use this to help determine the full City, State, Country format. Return null ONLY if no location info exists at all.

- highlights: Extract 3-5 short highlight phrases summarizing the most attractive aspects of this job.

IMPORTANT: For all extracted fields, return the JSON null value (not the string "null") when not found.

Return ONLY valid JSON:
{
  "cleanedTitle": "Clean Professional Job Title",
  "formattedDescription": "<h2>Job Summary</h2><p>...</p>",
  "extractedSalary": "salary string or null",
  "extractedEducation": "education string or null",
  "extractedExperience": "experience string or null",
  "extractedLocation": "City, State, Country or null",
  "highlights": ["highlight1", "highlight2", "highlight3"]
}

Job Title: ${title}
Company: ${company}

Raw Description:
${rawDescription}`;
}

// ============================================
// GPT-4o-mini API CALL
// ============================================
async function cleanJobWithGPT(job, currentLocation) {
  try {
    const rawDescription = stripHtml(job.description);
    
    if (!rawDescription || rawDescription.length < 30) {
      console.warn(`  ⏭️ Skipped "${job.title}" — description too short after stripping HTML`);
      return null;
    }

    const prompt = buildJobCleaningPrompt(rawDescription, job.title, job.company, currentLocation);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'OpenAI-Organization': OPENAI_ORG,
        'OpenAI-Project': OPENAI_PROJECT,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a job listing formatter. Always respond with valid JSON only, no markdown fences, no extra text.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`  ⚠️ GPT API error: HTTP ${response.status} — ${errText.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content;
    if (!text) return null;

    text = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const result = JSON.parse(text);
    if (!result || !result.formattedDescription) return null;

    const clean = (val) => {
      if (!val || val === 'null' || String(val).trim().length === 0) return null;
      const s = String(val).trim();
      // Filter out generic non-answers for salary
      return s;
    };

    const cleanSalary = (val) => {
      const s = clean(val);
      if (!s) return null;
      const lower = s.toLowerCase();
      if (lower.includes('as per') || lower.includes('not mentioned') || lower.includes('not specified') || lower.includes('industry standard') || lower.includes('company norm')) return null;
      return s;
    };

    return {
      cleanedTitle: clean(result.cleanedTitle),
      formattedDescription: result.formattedDescription,
      extractedSalary: cleanSalary(result.extractedSalary),
      extractedEducation: clean(result.extractedEducation),
      extractedExperience: clean(result.extractedExperience),
      extractedLocation: clean(result.extractedLocation),
      highlights: result.highlights || [],
    };
  } catch (error) {
    console.warn(`  ⚠️ GPT cleaning failed for "${job.title}": ${error.message}`);
    return null;
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('='.repeat(80));
  console.log('REPROCESS JOBS WITH GPT-4o-mini — Reformat & Extract Fields');
  console.log(`  Target: ${singleJobId || (onlyFailed ? 'FAILED JOBS ONLY' : 'ALL ACTIVE JOBS')}`);
  console.log(`  Limit: ${LIMIT}`);
  console.log(`  Delay: ${DELAY_MS}ms`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`  Show Diff: ${showDiff}`);
  console.log('='.repeat(80));

  // Fetch jobs
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
      query = query.where('aiProcessed', '==', 'error');
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

      // Call GPT with current location for context
      const cleaned = await cleanJobWithGPT(
        { title: data.title || '', company: data.company || '', description: data.description || '' },
        data.location || ''
      );

      stats.processed++;

      if (!cleaned) {
        stats.failed++;
        if (!dryRun) {
          await doc.ref.update({
            aiProcessed: 'error',
            aiProcessedAt: admin.firestore.Timestamp.now(),
            aiError: 'No result from GPT-4o-mini',
          });
        }
        continue;
      }

      // Build update — ONLY existing fields, NO new fields
      const updateData = {
        aiProcessed: true,
        aiProcessedAt: admin.firestore.Timestamp.now(),
      };

      if (cleaned.cleanedTitle) updateData.title = cleaned.cleanedTitle;
      if (cleaned.formattedDescription) updateData.description = cleaned.formattedDescription;
      if (cleaned.extractedSalary) updateData.salary = cleaned.extractedSalary;
      if (cleaned.extractedEducation) updateData.qualifications = cleaned.extractedEducation;
      if (cleaned.extractedExperience) updateData.experience = cleaned.extractedExperience;
      if (cleaned.extractedLocation) updateData.location = cleaned.extractedLocation;
      if (cleaned.highlights && cleaned.highlights.length > 0) updateData.highlights = cleaned.highlights;

      // Show diff
      if (showDiff || dryRun) {
        console.log(`\n  📋 [${jobId}] "${data.title}" — ${data.company}`);
        if (cleaned.cleanedTitle && cleaned.cleanedTitle !== data.title)
          console.log(`     title: "${data.title}" → "${cleaned.cleanedTitle}"`);
        console.log(`     salary: "${data.salary || 'null'}" → "${cleaned.extractedSalary || 'null'}"`);
        console.log(`     qualifications: "${data.qualifications || 'null'}" → "${cleaned.extractedEducation || 'null'}"`);
        console.log(`     experience: "${data.experience || 'null'}" → "${cleaned.extractedExperience || 'null'}"`);
        console.log(`     location: "${data.location || 'null'}" → "${cleaned.extractedLocation || 'null'}"`);
        if (cleaned.highlights && cleaned.highlights.length > 0)
          console.log(`     highlights: ${JSON.stringify(cleaned.highlights)}`);
        console.log(`     description: reformatted (${(cleaned.formattedDescription || '').length} chars)`);
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
            aiProcessed: 'error',
            aiProcessedAt: admin.firestore.Timestamp.now(),
            aiError: err.message,
          });
        } catch (_) {}
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('REPROCESS SUMMARY');
  console.log(`  Total jobs:          ${stats.total}`);
  console.log(`  Processed by GPT:    ${stats.processed}`);
  console.log(`  Updated:             ${stats.updated}`);
  console.log(`  Failed:              ${stats.failed}`);
  console.log(`  No description:      ${stats.noDescription}`);
  if (dryRun) console.log(`\n  ⚠️  DRY RUN — nothing was written`);
  console.log('='.repeat(80));
}

main()
  .then(() => { console.log('\nDone'); process.exit(0); })
  .catch(err => { console.error('\nFatal:', err); process.exit(1); });
