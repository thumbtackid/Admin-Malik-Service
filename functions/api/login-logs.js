// ============================================
// API LOGIN LOGS - MALIK SERVICE
// ============================================

export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    // Ambil semua log login terbaru
    const { results } = await env.DB.prepare(
      "SELECT * FROM login_logs ORDER BY timestamp DESC LIMIT 500"
    ).all();
    
    return new Response(JSON.stringify(results), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  
  try {
    const data = await request.json();
    
    const timestamp = new Date().toISOString();
    const browser = data.browser || 'Unknown';
    const ip = data.ip || request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    
    // Simpan log login ke database
    const { success } = await env.DB.prepare(
      "INSERT INTO login_logs (username, role, ip, status, browser, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      data.username || 'unknown',
      data.role || 'unknown',
      ip,
      data.status || 'Unknown',
      browser,
      timestamp
    ).run();
    
    return new Response(JSON.stringify({ success, timestamp }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
