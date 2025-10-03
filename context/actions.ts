"use server"

import { auth } from "@/firebase/server";
import { cookies } from "next/headers";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "dulgn6@gmail.com";

export const removeToken = async () => {
    const cookieStore = await cookies();
    cookieStore.delete("firebaseAuthToken");
    cookieStore.delete("firebaseAuthRefreshToken");
};

export const setToken = async ({
    token,
    refreshToken
}: {
    token: string;
    refreshToken: string;
}) => {
    try {
        const verifiedToken = await auth.verifyIdToken(token);
        if (!verifiedToken) {
            return;
        }

        const userRecord = await auth.getUser(verifiedToken.uid);
        
        // Зөвхөн admin email шалгах
        if (userRecord.email !== ADMIN_EMAIL) {
            console.log("Non-admin user attempted to access admin panel");
            return; // Token хадгалахгүй
        }

        // Admin claim нэмэх (хэрэв байхгүй бол)
        if (!userRecord.customClaims?.admin) {
            await auth.setCustomUserClaims(verifiedToken.uid, {
                admin: true
            });
        }

        const cookieStore = await cookies();
        cookieStore.set("firebaseAuthToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24, // 24 hours
        });
    } catch (e) {
        console.log("setToken error:", e);
    }
};