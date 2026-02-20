import React from "react";
import { Link } from "react-router-dom";
import { http } from "@/api/http";

export type UserProfile = { id: string; email?: string; displayName?: string };

const userCache = new Map<string, UserProfile>();

async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    if (userCache.has(userId)) return userCache.get(userId)!;
    const { data } = await http.get(`/user/${userId}`);
    userCache.set(userId, data);
    return data;
  } catch (e) {
    console.warn("loadUserProfile failed", e);
    return null;
  }
}

export function UserInline({ userId }: { userId: string }) {
  const [p, setP] = React.useState<UserProfile | null>(userCache.get(userId) || null);

  React.useEffect(() => {
    let dead = false;
    if (!userCache.has(userId)) {
      loadUserProfile(userId).then((u) => {
        if (!dead && u) setP(u);
      });
    }
    return () => {
      dead = true;
    };
  }, [userId]);

  const name = p?.displayName || p?.email || `Пользователь ${userId.slice(0, 8)}`;
  return (
    <Link to={`/profile/${userId}`} className="text-sm font-medium hover:underline">
      {name}
    </Link>
  );
}
