import { NextResponse } from 'next/server';
import { dataService } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { hotelId, guestName, guestEmail, checkIn, checkOut, phoneNumber, userId } = body;

    if (!hotelId || !guestName || !checkIn || !checkOut) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const booking = dataService.createBooking(
      hotelId, guestName, guestEmail || '', checkIn, checkOut, phoneNumber || '', userId || null
    );

    if (!booking) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || 'StayWU_bot';
    const telegramLink = `https://t.me/${botUsername}?start=${booking.id}`;

    return NextResponse.json({
      booking,
      telegramLink,
      message: `Booking confirmed! Open your Trip Concierge on Telegram to plan your Goa trip.`
    });
  } catch (error) {
    console.error('API /api/bookings error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
