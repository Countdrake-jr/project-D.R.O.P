// Firebase Admin SDK — quick connectivity test for Project D.R.O.P.
// Run with: node test-firebase.js

const https = require('https');

const DB_URL = 'https://project-drop-3684a-default-rtdb.firebaseio.com';
const API_KEY = 'AIzaSyA6fIzONckvCrbpGNCpNGOXiUL1B4F5p9k';

// Read the full database root (public read rules assumed)
function fetchPath(path) {
  return new Promise((resolve, reject) => {
    const url = `${DB_URL}${path}.json?auth=${API_KEY}`;
    console.log(`\n📡 Fetching: ${DB_URL}${path}.json`);
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Project D.R.O.P. — Firebase DB Test');
  console.log('═══════════════════════════════════════════');

  // 1. Try the configured sensor path
  const sensorResult = await fetchPath('/sensors/latest');
  console.log(`\nStatus: ${sensorResult.status}`);
  console.log('Data at /sensors/latest:');
  console.log(JSON.stringify(sensorResult.data ?? sensorResult.raw, null, 2));

  // 2. Try the root to see ALL paths in the database
  const rootResult = await fetchPath('/');
  console.log('\n───────────────────────────────────────────');
  console.log('Full database root structure:');
  if (rootResult.data === null) {
    console.log('  ⚠️  Root is NULL — database is empty or rules block access.');
  } else {
    console.log(JSON.stringify(rootResult.data, null, 2));
  }

  // 3. Try /sensors path
  const sensorsResult = await fetchPath('/sensors');
  console.log('\n───────────────────────────────────────────');
  console.log('Data at /sensors:');
  console.log(JSON.stringify(sensorsResult.data ?? sensorsResult.raw, null, 2));

  console.log('\n═══════════════════════════════════════════');
  console.log('  Done!');
  console.log('═══════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Error:', err.message);
});
