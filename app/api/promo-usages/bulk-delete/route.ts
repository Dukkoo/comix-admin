// app/api/promo-usages/bulk-delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  deletePromoUsages,
  handlePromoError,
  parseUsageIds,
  readJsonBody,
  requireAdmin,
} from "@/lib/promo-codes";

// POST - Ашиглалтын олон бичлэгийг нэг дор устгах (зөвхөн админ).  Бие: { "ids": ["...", "..."] }
// Нэг batch-ээр устгана (бүгд эсвэл огт). Аль хэдийн устсан ID-г алгасна.
// Зөвхөн "Ашиглалтын түүх" болон статистикаас хасна: хэрэглэгчийн олгогдсон эрх, төлбөрийн түүх өөрчлөгдөхгүй.
export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const ids = parseUsageIds(await readJsonBody(request));
    const removed = await deletePromoUsages(ids);

    // Серверийн логт үлдээнэ (буруу бичлэг устгасан эсэхийг хойно мэдэхэд)
    console.info(
      `Promo usages deleted: count=${removed.length} ` +
        removed
          .map((usage) => `[id=${usage.id} code=${usage.code} userId=${usage.userId} amount=${usage.amount} bonusDays=${usage.bonusDays}]`)
          .join(" ")
    );

    return NextResponse.json({
      error: false,
      message: `${removed.length} бичлэг устгагдлаа`,
      deleted: removed.length,
    });
  } catch (error) {
    return handlePromoError(error, "Error bulk deleting promo usages");
  }
}