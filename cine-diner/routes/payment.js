const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
  createRegistration,
  updatePaymentInfo,
  updatePaymentStatus,
  getRegistrationByPaymentId,
  getRegistrationById,
  getPlacesRemaining,
  saveQrCodeData
} = require('../database');
const { createPayment, getPayment } = require('../services/mollie');
const { generateTicketQR } = require('../services/qrcode');
const { sendConfirmationEmail } = require('../services/email');

// Create payment — POST from registration form
router.post('/create', async (req, res) => {
  try {
    const { nom, prenom, email, telephone, nombre_places, regime_alimentaire, conditions } = req.body;

    // Validation
    if (!nom || !prenom || !email || !telephone || !nombre_places || !conditions) {
      return res.render('register', {
        placesRemaining: getPlacesRemaining(),
        pricePerPerson: 50,
        error: 'Veuillez remplir tous les champs obligatoires et accepter les conditions.'
      });
    }

    const nbPlaces = parseInt(nombre_places);
    if (isNaN(nbPlaces) || nbPlaces < 1 || nbPlaces > 10) {
      return res.render('register', {
        placesRemaining: getPlacesRemaining(),
        pricePerPerson: 50,
        error: 'Le nombre de places doit être entre 1 et 10.'
      });
    }

    // Check remaining places
    const remaining = getPlacesRemaining();
    if (nbPlaces > remaining) {
      return res.render('register', {
        placesRemaining: remaining,
        pricePerPerson: 50,
        error: `Désolé, il ne reste que ${remaining} place(s) disponible(s).`
      });
    }

    const totalAmount = nbPlaces * 50;
    const confirmationCode = uuidv4().split('-')[0].toUpperCase();

    // Create registration in database
    const registrationId = createRegistration({
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: email.trim().toLowerCase(),
      telephone: telephone.trim(),
      nombre_places: nbPlaces,
      regime_alimentaire: regime_alimentaire ? regime_alimentaire.trim() : null,
      conditions_acceptees: 1,
      total_amount: totalAmount,
      confirmation_code: confirmationCode
    });

    // Create Mollie payment
    const registration = getRegistrationById(registrationId);
    const payment = await createPayment(registration);

    // Save Mollie payment ID
    updatePaymentInfo(registrationId, payment.id);

    // Redirect to Mollie checkout
    res.redirect(payment.getCheckoutUrl());

  } catch (error) {
    console.error('❌ Erreur création paiement:', error);
    res.render('register', {
      placesRemaining: getPlacesRemaining(),
      pricePerPerson: 50,
      error: 'Une erreur est survenue lors de la création du paiement. Veuillez réessayer.'
    });
  }
});

// Mollie webhook — called asynchronously by Mollie when payment status changes
router.post('/webhook', async (req, res) => {
  try {
    const paymentId = req.body.id;
    if (!paymentId) {
      return res.status(400).send('Missing payment ID');
    }

    // Get payment status from Mollie
    const payment = await getPayment(paymentId);
    const status = payment.status; // paid, failed, expired, canceled, pending, open

    // Map Mollie status to our status
    let dbStatus = 'pending';
    if (status === 'paid') dbStatus = 'paid';
    else if (status === 'failed' || status === 'canceled' || status === 'expired') dbStatus = 'failed';

    // Update in database
    updatePaymentStatus(paymentId, dbStatus);

    // If paid, generate QR code and send confirmation email
    if (dbStatus === 'paid') {
      const registration = getRegistrationByPaymentId(paymentId);
      if (registration) {
        try {
          // Generate individual ticket QR code
          const qrCodeDataUrl = await generateTicketQR(
            registration.confirmation_code,
            registration
          );
          saveQrCodeData(registration.id, qrCodeDataUrl);

          // Send confirmation email with QR code
          await sendConfirmationEmail(registration, qrCodeDataUrl);
        } catch (emailError) {
          console.error('❌ Erreur post-paiement (QR/email):', emailError);
          // Don't fail the webhook — payment is still valid
        }
      }
    }

    // Always return 200 to Mollie
    res.status(200).send('OK');

  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    res.status(200).send('OK'); // Still return 200 to prevent Mollie retries
  }
});

// Payment success page — redirect after payment
router.get('/success', async (req, res) => {
  try {
    const registrationId = req.query.id;
    if (!registrationId) {
      return res.redirect('/');
    }

    const registration = getRegistrationById(registrationId);
    if (!registration) {
      return res.redirect('/');
    }

    // Check actual payment status from Mollie (webhook might not have fired yet)
    if (registration.mollie_payment_id) {
      try {
        const payment = await getPayment(registration.mollie_payment_id);
        if (payment.status === 'paid' && registration.payment_status !== 'paid') {
          updatePaymentStatus(registration.mollie_payment_id, 'paid');
          registration.payment_status = 'paid';

          // Generate QR and send email if not done by webhook yet
          if (!registration.qr_code_data) {
            const qrCodeDataUrl = await generateTicketQR(
              registration.confirmation_code,
              registration
            );
            saveQrCodeData(registration.id, qrCodeDataUrl);
            registration.qr_code_data = qrCodeDataUrl;

            await sendConfirmationEmail(registration, qrCodeDataUrl);
          }
        }
      } catch (e) {
        console.error('Erreur vérification paiement:', e);
      }
    }

    // Re-fetch in case it was updated
    const updatedRegistration = getRegistrationById(registrationId);

    res.render('payment-success', { registration: updatedRegistration });

  } catch (error) {
    console.error('❌ Erreur page success:', error);
    res.redirect('/');
  }
});

// Payment failed/cancelled page
router.get('/failed', (req, res) => {
  res.render('payment-failed');
});

module.exports = router;
