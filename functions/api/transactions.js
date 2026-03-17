// ============================================
// API TRANSACTIONS - MALIK SERVICE
// ============================================

export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    // Ambil semua transaksi terbaru
    const { results } = await env.DB.prepare(
      "SELECT * FROM transactions ORDER BY tanggal DESC LIMIT 1000"
    ).all();
    
    return new Response(JSON.stringify(results), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
  
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  
  try {
    const data = await request.json();
    
    // Generate ID transaksi unik
    const transaksiId = data.id || data.transaksi_id || 'TRX-' + Date.now().toString().slice(-8) + '-' + Math.random().toString(36).substring(2,5).toUpperCase();
    const tanggal = data.tanggal || new Date().toISOString();
    
    // Simpan transaksi ke database
    const { success } = await env.DB.prepare(
      "INSERT INTO transactions (transaksi_id, item, subtotal, diskon, total, kasir, nama_pelanggan, no_hp, alamat, tanggal, pickup, garansi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      transaksiId,
      typeof data.item === 'string' ? data.item : (data.item ? JSON.stringify(data.item) : ''),
      data.subtotal || data.total || 0,
      data.diskon || 0,
      data.total || 0,
      data.kasir || 'Admin',
      data.nama_pelanggan || data.nama || '',
      data.no_hp || '',
      data.alamat || '',
      tanggal,
      data.pickup ? 1 : 0,
      data.garansi ? 1 : 0
    ).run();
    
    return new Response(JSON.stringify({ success, id: transaksiId }), {
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
    
    // Update transaksi
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
    
    // Hapus transaksi
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

export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
