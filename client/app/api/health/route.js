import { NextResponse } from 'next/server';
import { dataService } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    hotels: dataService.hotels.length,
    places: dataService.places.length,
    platform: 'Vercel Serverless / Next.js',
    timestamp: new Date().toISOString()
  });
}
