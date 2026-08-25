const express = require('express');
const router = express.Router();

// Root admin route
router.get('/', (req, res) => {
  res.redirect('/admin/dashboard');
});

const { stringify } = require('csv-stringify/sync');
const { getAllRegistrations, getStats, getRegistrationByConfirmationCode } = require('../database');

// Auth middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
}

// Login page
router.get('/login', (req, res) => {
  res.render('admin/login', { error: null });
});

// Login handler
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin2026';

  if (password === adminPassword) {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin/login', { error: 'Mot de passe incorrect.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Dashboard
router.get('/dashboard', requireAdmin, (req, res) => {
  const statusFilter = req.query.status || 'all';
  const registrations = getAllRegistrations(statusFilter);
  const stats = getStats();

  res.render('admin/dashboard', {
    registrations,
    stats,
    statusFilter
  });
});

// Verify a ticket (scan QR code at entrance)
router.get('/verify/:code', requireAdmin, (req, res) => {
  const registration = getRegistrationByConfirmationCode(req.params.code);

  res.json({
    valid: !!(registration && registration.payment_status === 'paid'),
    registration: registration ? {
      nom: registration.nom,
      prenom: registration.prenom,
      nombre_places: registration.nombre_places,
      confirmation_code: registration.confirmation_code,
      payment_status: registration.payment_status
    } : null
  });
});

// Export CSV
router.get('/export/csv', requireAdmin, (req, res) => {
  const registrations = getAllRegistrations('paid');

  const csvData = registrations.map(r => ({
    'Nom': r.nom,
    'Prénom': r.prenom,
    'Email': r.email,
    'Téléphone': r.telephone,
    'Nb Places': r.nombre_places,
    'Régime alimentaire': r.regime_alimentaire || '-',
    'Montant (€)': r.total_amount,
    'Code Confirmation': r.confirmation_code,
    'Statut': r.payment_status,
    'Date inscription': r.created_at
  }));

  const csv = stringify(csvData, { header: true, delimiter: ';' });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=inscrits-cine-diner.csv');
  // Add BOM for Excel compatibility with accented characters
  res.send('\uFEFF' + csv);
});

module.exports = router;

// Validate a pending payment manually
router.post('/validate/:id', requireAdmin, async (req, res) => {
  try {
    const { updatePaymentStatus, getRegistrationById, saveQrCodeData } = require('../database');
    const { generateTicketQR } = require('../services/qrcode');
    const { sendConfirmationEmail } = require('../services/email');
    
    const registrationId = req.params.id;
    const registration = getRegistrationById(registrationId);
    
    if (registration && registration.payment_status === 'pending') {
      updatePaymentStatus(registration.id, 'paid');
      registration.payment_status = 'paid';
      
      if (!registration.qr_code_data) {
        const qrCodeDataUrl = await generateTicketQR(registration.confirmation_code, registration);
        saveQrCodeData(registration.id, qrCodeDataUrl);
        registration.qr_code_data = qrCodeDataUrl;
        
        await sendConfirmationEmail(registration, qrCodeDataUrl);
      }
    }
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Erreur validation manuelle:', error);
    res.redirect('/admin/dashboard');
  }
});
