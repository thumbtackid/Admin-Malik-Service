// functions/websocket.js
export async function onRequest(context) {
  const { request, env } = context;
  
  // Upgrade ke WebSocket
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('WebSocket only', { status: 426 });
  }
  
  const db = env.DB;
  
  // Inisialisasi tabel jika belum ada
  await initDatabase(db);
  
  const [client, server] = new WebSocketPair();
  server.accept();
  
  const clientId = crypto.randomUUID();
  
  // Simpan koneksi ke global (gunakan context.waitUntil untuk persistensi)
  if (!globalThis.clients) globalThis.clients = new Map();
  globalThis.clients.set(clientId, server);
  
  // Handle incoming messages
  server.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log(`📩 Received: ${data.type} from ${clientId}`);
      
      switch(data.type) {
        case 'sync':
          // Kirim semua data dari database
          await sendSyncData(server, db);
          break;
          
        case 'newTransaction':
          // Simpan transaksi ke D1
          const transaction = data.transaction;
          await saveTransaction(db, transaction);
          
          // Broadcast ke semua client lain
          broadcastToOthers(clientId, {
            type: 'newTransaction',
            transaction: transaction
          });
          break;
          
        case 'updateDiskon':
          // Update semua diskon ke D1
          await updateDiskon(db, data.diskon);
          
          broadcastToOthers(clientId, {
            type: 'updateDiskon',
            diskon: data.diskon
          });
          break;
          
        case 'updateCustomItems':
          // Update custom items ke D1
          await updateCustomItems(db, data.customItems);
          
          broadcastToOthers(clientId, {
            type: 'updateCustomItems',
            customItems: data.customItems
          });
          break;
          
        case 'newLoginLog':
          // Simpan log login
          await saveLoginLog(db, data.log);
          break;
          
        case 'ping':
          server.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      server.send(JSON.stringify({ 
        type: 'error', 
        message: error.message 
      }));
    }
  });
  
  server.addEventListener('close', () => {
    console.log(`🔌 Client disconnected: ${clientId}`);
    globalThis.clients.delete(clientId);
  });
  
  return new Response(null, { status: 101, webSocket: client });
}

// Fungsi inisialisasi database
async function initDatabase(db) {
  try {
    // Tabel transaksi
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
    
    // Tabel diskon
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS diskon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kode TEXT UNIQUE,
        tipe TEXT,
        nilai INTEGER,
        min_belanja INTEGER DEFAULT 0,
        berlaku TEXT,
        deskripsi TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    
    // Tabel custom items
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS custom_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kategori TEXT,
        tipe TEXT,
        nama TEXT,
        jenis TEXT,
        harga INTEGER,
        estimasi TEXT,
        garansi TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    
    // Tabel login logs
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        role TEXT,
        ip TEXT,
        status TEXT,
        browser TEXT,
        timestamp TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    
    console.log('✅ Database tables ready');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

// Kirim semua data sync
async function sendSyncData(server, db) {
  try {
    const transactions = await db.prepare(
      'SELECT * FROM transactions ORDER BY tanggal DESC LIMIT 500'
    ).all();
    
    const diskon = await db.prepare(
      'SELECT * FROM diskon ORDER BY berlaku DESC'
    ).all();
    
    const customItems = await db.prepare(
      'SELECT * FROM custom_items'
    ).all();
    
    const loginLogs = await db.prepare(
      'SELECT * FROM login_logs ORDER BY timestamp DESC LIMIT 100'
    ).all();
    
    server.send(JSON.stringify({
      type: 'sync',
      transactions: transactions.results,
      diskon: diskon.results,
      customItems: customItems.results,
      loginLogs: loginLogs.results
    }));
    
    console.log(`📤 Synced: ${transactions.results.length} transactions, ${diskon.results.length} discounts`);
  } catch (error) {
    console.error('Error sending sync data:', error);
    server.send(JSON.stringify({ type: 'error', message: 'Sync failed' }));
  }
}

// Simpan transaksi
async function saveTransaction(db, transaction) {
  try {
    // Cek apakah sudah ada
    const existing = await db.prepare(
      'SELECT id FROM transactions WHERE transaksi_id = ?'
    ).bind(transaction.transaksi_id).first();
    
    if (existing) {
      // Update
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
        transaction.item,
        transaction.subtotal || 0,
        transaction.diskon || 0,
        transaction.total || 0,
        transaction.kasir || 'Admin',
        transaction.nama_pelanggan,
        transaction.no_hp || '',
        transaction.alamat || '',
        transaction.tanggal || new Date().toISOString(),
        transaction.pickup ? 1 : 0,
        transaction.transaksi_id
      ).run();
    } else {
      // Insert
      await db.prepare(`
        INSERT INTO transactions (
          transaksi_id, item, subtotal, diskon, total, kasir,
          nama_pelanggan, no_hp, alamat, tanggal, pickup
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        transaction.transaksi_id,
        transaction.item,
        transaction.subtotal || 0,
        transaction.diskon || 0,
        transaction.total || 0,
        transaction.kasir || 'Admin',
        transaction.nama_pelanggan,
        transaction.no_hp || '',
        transaction.alamat || '',
        transaction.tanggal || new Date().toISOString(),
        transaction.pickup ? 1 : 0
      ).run();
    }
    
    console.log(`💾 Saved transaction: ${transaction.transaksi_id}`);
  } catch (error) {
    console.error('Error saving transaction:', error);
    throw error;
  }
}

// Update semua diskon
async function updateDiskon(db, diskonList) {
  try {
    // Hapus semua diskon lama
    await db.prepare('DELETE FROM diskon').run();
    
    // Insert diskon baru
    for (const d of diskonList) {
      await db.prepare(`
        INSERT INTO diskon (kode, tipe, nilai, min_belanja, berlaku, deskripsi)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        d.kode,
        d.tipe,
        d.nilai,
        d.minBelanja || 0,
        d.berlaku,
        d.deskripsi || ''
      ).run();
    }
    
    console.log(`💾 Updated ${diskonList.length} discounts`);
  } catch (error) {
    console.error('Error updating diskon:', error);
    throw error;
  }
}

// Update custom items
async function updateCustomItems(db, itemsList) {
  try {
    // Hapus semua item lama
    await db.prepare('DELETE FROM custom_items').run();
    
    // Insert item baru
    for (const item of itemsList) {
      await db.prepare(`
        INSERT INTO custom_items (kategori, tipe, nama, jenis, harga, estimasi, garansi)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        item.kategori,
        item.tipe,
        item.nama,
        item.jenis,
        item.harga,
        item.estimasi,
        item.garansi || '30 Hari'
      ).run();
    }
    
    console.log(`💾 Updated ${itemsList.length} custom items`);
  } catch (error) {
    console.error('Error updating custom items:', error);
    throw error;
  }
}

// Simpan login log
async function saveLoginLog(db, log) {
  try {
    await db.prepare(`
      INSERT INTO login_logs (username, role, ip, status, browser, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      log.username,
      log.role,
      log.ip || 'Client',
      log.status,
      log.browser || 'Unknown',
      log.timestamp || new Date().toISOString()
    ).run();
    
    console.log(`📝 Saved login log: ${log.username}`);
  } catch (error) {
    console.error('Error saving login log:', error);
  }
}

// Broadcast ke semua client lain
function broadcastToOthers(senderId, message) {
  if (!globalThis.clients) return;
  
  for (const [id, client] of globalThis.clients) {
    if (id !== senderId && client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(message));
    }
  }
}
