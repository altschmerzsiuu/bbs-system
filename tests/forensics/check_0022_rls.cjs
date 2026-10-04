const fetch = require('node-fetch'); // If not available, use dynamic import or native fetch (Node 18+)

async function checkRLS() {
  const token = process.env.PAT;
  const projectRef = 'jfbcfzhnffvgpgvebzob';
  
  // Actually, we can run a direct SQL query via Management API
  const query = "SELECT polname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'membership_applications';";
  
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  
  if (!res.ok) {
    console.error('Failed:', await res.text());
    return;
  }
  
  const data = await res.json();
  console.log('POLICIES:', JSON.stringify(data, null, 2));
}

checkRLS();
