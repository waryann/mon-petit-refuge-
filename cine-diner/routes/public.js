const express = require('express');
const router = express.Router();
const { getPlacesRemaining } = require('../database');

// Landing page
router.get('/', (req, res) => {
  const placesRemaining = getPlacesRemaining();
  const maxPlaces = parseInt(process.env.MAX_PLACES) || 80;

  res.render('landing', {
    placesRemaining,
    maxPlaces,
    soldOut: placesRemaining <= 0
  });
});

// Registration form
router.get('/inscription', (req, res) => {
  const ticketType = req.query.type === '25' ? 25 : 50;
  const placesRemaining = getPlacesRemaining();

  if (placesRemaining <= 0) {
    return res.render('landing', {
      placesRemaining: 0,
      maxPlaces: parseInt(process.env.MAX_PLACES) || 80,
      soldOut: true,
      errorMessage: 'Désolé, toutes les places sont vendues !'
    });
  }

  res.render('register', {
    placesRemaining,
    pricePerPerson: ticketType,
    error: null
  });
});

module.exports = router;
