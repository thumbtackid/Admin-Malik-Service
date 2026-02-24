export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM login_logs ORDER BY timestamp DESC LIMIT 100"
    ).all();
    
    return new Response(JSON.stringify(results), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500 
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    
    const { success } = await env.DB.prepare(
      "INSERT INTO login_logs (username, role, ip, status) VALUES (?, ?, ?, ?)"
    ).bind(
      data.username,
      data.role,
      data.ip || 'unknown',
      data.status
    ).run();
    
    return new Response(JSON.stringify({ success }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500 
    });
  }
}