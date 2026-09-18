import { NextResponse } from 'next/server';
import { dataService } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const location = searchParams.get('location');
    const min_price = searchParams.get('min_price');
    const max_price = searchParams.get('max_price');
    const min_rating = searchParams.get('min_rating');
    const trust = searchParams.get('trust');
    const sort = searchParams.get('sort');
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');

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

    return NextResponse.json(results);
  } catch (error) {
    console.error('API /api/hotels error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
