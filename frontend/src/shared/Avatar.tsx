import React from "react";

function initialsSeed(name?: string | null, email?: string | null) {
  const s = (name && name.trim()) || (email && email.trim()) || "user";
  return encodeURIComponent(s);
}

export default function Avatar({
  name,
  email,
  size = 80,
  className = "",
}: { name?: string | null; email?: string | null; size?: number; className?: string }) {
  // DiceBear Initials – без внешних зависимостей
  const src = `https://api.dicebear.com/7.x/initials/svg?seed=${initialsSeed(name, email)}&radius=50`;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={name || email || "avatar"}
      className={`rounded-full border object-cover ${className}`}
      loading="lazy"
    />
  );
}
