// app/api/admin/payment-logs/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const snapshot = await firestore
      .collection("payment_logs")
      .get();

    const logs = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => {
        const aTime = a.processedAt ? new Date(a.processedAt).getTime() : 0;
        const bTime = b.processedAt ? new Date(b.processedAt).getTime() : 0;
        return bTime - aTime;
      });

    const invoiceCount: Record<string, number> = {};
    logs.forEach((log: any) => {
      if (log.invoiceId) {
        invoiceCount[log.invoiceId] = (invoiceCount[log.invoiceId] || 0) + 1;
      }
    });

    const logsWithFlag = logs.map((log: any) => ({
      ...log,
      isDuplicate: log.invoiceId ? invoiceCount[log.invoiceId] > 1 : false,
    }));

    return NextResponse.json({
      logs: logsWithFlag,
      total: logs.length,
      duplicateCount: logsWithFlag.filter((l: any) => l.isDuplicate).length,
    });
  } catch (error: any) {
    console.error("Payment logs error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// ✅ DELETE — сонгосон log-уудыг устгах
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "IDs required" }, { status: 400 });
    }

    await Promise.all(
      ids.map((id: string) =>
        firestore.collection("payment_logs").doc(id).delete()
      )
    );

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error: any) {
    console.error("Delete logs error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}