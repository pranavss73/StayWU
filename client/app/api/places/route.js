import { NextResponse } from 'next/server';
import { dataService } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(dataService.getPlaces());
  } catch (error) {
    console.error('API /api/places error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
