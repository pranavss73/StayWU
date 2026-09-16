const express = require('express');
const router = express.Router();

module.exports = function(dataService, llmService) {
  // POST /api/chat — web chatbot
  router.post('/', async (req, res) => {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    try {
      // Extract relevant context from the message
      const hotelContext = dataService.getHotelsForContext(message, 15);
      
      const reply = await llmService.chatPreBooking(message, hotelContext, history);
      
      res.json({ reply });
    } catch (error) {
      console.error('Chat error:', error.message);
      res.status(500).json({ 
        reply: "I'm having trouble connecting right now. Please try again in a moment! 🙏" 
      });
    }
  });

  return router;
};
