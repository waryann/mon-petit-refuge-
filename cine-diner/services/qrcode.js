const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Generate a QR code for an individual ticket (confirmation)
 * Contains the confirmation code that can be scanned at the entrance
 * @param {string} confirmationCode - Unique confirmation code
 * @param {Object} registration - Registration data
 * @returns {string} QR code as base64 data URL
 */
async function generateTicketQR(confirmationCode, registration) {
  // The QR code contains a JSON with ticket info
  const ticketData = JSON.stringify({
    code: confirmationCode,
    nom: registration.nom,
    prenom: registration.prenom,
    places: registration.nombre_places,
    event: 'Soirée Ciné-Dîner 2026'
  });

  const dataUrl = await QRCode.toDataURL(ticketData, {
    width: 400,
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'H'
  });

  return dataUrl;
}

/**
 * Generate the event QR code (for flyers)
 * Points to the landing page URL
 * Saves to qr-output/event-qr.png
 */
async function generateEventQR() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const outputDir = path.join(__dirname, '..', 'qr-output');
  const outputPath = path.join(outputDir, 'event-qr.png');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await QRCode.toFile(outputPath, baseUrl, {
    width: 800,
    margin: 3,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'H'
  });

  console.log(`\n🔲 QR Code événement généré !`);
  console.log(`   → Fichier : ${outputPath}`);
  console.log(`   → Pointe vers : ${baseUrl}\n`);

  return outputPath;
}

// If run directly: generate the event QR code
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  generateEventQR()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Erreur:', err);
      process.exit(1);
    });
}

module.exports = {
  generateTicketQR,
  generateEventQR
};
