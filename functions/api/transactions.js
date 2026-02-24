export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM transactions ORDER BY tanggal DESC LIMIT 100"
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
    
    const { success } = await env.DB.prepare(
      "INSERT INTO transactions (transaksi_id, item, total, kasir, nama_pelanggan) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      data.id, 
      data.item, 
      data.total, 
      data.kasir, 
      data.nama
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