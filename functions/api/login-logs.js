export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM login_logs ORDER BY timestamp DESC LIMIT 500"
    ).all();
    
    return new Response(JSON.stringify(results), {
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

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    
    const timestamp = new Date().toISOString();
    const browser = data.browser || 'Unknown';
    
    const { success } = await env.DB.prepare(
      "INSERT INTO login_logs (username, role, ip, status, browser, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      data.username || 'unknown',
      data.role || 'unknown',
      data.ip || request.headers.get('CF-Connecting-IP') || 'unknown',
      data.status || 'Unknown',
      browser,
      timestamp
    ).run();
    
    return new Response(JSON.stringify({ success }), {
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
