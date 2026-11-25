// app/api/promo-usages/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { deletePromoUsage, handlePromoError, parseUsageIdParam, requireAdmin } from "@/lib/promo-codes";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE - Ашиглалтын нэг бичлэгийг устгах (зөвхөн админ).
// Зөвхөн "Ашиглалтын түүх" болон статистикаас хасна: хэрэглэгчийн олгогдсон эрх, төлбөрийн түүх өөрчлөгдөхгүй.
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const id = parseUsageIdParam((await params).id);
    const removed = await deletePromoUsage(id);

    // Серверийн логт үлдээнэ (хэн нэгэн буруу бичлэг устгасан эсэхийг хойно мэдэхэд)
    console.info(
      `Promo usage deleted: id=${removed.id} code=${removed.code} userId=${removed.userId} amount=${removed.amount} bonusDays=${removed.bonusDays}`
    );

    return NextResponse.json({ error: false, message: "Ашиглалтын бүртгэл устгагдлаа" });
  } catch (error) {
    return handlePromoError(error, "Error deleting promo usage");
  }
}