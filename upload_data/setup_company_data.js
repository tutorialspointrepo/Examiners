/**
 * Firestore Setup Script - Companies Only
 * 1. Creates 'companies' collection with aggregated problem counts
 * 2. Creates 'all' company containing ALL problems for the "All Problems" page
 * 
 * Usage: node setup_company_data.js
 * 
 * Note: For topics, use setup_topic_data.js separately
 */

const admin = require('firebase-admin');
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
    projectId: FIREBASE_PROJECT_ID
  });
}
const db = admin.firestore();

async function createCompaniesCollection() {
  console.log('========================================');
  console.log('📊 Creating Companies Collection');
  console.log('========================================\n');

  // Fetch all problems
  console.log('📥 Fetching all problems...');
  const problemsSnapshot = await db.collection('problems').get();
  console.log(`   Found ${problemsSnapshot.size} problems\n`);

  // Aggregate by company
  const companiesMap = {};

  // Initialize "all" company to hold ALL problems
  companiesMap['all'] = {
    id: 'all',
    name: 'All',
    count: 0,
    problems: [],
    difficultyCounts: { Easy: 0, Medium: 0, Hard: 0 },
    topicCounts: {}
  };

  problemsSnapshot.forEach(doc => {
    const data = doc.data();
    const companies = data.companies || [];
    const problemInfo = {
      id: doc.id,
      slug: data.slug || doc.id,
      title: data.title || '',
      difficulty: data.difficulty || 'Medium',
      topics: data.tags || data.topics || []
    };

    // Add to "all" company (every problem goes here)
    companiesMap['all'].count++;
    companiesMap['all'].problems.push(problemInfo);
    
    const diff = problemInfo.difficulty || 'Medium';
    if (companiesMap['all'].difficultyCounts[diff] !== undefined) {
      companiesMap['all'].difficultyCounts[diff]++;
    }
    
    (problemInfo.topics || []).forEach(topic => {
      companiesMap['all'].topicCounts[topic] = (companiesMap['all'].topicCounts[topic] || 0) + 1;
    });

    // Add to specific companies
    companies.forEach(company => {
      const companyName = typeof company === 'string' ? company : company.name;
      if (!companyName) return;

      const companyKey = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      
      if (!companiesMap[companyKey]) {
        companiesMap[companyKey] = {
          id: companyKey,
          name: companyName,
          count: 0,
          problems: [],
          difficultyCounts: { Easy: 0, Medium: 0, Hard: 0 },
          topicCounts: {}
        };
      }

      companiesMap[companyKey].count++;
      companiesMap[companyKey].problems.push(problemInfo);
      
      // Count by difficulty
      if (companiesMap[companyKey].difficultyCounts[diff] !== undefined) {
        companiesMap[companyKey].difficultyCounts[diff]++;
      }

      // Count by topic
      (problemInfo.topics || []).forEach(topic => {
        companiesMap[companyKey].topicCounts[topic] = (companiesMap[companyKey].topicCounts[topic] || 0) + 1;
      });
    });
  });

  const companies = Object.values(companiesMap);
  console.log(`📊 Found ${companies.length} companies (including "all")\n`);

  // Print "all" company stats
  const allCompany = companiesMap['all'];
  console.log('────────────────────────────────────────');
  console.log('📋 "All" Company Stats:');
  console.log('────────────────────────────────────────');
  console.log(`   Total Problems: ${allCompany.count}`);
  console.log(`   Easy: ${allCompany.difficultyCounts.Easy}`);
  console.log(`   Medium: ${allCompany.difficultyCounts.Medium}`);
  console.log(`   Hard: ${allCompany.difficultyCounts.Hard}`);
  console.log(`   Unique Topics: ${Object.keys(allCompany.topicCounts).length}`);
  console.log('────────────────────────────────────────\n');

  // Upload to Firestore in batches
  console.log('📤 Uploading companies collection...');
  
  const BATCH_SIZE = 400;
  let uploaded = 0;

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = companies.slice(i, i + BATCH_SIZE);

    chunk.forEach(company => {
      // Create main company doc (without full problems array for fast queries)
      const companyDoc = {
        id: company.id,
        name: company.name,
        count: company.count,
        difficultyCounts: company.difficultyCounts,
        topicCounts: company.topicCounts,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = db.collection('companies').doc(company.id);
      batch.set(docRef, companyDoc, { merge: true });
    });

    await batch.commit();
    uploaded += chunk.length;
    console.log(`   ✅ Uploaded ${uploaded}/${companies.length} companies`);
  }

  // Now create company_problems subcollection for pagination
  console.log('\n📤 Creating company_problems for fast pagination...');
  
  let problemsUploaded = 0;
  const totalProblems = companies.reduce((sum, c) => sum + c.problems.length, 0);

  for (const company of companies) {
    // Upload problems in batches
    for (let i = 0; i < company.problems.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = company.problems.slice(i, i + BATCH_SIZE);

      chunk.forEach((problem, idx) => {
        const docRef = db.collection('companies').doc(company.id)
          .collection('problems').doc(problem.id);
        
        batch.set(docRef, {
          ...problem,
          companyId: company.id,
          companyName: company.name
        }, { merge: true });
      });

      await batch.commit();
      problemsUploaded += chunk.length;
    }
    
    process.stdout.write(`\r   ✅ Uploaded ${problemsUploaded}/${totalProblems} company-problem links`);
  }

  console.log('\n');
  
  // Print top companies (excluding "all")
  console.log('────────────────────────────────────────');
  console.log('🏆 Top 20 Companies by Problem Count:');
  console.log('────────────────────────────────────────');
  
  const sorted = companies
    .filter(c => c.id !== 'all')
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  sorted.forEach((c, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${c.name.padEnd(20)} ${c.count} problems`);
  });

  return companies;
}

async function verifySetup() {
  console.log('\n========================================');
  console.log('🔍 Verifying Setup');
  console.log('========================================\n');

  // Test "all" company
  console.log('🔍 Verifying "all" company...');
  const allDoc = await db.collection('companies').doc('all').get();
  if (allDoc.exists) {
    const data = allDoc.data();
    console.log(`✅ "all" company found with ${data.count} problems`);
    console.log(`   Easy: ${data.difficultyCounts.Easy}, Medium: ${data.difficultyCounts.Medium}, Hard: ${data.difficultyCounts.Hard}`);
  } else {
    console.log(`❌ "all" company not found!`);
  }

  // Test "all" problems subcollection
  console.log('\n🔍 Verifying "all" problems subcollection...');
  const allProblems = await db.collection('companies').doc('all').collection('problems').limit(5).get();
  console.log(`✅ Found ${allProblems.size} problems in "all" subcollection (showing first 5)`);
  allProblems.forEach(doc => {
    console.log(`   • ${doc.data().title}`);
  });

  // Test a specific company
  console.log('\n🔍 Verifying "google" company...');
  const googleDoc = await db.collection('companies').doc('google').get();
  if (googleDoc.exists) {
    const data = googleDoc.data();
    console.log(`✅ "google" company found with ${data.count} problems`);
  } else {
    console.log(`⚠️  "google" company not found`);
  }
}

async function main() {
  try {
    await createCompaniesCollection();
    await verifySetup();
    
    console.log('\n========================================');
    console.log('✅ Companies Setup Complete!');
    console.log('========================================');
    console.log('\n📚 Collections created:');
    console.log('   • companies - Company list with counts (includes "all")');
    console.log('   • companies/{id}/problems - Problems per company for pagination');
    console.log('   • companies/all - Special company containing ALL problems');
    console.log('   • companies/all/problems - All problems for "All Problems" page');
    console.log('\n🔍 Fast queries available:');
    console.log('   • Get company: db.collection("companies").doc("google")');
    console.log('   • Get ALL stats: db.collection("companies").doc("all")');
    console.log('   • Get company problems: db.collection("companies").doc("google").collection("problems")');
    console.log('   • Get ALL problems: db.collection("companies").doc("all").collection("problems")');
    console.log('\n💡 Note: Run setup_topic_data.js separately for topics collection.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
