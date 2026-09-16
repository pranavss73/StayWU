const express = require('express');
const router = express.Router();

module.exports = function(dataService) {
  // POST /api/bookings — create a booking
  router.post('/', (req, res) => {
    const { hotelId, guestName, guestEmail, checkIn, checkOut, phoneNumber, userId } = req.body;

    if (!hotelId || !guestName || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const booking = dataService.createBooking(
      hotelId, guestName, guestEmail || '', checkIn, checkOut, phoneNumber || '', userId || null
    );

    if (!booking) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    // Generate Telegram deep link
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'StayWUBot';
    const telegramLink = `https://t.me/${botUsername}?start=${booking.id}`;

    res.json({
      booking,
      telegramLink,
      message: `Booking confirmed! Open your Trip Concierge on Telegram to plan your Goa trip.`
    });
  });

  // GET /api/bookings/:id
  router.get('/:id', (req, res) => {
    const booking = dataService.getBooking(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  });

  return router;
};
