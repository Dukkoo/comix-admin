// app/api/promo-codes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promoCodeCreateSchema } from "@/validation/promoCodeSchema";
import {
  handlePromoError,
  jsonError,
  loadPromoCodesWithStats,
  promoCodesCollection,
  readJsonBody,
  requireAdmin,
  toPromoCode,
} from "@/lib/promo-codes";

// GET - Бүх промо код + код бүрийн статистик + нийт дүн (зөвхөн админ)
export async function GET(request: NextRequest) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const result = await loadPromoCodesWithStats();

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handlePromoError(error, "Error listing promo codes");
  }
}

// POST - Шинэ промо код үүсгэх (зөвхөн админ)
export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const body = await readJsonBody(request);
    const validation = promoCodeCreateSchema.safeParse(body);

    if (!validation.success) {
      return jsonError(400, validation.error.issues[0]?.message ?? "Өгөгдөл буруу байна");
    }

    const { code, partnerName, bonusDays, note } = validation.data;
    const now = new Date().toISOString();

    const document = {
      code,
      partnerName,
      note: note ?? "",
      bonusDays,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    // create(): ижил код байвал өрсөлдөөнгүйгээр ALREADY_EXISTS алдаа өгнө (409)
    await promoCodesCollection().doc(code).create(document);

    return NextResponse.json(
      {
        error: false,
        message: "Промо код амжилттай үүслээ",
        data: toPromoCode(code, document),
      },
      { status: 201 }
    );
  } catch (error) {
    return handlePromoError(error, "Error creating promo code");
  }
}