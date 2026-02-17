#!/usr/bin/env node

/**
 * Create Firestore composite indexes for jobs collection
 * Usage: node create_indexes.js
 */

const { GoogleAuth } = require('google-auth-library');
const SERVICE_ACCOUNT = require('./serviceAccountKey.json');

const PROJECT = SERVICE_ACCOUNT.project_id || 'examiners-app';
const DB = '(default)';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/collectionGroups/jobs/indexes`;

const INDEXES = [
  {
    name: 'status + postedTimestamp desc',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'postedTimestamp', order: 'DESCENDING' },
    ],
  },
  {
    name: 'status + category + postedTimestamp desc',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'category', order: 'ASCENDING' },
      { fieldPath: 'postedTimestamp', order: 'DESCENDING' },
    ],
  },
  {
    name: 'status + isRemote + postedTimestamp desc',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'isRemote', order: 'ASCENDING' },
      { fieldPath: 'postedTimestamp', order: 'DESCENDING' },
    ],
  },
];

async function main() {
  const auth = new GoogleAuth({
    credentials: SERVICE_ACCOUNT,
    scopes: ['https://www.googleapis.com/auth/datastore'],
  });
  const client = await auth.getClient();

  for (const idx of INDEXES) {
    console.log(`\n🔨 Creating index: ${idx.name}`);
    try {
      const res = await client.request({
        url: BASE,
        method: 'POST',
        data: {
          queryScope: 'COLLECTION',
          fields: idx.fields,
        },
      });
      console.log(`   ✅ Created! Operation: ${res.data.name || 'started'}`);
    } catch (err) {
      if (err.response?.data?.error?.message?.includes('already exists')) {
        console.log(`   ⏭️  Already exists, skipping.`);
      } else {
        console.error(`   ❌ Error:`, err.response?.data?.error?.message || err.message);
      }
    }
  }

  console.log(`\n✅ Done. Indexes take a few minutes to build.`);
  console.log(`   Check: https://console.firebase.google.com/project/${PROJECT}/firestore/indexes`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
