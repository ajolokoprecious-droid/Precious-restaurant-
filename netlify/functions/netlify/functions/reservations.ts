import type { Handler } from '@netlify/functions';
import { RESTAURANT_INFO } from '../../src/data/restaurantInfo';
import { sendEmail, generateUniqueCode } from './_email';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');

    if (!payload.fullName || String(payload.fullName).trim().length < 2) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Please enter your full name.' }) };
    }
    if (!payload.phone || String(payload.phone).trim().length < 7) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Please enter a valid phone number.' }) };
    }
    if (!payload.email || !String(payload.email).includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Please enter a valid email address.' }) };
    }
    if (!payload.guests || payload.guests < 1 || payload.guests > 50) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Please select a valid party size (1–50 guests).' }) };
    }
    if (!payload.reservationDate) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Please select a reservation date.' }) };
    }
    if (!payload.reservationTime) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Please select a reservation time slot.' }) };
    }

    const now = new Date();
    const reservationCode = generateUniqueCode('PRECIOUS-RES');

    const reservationRecord = {
      reservationCode,
      createdAt: now.toISOString(),
      dateFormatted: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeFormatted: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      fullName: String(payload.fullName).trim(),
      phone: String(payload.phone).trim(),
      email: String(payload.email).trim(),
      guests: Number(payload.guests),
      reservationDate: payload.reservationDate,
      reservationTime: payload.reservationTime,
      seatingPreference: payload.seatingPreference ? String(payload.seatingPreference).trim() : undefined,
      specialRequests: payload.specialRequests ? String(payload.specialRequests).trim() : undefined,
      status: 'Request Received',
      notificationSentTo: RESTAURANT_INFO.email,
    };

    const emailText = `
========================================
NEW PRECIOUS RESTAURANT RESERVATION REQUEST
Reservation Code: ${reservationRecord.reservationCode}
Submitted Date: ${reservationRecord.dateFormatted}
Submitted Time: ${reservationRecord.timeFormatted}
Status: ${reservationRecord.status}
========================================

GUEST INFORMATION:
- Full Name: ${reservationRecord.fullName}
- Phone Number: ${reservationRecord.phone}
- Email: ${reservationRecord.email}
- Number of Guests: ${reservationRecord.guests}
- Reserved Date: ${reservationRecord.reservationDate}
- Reserved Time: ${reservationRecord.reservationTime}
- Seating Preference: ${reservationRecord.seatingPreference || 'Standard Dining Area'}
- Special Requests: ${reservationRecord.specialRequests || 'None'}

Note: Please contact the guest at ${reservationRecord.phone} or ${reservationRecord.email} to confirm.
========================================
`;

    await sendEmail(
      RESTAURANT_INFO.email,
      `New Precious Restaurant Reservation — [${reservationRecord.reservationCode}]`,
      emailText
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: 'Reservation request received successfully!',
        reservation: reservationRecord,
      }),
    };
  } catch (err) {
    console.error('Error processing reservation:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error while processing your reservation.' }),
    };
  }
};
