const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cine-diner.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        email TEXT NOT NULL,
        telephone TEXT NOT NULL,
        nombre_places INTEGER NOT NULL DEFAULT 1,
        regime_alimentaire TEXT,
        conditions_acceptees INTEGER NOT NULL DEFAULT 0,
        mollie_payment_id TEXT,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        total_amount REAL NOT NULL,
        confirmation_code TEXT UNIQUE NOT NULL,
        qr_code_data TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_mollie_payment_id 
        ON registrations(mollie_payment_id);
      
      CREATE INDEX IF NOT EXISTS idx_email 
        ON registrations(email);
      
      CREATE INDEX IF NOT EXISTS idx_confirmation_code 
        ON registrations(confirmation_code);
      
      CREATE INDEX IF NOT EXISTS idx_payment_status 
        ON registrations(payment_status);
    `);
  }

  return db;
}

// Get total places sold (only paid registrations)
function getPlacesSold() {
  const db = getDb();
  const result = db.prepare(
    `SELECT COALESCE(SUM(nombre_places), 0) as total 
     FROM registrations 
     WHERE payment_status = 'paid'`
  ).get();
  return result.total;
}

// Get places remaining
function getPlacesRemaining() {
  const maxPlaces = parseInt(process.env.MAX_PLACES) || 80;
  return maxPlaces - getPlacesSold();
}

// Create a new registration
function createRegistration(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO registrations (nom, prenom, email, telephone, nombre_places, 
      regime_alimentaire, conditions_acceptees, total_amount, confirmation_code)
    VALUES (@nom, @prenom, @email, @telephone, @nombre_places, 
      @regime_alimentaire, @conditions_acceptees, @total_amount, @confirmation_code)
  `);
  const result = stmt.run(data);
  return result.lastInsertRowid;
}

// Update payment info
function updatePaymentInfo(registrationId, molliePaymentId) {
  const db = getDb();
  db.prepare(`
    UPDATE registrations 
    SET mollie_payment_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(molliePaymentId, registrationId);
}

// Update payment status
function updatePaymentStatus(molliePaymentId, status) {
  const db = getDb();
  db.prepare(`
    UPDATE registrations 
    SET payment_status = ?, updated_at = datetime('now')
    WHERE mollie_payment_id = ?
  `).run(status, molliePaymentId);
}

// Get registration by Mollie payment ID
function getRegistrationByPaymentId(molliePaymentId) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM registrations WHERE mollie_payment_id = ?'
  ).get(molliePaymentId);
}

// Get registration by ID
function getRegistrationById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
}

// Get registration by confirmation code
function getRegistrationByConfirmationCode(code) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM registrations WHERE confirmation_code = ?'
  ).get(code);
}

// Get all registrations (for admin)
function getAllRegistrations(statusFilter = null) {
  const db = getDb();
  if (statusFilter && statusFilter !== 'all') {
    return db.prepare(
      'SELECT * FROM registrations WHERE payment_status = ? ORDER BY created_at DESC'
    ).all(statusFilter);
  }
  return db.prepare(
    'SELECT * FROM registrations ORDER BY created_at DESC'
  ).all();
}

// Get stats for admin dashboard
function getStats() {
  const db = getDb();
  const maxPlaces = parseInt(process.env.MAX_PLACES) || 80;

  const totalRegistrations = db.prepare(
    `SELECT COUNT(*) as count FROM registrations WHERE payment_status = 'paid'`
  ).get().count;

  const totalPlaces = db.prepare(
    `SELECT COALESCE(SUM(nombre_places), 0) as total 
     FROM registrations WHERE payment_status = 'paid'`
  ).get().total;

  const totalRevenue = db.prepare(
    `SELECT COALESCE(SUM(total_amount), 0) as total 
     FROM registrations WHERE payment_status = 'paid'`
  ).get().total;

  const pendingCount = db.prepare(
    `SELECT COUNT(*) as count FROM registrations WHERE payment_status = 'pending'`
  ).get().count;

  return {
    totalRegistrations,
    totalPlaces,
    totalRevenue,
    pendingCount,
    placesRemaining: maxPlaces - totalPlaces,
    maxPlaces
  };
}

// Save QR code data for a registration
function saveQrCodeData(registrationId, qrCodeData) {
  const db = getDb();
  db.prepare(`
    UPDATE registrations 
    SET qr_code_data = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(qrCodeData, registrationId);
}

// Close database connection
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}


// Update payment status by ID
function updatePaymentStatusById(id, status) {
  const db = getDb();
  db.prepare(`
    UPDATE registrations 
    SET payment_status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, id);
}

// Delete registration
function deleteRegistration(id) {
  const db = getDb();
  db.prepare('DELETE FROM registrations WHERE id = ?').run(id);
}

module.exports = {
  getDb,
  getPlacesSold,
  getPlacesRemaining,
  createRegistration,
  updatePaymentInfo,
  updatePaymentStatus,
  updatePaymentStatusById,
  deleteRegistration,
  getRegistrationByPaymentId,
  getRegistrationById,
  getRegistrationByConfirmationCode,
  getAllRegistrations,
  getStats,
  saveQrCodeData,
  closeDb
};
