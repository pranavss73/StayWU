const express = require('express');
const router = express.Router();

module.exports = function(dataService) {
  // GET /api/hotels — search & list hotels
  router.get('/', (req, res) => {
    const { q, location, min_price, max_price, min_rating, trust, sort, page, limit } = req.query;
    
    const results = dataService.searchHotels({
      query: q,
      location,
      minPrice: min_price ? parseInt(min_price) : null,
      maxPrice: max_price ? parseInt(max_price) : null,
      minRating: min_rating ? parseFloat(min_rating) : null,
      trustBadge: trust,
      sortBy: sort,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 12,
    });

    res.json(results);
  });

  // GET /api/hotels/locations — unique locations
  router.get('/locations', (req, res) => {
    res.json(dataService.getLocations());
  });

  // GET /api/hotels/:id — single hotel
  router.get('/:id', (req, res) => {
    const hotel = dataService.getHotel(req.params.id);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json(hotel);
  });

  return router;
};
