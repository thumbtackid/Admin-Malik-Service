export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM transactions ORDER BY tanggal DESC LIMIT 1000"
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
      "INSERT INTO transactions (transaksi_id, item, subtotal, diskon, total, kasir, nama_pelanggan, no_hp, alamat, tanggal, pickup, garansi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      data.id || data.transaksi_id,
      data.item || '',
      data.subtotal || data.total || 0,
      data.diskon || 0,
      data.total || 0,
      data.kasir || 'Admin',
      data.nama_pelanggan || data.nama || '',
      data.no_hp || '',
      data.alamat || '',
      data.tanggal || new Date().toISOString(),
      data.pickup ? 1 : 0,
      data.garansi ? 1 : 0
    ).run();
    
    return new Response(JSON.stringify({ success, id: data.id }), {
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

export async function onRequestPut(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    
    const { success } = await env.DB.prepare(
      "UPDATE transactions SET item = ?, total = ?, kasir = ?, nama_pelanggan = ? WHERE transaksi_id = ?"
    ).bind(
      data.item,
      data.total,
      data.kasir,
      data.nama_pelanggan,
      data.transaksi_id
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

export async function onRequestDelete(context) {
  const { request, env } = context;
  
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID diperlukan' }), { 
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    
    const { success } = await env.DB.prepare(
      "DELETE FROM transactions WHERE transaksi_id = ?"
    ).bind(id).run();
    
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
