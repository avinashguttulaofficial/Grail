import fs from 'fs';
import path from 'path';
const token = '';
const projectRef = '';

async function executeSql() {
  const sqlPath = path.resolve(process.cwd(), 'supabase/schema.sql');
  const query = fs.readFileSync(sqlPath, 'utf8');

  console.log('Sending schema.sql to Supabase Management API...');
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const responseText = await res.text();
  console.log(`Status: ${res.status} ${res.statusText}`);
  try {
    const json = JSON.parse(responseText);
    console.log('Response:', JSON.stringify(json, null, 2).slice(0, 500));
  } catch {
    console.log('Response text:', responseText.slice(0, 500));
  }
}

executeSql().catch(console.error);
