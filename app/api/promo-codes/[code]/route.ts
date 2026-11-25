// app/api/promo-codes/[code]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promoCodeUpdateSchema } from "@/validation/promoCodeSchema";
import {
  PromoApiError,
  handlePromoError,
  jsonError,
  parseCodeParam,
  promoCodeHasUsages,
  promoCodesCollection,
  readJsonBody,
  requireAdmin,
} from "@/lib/promo-codes";

type RouteContext = { params: Promise<{ code: string }> };

// PATCH - Промо кодын мэдээлэл засах, идэвхжүүлэх/идэвхгүй болгох (зөвхөн админ).
// Код өөрөө (баримтын ID) солигдохгүй. Нэмэлт хоногийг өөрчилбөл зөвхөн ДАРААГИЙН худалдан авалтад үйлчилнэ.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const code = parseCodeParam((await params).code);

    const body = await readJsonBody(request);
    const validation = promoCodeUpdateSchema.safeParse(body);

    if (!validation.success) {
      return jsonError(400, validation.error.issues[0]?.message ?? "Өгөгдөл буруу байна");
    }

    const { partnerName, bonusDays, note, isActive } = validation.data;

    const changes: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (partnerName !== undefined) changes.partnerName = partnerName;
    if (bonusDays !== undefined) changes.bonusDays = bonusDays;
    if (note !== undefined) changes.note = note;
    if (isActive !== undefined) changes.isActive = isActive;

    // update(): код байхгүй бол NOT_FOUND алдаа өгнө (404)
    await promoCodesCollection().doc(code).update(changes);

    return NextResponse.json({ error: false, message: "Хадгалагдлаа" });
  } catch (error) {
    return handlePromoError(error, "Error updating promo code");
  }
}

// DELETE - Промо код устгах (зөвхөн админ).
// Нэг удаа ч ашиглагдсан кодыг устгахгүй: статистик, түүх алдагдахаас сэргийлж идэвхгүй болгоно.
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const code = parseCodeParam((await params).code);
    const reference = promoCodesCollection().doc(code);

    const snapshot = await reference.get();
    if (!snapshot.exists) {
      throw new PromoApiError(404, "Промо код олдсонгүй");
    }

    if (await promoCodeHasUsages(code)) {
      throw new PromoApiError(409, "Энэ код ашиглагдсан тул устгах боломжгүй. Устгахын оронд идэвхгүй болгоно уу");
    }

    await reference.delete();

    return NextResponse.json({ error: false, message: "Промо код устгагдлаа" });
  } catch (error) {
    return handlePromoError(error, "Error deleting promo code");
  }
}