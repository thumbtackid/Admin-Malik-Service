// ============================================
// API DISKON - MALIK SERVICE
// ============================================

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle OPTIONS request (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  
  try {
    // Cek koneksi database
    if (!env || !env.DB) {
      throw new Error('Database tidak terhubung');
    }
    
    // Buat tabel diskon jika belum ada
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS diskon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kode TEXT UNIQUE,
        tipe TEXT,
        nilai INTEGER,
        min_belanja INTEGER DEFAULT 0,
        berlaku TEXT,
        deskripsi TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Routing berdasarkan method
    if (request.method === 'GET') {
      return await handleGET(env);
    }
    
    if (request.method === 'POST') {
      return await handlePOST(request, env);
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

// GET - Ambil semua diskon
async function handleGET(env) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM diskon ORDER BY berlaku DESC"
    ).all();
    
    return new Response(JSON.stringify(results), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}

// POST - Simpan diskon (bisa array atau object)
async function handlePOST(request, env) {
  try {
    const data = await request.json();
    
    // Kalau data berupa array (multiple diskon)
    if (Array.isArray(data)) {
      for (const diskon of data) {
        await saveOrUpdateDiskon(env, diskon);
      }
      return new Response(JSON.stringify({ success: true, count: data.length }), { headers });
    }
    
    // Kalau data berupa object (single diskon)
    await saveOrUpdateDiskon(env, data);
    return new Response(JSON.stringify({ success: true }), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}

// Fungsi bantu untuk save/update diskon
async function saveOrUpdateDiskon(env, diskon) {
  // Validasi data
  if (!diskon.kode) {
    throw new Error('Kode diskon wajib diisi');
  }
  
  // Cek apakah kode sudah ada
  const existing = await env.DB.prepare(
    "SELECT id FROM diskon WHERE kode = ?"
  ).bind(diskon.kode).first();
  
  if (existing) {
    // Update diskon yang sudah ada
    await env.DB.prepare(`
      UPDATE diskon 
      SET tipe = ?, nilai = ?, min_belanja = ?, berlaku = ?, deskripsi = ?
      WHERE kode = ?
    `).bind(
      diskon.tipe || 'persen',
      diskon.nilai || 0,
      diskon.min_belanja || diskon.minBelanja || 0,
      diskon.berlaku || '2025-12-31',
      diskon.deskripsi || '',
      diskon.kode
    ).run();
  } else {
    // Insert diskon baru
    await env.DB.prepare(`
      INSERT INTO diskon (kode, tipe, nilai, min_belanja, berlaku, deskripsi)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      diskon.kode,
      diskon.tipe || 'persen',
      diskon.nilai || 0,
      diskon.min_belanja || diskon.minBelanja || 0,
      diskon.berlaku || '2025-12-31',
      diskon.deskripsi || ''
    ).run();
  }
}

// DELETE - Hapus diskon berdasarkan kode
async function handleDELETE(request, env) {
  try {
    const url = new URL(request.url);
    const kode = url.searchParams.get('kode');
    
    if (!kode) {
      return new Response(JSON.stringify({ error: 'Parameter kode diperlukan' }), { 
        status: 400, 
        headers 
      });
    }
    
    const result = await env.DB.prepare(
      "DELETE FROM diskon WHERE kode = ?"
    ).bind(kode).run();
    
    return new Response(JSON.stringify({ 
      success: true,
      deleted: result.changes > 0 
    }), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers 
    });
  }
}
