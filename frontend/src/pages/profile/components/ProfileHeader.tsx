import React from "react";
import type { UserDTO } from "@/features/user/api";
import Avatar from "@/shared/Avatar";

export default function ProfileHeader({
  user,
  avatarSrc,
  imgLoaded,
  onImageLoad,
  amI,
  avatarUploading,
  onPickFile,
  onRemove,
  extra,
}: {
  user: UserDTO;
  avatarSrc: string | null;
  imgLoaded: boolean;
  onImageLoad: () => void;
  amI: boolean;
  avatarUploading: boolean;
  onPickFile: (file: File) => void;
  onRemove: () => void | Promise<void>;
  extra?: React.ReactNode;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const name = user.displayName || user.email || "Профиль";
  const subtitle = user.email ? user.email : "";

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full bg-gray-100">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="avatar"
              className={`h-full w-full object-cover transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={onImageLoad}
            />
          ) : (
            <Avatar seed={user.email || user.displayName || "user"} size={64} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold">{name}</div>
          {subtitle && <div className="truncate text-sm text-gray-500">{subtitle}</div>}
          {extra}

          {amI && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  onPickFile(f);
                  // чтобы повторный выбор того же файла сработал
                  e.currentTarget.value = "";
                }}
              />

              <button
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => inputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? "Загрузка…" : "Выбрать аватар"}
              </button>

              <button
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={onRemove}
                disabled={avatarUploading || !user.avatarUrl}
                title={!user.avatarUrl ? "Нет аватара" : ""}
              >
                Удалить аватар
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
