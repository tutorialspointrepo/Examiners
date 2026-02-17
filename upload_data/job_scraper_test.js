#!/usr/bin/env node

/**
 * Google Jobs Daily Scraper v2
 * 
 * Uses broad industry-category queries (not specific roles) to fetch
 * ALL types of jobs posted today in India via Google Jobs / SerpAPI.
 * 
 * Usage:
 *   node job_scraper.js --key YOUR_SERPAPI_KEY
 *   node job_scraper.js --key YOUR_KEY --max-pages 5
 *   node job_scraper.js --key YOUR_KEY --location "Hyderabad, India"
 */

const https = require('https');
const fs = require('fs');

// ─── CLI Arguments ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const API_KEY = getArg('--key') || 'demo';
const LOCATION = getArg('--location') || 'India';
const MAX_PAGES = parseInt(getArg('--max-pages') || '5', 10);

// Broad industry categories — each covers hundreds of job titles
const QUERIES = [
  // Tech & Engineering
  'software engineer',
  'developer',
  'data engineer',
  'IT support',
  'cloud computing',
  'cybersecurity',
  // Finance & Accounting
  'accountant',
  'finance',
  'banking',
  'auditor',
  // Sales & Marketing
  'marketing',
  'sales executive',
  'digital marketing',
  // HR & Admin
  'human resources',
  'administration',
  'recruitment',
  // Healthcare
  'doctor',
  'nurse',
  'pharmacy',
  // Education
  'teacher',
  'professor',
  'training',
  // Operations & Logistics
  'operations manager',
  'logistics',
  'supply chain',
  // Design & Creative
  'graphic designer',
  'content writer',
  'video editor',
  // Legal & Compliance
  'legal',
  'compliance',
  // Construction & Manufacturing
  'civil engineer',
  'mechanical engineer',
  'electrical engineer',
  'manufacturing',
  // Catch-all broad
  'jobs hiring',
  'fresher jobs',
  'work from home',
  'internship',
  'manager',
  'analyst',
  'consultant',
  'executive',
];

// ─── Colors ─────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  magenta: '\x1b[35m', cyan: '\x1b[36m', red: '\x1b[31m',
  white: '\x1b[37m', bg_green: '\x1b[42m', bg_blue: '\x1b[44m',
};

// ─── Fetch ──────────────────────────────────────────────────────────────────
function fetchJobs(query, nextPageToken = null) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      engine: 'google_jobs',
      q: query,
      api_key: API_KEY,
      chips: 'date_posted:today',
    });
    if (LOCATION) params.set('location', LOCATION);
    if (nextPageToken) params.set('next_page_token', nextPageToken);

    const url = `https://serpapi.com/search.json?${params.toString()}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error));
          else resolve(parsed);
        } catch (e) {
          reject(new Error('Failed to parse response'));
        }
      });
    }).on('error', reject);
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];

  console.log(`\n${c.bright}${c.bg_blue}${c.white} 🔍 GOOGLE JOBS DAILY SCRAPER v2 ${c.reset}\n`);
  console.log(`  Date:       ${c.cyan}${today}${c.reset}`);
  console.log(`  Location:   ${c.cyan}${LOCATION}${c.reset}`);
  console.log(`  Categories: ${c.cyan}${QUERIES.length} industry queries${c.reset}`);
  console.log(`  Pages/Q:    ${c.cyan}${MAX_PAGES}${c.reset}`);
  console.log(`  Filter:     ${c.cyan}date_posted:today${c.reset}`);
  console.log('');

  const allJobs = [];
  const seenJobIds = new Set();
  let totalApiCalls = 0;
  let totalDuplicates = 0;

  for (let qi = 0; qi < QUERIES.length; qi++) {
    const query = QUERIES[qi];
    let nextPageToken = null;
    let queryNew = 0;

    process.stdout.write(`  ${c.magenta}[${qi + 1}/${QUERIES.length}]${c.reset} "${query}" `);

    for (let page = 0; page < MAX_PAGES; page++) {
      totalApiCalls++;

      try {
        const result = await fetchJobs(query, nextPageToken);
        const jobs = result.jobs_results || [];

        if (jobs.length === 0) break;

        // Deduplicate
        jobs.forEach(job => {
          if (job.job_id && seenJobIds.has(job.job_id)) {
            totalDuplicates++;
          } else {
            if (job.job_id) seenJobIds.add(job.job_id);
            allJobs.push(job);
            queryNew++;
          }
        });

        nextPageToken = result.serpapi_pagination?.next_page_token || null;
        if (!nextPageToken) break;

        await new Promise(r => setTimeout(r, 600));
      } catch (error) {
        if (error.message.includes('Invalid API key')) {
          console.log(`\n\n  ${c.red}Invalid API key. Get one at: https://serpapi.com/users/sign_up${c.reset}\n`);
          return;
        }
        break;
      }
    }

    console.log(`→ ${c.green}${queryNew} new${c.reset} ${c.dim}[total: ${allJobs.length}]${c.reset}`);

    await new Promise(r => setTimeout(r, 500));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ─── Report ─────────────────────────────────────────────────────────────
  if (allJobs.length === 0) {
    console.log(`\n  ${c.red}No jobs fetched.${c.reset}\n`);
    return;
  }

  console.log(`\n${c.bright}${'═'.repeat(70)}${c.reset}`);
  console.log(`${c.bright}${c.bg_green}${c.white} 📊 DAILY COLLECTION REPORT ${c.reset}\n`);

  console.log(`  ${c.bright}Total Unique Jobs:${c.reset}  ${c.cyan}${c.bright}${allJobs.length}${c.reset}`);
  console.log(`  ${c.bright}API Calls Made:${c.reset}     ${c.cyan}${totalApiCalls}${c.reset}`);
  console.log(`  ${c.bright}Duplicates Skipped:${c.reset} ${c.cyan}${totalDuplicates}${c.reset}`);
  console.log(`  ${c.bright}Time Taken:${c.reset}         ${c.cyan}${elapsed}s${c.reset}`);

  // Field completeness
  const fields = {
    'Title': allJobs.filter(j => j.title).length,
    'Company': allJobs.filter(j => j.company_name).length,
    'Location': allJobs.filter(j => j.location).length,
    'Description': allJobs.filter(j => j.description).length,
    'Job ID': allJobs.filter(j => j.job_id).length,
    'Posted Date': allJobs.filter(j => j.detected_extensions?.posted_at).length,
    'Schedule Type': allJobs.filter(j => j.detected_extensions?.schedule_type).length,
    'Salary': allJobs.filter(j => j.detected_extensions?.salary).length,
    'Apply Links': allJobs.filter(j => j.apply_options?.length > 0).length,
  };

  console.log(`\n  ${c.bright}📋 Field Completeness:${c.reset}\n`);
  Object.entries(fields).forEach(([field, count]) => {
    const pct = Math.round((count / allJobs.length) * 100);
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    const color = pct >= 80 ? c.green : pct >= 50 ? c.yellow : c.red;
    console.log(`  ${field.padEnd(16)} ${color}${bar} ${pct}%${c.reset} (${count}/${allJobs.length})`);
  });

  // Companies
  const companies = [...new Set(allJobs.map(j => j.company_name).filter(Boolean))];
  console.log(`\n  ${c.bright}🏢 Unique Companies:${c.reset} ${c.cyan}${companies.length}${c.reset}`);
  companies.slice(0, 20).forEach(co => console.log(`     ${c.dim}• ${co}${c.reset}`));
  if (companies.length > 20) console.log(`     ${c.dim}... and ${companies.length - 20} more${c.reset}`);

  // Locations
  const locations = [...new Set(allJobs.map(j => j.location).filter(Boolean))];
  console.log(`\n  ${c.bright}📍 Unique Locations:${c.reset} ${c.cyan}${locations.length}${c.reset}`);
  locations.slice(0, 15).forEach(loc => console.log(`     ${c.dim}• ${loc}${c.reset}`));
  if (locations.length > 15) console.log(`     ${c.dim}... and ${locations.length - 15} more${c.reset}`);

  // Job types
  const types = [...new Set(allJobs.map(j => j.detected_extensions?.schedule_type).filter(Boolean))];
  console.log(`\n  ${c.bright}📋 Job Types:${c.reset}       ${types.join(', ') || 'N/A'}`);

  const remoteCount = allJobs.filter(j => j.detected_extensions?.work_from_home).length;
  console.log(`  ${c.bright}🏠 Remote:${c.reset}          ${remoteCount}/${allJobs.length} (${Math.round((remoteCount / allJobs.length) * 100)}%)`);

  const withSalary = allJobs.filter(j => j.detected_extensions?.salary);
  console.log(`  ${c.bright}💰 With Salary:${c.reset}     ${withSalary.length}/${allJobs.length} (${Math.round((withSalary.length / allJobs.length) * 100)}%)`);

  // Apply sources
  const sources = {};
  allJobs.forEach(j => (j.apply_options || []).forEach(o => { sources[o.title] = (sources[o.title] || 0) + 1; }));
  const sortedSources = Object.entries(sources).sort((a, b) => b[1] - a[1]);
  console.log(`\n  ${c.bright}🔗 Top Job Sources:${c.reset}`);
  sortedSources.slice(0, 15).forEach(([src, cnt]) => console.log(`     ${c.dim}• ${src}: ${cnt}${c.reset}`));

  console.log(`\n${c.bright}${'═'.repeat(70)}${c.reset}`);

  // ─── Save ─────────────────────────────────────────────────────────────
  const filename = `jobs_india_${today}.json`;
  const saveData = {
    meta: {
      fetchedAt: new Date().toISOString(),
      date: today,
      location: LOCATION,
      totalJobs: allJobs.length,
      uniqueCompanies: companies.length,
      uniqueLocations: locations.length,
      apiCalls: totalApiCalls,
      duplicatesSkipped: totalDuplicates,
      timeTakenSeconds: parseFloat(elapsed),
      queries: QUERIES,
    },
    jobs: allJobs.map(j => ({
      jobId: j.job_id || null,
      title: j.title || '',
      company: j.company_name || '',
      location: j.location || '',
      via: j.via || '',
      description: j.description || '',
      postedAt: j.detected_extensions?.posted_at || '',
      scheduleType: j.detected_extensions?.schedule_type || '',
      salary: j.detected_extensions?.salary || null,
      isRemote: j.detected_extensions?.work_from_home || false,
      qualifications: j.detected_extensions?.qualifications || '',
      highlights: j.job_highlights || [],
      applyOptions: (j.apply_options || []).map(o => ({
        source: o.title,
        link: o.link,
      })),
      shareLink: j.share_link || '',
      thumbnail: j.thumbnail || null,
    })),
  };

  fs.writeFileSync(filename, JSON.stringify(saveData, null, 2));
  console.log(`\n  ${c.green}💾 Saved ${allJobs.length} jobs → ${filename}${c.reset}`);
  console.log(`  ${c.dim}File size: ${(fs.statSync(filename).size / 1024).toFixed(1)} KB${c.reset}\n`);
}

main().catch(err => {
  console.error(`${c.red}Fatal: ${err.message}${c.reset}`);
  process.exit(1);
});
