const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return transporter;
}

/**
 * Send confirmation email with QR code attached
 * @param {Object} registration - Registration data from database
 * @param {string} qrCodeDataUrl - QR code as data URL (base64)
 */
async function sendConfirmationEmail(registration, qrCodeDataUrl) {
  const transport = getTransporter();

  // Render the email template
  const templatePath = path.join(__dirname, '..', 'views', 'emails', 'confirmation.ejs');
  const html = await ejs.renderFile(templatePath, {
    registration,
    eventDate: 'Samedi 26 septembre',
    eventTime: '18h00 – 22h00',
    eventAddress: 'Brusselbaan 140, 1600 Sint-Pieters-Leeuw',
    eventName: 'Soirée Ciné-Dîner — La vie est belle'
  });

  // Extract base64 from data URL for attachment
  let attachments = [];
  if (qrCodeDataUrl) {
    const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
    attachments.push({
      filename: `billet-${registration.confirmation_code}.png`,
      content: Buffer.from(base64Data, 'base64'),
      cid: 'qrcode-billet' // Content-ID for embedding in email
    });
  }

  const mailOptions = {
    from: `"Soirée Ciné-Dîner" <${process.env.GMAIL_USER}>`,
    to: registration.email,
    subject: `✅ Confirmation — Soirée Ciné-Dîner du 26 septembre — ${registration.nombre_places} place(s)`,
    html: html,
    attachments: attachments
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`📧 Email de confirmation envoyé à ${registration.email} (${info.messageId})`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur envoi email à ${registration.email}:`, error.message);
    return false;
  }
}

module.exports = {
  sendConfirmationEmail
};
