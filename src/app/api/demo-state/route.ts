import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { ok: true, mode: 'firebase', message: 'Demo state endpoint retired. App now uses Firebase and Firestore.' },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
