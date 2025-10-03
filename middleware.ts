import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "dulgn6@gmail.com";

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Public routes - middleware ажиллуулахгүй
    if (pathname === "/login" || pathname === "/unauthorized") {
        return NextResponse.next();
    }

    // Бүх бусад route - authentication шаардлагатай
    const cookieStore = await cookies();
    const token = cookieStore.get("firebaseAuthToken")?.value;

    if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Validate token
    try {
        const decodedToken = decodeJwt(token);
        
        // Token дууссан эсэхийг шалгах
        if (!decodedToken.exp || decodedToken.exp < Date.now() / 1000) {
            const response = NextResponse.redirect(new URL("/login", request.url));
            response.cookies.delete("firebaseAuthToken");
            return response;
        }

        // Admin эсэхийг шалгах
        const userEmail = decodedToken.email as string;
        if (!decodedToken.admin && userEmail !== ADMIN_EMAIL) {
            return NextResponse.redirect(new URL("/unauthorized", request.url));
        }

    } catch (error) {
        console.error("Invalid token:", error);
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("firebaseAuthToken");
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc)
         * - api routes
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api/).*)',
    ]
}