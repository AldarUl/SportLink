import React from "react";
import { Link } from "react-router-dom";
import { getUser } from "@/features/user/api";

export type UserProfile = {
  id: string;
  email?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

const userCache = new Map<string, UserProfile>();

function dicebearInitials(name?: string | null, email?: string | null) {
  const s = (name && name.trim()) || (email && email.trim()) || "user";
  const seed = encodeURIComponent(s);
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&radius=50`;
}

async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    if (userCache.has(userId)) return userCache.get(userId)!;
    const u = await getUser(userId);
    userCache.set(userId, u);
    return u;
  } catch (e) {
    console.warn("loadUserProfile failed", e);
    return null;
  }
}

export function UserInline({ userId, className = "" }: { userId: string; className?: string }) {
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

  const name = (p?.displayName || p?.email || "Пользователь").trim();
  const avatarSrc = p?.avatarUrl || dicebearInitials(p?.displayName, p?.email);

  return (
    <Link
      to={`/profile/${userId}`}
      className={`inline-flex min-w-0 items-center gap-2 hover:underline ${className}`}
      title={name}
    >
      <img
        src={avatarSrc}
        alt={name}
        className="h-6 w-6 flex-none rounded-full border object-cover"
        loading="lazy"
      />
      <span className="min-w-0 truncate text-sm font-medium">{name}</span>
    </Link>
  );
}
