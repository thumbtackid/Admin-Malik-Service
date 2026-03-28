// ============================================
// API TRANSACTIONS - MALIK SERVICE
// ============================================

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  
  try {
    if (!env || !env.DB) {
      throw new Error('Database tidak terhubung');
    }
    
    // Pastikan tabel ada
    await ensureTableExists(env.DB);
    
    // Routing
    switch (request.method) {
      case 'GET':
        return await handleGET(env.DB);
      case 'POST':
        return await handlePOST(request, env.DB);
      case 'PUT':
        return await handlePUT(request, env.DB);
      case 'DELETE':
        return await handleDELETE(request, env.DB);
      default:
        return new Response(JSON.stringify({ error: 'Method tidak diizinkan' }), { 
          status: 405, 
          headers 
        });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), { 
      status: 500, 
      headers 
    });
  }
}

// Pastikan tabel ada
async function ensureTableExists(db) {
  try {
    const tableCheck = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'"
    ).first();
    
    if (!tableCheck) {
      await db.prepare(`
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
          created_at TEXT DEFAULT (datetime('now'))
        )
      `).run();
      console.log('✅ Transactions table created');
    }
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
}

// GET - Ambil semua transaksi
async function handleGET(db) {
  try {
    const { results } = await db.prepare(
      "SELECT * FROM transactions ORDER BY tanggal DESC LIMIT 1000"
    ).all();
    
    return new Response(JSON.stringify(results || []), { headers });
    
  } catch (error) {
    console.error('GET Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}

// POST - Simpan transaksi baru
async function handlePOST(request, db) {
  try {
    const data = await request.json();
    
    // Validasi data
    if (!data.nama_pelanggan && !data.nama) {
      return new Response(JSON.stringify({ error: 'Nama pelanggan wajib diisi' }), { 
        status: 400, 
        headers 
      });
    }
    
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
    } else if (data.item) {
      itemString = JSON.stringify(data.item);
    } else {
      itemString = '';
    }
    
    // Hitung total
    const subtotal = Number(data.subtotal) || Number(data.total) || 0;
    const diskon = Number(data.diskon) || 0;
    const total = Number(data.total) || (subtotal - diskon);
    
    // Cek apakah ID sudah ada (untuk update)
    const existing = await db.prepare(
      'SELECT id FROM transactions WHERE transaksi_id = ?'
    ).bind(transaksiId).first();
    
    if (existing) {
      // Update existing
      await db.prepare(`
        UPDATE transactions SET
          item = ?,
          subtotal = ?,
          diskon = ?,
          total = ?,
          kasir = ?,
          nama_pelanggan = ?,
          no_hp = ?,
          alamat = ?,
          tanggal = ?,
          pickup = ?
        WHERE transaksi_id = ?
      `).bind(
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
        transaksiId
      ).run();
    } else {
      // Insert baru
      await db.prepare(`
        INSERT INTO transactions 
        (transaksi_id, item, subtotal, diskon, total, kasir, nama_pelanggan, no_hp, alamat, tanggal, pickup) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        data.pickup ? 1 : 0
      ).run();
    }
    
    console.log(`💾 Transaction saved: ${transaksiId}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      id: transaksiId
    }), { headers });
    
  } catch (error) {
    console.error('POST Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message
    }), { 
      status: 500, 
      headers 
    });
  }
}

// PUT - Update transaksi
async function handlePUT(request, db) {
  try {
    const data = await request.json();
    
    if (!data.transaksi_id && !data.id) {
      return new Response(JSON.stringify({ error: 'ID transaksi diperlukan' }), { 
        status: 400, 
        headers 
      });
    }
    
    const transaksiId = data.transaksi_id || data.id;
    
    // Cek apakah transaksi ada
    const existing = await db.prepare(
      'SELECT id FROM transactions WHERE transaksi_id = ?'
    ).bind(transaksiId).first();
    
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Transaksi tidak ditemukan' }), { 
        status: 404, 
        headers 
      });
    }
    
    await db.prepare(`
      UPDATE transactions 
      SET item = ?, 
          total = ?, 
          kasir = ?, 
          nama_pelanggan = ?, 
          no_hp = ?, 
          alamat = ?
      WHERE transaksi_id = ?
    `).bind(
      data.item || '',
      Number(data.total) || 0,
      data.kasir || 'Admin',
      data.nama_pelanggan || '',
      data.no_hp || '',
      data.alamat || '',
      transaksiId
    ).run();
    
    return new Response(JSON.stringify({ success: true }), { headers });
    
  } catch (error) {
    console.error('PUT Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}

// DELETE - Hapus transaksi
async function handleDELETE(request, db) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'Parameter id diperlukan' }), { 
        status: 400, 
        headers 
      });
    }
    
    // Cek apakah transaksi ada
    const existing = await db.prepare(
      'SELECT id FROM transactions WHERE transaksi_id = ?'
    ).bind(id).first();
    
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Transaksi tidak ditemukan' }), { 
        status: 404, 
        headers 
      });
    }
    
    await db.prepare(
      "DELETE FROM transactions WHERE transaksi_id = ?"
    ).bind(id).run();
    
    return new Response(JSON.stringify({ 
      success: true
    }), { headers });
    
  } catch (error) {
    console.error('DELETE Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}
