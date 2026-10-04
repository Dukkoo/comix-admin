import { firestore } from "@/firebase/server";

export async function clearUserDevices(
  userRef: FirebaseFirestore.DocumentReference
) {
  // 1. Subcollection байвал устгах (batch лимит 500 тул хуваана)
  const devicesSnap = await userRef.collection("devices").get();
  const docs = devicesSnap.docs;

  for (let i = 0; i < docs.length; i += 450) {
    const batch = firestore.batch();
    docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // 2. User document доторх талбарыг цэвэрлэх
  await userRef.update({
    devices: [],
    deviceCount: 0,
  });

  return docs.length;
}