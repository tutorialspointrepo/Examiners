/**
 * Validate ALL SQL problems using the SAME logic as PHP template / CodePractice
 * 
 * This mirrors exactly how the frontend creates tables, inserts data,
 * runs queries, and compares results — so if it passes here, it passes there.
 *
 * Usage:
 *   node validate_sql.js                    # Validate all SQL problems
 *   node validate_sql.js <problem_id>       # Validate one problem
 *   node validate_sql.js --failed           # Only validate failed/untested
 */

const admin = require('firebase-admin');
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
    projectId: FIREBASE_PROJECT_ID
  });
}
const db = admin.firestore();

// ==================== HELPERS (same as PHP template) ====================

function normalizeToArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    return Object.keys(data).sort((a, b) => Number(a) - Number(b)).map(key => data[key]);
  }
  return [];
}

// Only quote SQL identifiers when needed (starts with digit, contains spaces/special chars)
function quoteSqlName(name) {
  if (!name) return name;
  if (/^[0-9]/.test(name) || /[^a-zA-Z0-9_]/.test(name)) {
    return '"' + name + '"';
  }
  return name;
}

// Mirrors PHP template: type mapping (line 1760-1766)
function mapColumnType(type) {
  if (!type) return 'TEXT';
  let t = (type || 'TEXT').toUpperCase();
  if (t.includes('ENUM')) return 'TEXT';
  if (t.includes('BIGINT')) return 'BIGINT';
  else if (t.includes('INT')) return 'INTEGER';
  if (t.includes('VARCHAR')) return 'TEXT';
  if (t.includes('DECIMAL') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('NUMERIC')) return 'NUMERIC';
  if (t.includes('DATETIME') || t.includes('TIMESTAMP')) return 'TIMESTAMP';
  if (t.includes('DATE')) return 'DATE';
  if (t.includes('BOOL')) return 'BOOLEAN';
  return t;
}

// Mirrors PHP template: value formatting with boolean casting
function formatValue(val, colType) {
  if (val === null || val === undefined) return 'NULL';
  if (colType === 'BOOLEAN') {
    if (val === 1 || val === '1' || val === true || val === 'true') return 'TRUE';
    if (val === 0 || val === '0' || val === false || val === 'false') return 'FALSE';
  }
  if (typeof val === 'string') return "'" + val.replace(/'/g, "''") + "'";
  return String(val);
}

function getColType(schemas, tableName, colIndex, headerName) {
  const schema = schemas.find(s => s.tableName?.toLowerCase() === tableName?.toLowerCase()) || schemas[0];
  if (!schema) return null;
  const columns = normalizeToArray(schema.columns);
  const col = columns.find(c => c.name?.toLowerCase() === headerName?.toLowerCase()) || columns[colIndex];
  if (!col) return null;
  const type = (col.type || 'TEXT').toUpperCase();
  if (type.includes('BOOL')) return 'BOOLEAN';
  return type;
}

// Mirrors PHP template: compareValues (with Date fix)
function compareValues(actual, expected) {
  if (actual === null && expected === null) return true;
  if (actual === null || expected === null) return false;

  // Handle Date objects from PGlite
  let actualNorm = actual;
  let expectedNorm = expected;
  if (actual instanceof Date) actualNorm = actual.toISOString().split('T')[0];
  if (expected instanceof Date) expectedNorm = expected.toISOString().split('T')[0];

  const a = String(actualNorm).trim().toLowerCase();
  const e = String(expectedNorm).trim().toLowerCase();
  if (a === e) return true;

  const aNum = parseFloat(actualNorm);
  const eNum = parseFloat(expectedNorm);
  if (!isNaN(aNum) && !isNaN(eNum)) return Math.abs(aNum - eNum) < 0.0001;
  return false;
}

// Mirrors PHP template: compareSqlResults (line 2410+)
function compareSqlResults(actualHeaders, actualRows, expectedHeaders, expectedRows) {
  if (expectedRows.length === 0) {
    if (actualRows.length === 0) return { passed: true };
    return { passed: false, error: 'Expected 0 rows, got ' + actualRows.length };
  }
  if (actualRows.length === 0) {
    return { passed: false, error: 'Expected ' + expectedRows.length + ' rows, got 0' };
  }
  if (actualHeaders.length !== expectedHeaders.length) {
    return { passed: false, error: 'Column count: got ' + actualHeaders.length + ' (' + actualHeaders.join(',') + '), expected ' + expectedHeaders.length + ' (' + expectedHeaders.join(',') + ')' };
  }
  if (actualRows.length !== expectedRows.length) {
    return { passed: false, error: 'Row count: got ' + actualRows.length + ', expected ' + expectedRows.length };
  }

  const isFuncHeader = expectedHeaders.some(h => /^\w+\(.*\)$/.test(h));

  // Try ordered comparison first
  const orderedResult = compareRowsOrdered(actualHeaders, actualRows, expectedHeaders, expectedRows, isFuncHeader);
  if (orderedResult.passed) return orderedResult;

  // If ordered fails, try unordered (set) comparison for DISTINCT queries
  const unorderedResult = compareRowsUnordered(actualHeaders, actualRows, expectedHeaders, expectedRows, isFuncHeader);
  return unorderedResult;
}

function compareRowsOrdered(actualHeaders, actualRows, expectedHeaders, expectedRows, isFuncHeader) {
  for (let i = 0; i < expectedRows.length; i++) {
    const expectedRow = expectedRows[i];
    const actualRow = actualRows[i];

    for (let j = 0; j < expectedHeaders.length; j++) {
      const expectedVal = expectedRow['i' + j];
      let actualVal;

      if (isFuncHeader) {
        actualVal = actualRow[actualHeaders[j]];
      } else {
        const headerName = expectedHeaders[j];
        const actualKey = actualHeaders.find(h => h.toLowerCase() === headerName.toLowerCase()) || actualHeaders[j];
        actualVal = actualRow[actualKey];
      }

      if (!compareValues(actualVal, expectedVal)) {
        return { passed: false, error: 'Row ' + (i + 1) + ', col ' + j + ' (' + expectedHeaders[j] + '): got "' + actualVal + '", expected "' + expectedVal + '"' };
      }
    }
  }
  return { passed: true };
}

function compareRowsUnordered(actualHeaders, actualRows, expectedHeaders, expectedRows, isFuncHeader) {
  function rowKey(row, headers, isActual) {
    return headers.map((h, j) => {
      let val;
      if (isActual) {
        if (isFuncHeader) {
          val = row[headers[j]];
        } else {
          const actualKey = Object.keys(row).find(k => k.toLowerCase() === expectedHeaders[j].toLowerCase()) || headers[j];
          val = row[actualKey];
        }
      } else {
        val = row['i' + j];
      }
      if (val === null || val === undefined) return 'NULL';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return String(val).trim().toLowerCase();
    }).join('|');
  }

  const actualKeys = actualRows.map(r => rowKey(r, actualHeaders, true)).sort();
  const expectedKeys = expectedRows.map(r => rowKey(r, expectedHeaders, false)).sort();

  for (let i = 0; i < expectedKeys.length; i++) {
    if (actualKeys[i] !== expectedKeys[i]) {
      return { passed: false, error: 'Row mismatch (unordered): expected row with values [' + expectedKeys[i] + '] not found' };
    }
  }
  return { passed: true };
}

// Detect CREATE FUNCTION
function detectFunctionSql(query) {
  const match = query.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)\s*\(([^)]*)\)/i);
  if (!match) return { isFunction: false };
  const funcName = match[1];
  const params = match[2].trim();
  const hasParams = params.length > 0;
  return { isFunction: true, functionName: funcName, hasParams };
}

// ==================== CORE TEST RUNNER ====================

async function runTestCase(pglite, schemas, sql, example) {
  // Build schema name lookup (lowercase → actual created name)
  const schemaNameMap = {};
  for (const s of schemas) {
    if (s.tableName) schemaNameMap[s.tableName.toLowerCase()] = s.tableName;
  }

  // Step 1: Truncate all tables
  for (const schema of schemas) {
    const tableName = schema?.tableName || 'Table';
    try { await pglite.query('DELETE FROM ' + quoteSqlName(tableName)); } catch (e) {}
  }

  // Helper: resolve example table name to actual schema table name
  function resolveTableName(exName) {
    if (!exName) return schemas[0]?.tableName || 'Table';
    if (schemaNameMap[exName.toLowerCase()]) return schemaNameMap[exName.toLowerCase()];
    const lower = exName.toLowerCase();
    const schemaNames = Object.values(schemaNameMap);
    const fuzzy = schemaNames.find(s => {
      const sl = s.toLowerCase();
      return sl.startsWith(lower.substring(0, 4)) || lower.startsWith(sl.substring(0, 4));
    });
    return fuzzy || exName;
  }

  // Step 2: Insert test data
  const input = example.input;
  try {
    if (input?.tables) {
      const tables = normalizeToArray(input.tables);
      for (const tableData of tables) {
        const tableName = resolveTableName(tableData.name);
        const headers = normalizeToArray(tableData.headers);
        const rows = normalizeToArray(tableData.rows);
        for (const row of rows) {
          const vals = headers.map((h, i) => formatValue(row['i' + i], getColType(schemas, tableName, i, h)));
          const quotedHeaders = headers.map(h => quoteSqlName(h)).join(', ');
          await pglite.query('INSERT INTO ' + quoteSqlName(tableName) + ' (' + quotedHeaders + ') VALUES (' + vals.join(', ') + ')');
        }
      }
    } else if (input?.headers && input?.rows) {
      const tableName = schemas[0]?.tableName || 'Table';
      const headers = normalizeToArray(input.headers);
      const rows = normalizeToArray(input.rows);
      for (const row of rows) {
        const vals = headers.map((h, i) => formatValue(row['i' + i], getColType(schemas, tableName, i, h)));
        const quotedHeaders = headers.map(h => quoteSqlName(h)).join(', ');
        await pglite.query('INSERT INTO ' + quoteSqlName(tableName) + ' (' + quotedHeaders + ') VALUES (' + vals.join(', ') + ')');
      }
    }
  } catch (e) {
    return { passed: false, error: null, sqlError: 'INSERT failed: ' + e.message };
  }

  // Step 3: Run query
  const expectedHeaders = normalizeToArray(example.output?.headers);
  const expectedRows = normalizeToArray(example.output?.rows);

  try {
    let actualRows = [];
    let actualHeaders = [];
    const query = sql.trim();

    // Unwrap if SQL is wrapped in SELECT * FROM (...)
    let cleanQuery = query;
    if (/^SELECT\s+\*\s+FROM\s+\(/i.test(cleanQuery)) {
      const unwrapped = cleanQuery.replace(/^SELECT\s+\*\s+FROM\s+\(/i, '').replace(/\)\s*(__\w+)?\s*(ORDER\s+BY[^;]*)?\s*;?\s*$/i, '');
      if (/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i.test(unwrapped) || /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE/i.test(unwrapped)) {
        cleanQuery = unwrapped.trim();
      }
    }

    const funcInfo = detectFunctionSql(cleanQuery);

    if (funcInfo.isFunction) {
      try { await pglite.query('DROP FUNCTION IF EXISTS ' + funcInfo.functionName + ' CASCADE'); } catch (e) {}
      await pglite.query(cleanQuery);
      
      let callQuery;
      if (funcInfo.hasParams) {
        const inputData = example.input;
        let paramVal = null;
        if (inputData?.N !== undefined) paramVal = inputData.N;
        else if (inputData?.n !== undefined) paramVal = inputData.n;
        else if (inputData?.param !== undefined) paramVal = inputData.param;
        if (paramVal === null) {
          for (const [k, v] of Object.entries(inputData || {})) {
            if (k !== 'headers' && k !== 'rows' && k !== 'tables' && typeof v === 'number') {
              paramVal = v; break;
            }
          }
        }
        callQuery = 'SELECT * FROM ' + funcInfo.functionName + '(' + (paramVal !== null ? paramVal : 1) + ')';
      } else {
        callQuery = 'SELECT * FROM ' + funcInfo.functionName + '()';
      }
      const result = await pglite.query(callQuery);
      actualRows = result.rows || [];
    } else if (/^\s*UPDATE\b/i.test(query)) {
      await pglite.query(cleanQuery);
      const schema = schemas[0];
      const tableName = schema?.tableName || 'Table';
      const selectCols = expectedHeaders.length > 0 ? expectedHeaders.join(', ') : '*';
      const orderCol = expectedHeaders[0] || normalizeToArray(schema?.columns)?.[0]?.name || 'id';
      const result = await pglite.query('SELECT ' + selectCols + ' FROM ' + tableName + ' ORDER BY ' + orderCol);
      actualRows = result.rows || [];
    } else if (/^\s*DELETE\b/i.test(query)) {
      await pglite.query(cleanQuery);
      const schema = schemas[0];
      const tableName = schema?.tableName || 'Table';
      const selectCols = expectedHeaders.length > 0 ? expectedHeaders.join(', ') : '*';
      const orderCol = expectedHeaders[0] || normalizeToArray(schema?.columns)?.[0]?.name || 'id';
      const result = await pglite.query('SELECT ' + selectCols + ' FROM ' + tableName + ' ORDER BY ' + orderCol);
      actualRows = result.rows || [];
    } else if (/CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE/i.test(cleanQuery)) {
      const procMatch = cleanQuery.match(/CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+(\w+)/i);
      const procName = procMatch ? procMatch[1] : 'unknown';
      try { await pglite.query('DROP FUNCTION IF EXISTS ' + procName + ' CASCADE'); } catch (e) {}
      try { await pglite.query('DROP VIEW IF EXISTS __pivot_result CASCADE'); } catch (e) {}
      try { await pglite.query('DROP TABLE IF EXISTS __pivot_result CASCADE'); } catch (e) {}
      try { await pglite.query('DROP VIEW IF EXISTS unpivoted_products CASCADE'); } catch (e) {}
      try { await pglite.query('DROP VIEW IF EXISTS pivot_result CASCADE'); } catch (e) {}
      await pglite.query(cleanQuery);
      await pglite.query('CALL ' + procName + '()');
      let gotResult = false;
      if (!gotResult) {
        try { const r = await pglite.query('SELECT * FROM __pivot_result ORDER BY 1'); actualRows = r.rows || []; gotResult = true; } catch (e) {}
      }
      if (!gotResult) {
        try { const r = await pglite.query('SELECT * FROM unpivoted_products ORDER BY 1'); actualRows = r.rows || []; gotResult = true; } catch (e) {}
      }
      if (!gotResult) {
        try { const r = await pglite.query('SELECT * FROM pivot_result ORDER BY 1'); actualRows = r.rows || []; gotResult = true; } catch (e) {}
      }
      if (!gotResult) {
        const schema = schemas[0];
        const tableName = schema?.tableName || 'Table';
        try { const r = await pglite.query('SELECT * FROM ' + quoteSqlName(tableName) + ' ORDER BY 1'); actualRows = r.rows || []; } catch (e) {}
      }
    } else {
      const result = await pglite.query(query);
      actualRows = result.rows || [];
    }

    actualHeaders = actualRows.length > 0 ? Object.keys(actualRows[0]) : [];

    // Step 4: Compare
    const cmp = compareSqlResults(actualHeaders, actualRows, expectedHeaders, expectedRows);
    return { ...cmp, sqlError: null };

  } catch (e) {
    return { passed: false, error: null, sqlError: e.message };
  }
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const singleId = args.find(a => !a.startsWith('--'));
  const failedOnly = args.includes('--failed');
  const applyResults = args.includes('--apply');

  const { PGlite } = await import('@electric-sql/pglite');

  // Fetch problems
  let problems;
  if (singleId) {
    const doc = await db.collection(COLLECTION_NAME).doc(singleId).get();
    if (!doc.exists) { console.log('❌ Not found: ' + singleId); process.exit(1); }
    problems = [{ id: doc.id, ...doc.data() }];
  } else {
    const snap = await db.collection(COLLECTION_NAME).where('problemType', '==', 'sql').get();
    const all = []; snap.forEach(doc => all.push({ id: doc.id, ...doc.data() }));
    problems = failedOnly ? all.filter(p => p.tests_passed !== true) : all;
    problems.sort((a, b) => a.id.localeCompare(b.id));
  }

  console.log('🔍 Validating ' + problems.length + ' SQL problems (mirroring PHP template logic)\n');
  console.log('═'.repeat(70));

  let totalPassed = 0, totalFailed = 0, totalErrors = [];

  for (let pi = 0; pi < problems.length; pi++) {
    const p = problems[pi];
    const examples = normalizeToArray(p.examples);
    const approaches = p.approaches || {};
    const tableSchema = p.tableSchema;

    if (!tableSchema || examples.length === 0) {
      console.log('[' + (pi + 1) + '/' + problems.length + '] ⏭️  ' + p.id + ' — no schema/examples');
      continue;
    }

    // *** CRITICAL FIX: Firestore stores arrays as maps with numeric keys ***
    // Array.isArray() returns false for Firestore array-maps like {0: {...}, 1: {...}}
    // Detect single schema by checking for 'tableName' property directly on tableSchema
    let schemas;
    if (tableSchema.tableName) {
      schemas = [tableSchema];
    } else if (Array.isArray(tableSchema)) {
      schemas = tableSchema;
    } else {
      schemas = normalizeToArray(tableSchema);
    }

    if (schemas.length === 0 || !schemas[0]?.tableName) {
      console.log('[' + (pi + 1) + '/' + problems.length + '] ⏭️  ' + p.id + ' — invalid schema');
      continue;
    }

    // Check if this problem has dynamic schema (columns vary per example)
    const hasDynamicSchema = schemas.length === 1 && schemas[0]?.notes?.toLowerCase().includes('dynamic');

    // Create PGlite instance
    let pglite;
    if (!hasDynamicSchema) {
      try {
        pglite = new PGlite();
        for (const schema of schemas) {
          let columns = normalizeToArray(schema.columns);
          if (columns.length === 0) continue;
          const tableName = schema.tableName || 'Table';
          const seen = new Set();
          const dedupedCols = [];
          for (const col of columns) {
            if (!seen.has(col.name)) { seen.add(col.name); dedupedCols.push(col); }
          }
          const colDefs = dedupedCols.map(col => quoteSqlName(col.name) + ' ' + mapColumnType(col.type)).join(', ');
          await pglite.query('CREATE TABLE IF NOT EXISTS ' + quoteSqlName(tableName) + ' (' + colDefs + ')');
        }
      } catch (e) {
        console.log('[' + (pi + 1) + '/' + problems.length + '] ❌ ' + p.id + ' — PGlite init: ' + e.message);
        totalFailed++;
        totalErrors.push({ id: p.id, error: 'PGlite init: ' + e.message });
        try { if (pglite) await pglite.close(); } catch (e2) {}
        continue;
      }
    }

    // Test each approach against each example
    let problemPassed = true;
    const failedDetails = [];

    try {
      for (const [approach, data] of Object.entries(approaches)) {
        const sql = data.code?.sql;
        if (!sql || sql.trim().startsWith('-- Write your SQL')) continue;

        for (let ei = 0; ei < examples.length; ei++) {
          let exPglite = pglite;
          
          if (hasDynamicSchema) {
            exPglite = new PGlite();
            const ex = examples[ei];
            const input = ex.input;
            const tableName = schemas[0]?.tableName || 'Products';
            let inputHeaders;
            if (input?.tables) {
              const tables = normalizeToArray(input.tables);
              inputHeaders = normalizeToArray(tables[0]?.headers);
            } else {
              inputHeaders = normalizeToArray(input?.headers);
            }
            if (inputHeaders.length > 0) {
              const colDefs = inputHeaders.map(h => quoteSqlName(h) + ' INTEGER').join(', ');
              await exPglite.query('CREATE TABLE IF NOT EXISTS ' + quoteSqlName(tableName) + ' (' + colDefs + ')');
            }
          }
          
          const result = await runTestCase(exPglite, schemas, sql, examples[ei]);
          
          if (hasDynamicSchema) {
            try { await exPglite.close(); } catch (e) {}
          }
          
          if (!result.passed) {
            problemPassed = false;
            failedDetails.push('  ❌ ' + approach + '/Ex' + (ei + 1) + ': ' + (result.sqlError || result.error));
          }
        }
      }
    } catch (e) {
      problemPassed = false;
      failedDetails.push('  ❌ Unexpected: ' + e.message);
    }

    if (!hasDynamicSchema) {
      try { await pglite.close(); } catch (e) {}
    }

    if (problemPassed) {
      totalPassed++;
      if (singleId) {
        console.log('[' + (pi + 1) + '/' + problems.length + '] ✅ ' + p.id);
      }
      if (applyResults && !p.tests_passed) {
        try {
          await db.collection(COLLECTION_NAME).doc(p.id).update({
            tests_passed: true,
            tests_validated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) {}
      }
    } else {
      totalFailed++;
      console.log('[' + (pi + 1) + '/' + problems.length + '] ❌ ' + p.id);
      failedDetails.forEach(d => console.log(d));
      totalErrors.push({ id: p.id, details: failedDetails });
      if (applyResults && p.tests_passed) {
        try {
          await db.collection(COLLECTION_NAME).doc(p.id).update({
            tests_passed: false,
            tests_validated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) {}
      }
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('📊 RESULTS: ✅ ' + totalPassed + ' passed | ❌ ' + totalFailed + ' failed | Total: ' + (totalPassed + totalFailed));

  if (totalErrors.length > 0) {
    console.log('\n❌ FAILING PROBLEMS:');
    totalErrors.forEach(e => {
      console.log('  • ' + e.id + (e.error ? ' — ' + e.error : ''));
      if (e.details) e.details.forEach(d => console.log('  ' + d));
    });
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
