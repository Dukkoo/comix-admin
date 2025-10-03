'use client';

import { auth } from "@/firebase/client";
import { signInWithEmailAndPassword, User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setToken, removeToken } from "@/context/actions";

type AuthContextType = {
    currentUser: User | null;
    logout: () => Promise<void>;
    loginWithEmail: (email: string, password: string) => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            try {
                setCurrentUser(user ?? null);
                
                if (user) {
                    const tokenResult = await user.getIdTokenResult();
                    const token = tokenResult.token;
                    const refreshToken = user.refreshToken;
                    
                    if (token && refreshToken) {
                        await setToken({ token, refreshToken });
                    }

                    // Login page-с dashboard руу redirect
                    const currentPath = window.location.pathname;
                    if (currentPath === '/login') {
                        router.push('/');
                    }
                } else {
                    await removeToken();
                }
            } catch (error) {
                console.error("Auth state change error:", error);
                setCurrentUser(null);
                await removeToken();
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const logout = async () => {
        try {
            await auth.signOut();
            setCurrentUser(null);
            await removeToken();
            router.push('/login');
        } catch (error) {
            console.error("Logout error:", error);
            throw error;
        }
    }
    
    const loginWithEmail = async (email: string, password: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Login error:", error);
            throw error;
        }
    }

    return (
        <AuthContext.Provider value={{
            currentUser,
            logout,
            loginWithEmail,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};