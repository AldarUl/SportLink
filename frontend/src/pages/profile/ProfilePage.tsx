import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  deleteAvatar,
  getUser,
  listSkillsByUser,
  updateMe,
  uploadAvatar,
  type UserDTO as User,
} from "@/features/user/api";
import {
  addMySkill,
  deleteMySkill,
  listMySkills,
  listSports,
  type Sport,
  type UserSkill,
} from "@/features/skills/api";
import { useAuthStore } from "@/features/auth/store";
import { useApplicationStore } from "@/entities/application/store";
import { listReviewsByEvent } from "@/entities/review/api";
import type { Review } from "@/entities/review/types";
import { http } from "@/api/http";
import ProfileHeader from "./components/ProfileHeader";
import SkillsSection from "./components/SkillsSection";
import ProfileEditPanel from "./components/ProfileEditPanel";

function roleLabel(u: User) {
  const roles = (u.roles ?? []) as string[];
  if (roles.includes("ADMIN")) return "Админ";
  if (roles.includes("ORGANIZER")) return "Организатор";
  return "Участник";
}

export default function ProfilePage() {
  const params = useParams();
  const me = useAuthStore((s: any) => s.user || null);
  const setMe = useAuthStore((s: any) => s.setUser);
  const accessToken = useAuthStore((s: any) => s.accessToken);

  const loadMineApps = useApplicationStore((s: any) => s.loadMine);

  const paramId = params.id ? String(params.id) : null;
  const amI = !paramId || (me?.id && String(me.id) === paramId);
  const targetId = amI ? (me?.id ? String(me.id) : null) : paramId;

  const [busy, setBusy] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [avatarUploading, setAvatarUploading] = React.useState(false);

  const [user, setUser] = React.useState<User | null>(null);
  const [sports, setSports] = React.useState<Sport[]>([]);
  const [skills, setSkills] = React.useState<UserSkill[]>([]);

  const [displayName, setDisplayName] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [repeatPassword, setRepeatPassword] = React.useState("");

  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = React.useState(false);

  type ReceivedReview = Review & {
    eventTitle?: string;
    authorName?: string;
  };
  const [receivedReviews, setReceivedReviews] = React.useState<ReceivedReview[]>([]);
  const [avgRating, setAvgRating] = React.useState<number | null>(null);
  const [reviewsLoading, setReviewsLoading] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  React.useEffect(() => {
    if (!targetId) {
      setBusy(false);
      return;
    }

    let ignore = false;
    (async () => {
      setBusy(true);
      try {
        const [u, sp, sk] = await Promise.all([
          getUser(targetId),
          listSports().catch(() => []),
          amI ? listMySkills().catch(() => []) : listSkillsByUser(targetId).catch(() => []),
        ]);
        if (ignore) return;
        setUser(u);
        setSports(sp);
        setSkills(sk);
        setDisplayName(u.displayName || "");
        setImgLoaded(false);

        if (amI) setMe(u);
      } finally {
        if (!ignore) setBusy(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [targetId, amI, setMe]);

  // Оценки, полученные пользователем (делаем для своего профиля на основе событий, где есть отзывы)
  React.useEffect(() => {
    if (!amI || !targetId || !accessToken) {
      setReceivedReviews([]);
      setAvgRating(null);
      return;
    }

    let ignore = false;
    (async () => {
      setReviewsLoading(true);
      try {
        // 1) пытаемся взять legacy-выдачу (с вложенным событием), чтобы не тянуть события по одному
        let mineLegacy: any[] | null = null;
        try {
          const { data } = await http.get("/application/mine");
          mineLegacy = Array.isArray(data) ? data : null;
        } catch {
          mineLegacy = null;
        }

        // 2) fallback: загрузим обычные заявки, если legacy недоступен
        if (!mineLegacy) {
          try {
            await loadMineApps?.(0, 200);
          } catch {}
        }

        const mineNow = mineLegacy ?? ((useApplicationStore.getState() as any).mine as any[]);

        // подсказки по названиям событий
        const titleByEventId = new Map<string, string>();
        for (const a of mineNow || []) {
          const id = String(a?.eventId || "").toLowerCase();
          const t = a?.event?.title;
          if (id && t) titleByEventId.set(id, String(t));
        }

        // берём только те события, по которым есть шанс получить отзывы (завершённые или уже прошедшие)
        const now = Date.now();
        const candidateEventIds = Array.from(
          new Set(
            (mineNow || [])
              .filter((a) => {
                const ev = a?.event;
                if (!ev) return false;
                const st = String(ev.status || "").toUpperCase();
                if (st === "FINISHED") return true;
                const startBase = Date.parse(ev.launchedAt || ev.startsAt);
                const dur = Number(ev.durationMin || 0);
                const end = startBase + dur * 60 * 1000;
                return Number.isFinite(end) && end < now;
              })
              .map((a) => String(a?.eventId || "").toLowerCase())
              .filter(Boolean)
          )
        );

        // запросы отзывов по каждому событию (targetId фильтрует только отзывы о пользователе)
        const pages = await Promise.allSettled(
          candidateEventIds.map((eventId) => listReviewsByEvent(eventId, targetId, 0, 50))
        );

        const all: Review[] = [];
        for (const r of pages) {
          if (r.status === "fulfilled") {
            const content = r.value?.content ?? [];
            for (const it of content) all.push(it);
          }
        }

        if (ignore) return;

        // авторы
        const authorIds = Array.from(new Set(all.map((x) => String(x.authorId)).filter(Boolean)));
        const authorRes = await Promise.allSettled(authorIds.map((id) => getUser(id)));
        const authorNameById = new Map<string, string>();
        authorRes.forEach((r, idx) => {
          const id = authorIds[idx];
          if (r.status === "fulfilled") {
            const u = r.value as any;
            authorNameById.set(id, u?.displayName || u?.email || id);
          }
        });

        const enriched: ReceivedReview[] = all
          .map((x) => {
            const evId = String(x.eventId).toLowerCase();
            return {
              ...x,
              eventTitle: titleByEventId.get(evId) || "Тренировка / событие",
              authorName: authorNameById.get(String(x.authorId)) || "Пользователь",
            };
          })
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

        const avg = enriched.length
          ? enriched.reduce((sum, x) => sum + Number(x.rating || 0), 0) / enriched.length
          : null;

        setReceivedReviews(enriched);
        setAvgRating(avg ? Math.round(avg * 10) / 10 : null);
      } finally {
        if (!ignore) setReviewsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [amI, targetId, accessToken, loadMineApps]);

  const avatarSrc = previewUrl || user?.avatarUrl || null;

  const handlePickAvatar = (file: File) => {
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setImgLoaded(false);
  };

  const handleRemoveAvatar = async () => {
    if (!user || !amI) return;
    if (!confirm("Удалить аватар?")) return;

    setAvatarUploading(true);
    try {
      await deleteAvatar();
      const updated: User = { ...user, avatarUrl: null };
      setUser(updated);
      setMe(updated);
      setPreviewUrl(null);
      setPendingFile(null);
      setImgLoaded(false);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !amI) return;

    if (newPassword || repeatPassword) {
      if (!currentPassword) {
        alert("Введите текущий пароль");
        return;
      }
      if (newPassword !== repeatPassword) {
        alert("Пароли не совпадают");
        return;
      }
    }

    setSaving(true);
    try {
      // 1) профиль
      const updated = await updateMe({
        displayName: displayName || null,
        currentPassword: currentPassword || null,
        newPassword: newPassword || null,
      });
      setUser(updated);
      setMe(updated);

      // 2) аватар
      if (pendingFile) {
        setAvatarUploading(true);
        try {
          const u2 = await uploadAvatar(pendingFile);
          setUser(u2);
          setMe(u2);
        } finally {
          setAvatarUploading(false);
          setPendingFile(null);
          setPreviewUrl(null);
          setImgLoaded(false);
        }
      }

      // 3) очистить поля пароля
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      alert("Сохранено");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = async (sportCode: string, level: number) => {
    setSaving(true);
    try {
      const s = await addMySkill(sportCode, level);
      setSkills((prev) => {
        const without = prev.filter((x) => x.sport !== s.sport);
        return [...without, s];
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSkill = async (sportCode: string) => {
    setSaving(true);
    try {
      await deleteMySkill(sportCode);
      setSkills((prev) => prev.filter((x) => x.sport !== sportCode));
    } finally {
      setSaving(false);
    }
  };

  if (busy) return <div className="p-6">Загрузка…</div>;
  if (!user) return <div className="p-6">Профиль не найден.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Профиль</h1>
        <Link to="/map" className="text-sm text-blue-700 hover:underline">
          ← На карту
        </Link>
      </div>

      <ProfileHeader
        user={user}
        avatarSrc={avatarSrc}
        imgLoaded={imgLoaded}
        onImageLoad={() => setImgLoaded(true)}
        amI={amI}
        avatarUploading={avatarUploading}
        onPickFile={handlePickAvatar}
        onRemove={handleRemoveAvatar}
        extra={
          <div className="mt-1 space-y-1 text-sm text-gray-600">
            <div>Роль: {roleLabel(user)}</div>
            {avgRating != null && (
              <div>
                Средняя оценка: <span className="font-semibold text-gray-900">{avgRating}</span> / 5
                {receivedReviews.length ? ` (${receivedReviews.length})` : ""}
              </div>
            )}
          </div>
        }
      />

      {amI && (
        <div className="rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Оценки</div>
            {avgRating != null && (
              <div className="text-sm text-gray-700">
                Средняя: <span className="font-semibold text-gray-900">{avgRating}</span> / 5
              </div>
            )}
          </div>

          {reviewsLoading ? (
            <div className="text-sm text-gray-600">Загрузка оценок…</div>
          ) : !receivedReviews.length ? (
            <div className="text-sm text-gray-600">Пока нет полученных оценок.</div>
          ) : (
            <div className="space-y-2">
              {receivedReviews.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.eventTitle}</div>
                    <div className="text-xs text-gray-500">
                      От: <span className="text-gray-800">{r.authorName}</span>
                      {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleString("ru-RU")}` : ""}
                    </div>
                    {r.comment && <div className="mt-1 text-sm text-gray-800">{r.comment}</div>}
                  </div>

                  <div className="shrink-0 rounded-lg bg-gray-900 px-2.5 py-1 text-sm font-semibold text-white">
                    {r.rating}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SkillsSection
        sports={sports}
        skills={skills}
        amI={amI}
        saving={saving}
        onAddOrUpdate={handleAddSkill}
        onDelete={handleDeleteSkill}
      />

      {amI && (
        <ProfileEditPanel
          displayName={displayName}
          setDisplayName={setDisplayName}
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          repeatPassword={repeatPassword}
          setRepeatPassword={setRepeatPassword}
          busy={saving || avatarUploading}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
