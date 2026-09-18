import { NextResponse } from 'next/server';
import { dataService } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const locations = dataService.getLocations();
    return NextResponse.json(locations);
  } catch (error) {
    console.error('API /api/hotels/locations error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
