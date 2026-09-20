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

  // GET /api/bookings — list user bookings
  router.get('/', (req, res) => {
    try {
      const { userId, email } = req.query;
      const bookings = dataService.getUserBookings(userId, email);
      res.json({ bookings });
    } catch (err) {
      console.error('Error fetching bookings:', err);
      res.status(500).json({ error: 'Failed to retrieve bookings' });
    }
  });

  // POST /api/bookings/demo — quick sample booking for presentation
  router.post('/demo', (req, res) => {
    try {
      const { userId, guestName, guestEmail } = req.body;
      const hotel = dataService.hotels.find(h => h.trust_score >= 90) || dataService.hotels[0];
      const checkIn = '2026-09-24';
      const checkOut = '2026-09-28';
      const booking = dataService.createBooking(
        hotel.id,
        guestName || 'Pranav',
        guestEmail || 'pranav@staywu.com',
        checkIn,
        checkOut,
        '+91 98765 43210',
        userId || 'traveler_default'
      );

      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'StayWUBot';
      const telegramLink = `https://t.me/${botUsername}?start=${booking.id}`;

      res.json({
        success: true,
        booking,
        telegramLink,
        message: 'Presentation demo booking created successfully.'
      });
    } catch (err) {
      console.error('Error creating demo booking:', err);
      res.status(500).json({ error: 'Failed to create demo booking' });
    }
  });

  // GET /api/bookings/:id
  router.get('/:id', (req, res) => {
    const booking = dataService.getBooking(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  });

  return router;
};
