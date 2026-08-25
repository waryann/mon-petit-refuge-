const { Pool } = require('pg');

let pool;

async function getDb() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      console.warn("⚠️ DATABASE_URL n'est pas défini sur Render.");
    }
    
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
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
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mollie_payment_id ON registrations(mollie_payment_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_email ON registrations(email);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_confirmation_code ON registrations(confirmation_code);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payment_status ON registrations(payment_status);`);
  }

  return pool;
}

async function getPlacesSold() {
  const db = await getDb();
  const result = await db.query(
    `SELECT COALESCE(SUM(nombre_places), 0) as total FROM registrations WHERE payment_status = 'paid'`
  );
  return parseInt(result.rows[0].total) || 0;
}

async function getPlacesRemaining() {
  const maxPlaces = parseInt(process.env.MAX_PLACES) || 80;
  const sold = await getPlacesSold();
  return maxPlaces - sold;
}

async function createRegistration(data) {
  const db = await getDb();
  const result = await db.query(`
    INSERT INTO registrations (nom, prenom, email, telephone, nombre_places, 
      regime_alimentaire, conditions_acceptees, total_amount, confirmation_code)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [
    data.nom, data.prenom, data.email, data.telephone, data.nombre_places,
    data.regime_alimentaire, data.conditions_acceptees, data.total_amount, data.confirmation_code
  ]);
  return result.rows[0].id;
}

async function updatePaymentInfo(registrationId, molliePaymentId) {
  const db = await getDb();
  await db.query(`
    UPDATE registrations SET mollie_payment_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
  `, [molliePaymentId, registrationId]);
}

async function updatePaymentStatus(molliePaymentId, status) {
  const db = await getDb();
  await db.query(`
    UPDATE registrations SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE mollie_payment_id = $2
  `, [status, molliePaymentId]);
}

async function updatePaymentStatusById(id, status) {
  const db = await getDb();
  await db.query(`
    UPDATE registrations SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
  `, [status, id]);
}

async function getRegistrationByPaymentId(molliePaymentId) {
  const db = await getDb();
  const result = await db.query('SELECT * FROM registrations WHERE mollie_payment_id = $1', [molliePaymentId]);
  return result.rows[0] || null;
}

async function getRegistrationById(id) {
  const db = await getDb();
  const result = await db.query('SELECT * FROM registrations WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getRegistrationByConfirmationCode(code) {
  const db = await getDb();
  const result = await db.query('SELECT * FROM registrations WHERE confirmation_code = $1', [code]);
  return result.rows[0] || null;
}

async function getAllRegistrations(statusFilter = null) {
  const db = await getDb();
  if (statusFilter && statusFilter !== 'all') {
    const result = await db.query('SELECT * FROM registrations WHERE payment_status = $1 ORDER BY created_at DESC', [statusFilter]);
    return result.rows;
  }
  const result = await db.query('SELECT * FROM registrations ORDER BY created_at DESC');
  return result.rows;
}

async function getStats() {
  const db = await getDb();
  const maxPlaces = parseInt(process.env.MAX_PLACES) || 80;

  const totalRegistrationsRes = await db.query(`SELECT COUNT(*) as count FROM registrations WHERE payment_status = 'paid'`);
  const totalRegistrations = parseInt(totalRegistrationsRes.rows[0].count) || 0;

  const totalPlacesRes = await db.query(`SELECT COALESCE(SUM(nombre_places), 0) as total FROM registrations WHERE payment_status = 'paid'`);
  const totalPlaces = parseInt(totalPlacesRes.rows[0].total) || 0;

  const totalRevenueRes = await db.query(`SELECT COALESCE(SUM(total_amount), 0) as total FROM registrations WHERE payment_status = 'paid'`);
  const totalRevenue = parseFloat(totalRevenueRes.rows[0].total) || 0;

  const pendingCountRes = await db.query(`SELECT COUNT(*) as count FROM registrations WHERE payment_status = 'pending'`);
  const pendingCount = parseInt(pendingCountRes.rows[0].count) || 0;

  return {
    totalRegistrations, totalPlaces, totalRevenue, pendingCount,
    placesRemaining: maxPlaces - totalPlaces, maxPlaces
  };
}

async function saveQrCodeData(registrationId, qrCodeData) {
  const db = await getDb();
  await db.query(`
    UPDATE registrations SET qr_code_data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
  `, [qrCodeData, registrationId]);
}

async function deleteRegistration(id) {
  const db = await getDb();
  await db.query('DELETE FROM registrations WHERE id = $1', [id]);
}

async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getDb, getPlacesSold, getPlacesRemaining, createRegistration, updatePaymentInfo,
  updatePaymentStatus, updatePaymentStatusById, getRegistrationByPaymentId,
  getRegistrationById, getRegistrationByConfirmationCode, getAllRegistrations,
  getStats, saveQrCodeData, deleteRegistration, closeDb
};
