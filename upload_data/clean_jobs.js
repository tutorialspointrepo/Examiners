/**
 * clean_jobs.js - Batch process all jobs using Gemini AI
 * 
 * Cleans and formats job descriptions into HTML.
 * Extracts salary and education into separate fields.
 * Adds 'formattedDescription' field (keeps original 'description' untouched).
 * Marks processed jobs with 'geminiProcessed: true' to avoid re-processing.
 *
 * Usage: node clean_jobs.js [--dry-run] [--limit=N] [--force]
 */

const https = require('https');
const http = require('http');

// ============================================
// CONFIG
// ============================================
const FIREBASE_PROJECT_ID = 'examiners-app';
const FIREBASE_COLLECTION = 'jobs';
const FIREBASE_API_KEY = 'AIzaSyAgBlBnFUJsu_GlPK4xbJ1lDtCv8lvm1-U';
const GEMINI_DELAY_MS = 1500;

// Gemini pricing (per 1M tokens)
const PRICE_INPUT_PER_1M = 0.50;   // $0.50 per 1M input tokens
const PRICE_OUTPUT_PER_1M = 3.00;  // $3.00 per 1M output tokens
const CHARS_PER_TOKEN = 4;         // ~4 chars per token estimate

// ============================================
// PARSE CLI ARGS
// ============================================
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

console.log('=== Gemini Job Cleaner (Node.js) ===');
console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
console.log(`Force: ${force ? 'YES' : 'NO'}`);
console.log(`Limit: ${limit || 'ALL'}\n`);

// ============================================
// HTTP HELPERS
// ============================================
function httpRequest(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body: data });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });

        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// FIRESTORE HELPERS
// ============================================
async function firestoreGet(docPath) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${docPath}?key=${FIREBASE_API_KEY}`;
    const res = await httpRequest(url);
    if (res.status !== 200) return null;
    return JSON.parse(res.body);
}

async function firestoreQuery(query) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
    const res = await httpRequest(url, 'POST', query);
    if (res.status !== 200) {
        console.error(`Firestore query error: HTTP ${res.status}`);
        return [];
    }
    return JSON.parse(res.body);
}

async function firestorePatch(docId, fields) {
    const docPath = `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${FIREBASE_COLLECTION}/${docId}`;
    const maskParams = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join('&');
    const url = `https://firestore.googleapis.com/v1/${docPath}?key=${FIREBASE_API_KEY}&${maskParams}`;
    const res = await httpRequest(url, 'PATCH', { fields });
    if (res.status !== 200) {
        console.error(`  Firestore PATCH error: HTTP ${res.status}`);
        console.error(`  Response: ${res.body.substring(0, 500)}`);
    }
    return res.status === 200;
}

// ============================================
// FETCH GEMINI CREDENTIALS FROM FIRESTORE
// ============================================
async function getGeminiConfig() {
    console.log('Fetching Gemini credentials from Firestore...');
    
    const keyDoc = await firestoreGet('settings/GEMINI_API_KEY');
    const modelDoc = await firestoreGet('settings/GEMINI_MODEL');

    if (!keyDoc || !modelDoc) throw new Error('Could not fetch Gemini settings from Firestore.');

    const geminiKey = keyDoc.fields?.GEMINI_API_KEY?.stringValue;
    const geminiModel = modelDoc.fields?.GEMINI_MODEL?.stringValue;

    if (!geminiKey || !geminiModel) throw new Error('GEMINI_API_KEY or GEMINI_MODEL not found.');

    console.log(`Model: ${geminiModel}`);
    console.log(`API Key: ${geminiKey.substring(0, 10)}...\n`);

    return { geminiKey, geminiModel };
}

// ============================================
// GEMINI API
// ============================================
async function callGemini(prompt, geminiKey, geminiModel) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json'
        }
    };

    const res = await httpRequest(url, 'POST', payload);

    if (res.status !== 200) {
        console.error(`  Gemini API error: HTTP ${res.status}`);
        console.error(`  Response: ${res.body.substring(0, 300)}`);
        return { result: null, tokens: null };
    }

    const data = JSON.parse(res.body);
    
    // Extract token usage from response
    const usage = data.usageMetadata || {};
    const tokens = {
        input: usage.promptTokenCount || Math.ceil(prompt.length / CHARS_PER_TOKEN),
        output: usage.candidatesTokenCount || 0,
        total: usage.totalTokenCount || 0,
    };

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { result: null, tokens };

    // Clean markdown fences
    text = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');

    try {
        return { result: JSON.parse(text), tokens };
    } catch (e) {
        console.error(`  JSON parse error: ${e.message}`);
        console.error(`  Raw: ${text.substring(0, 300)}`);
        return { result: null, tokens };
    }
}

function buildPrompt(description, title, company) {
    return `You are a job listing formatter. Given raw job description text, clean and restructure it into well-formatted HTML.

TITLE CLEANING RULES:
- KEEP THE FULL TITLE — do NOT shorten, summarize, or remove meaningful parts
- Only clean formatting: fix capitalization to Title Case, replace underscores with spaces, fix encoding issues
- Keep company names, locations, specializations, and qualifiers that are part of the original title
- Remove only true junk: internal codes, random IDs, duplicate words
- Example: "In_director_it Risk Assessment_cyber Risk And Regulations_advisory_bangalore" → "Director - IT Risk Assessment, Cyber Risk and Regulations, Advisory, Bangalore"
- Example: "senior ai engineer – llm frameworks, vector databases & automation" → "Senior AI Engineer – LLM Frameworks, Vector Databases & Automation"
- Example: "Amazon Web Services (AWS) Hiring for IT Support Associate in Chennai" → "Amazon Web Services (AWS) Hiring for IT Support Associate in Chennai"
- Example: "launch your global career: ai, ml & data science internship for future innovators" → "Launch Your Global Career: AI, ML & Data Science Internship for Future Innovators"
- If the title is already clean, return it as-is in Title Case
- Do NOT remove company name, location, or role details from the title

FORMATTING RULES:
- Use <h2> for section headings (e.g., "Job Summary", "Key Responsibilities", "Qualifications", "Benefits", "How to Apply")
- Use <p> for paragraphs. Use <strong> for emphasis on key terms.
- Use <ul><li> for bullet/list items
- Use <em> for italic/notes
- Do NOT include any CSS, <style>, <html>, <body>, <head>, <div>, or wrapper tags
- Do NOT include the job title as <h1> — we already show it separately
- Output ONLY the inner content HTML — ready to insert inside a container
- Clean up junk characters, fix encoding issues, remove messy formatting
- Split wall-of-text into proper sections with headings where content logically separates
- When text like "Key ResponsibilitiesMaintain..." appears, split into heading + content
- Do NOT change the actual content/meaning — only restructure for readability
- Do NOT add any information not in the original
- Remove any duplicate/repeated content
- Keep it professional and clean

EXTRACTION RULES:
- Extract salary if mentioned anywhere (e.g., "₹5-8 LPA", "20-30 an hour", "$1000-3000/month", "75k-80k"). Return null if not found.
- Extract education/qualification requirements (e.g., "B.Com", "B.Tech/M.Tech", "MBA", "CA/CMA"). Return null if not found.  
- Extract 3-5 short highlight phrases summarizing the most attractive aspects of the job.

Return ONLY valid JSON (no markdown fences):
{
  "cleanedTitle": "Clean Professional Job Title",
  "formattedDescription": "<h2>Job Summary</h2><p>...</p><h2>Key Responsibilities</h2><ul><li>...</li></ul>",
  "extractedSalary": "salary string or null",
  "extractedEducation": "education string or null",
  "highlights": ["highlight1", "highlight2", "highlight3"]
}

Job Title: ${title}
Company: ${company}

Raw Description:
${description}`;
}

// ============================================
// FETCH ALL JOBS
// ============================================
async function fetchAllJobs(onlyUnprocessed = true) {
    console.log('Fetching jobs from Firestore...');

    const query = {
        structuredQuery: {
            from: [{ collectionId: FIREBASE_COLLECTION }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'status' },
                    op: 'EQUAL',
                    value: { stringValue: 'active' }
                }
            },
            orderBy: [{ field: { fieldPath: 'postedTimestamp' }, direction: 'DESCENDING' }],
            limit: 1000
        }
    };

    const data = await firestoreQuery(query);
    if (!Array.isArray(data)) return [];

    const jobs = [];
    for (const item of data) {
        if (!item.document) continue;
        const fields = item.document.fields || {};
        const docId = item.document.name.split('/').pop();

        const isProcessed = fields.geminiProcessed?.booleanValue === true;
        if (onlyUnprocessed && isProcessed) continue;

        jobs.push({
            docId,
            title: fields.title?.stringValue || '',
            company: fields.company?.stringValue || '',
            description: fields.description?.stringValue || '',
            existingSalary: fields.salary?.stringValue || null,
            existingEducation: fields.qualifications?.stringValue || null,
            isProcessed,
        });
    }

    return jobs;
}

// ============================================
// UPDATE JOB
// ============================================
async function updateJob(docId, cleanedTitle, formattedDesc, salary, education, highlights, existingSalary, existingEducation) {
    const fields = {
        description: { stringValue: formattedDesc },
        geminiProcessed: { booleanValue: true },
        geminiProcessedAt: { timestampValue: new Date().toISOString() },
    };

    // Write cleaned title
    if (cleanedTitle) {
        fields.title = { stringValue: cleanedTitle };
    }

    // Only overwrite salary if existing is empty AND Gemini extracted one
    if (!existingSalary && salary) {
        fields.salary = { stringValue: salary };
    }
    // Only overwrite education if existing is empty AND Gemini extracted one
    if (!existingEducation && education) {
        fields.qualifications = { stringValue: education };
    }
    if (highlights && highlights.length > 0) {
        fields.highlights = {
            arrayValue: {
                values: highlights.map(h => ({ stringValue: h }))
            }
        };
    }

    return firestorePatch(docId, fields);
}

// ============================================
// MAIN
// ============================================
async function main() {
    const { geminiKey, geminiModel } = await getGeminiConfig();

    let jobs = await fetchAllJobs(!force);
    console.log(`Found ${jobs.length} jobs to process.\n`);

    if (jobs.length === 0) {
        console.log('No jobs to process. Use --force to re-process all.');
        return;
    }

    if (limit) {
        jobs = jobs.slice(0, limit);
        console.log(`Processing limited to ${limit} jobs.\n`);
    }

    let processed = 0, failed = 0, skipped = 0;
    let totalInputTokens = 0, totalOutputTokens = 0;

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const num = i + 1;

        console.log(`[${num}/${jobs.length}] ${job.title}`);
        console.log(`  Company: ${job.company}`);
        console.log(`  DocID: ${job.docId}`);

        if (job.description.length < 50) {
            console.log('  SKIP: Description too short.\n');
            skipped++;
            continue;
        }

        const prompt = buildPrompt(job.description, job.title, job.company);
        const { result, tokens } = await callGemini(prompt, geminiKey, geminiModel);

        if (tokens) {
            totalInputTokens += tokens.input;
            totalOutputTokens += tokens.output;
            const jobCostIn = (tokens.input / 1_000_000) * PRICE_INPUT_PER_1M;
            const jobCostOut = (tokens.output / 1_000_000) * PRICE_OUTPUT_PER_1M;
            console.log(`  Tokens: ${tokens.input} in / ${tokens.output} out`);
            console.log(`  Cost: $${(jobCostIn + jobCostOut).toFixed(6)}`);
        }

        if (!result || !result.formattedDescription) {
            console.log('  FAILED: No valid response from Gemini.\n');
            failed++;
            await sleep(GEMINI_DELAY_MS);
            continue;
        }

        const { cleanedTitle, formattedDescription, extractedSalary, extractedEducation, highlights } = result;

        console.log(`  Title: "${job.title}" → "${cleanedTitle || job.title}"`);
        console.log(`  Formatted: ${formattedDescription.length} chars`);
        const willWriteSalary = !job.existingSalary && extractedSalary;
        const willWriteEducation = !job.existingEducation && extractedEducation;
        console.log(`  Salary: existing="${job.existingSalary || ''}" | extracted="${extractedSalary || ''}" → ${willWriteSalary ? 'WRITE' : 'SKIP'}`);
        console.log(`  Education: existing="${job.existingEducation || ''}" | extracted="${extractedEducation || ''}" → ${willWriteEducation ? 'WRITE' : 'SKIP'}`);
        console.log(`  Highlights: ${(highlights || []).length}`);

        if (dryRun) {
            console.log('  DRY RUN - skipping Firestore update.\n');
            processed++;
        } else {
            const ok = await updateJob(job.docId, cleanedTitle, formattedDescription, extractedSalary, extractedEducation, highlights || [], job.existingSalary, job.existingEducation);
            if (ok) {
                console.log('  ✓ Updated in Firestore.\n');
                processed++;
            } else {
                console.log('  ✗ Firestore update FAILED.\n');
                failed++;
            }
        }

        await sleep(GEMINI_DELAY_MS);
    }

    // Cost summary
    const totalCostIn = (totalInputTokens / 1_000_000) * PRICE_INPUT_PER_1M;
    const totalCostOut = (totalOutputTokens / 1_000_000) * PRICE_OUTPUT_PER_1M;
    const totalCost = totalCostIn + totalCostOut;
    const avgPerJob = processed > 0 ? totalCost / processed : 0;

    console.log('\n=== SUMMARY ===');
    console.log(`Processed: ${processed} | Failed: ${failed} | Skipped: ${skipped}`);
    console.log(`\n=== COST (${geminiModel}) ===`);
    console.log(`Pricing: $${PRICE_INPUT_PER_1M}/1M input, $${PRICE_OUTPUT_PER_1M}/1M output`);
    console.log(`Input:  ${totalInputTokens.toLocaleString()} tokens → $${totalCostIn.toFixed(4)}`);
    console.log(`Output: ${totalOutputTokens.toLocaleString()} tokens → $${totalCostOut.toFixed(4)}`);
    console.log(`TOTAL COST: $${totalCost.toFixed(4)}`);
    console.log(`Avg per job: $${avgPerJob.toFixed(6)}`);
    if (processed > 0) {
        console.log(`\n=== PROJECTIONS ===`);
        console.log(`  100 jobs:  $${(avgPerJob * 100).toFixed(2)}`);
        console.log(`  500 jobs:  $${(avgPerJob * 500).toFixed(2)}`);
        console.log(`  1000 jobs: $${(avgPerJob * 1000).toFixed(2)}`);
        console.log(`  5000 jobs: $${(avgPerJob * 5000).toFixed(2)}`);
    }
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
