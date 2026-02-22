function firstLetter(name?: string | null, email?: string | null) {
  const s = (name && name.trim()) || (email && email.trim()) || "";
  const ch = s ? s[0] : "?";
  return ch.toUpperCase();
}

export default function AvatarCircle({
  avatarUrl,
  name,
  email,
  size = 40,
  className = "",
}: {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || email || "avatar"}
        width={size}
        height={size}
        className={`rounded-full border object-cover ${className}`}
        loading="lazy"
      />
    );
  }

  const letter = firstLetter(name, email);
  return (
    <div
      className={`rounded-full border bg-gray-100 text-gray-800 flex items-center justify-center font-semibold ${className}`}
      style={{ width: size, height: size, lineHeight: 1 }}
      aria-label={name || email || "user"}
      title={name || email || ""}
    >
      <span className="leading-none">{letter}</span>
    </div>
  );
}
