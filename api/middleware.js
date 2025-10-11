import { NextResponse } from 'next/server';

export function middleware(request) {
    // In production, `VERCEL_URL` is the domain of your deployment.
    // We construct the expected origin from it.
    const expectedOrigin = `https://${process.env.VERCEL_URL}`;

    // Get the origin of the incoming request.
    const requestOrigin = request.headers.get('origin');

    // Allow the request to pass if we are in local development (where VERCEL_URL is not set).
    if (!process.env.VERCEL_URL) {
        return NextResponse.next();
    }

    // If the request's origin matches our site's origin, allow it.
    if (requestOrigin === expectedOrigin) {
        return NextResponse.next();
    }

    // Otherwise, block the request with a 403 Forbidden error.
    return new Response('Forbidden', { status: 403 });
}

// This configures the middleware to run ONLY on requests to your get-movements API.
export const config = {
    matcher: '/api/get-movements',
};