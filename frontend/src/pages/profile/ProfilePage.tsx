// src/pages/profile/ProfilePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Avatar from "@/shared/Avatar";
import { useAuthStore } from "@/features/auth/store";
import { listSports, listMySkills } from "@/features/skills/api";
import type { UserDTO as User } from "@/features/user/api";
import { getUser, updateMe, listSkillsByUser, uploadAvatar, deleteAvatar } from "@/features/user/api";

const LEVEL_LABEL: Record<number, string> = {
  1: "Новичок",
  2: "Любитель",
  3: "Уверенный",
  4: "Продвинутый",
  5: "Профи",
};

type Sport = { code: string; name: string };
type Skill = { sport: string; level: number };

export default function ProfilePage() {
  const params = useParams<{ id?: string }>();
  const me = useAuthStore((s) => s.user as User | null);
  const amI = !params.id || Boolean(me?.id && String(params.id) === String(me.id));

  const [user, setUser] = useState<User | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // формы «только для меня»
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // аватар: превью перед сохранением + контроль загрузки
  const [imgLoaded, setImgLoaded] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => setImgLoaded(false), [user?.avatarUrl, previewUrl]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const sportName = useMemo(() => {
    const map = new Map(sports.map((s) => [s.code.toLowerCase(), s.name]));
    return (code: string) => map.get(code.toLowerCase()) || code;
  }, [sports]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError(null);
        setBusy(true);

        // 1) пользователь
        let u: User | null = null;

        if (amI && me?.id) {
        // всегда берём полную карточку себя, т.к. /auth/me не отдаёт avatarUrl
        u = await getUser(me.id);
        // заодно синхронизируем store, чтобы в остальном приложение тоже видело avatarUrl
        useAuthStore.setState({ user: u as any });
        } else if (params.id) {
        u = await getUser(params.id);
}
        if (!alive) return;

        setUser(u);
        setDisplayName(u?.displayName || "");

        // 2) справочник видов спорта
        const sp = await listSports();
        if (!alive) return;
        setSports(sp || []);

        // 3) навыки
        let ks: Skill[] = [];
        if (amI) ks = await listMySkills();
        else {
          try { ks = await listSkillsByUser(params.id!); } catch { ks = []; }
        }
        if (!alive) return;
        setSkills(ks || []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.response?.data?.message || e?.message || "Не удалось загрузить профиль");
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [amI, me?.id, params.id]);






async function handleSaveProfile(e: React.FormEvent) {
  e.preventDefault();
  if (!amI) return;

  try {
    setBusy(true);
    setError(null);

    let nextUser = user as User;

    const needProfileUpdate =
      (displayName?.trim() ?? "") !== (user?.displayName ?? "") || Boolean(newPassword);

    if (needProfileUpdate) {
      nextUser = await updateMe({
        displayName: displayName?.trim() || undefined,
        currentPassword: newPassword ? currentPassword || undefined : undefined,
        newPassword: newPassword || undefined,
      });
      setCurrentPassword("");
      setNewPassword("");
    }

    if (pendingFile) {
      const uploaded = await uploadAvatar(pendingFile);
      const url = uploaded.avatarUrl
        ? uploaded.avatarUrl + (uploaded.avatarUrl.includes("?") ? "&" : "?") + "t=" + Date.now()
        : null;

      nextUser = { ...uploaded, avatarUrl: url };

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPendingFile(null);
    }

    // 👉 единое обновление стора и локального стейта
    useAuthStore.setState({
      user: { ...(useAuthStore.getState().user || {}), ...nextUser } as any,
    });
    setUser(nextUser);
  } catch (e: any) {
    setError(e?.response?.data?.message || e?.message || "Не удалось сохранить");
  } finally {
    setBusy(false);
  }
}




  if (!user) return null;

  const displayAvatar = previewUrl || user.avatarUrl || null;

  return (
    <div className="p-4">
      {/* Шапка профиля */}
      <div className="mb-4 flex items-center gap-4">
        <div className="relative h-[90px] w-[90px] rounded-full overflow-hidden">
          {(!displayAvatar || !imgLoaded) && (
            <Avatar
              name={user.displayName || undefined}
              email={user.email}
              size={90}
            />
          )}

          {displayAvatar && (
            <img
              key={displayAvatar}
              src={displayAvatar}
              alt=""
              role="presentation"
              aria-hidden="true"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(false)}
              loading="lazy"
            />
          )}
        </div>

        <div>
          <div className="text-xl font-semibold">{user.displayName || "Без имени"}</div>
          <div className="text-gray-600">{user.email}</div>
          {!amI && <div className="mt-1 text-xs text-gray-500">Публичный профиль</div>}

          {amI && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (!f) return;
                    if (f.size > 6 * 1024 * 1024) {
                      alert("Файл больше 6MB");
                      (e.target as HTMLInputElement).value = "";
                      return;
                    }
                    setPendingFile(f);
                    const url = URL.createObjectURL(f);
                    setPreviewUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return url;
                    });
                    (e.target as HTMLInputElement).value = "";
                  }}
                />
                Загрузить аватар
              </label>

              {user.avatarUrl && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      await deleteAvatar();
                      setUser((u) => (u ? { ...u, avatarUrl: null } : u));
                      useAuthStore.setState({
                        user: { ...(useAuthStore.getState().user || {}), avatarUrl: null } as any,
                      });
                    } catch (err: any) {
                      setError(err?.response?.data?.message || err?.message || "Не удалось удалить аватар");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-md bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200 disabled:opacity-50"
                >
                  Удалить
                </button>
              )}

              {pendingFile && (
                <>
                  <span className="text-xs text-gray-500">
                    Выбран файл: {pendingFile.name}. Нажмите «Сохранить», чтобы применить.
                  </span>
                  <button
                    type="button"
                    className="rounded-md bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                    onClick={() => {
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                      setPendingFile(null);
                    }}
                  >
                    Отменить
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}

      {/* Навыки */}
      <section className="mb-6">
        <div className="mb-2 text-sm font-semibold">Уровни в видах спорта</div>
        {!skills.length ? (
          <div className="rounded-md border p-3 text-sm text-gray-600">
            {amI ? "Вы ещё не заполнили навыки." : "Навыки не указаны."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {skills
              .sort((a, b) => a.sport.localeCompare(b.sport))
              .map((k) => (
                <div key={k.sport} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="text-sm">{sportName(k.sport)}</div>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    {LEVEL_LABEL[k.level] || k.level}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Редактирование — только для меня */}
      {amI && (
        <section className="mb-6 rounded-xl border p-4">
          <div className="mb-3 text-sm font-semibold">Редактировать профиль</div>
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Отображаемое имя</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={120}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-600">Текущий пароль</label>
                <input
                  type="password"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="введите, если меняете пароль"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Новый пароль</label>
                <input
                  type="password"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="не менее 6 символов"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {busy ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
