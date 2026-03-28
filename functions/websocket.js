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
  
  // Simpan koneksi (gunakan Map global)
  if (!globalThis.clients) globalThis.clients = new Map();
  globalThis.clients.set(clientId, server);
  
  console.log(`🔌 New client connected: ${clientId}, total clients: ${globalThis.clients.size}`);
  
  // Handle incoming messages
  server.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log(`📩 Received: ${data.type} from ${clientId}`);
      
      switch(data.type) {
        case 'sync':
          await sendSyncData(server, db);
          break;
          
        case 'newTransaction':
          try {
            const transaction = data.transaction;
            await saveTransaction(db, transaction);
            broadcastToOthers(clientId, {
              type: 'newTransaction',
              transaction: transaction
            });
            server.send(JSON.stringify({ type: 'success', message: 'Transaction saved' }));
          } catch (error) {
            console.error('Error saving transaction:', error);
            server.send(JSON.stringify({ type: 'error', message: error.message }));
          }
          break;
          
        case 'updateDiskon':
          try {
            await updateDiskon(db, data.diskon);
            broadcastToOthers(clientId, {
              type: 'updateDiskon',
              diskon: data.diskon
            });
            server.send(JSON.stringify({ type: 'success', message: 'Discounts updated' }));
          } catch (error) {
            console.error('Error updating diskon:', error);
            server.send(JSON.stringify({ type: 'error', message: error.message }));
          }
          break;
          
        case 'updateCustomItems':
          try {
            await updateCustomItems(db, data.customItems);
            broadcastToOthers(clientId, {
              type: 'updateCustomItems',
              customItems: data.customItems
            });
            server.send(JSON.stringify({ type: 'success', message: 'Custom items updated' }));
          } catch (error) {
            console.error('Error updating custom items:', error);
            server.send(JSON.stringify({ type: 'error', message: error.message }));
          }
          break;
          
        case 'newLoginLog':
          try {
            await saveLoginLog(db, data.log);
            server.send(JSON.stringify({ type: 'success', message: 'Login log saved' }));
          } catch (error) {
            console.error('Error saving login log:', error);
          }
          break;
          
        case 'ping':
          server.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
          
        default:
          console.log(`Unknown message type: ${data.type}`);
          server.send(JSON.stringify({ type: 'error', message: `Unknown type: ${data.type}` }));
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
    console.log(`🔌 Client disconnected: ${clientId}, remaining: ${globalThis.clients.size - 1}`);
    globalThis.clients.delete(clientId);
  });
  
  server.addEventListener('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
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
      transactions: transactions.results || [],
      diskon: diskon.results || [],
      customItems: customItems.results || [],
      loginLogs: loginLogs.results || []
    }));
    
    console.log(`📤 Synced: ${transactions.results?.length || 0} transactions, ${diskon.results?.length || 0} discounts`);
  } catch (error) {
    console.error('Error sending sync data:', error);
    server.send(JSON.stringify({ type: 'error', message: 'Sync failed' }));
  }
}

// Simpan transaksi
async function saveTransaction(db, transaction) {
  try {
    const transaksiId = transaction.transaksi_id || 'TRX-' + Date.now().toString().slice(-6);
    const tanggal = transaction.tanggal || new Date().toISOString();
    
    // Proses item
    let itemString = '';
    if (Array.isArray(transaction.item)) {
      itemString = transaction.item.join(', ');
    } else if (typeof transaction.item === 'string') {
      itemString = transaction.item;
    } else {
      itemString = JSON.stringify(transaction.item || '');
    }
    
    // Cek apakah sudah ada
    const existing = await db.prepare(
      'SELECT id FROM transactions WHERE transaksi_id = ?'
    ).bind(transaksiId).first();
    
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
        itemString,
        transaction.subtotal || 0,
        transaction.diskon || 0,
        transaction.total || 0,
        transaction.kasir || 'Admin',
        transaction.nama_pelanggan || '',
        transaction.no_hp || '',
        transaction.alamat || '',
        tanggal,
        transaction.pickup ? 1 : 0,
        transaksiId
      ).run();
    } else {
      // Insert
      await db.prepare(`
        INSERT INTO transactions (
          transaksi_id, item, subtotal, diskon, total, kasir,
          nama_pelanggan, no_hp, alamat, tanggal, pickup
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        transaksiId,
        itemString,
        transaction.subtotal || 0,
        transaction.diskon || 0,
        transaction.total || 0,
        transaction.kasir || 'Admin',
        transaction.nama_pelanggan || '',
        transaction.no_hp || '',
        transaction.alamat || '',
        tanggal,
        transaction.pickup ? 1 : 0
      ).run();
    }
    
    console.log(`💾 Saved transaction: ${transaksiId}`);
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
        d.tipe || 'persen',
        d.nilai || 0,
        d.minBelanja || d.min_belanja || 0,
        d.berlaku || '2025-12-31',
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
      log.username || 'unknown',
      log.role || 'unknown',
      log.ip || 'Client',
      log.status || 'Sukses',
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
  
  let count = 0;
  for (const [id, client] of globalThis.clients) {
    if (id !== senderId && client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(JSON.stringify(message));
        count++;
      } catch (error) {
        console.error(`Failed to broadcast to ${id}:`, error);
      }
    }
  }
  
  if (count > 0) {
    console.log(`📡 Broadcast to ${count} other clients`);
  }
}
