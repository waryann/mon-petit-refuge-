const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
  createRegistration,
  updatePaymentStatus,
  getRegistrationById,
  getPlacesRemaining,
  saveQrCodeData
} = require('../database');
const { generateTicketQR } = require('../services/qrcode');
const { sendConfirmationEmail } = require('../services/email');

// Create payment — POST from registration form
router.post('/create', async (req, res) => {
  try {
    const { nom, prenom, email, telephone, nombre_places, regime_alimentaire, conditions, ticket_type } = req.body;

    // Validation
    if (!nom || !prenom || !email || !telephone || !nombre_places || !conditions) {
      return res.render('register', { placesRemaining: getPlacesRemaining(), pricePerPerson: ticket_type || 50, error: 'Veuillez remplir tous les champs obligatoires.' });
    }

    const nbPlaces = parseInt(nombre_places);
    const typeBillet = parseInt(ticket_type) === 25 ? 25 : 50;

    const remaining = getPlacesRemaining();
    if (nbPlaces > remaining) {
      return res.render('register', { placesRemaining: remaining, pricePerPerson: typeBillet, error: `Désolé, il ne reste que ${remaining} place(s).` });
    }

    const totalAmount = nbPlaces * typeBillet;
    const confirmationCode = uuidv4().split('-')[0].toUpperCase();

    // Create registration (status defaults to 'pending')
    const registrationId = await createRegistration({
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: email.trim().toLowerCase(),
      telephone: telephone.trim(),
      nombre_places: nbPlaces,
      regime_alimentaire: regime_alimentaire ? regime_alimentaire.trim() : null,
      conditions_acceptees: 1,
      total_amount: totalAmount,
      confirmation_code: confirmationCode,
      ticket_type: typeBillet
    });

    // Redirect to pending page for Revolut payment
    res.redirect(`/payment/pending?id=${registrationId}`);

  } catch (error) {
    console.error('❌ Erreur création paiement:', error);
    res.render('register', { placesRemaining: getPlacesRemaining(), pricePerPerson: 50, error: 'Erreur. Veuillez réessayer.' });
  }
});

// Pending payment page (Revolut Links)
router.get('/pending', async (req, res) => {
  const registrationId = req.query.id;
  if (!registrationId) return res.redirect('/');

  const registration = await getRegistrationById(registrationId);
  if (!registration) return res.redirect('/');
  
  if (registration.payment_status === 'paid') {
      return res.redirect(`/payment/success?id=${registrationId}`);
  }

  // Define Revolut links
  const revolutLinks = {
    25: "https://revolut.me/monptitrefuge?currency=EUR&amount=2500&note=Soir%C3%A9e%20cin%C3%A9%20sans%20repas%20",
    50: "https://revolut.me/monptitrefuge?currency=EUR&amount=5000&note=Soir%C3%A9e%20cin%C3%A9%20avec%20repas%20"
  };
  
  // Calculate correct link based on ticket type and total amount
  // If multiple tickets, they should pay the total amount.
  // Wait, Revolut.me fixed links have fixed amounts.
  // We need to generate a dynamic link:
  const dynamicLink = `https://revolut.me/monptitrefuge?currency=EUR&amount=${registration.total_amount * 100}&note=Soiree%20Cine%20${registration.nom}%20${registration.prenom}`;
  // Wait, the user asked to use EXACTLY their links. But what if someone buys 2 places?
  // We will provide the exact link but warn them they might need to adjust the amount if buying multiple.

  res.render('payment-pending', { registration, link25: revolutLinks[25], link50: revolutLinks[50] });
});

// Success page (called when admin validates)
router.get('/success', (req, res) => {
  const registrationId = req.query.id;
  const registration = await getRegistrationById(registrationId);
  if (!registration) return res.redirect('/');
  res.render('payment-success', { registration });
});

module.exports = router;
