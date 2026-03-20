// ============================================
// API TRANSACTIONS - MALIK SERVICE
// ============================================

// Headers CORS yang konsisten
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// Handler utama
export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  
  try {
    // Cek koneksi database
    if (!env || !env.DB) {
      throw new Error('Database tidak terhubung');
    }
    
    // Routing berdasarkan method
    if (request.method === 'GET') {
      return await handleGET(env);
    }
    
    if (request.method === 'POST') {
      return await handlePOST(request, env);
    }
    
    if (request.method === 'PUT') {
      return await handlePUT(request, env);
    }
    
    if (request.method === 'DELETE') {
      return await handleDELETE(request, env);
    }
    
    return new Response(JSON.stringify({ error: 'Method tidak diizinkan' }), { 
      status: 405, 
      headers 
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}

// GET - Ambil semua transaksi
async function handleGET(env) {
  try {
    // Cek apakah tabel ada
    const tableCheck = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'"
    ).first();
    
    // Buat tabel jika belum ada
    if (!tableCheck) {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaksi_id TEXT UNIQUE,
          item TEXT,
          subtotal INTEGER DEFAULT 0,
          diskon INTEGER DEFAULT 0,
          total INTEGER DEFAULT 0,
          kasir TEXT,
          nama_pelanggan TEXT,
          no_hp TEXT,
          alamat TEXT,
          tanggal TEXT,
          pickup INTEGER DEFAULT 0,
          garansi INTEGER DEFAULT 0
        )
      `).run();
    }
    
    // Ambil semua transaksi
    const { results } = await env.DB.prepare(
      "SELECT * FROM transactions ORDER BY tanggal DESC LIMIT 1000"
    ).all();
    
    return new Response(JSON.stringify(results), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}

// POST - Simpan transaksi baru
async function handlePOST(request, env) {
  try {
    const data = await request.json();
    
    // Generate ID transaksi
    const transaksiId = data.transaksi_id || 
                       data.id || 
                       'TRX-' + Date.now().toString().slice(-6) + 
                       Math.random().toString(36).substring(2, 5).toUpperCase();
    
    const tanggal = data.tanggal || new Date().toISOString();
    
    // Proses item
    let itemString = '';
    if (Array.isArray(data.item)) {
      itemString = data.item.join(', ');
    } else if (typeof data.item === 'string') {
      itemString = data.item;
    } else {
      itemString = JSON.stringify(data.item || '');
    }
    
    // Hitung total
    const subtotal = Number(data.subtotal) || Number(data.total) || 0;
    const diskon = Number(data.diskon) || 0;
    const total = Number(data.total) || (subtotal - diskon);
    
    // Simpan ke database
    await env.DB.prepare(`
      INSERT INTO transactions 
      (transaksi_id, item, subtotal, diskon, total, kasir, nama_pelanggan, no_hp, alamat, tanggal, pickup, garansi) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      transaksiId,
      itemString,
      subtotal,
      diskon,
      total,
      data.kasir || 'Admin',
      data.nama_pelanggan || data.nama || '',
      data.no_hp || '',
      data.alamat || '',
      tanggal,
      data.pickup ? 1 : 0,
      data.garansi ? 1 : 0
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      id: transaksiId 
    }), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}

// PUT - Update transaksi
async function handlePUT(request, env) {
  try {
    const data = await request.json();
    
    if (!data.transaksi_id) {
      return new Response(JSON.stringify({ error: 'ID diperlukan' }), { 
        status: 400, 
        headers 
      });
    }
    
    await env.DB.prepare(`
      UPDATE transactions 
      SET item = ?, total = ?, kasir = ?, nama_pelanggan = ?, no_hp = ?, alamat = ?
      WHERE transaksi_id = ?
    `).bind(
      data.item || '',
      Number(data.total) || 0,
      data.kasir || 'Admin',
      data.nama_pelanggan || '',
      data.no_hp || '',
      data.alamat || '',
      data.transaksi_id
    ).run();
    
    return new Response(JSON.stringify({ success: true }), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}

// DELETE - Hapus transaksi
async function handleDELETE(request, env) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID diperlukan' }), { 
        status: 400, 
        headers 
      });
    }
    
    await env.DB.prepare(
      "DELETE FROM transactions WHERE transaksi_id = ?"
    ).bind(id).run();
    
    return new Response(JSON.stringify({ success: true }), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}