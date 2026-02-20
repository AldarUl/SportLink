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
        extra={<div className="mt-1 text-sm text-gray-600">Роль: {roleLabel(user)}</div>}
      />

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
