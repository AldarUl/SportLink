import React from "react";

export default function ProfileEditPanel({
  displayName,
  setDisplayName,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  repeatPassword,
  setRepeatPassword,
  busy,
  onSave,
}: {
  displayName: string;
  setDisplayName: (v: string) => void;
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  repeatPassword: string;
  setRepeatPassword: (v: string) => void;
  busy: boolean;
  onSave: () => void | Promise<void>;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 text-sm font-semibold">Редактирование</div>

      <div>
        <div className="mb-1 text-xs text-gray-600">Имя</div>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Ваше имя"
          disabled={busy}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs text-gray-600">Текущий пароль</div>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Текущий"
            disabled={busy}
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-gray-600">Новый пароль</div>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Новый"
            disabled={busy}
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-gray-600">Повторите пароль</div>
          <input
            type="password"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Повтор"
            disabled={busy}
          />
        </div>
      </div>

      <div className="mt-3">
        <button
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={onSave}
          disabled={busy}
        >
          {busy ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
