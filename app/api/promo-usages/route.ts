// app/api/promo-usages/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  USAGE_LOG_DEFAULT_LIMIT,
  USAGE_LOG_MAX_LIMIT,
  handlePromoError,
  loadPromoUsages,
  parseCodeParam,
  requireAdmin,
} from "@/lib/promo-codes";

// GET - Промо кодын ашиглалтын түүх, хамгийн сүүлийнх нь эхэнд (зөвхөн админ)
//   ?code=ABC123   зөвхөн энэ кодынх (байхгүй бол бүх кодынх)
//   ?limit=50      хэдэн мөр (1-200, анхны утга 50)
export async function GET(request: NextRequest) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);

    const rawCode = searchParams.get("code")?.trim();
    const code = rawCode ? parseCodeParam(rawCode) : undefined;

    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), USAGE_LOG_MAX_LIMIT)
      : USAGE_LOG_DEFAULT_LIMIT;

    const result = await loadPromoUsages({ code, limit });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handlePromoError(error, "Error listing promo usages");
  }
}