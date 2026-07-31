const http = require('http');

async function run() {
  console.log("1. Registering user...");
  try {
    const emailToUse = `test${Date.now()}@example.com`;
    const regRes = await fetch('http://localhost:5000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailToUse, password: 'StrongPass123!' })
    });
    const regData = await regRes.json();
    console.log("Register Response:", regData);

    console.log("2. Logging in...");
    const loginRes = await fetch('http://localhost:5000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailToUse, password: 'StrongPass123!' })
    });
    
    // Fetch API returns multiple set-cookie headers as a single comma-separated string,
    // or we can just iterate. We can just use the raw get() in Node 18+.
    const cookies = loginRes.headers.get('set-cookie');
    if (!cookies) {
      console.log("Login failed or no cookies set.");
      return;
    }
    
    // Simple parse for access token
    const accessTokenStr = cookies.split(',').find(c => c.trim().startsWith('accessToken='));
    const cookieHeader = accessTokenStr ? accessTokenStr.split(';')[0].trim() : '';

    console.log("3. Creating workspace...");
    const wsRes = await fetch('http://localhost:5000/workspaces', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({ name: "My First Workspace" })
    });
    const wsData = await wsRes.json();
    
    console.log("\n=============================================");
    console.log("🎉 BERHASIL! Workspace dibuat.");
    console.log("WORKSPACE ID ANDA:", wsData._id);
    console.log(`Buka URL ini di browser Anda: http://localhost:5000/workspaces/${wsData._id}/twitter/login`);
    console.log("=============================================\n");

  } catch (error) {
    console.error("Error:", error.message);
  }
}

run();
