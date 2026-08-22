const { createMollieClient } = require('@mollie/api-client');

let mollieClient;

function getMollieClient() {
  if (!mollieClient) {
    if (!process.env.MOLLIE_API_KEY) {
      throw new Error('MOLLIE_API_KEY is not set in environment variables');
    }
    mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
  }
  return mollieClient;
}

/**
 * Create a payment via Mollie
 * @param {Object} registration - Registration data
 * @param {number} registration.id - Registration ID
 * @param {string} registration.nom - Last name
 * @param {string} registration.prenom - First name
 * @param {number} registration.nombre_places - Number of places
 * @param {number} registration.total_amount - Total amount in EUR
 * @returns {Object} Mollie payment object
 */
async function createPayment(registration) {
  const client = getMollieClient();
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  const payment = await client.payments.create({
    amount: {
      currency: 'EUR',
      value: registration.total_amount.toFixed(2)
    },
    description: `Soirée Ciné-Dîner — ${registration.nombre_places} place(s) — ${registration.prenom} ${registration.nom}`,
    redirectUrl: `${baseUrl}/payment/success?id=${registration.id}`,
    webhookUrl: `${baseUrl}/payment/webhook`,
    metadata: {
      registrationId: registration.id.toString(),
      confirmationCode: registration.confirmation_code
    },
    // Allow both Bancontact and credit card
    // Remove the method field to let Mollie show all available methods
    // Or specify: method: ['bancontact', 'creditcard']
  });

  return payment;
}

/**
 * Get payment details from Mollie
 * @param {string} paymentId - Mollie payment ID
 * @returns {Object} Mollie payment object
 */
async function getPayment(paymentId) {
  const client = getMollieClient();
  return await client.payments.get(paymentId);
}

module.exports = {
  createPayment,
  getPayment
};
