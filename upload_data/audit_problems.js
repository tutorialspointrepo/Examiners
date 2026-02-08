/**
 * Audit Firebase Problems - Find Corrupted/Incomplete Documents
 * Based on problem-template.php field usage
 * 
 * Usage:
 *   node audit_problems.js                          (audit all coding problems)
 *   node audit_problems.js --fix-list               (audit all + write broken slugs to fix_list.txt)
 *   node audit_problems.js --slug <id>              (audit single problem in detail)
 *   node audit_problems.js --no-testcases              (list problems with no test cases)
 *   node audit_problems.js --no-testcases --save        (also save to no_testcases.txt)
 *   node audit_problems.js --fix-paramorder          (dry run - show what would be fixed)
 *   node audit_problems.js --fix-paramorder --apply  (write paramOrder to Firebase)
 */

const admin = require('firebase-admin');
const fs = require('fs');

const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';

const REQUIRED_LANGUAGES = ['c', 'cpp', 'java', 'python', 'javascript', 'go'];

let db = null;

function initFirebase() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
      projectId: FIREBASE_PROJECT_ID,
    });
  }
  db = admin.firestore();
}

// ==================== VALIDATION ====================

function auditProblem(id, data) {
  const issues = [];

  // ─────────── CRITICAL (❌) - Page breaks ───────────

  // title (used in <h1>, SEO, breadcrumbs)
  if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
    issues.push('❌ title: EMPTY or MISSING');
  }

  // description (HTML content shown in problem tab)
  if (!data.description || typeof data.description !== 'string' || data.description.trim() === '') {
    issues.push('❌ description: EMPTY or MISSING');
  }

  // descriptionText (used in meta description fallback)
  if (!data.descriptionText || typeof data.descriptionText !== 'string' || data.descriptionText.trim() === '') {
    issues.push('⚠️  descriptionText: EMPTY or MISSING');
  }

  // approaches (table + code editor + algorithm steps)
  if (!data.approaches || typeof data.approaches !== 'object' || Object.keys(data.approaches).length === 0) {
    issues.push('❌ approaches: EMPTY or MISSING');
  } else {
    for (const [name, approach] of Object.entries(data.approaches)) {
      const p = `approaches.${name}`;

      // approach.code (loaded into Monaco editor)
      if (!approach.code || typeof approach.code !== 'object' || Object.keys(approach.code).length === 0) {
        issues.push(`❌ ${p}.code: EMPTY or MISSING`);
      } else {
        const presentLangs = Object.keys(approach.code);
        const missingLangs = REQUIRED_LANGUAGES.filter(l => !presentLangs.includes(l));
        if (missingLangs.length > 0) {
          issues.push(`⚠️  ${p}.code: missing [${missingLangs.join(', ')}]`);
        }
        for (const [lang, code] of Object.entries(approach.code)) {
          if (typeof code !== 'string') {
            issues.push(`❌ ${p}.code.${lang}: NOT A STRING (type: ${typeof code})`);
          } else if (code.trim() === '') {
            issues.push(`❌ ${p}.code.${lang}: EMPTY string`);
          }
        }
      }

      // approach.complexity.time / .space (shown in approaches table)
      if (!approach.complexity || typeof approach.complexity !== 'object') {
        issues.push(`⚠️  ${p}.complexity: MISSING`);
      } else {
        if (!approach.complexity.time) issues.push(`⚠️  ${p}.complexity.time: MISSING`);
        if (!approach.complexity.space) issues.push(`⚠️  ${p}.complexity.space: MISSING`);
      }

      // approach.title (shown in table row + section heading)
      if (!approach.title) issues.push(`⚠️  ${p}.title: MISSING`);

      // approach.summary (shown in table Notes column)
      if (!approach.summary) issues.push(`⚠️  ${p}.summary: MISSING`);

      // approach.description (shown in approach detail)
      if (!approach.description) issues.push(`⚠️  ${p}.description: MISSING`);

      // approach.steps[] (rendered as <ol> in Algorithm Steps section)
      if (!approach.steps || !Array.isArray(approach.steps) || approach.steps.length === 0) {
        issues.push(`⚠️  ${p}.steps: EMPTY or MISSING`);
      }

      // approach.visualization.svg (rendered in Visualization section)
      if (approach.visualization) {
        if (!approach.visualization.svg) issues.push(`ℹ️  ${p}.visualization.svg: MISSING`);
      }
    }
  }

  // defaultCode (loaded when user resets editor)
  if (!data.defaultCode || typeof data.defaultCode !== 'object' || Object.keys(data.defaultCode).length === 0) {
    issues.push('❌ defaultCode: EMPTY or MISSING');
  } else {
    const presentLangs = Object.keys(data.defaultCode);
    const missingLangs = REQUIRED_LANGUAGES.filter(l => !presentLangs.includes(l));
    if (missingLangs.length > 0) {
      issues.push(`⚠️  defaultCode: missing [${missingLangs.join(', ')}]`);
    }
    for (const [lang, code] of Object.entries(data.defaultCode)) {
      if (typeof code !== 'string') {
        issues.push(`❌ defaultCode.${lang}: NOT A STRING (type: ${typeof code})`);
      } else if (code.trim() === '') {
        issues.push(`❌ defaultCode.${lang}: EMPTY string`);
      }
    }
  }

  // testCases (used by Run button + paramOrder logic)
  if (!data.testCases || !Array.isArray(data.testCases) || data.testCases.length === 0) {
    issues.push('❌ testCases: EMPTY or MISSING');
  } else {
    for (let i = 0; i < data.testCases.length; i++) {
      const tc = data.testCases[i];
      if (tc.expected === undefined || tc.expected === null) {
        issues.push(`❌ testCases[${i}]: missing 'expected'`);
      }
      if (!tc.input || typeof tc.input !== 'object' || Object.keys(tc.input).length === 0) {
        issues.push(`❌ testCases[${i}]: missing or empty 'input'`);
      }
    }
  }

  // ─────────── WARNINGS (⚠️) - Incomplete sections ───────────

  // examples (shown in Examples tab + SQL test data)
  if (!data.examples || !Array.isArray(data.examples) || data.examples.length === 0) {
    issues.push('⚠️  examples: EMPTY or MISSING');
  }

  // constraints (rendered in Constraints section)
  if (!data.constraints || !Array.isArray(data.constraints) || data.constraints.length === 0) {
    issues.push('⚠️  constraints: EMPTY or MISSING');
  }

  // tags (shown as tag pills)
  if (!data.tags || !Array.isArray(data.tags) || data.tags.length === 0) {
    issues.push('⚠️  tags: EMPTY or MISSING');
  }

  // solutionSummary (shown in solution panel)
  if (!data.solutionSummary || (typeof data.solutionSummary === 'string' && data.solutionSummary.trim() === '')) {
    issues.push('⚠️  solutionSummary: EMPTY or MISSING');
  }

  // seo.description (meta tag)
  if (!data.seo || !data.seo.description) {
    issues.push('⚠️  seo.description: MISSING');
  }

  // difficulty / level
  if (!data.difficulty) issues.push('⚠️  difficulty: MISSING');

  // slug
  if (!data.slug) issues.push('⚠️  slug: MISSING');

  // paramOrder (only matters for multi-input problems)
  if (data.testCases && Array.isArray(data.testCases) && data.testCases.length > 0) {
    const firstInput = data.testCases[0].input;
    if (firstInput && typeof firstInput === 'object' && Object.keys(firstInput).length > 1) {
      if (!data.paramOrder || !Array.isArray(data.paramOrder) || data.paramOrder.length === 0) {
        issues.push('⚠️  paramOrder: MISSING (multi-input problem - order matters)');
      }
    }
  }

  // ─────────── INFO (ℹ️) - Nice to have ───────────

  // analogy (rendered in Analogy tab)
  if (!data.analogy || typeof data.analogy !== 'object') {
    issues.push('ℹ️  analogy: MISSING');
  }

  // visualize.svg (main problem visualization)
  if (!data.visualize || !data.visualize.svg) {
    issues.push('ℹ️  visualize.svg: MISSING');
  }

  // companies (company tag pills)
  if (!data.companies || !Array.isArray(data.companies) || data.companies.length === 0) {
    issues.push('ℹ️  companies: EMPTY');
  }

  // related (related problems links)
  if (!data.related || !Array.isArray(data.related) || data.related.length === 0) {
    issues.push('ℹ️  related: EMPTY');
  }

  // \r\n in description
  if (data.description && typeof data.description === 'string' && data.description.includes('\r\n')) {
    issues.push('⚠️  description: contains \\r\\n (carriage returns)');
  }

  return issues;
}

// ==================== SEVERITY ====================

function classifyProblem(issues) {
  const critical = issues.filter(i => i.startsWith('❌')).length;
  const warning = issues.filter(i => i.startsWith('⚠️')).length;
  if (critical > 0) return 'BROKEN';
  if (warning > 0) return 'INCOMPLETE';
  if (issues.length > 0) return 'MINOR';
  return 'HEALTHY';
}

// ==================== HELPERS ====================

function naturalSort(keys) {
  return keys.slice().sort((a, b) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function needsParamOrderFix(keys) {
  // Only fix if there are numbered params out of order (v1/v2, root1/root2, etc)
  const numbered = keys.filter(k => /\d+$/.test(k));
  if (numbered.length < 2) return false;
  const sorted = naturalSort(numbered);
  for (let i = 0; i < numbered.length; i++) {
    if (keys.indexOf(numbered[i]) !== keys.indexOf(sorted[i])) return true;
  }
  return false;
}

function getParamOrder(data) {
  if (!data.testCases || !Array.isArray(data.testCases) || data.testCases.length === 0) return null;
  const firstInput = data.testCases[0].input;
  if (!firstInput || typeof firstInput !== 'object' || Object.keys(firstInput).length === 0) return null;
  
  const inputKeys = Object.keys(firstInput);
  
  // Try to extract order from examples first (most reliable)
  if (data.examples && Array.isArray(data.examples) && data.examples.length > 0) {
    const exampleInput = data.examples[0].input;
    if (exampleInput && typeof exampleInput === 'string') {
      // Parse "s = \"ab\", t = 1, nums = [...]" → ["s", "t", "nums"]
      const matches = exampleInput.match(/(\w+)\s*=/g);
      if (matches) {
        const exampleOrder = matches.map(m => m.replace(/\s*=/, '').trim());
        // Verify all keys are present
        if (exampleOrder.length === inputKeys.length && 
            inputKeys.every(k => exampleOrder.includes(k))) {
          return exampleOrder;
        }
      }
    }
  }
  
  // Fallback: natural sort
  return naturalSort(inputKeys);
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || '';
  const param = args[1] || '';

  initFirebase();

  // Single problem audit
  if (cmd === '--slug' && param) {
    const doc = await db.collection(COLLECTION_NAME).doc(param).get();
    if (!doc.exists) {
      console.log(`❌ Problem not found: ${param}`);
      process.exit(1);
    }
    const data = doc.data();
    const issues = auditProblem(doc.id, data);
    const status = classifyProblem(issues);

    console.log(`\n🔍 Audit: ${doc.id} (${data.title || 'NO TITLE'})`);
    console.log(`   Status: ${status}`);
    if (issues.length === 0) {
      console.log('   ✅ No issues found');
    } else {
      issues.forEach(i => console.log(`   ${i}`));
    }
    process.exit(0);
  }

  // List problems with no test cases
  if (cmd === '--no-testcases') {
    console.log('📋 Problems with NO test cases:\n');

    const snapshot = await db.collection(COLLECTION_NAME)
      .where('problemType', '==', 'coding')
      .get();

    const missing = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.testCases || !Array.isArray(data.testCases) || data.testCases.length === 0) {
        missing.push({ id: doc.id, title: data.title || 'NO TITLE', difficulty: data.difficulty || '?' });
      }
    }

    missing.sort((a, b) => a.id.localeCompare(b.id));

    for (const p of missing) {
      console.log(`  📄 ${p.id} — ${p.title} [${p.difficulty}]`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Total without testCases: ${missing.length} / ${snapshot.docs.length}`);
    console.log(`${'='.repeat(60)}`);

    if (param === '--save') {
      fs.writeFileSync('no_testcases.txt', missing.map(p => p.id).join('\n') + '\n');
      console.log(`\n📄 Written to no_testcases.txt`);
    }

    process.exit(0);
  }

  // Fix paramOrder for all problems
  if (cmd === '--fix-paramorder') {
    console.log('🔧 Fixing paramOrder for all coding problems...\n');

    const snapshot = await db.collection(COLLECTION_NAME)
      .where('problemType', '==', 'coding')
      .get();

    let fixed = 0, skipped = 0, alreadySet = 0, noTestCases = 0;
    const dryRun = param !== '--apply';

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const computed = getParamOrder(data);

      if (!computed) {
        noTestCases++;
        continue;
      }

      const existing = data.paramOrder;
      const hasValid = existing && Array.isArray(existing) && existing.length > 0;

      // Check current key order (from existing paramOrder or from input keys)
      const currentKeys = hasValid ? existing : Object.keys(data.testCases[0].input);
      
      if (hasValid) {
        // Already has paramOrder - only fix if numbered params are misordered
        if (!needsParamOrderFix(currentKeys)) {
          alreadySet++;
          continue;
        }
        // Skip if computed order is same as existing
        if (JSON.stringify(existing) === JSON.stringify(computed)) {
          alreadySet++;
          continue;
        }
      } else {
        // No paramOrder - set it for any multi-input problem
        if (currentKeys.length <= 1) {
          skipped++;
          continue;
        }
      }

      if (dryRun) {
        if (hasValid) {
          console.log(`  📄 ${doc.id} → [${existing.join(', ')}] ⇒ [${computed.join(', ')}]`);
        } else {
          console.log(`  📄 ${doc.id} → paramOrder: [${computed.join(', ')}]`);
        }
      } else {
        await db.collection(COLLECTION_NAME).doc(doc.id).update({ paramOrder: computed });
        console.log(`  ✅ ${doc.id} → [${computed.join(', ')}]`);
      }
      fixed++;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 PARAMORDER FIX ${dryRun ? '(DRY RUN)' : 'APPLIED'}`);
    console.log(`  🔧 ${dryRun ? 'Would fix' : 'Fixed'}: ${fixed}`);
    console.log(`  ✅ Already set:  ${alreadySet}`);
    console.log(`  ⏭️  Single input: ${skipped}`);
    console.log(`  ❌ No testCases: ${noTestCases}`);
    console.log(`  📦 Total:        ${snapshot.docs.length}`);
    console.log(`${'='.repeat(60)}`);

    if (dryRun && fixed > 0) {
      console.log(`\n💡 Run with --fix-paramorder --apply to write to Firebase`);
    }

    process.exit(0);
  }

  // Full audit
  console.log('🔍 Auditing all coding problems...\n');

  const snapshot = await db.collection(COLLECTION_NAME)
    .where('problemType', '==', 'coding')
    .get();

  const results = { BROKEN: [], INCOMPLETE: [], MINOR: [], HEALTHY: [] };
  const fixList = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const issues = auditProblem(doc.id, data);
    const status = classifyProblem(issues);

    results[status].push({ id: doc.id, title: data.title || 'NO TITLE', issues });

    if (status === 'BROKEN') {
      fixList.push(doc.id);
    }
  }

  const total = snapshot.docs.length;

  console.log(`${'='.repeat(60)}`);
  console.log(`📊 AUDIT RESULTS — ${total} coding problems`);
  console.log(`${'='.repeat(60)}\n`);

  // BROKEN
  if (results.BROKEN.length > 0) {
    console.log(`🔴 BROKEN (${results.BROKEN.length}) — Critical fields missing:\n${'─'.repeat(60)}`);
    for (const p of results.BROKEN) {
      console.log(`\n  📄 ${p.id} — ${p.title}`);
      p.issues.filter(i => i.startsWith('❌')).forEach(i => console.log(`     ${i}`));
    }
    console.log('');
  }

  // INCOMPLETE
  if (results.INCOMPLETE.length > 0) {
    console.log(`🟡 INCOMPLETE (${results.INCOMPLETE.length}) — Warnings:\n${'─'.repeat(60)}`);
    for (const p of results.INCOMPLETE) {
      console.log(`\n  📄 ${p.id} — ${p.title}`);
      p.issues.filter(i => !i.startsWith('ℹ️')).forEach(i => console.log(`     ${i}`));
    }
    console.log('');
  }

  // MINOR
  if (results.MINOR.length > 0) {
    console.log(`🟢 MINOR (${results.MINOR.length}) — Nice to have:\n${'─'.repeat(60)}`);
    for (const p of results.MINOR) {
      console.log(`\n  📄 ${p.id} — ${p.title}`);
      p.issues.forEach(i => console.log(`     ${i}`));
    }
    console.log('');
  }

  // Summary
  console.log(`${'='.repeat(60)}`);
  console.log(`📋 SUMMARY`);
  console.log(`  🔴 BROKEN:     ${results.BROKEN.length}`);
  console.log(`  🟡 INCOMPLETE: ${results.INCOMPLETE.length}`);
  console.log(`  🟢 MINOR:      ${results.MINOR.length}`);
  console.log(`  ✅ HEALTHY:    ${results.HEALTHY.length}`);
  console.log(`  📦 TOTAL:      ${total}`);
  console.log(`${'='.repeat(60)}`);

  // Write fix list
  if ((cmd === '--fix-list' || cmd === '--fixlist') && fixList.length > 0) {
    fs.writeFileSync('fix_list.txt', fixList.join('\n') + '\n');
    console.log(`\n📄 Written ${fixList.length} broken slugs to fix_list.txt`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
