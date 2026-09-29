import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { shouldRefreshAuthCookies } from "@/lib/auth/session-cookie";
import { applyPublicShareResponsePolicy } from "@/lib/share-links/public-response-policy";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/share/")) {
    const response = NextResponse.next({ request });
    applyPublicShareResponsePolicy(response);
    return response;
  }

  if (!shouldRefreshAuthCookies(request.cookies.getAll()).refresh) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/app",
    "/app/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/share/:path*",
  ],
};
