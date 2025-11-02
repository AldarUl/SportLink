import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";
import { listSports, listMySkills, upsertSkill, deleteSkill } from "./api";

export default function SkillsGate() {
  // 1) Все хуки — без условий
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const location = useLocation();

  const [open, setOpen]     = useState(false);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [sports, setSports] = useState<{ code: string; name: string }[]>([]);
  const [skills, setSkills] = useState<{ sport: string; level: number; levelLabel?: string }[]>([]);

  // НЕ внутри if
  const onAuthPage = useMemo(() => location.pathname.startsWith("/auth"), [location.pathname]);

  // Показывать модалку?
  const shouldShow = isAuthed && !onAuthPage && open;

  // 2) Загрузка видов спорта и моих скиллов
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!isAuthed) {                // вылогин — закрываем
        if (alive) setOpen(false);
        return;
      }

      try {
        setBusy(true);
        const [sp, me] = await Promise.all([listSports(), listMySkills()]);
        if (!alive) return;

        setSports(sp || []);
        setSkills(me || []);
        setOpen((me?.length ?? 0) === 0); // открыть, если навыков ещё нет
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Не удалось загрузить навыки");
        setOpen(true);                 // дадим шанс попробовать ещё раз
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => { alive = false; };
  }, [isAuthed]);

  // 3) Хэндлеры
async function saveSkill(sport: string, level: number) {
  setBusy(true);
  try {
    await upsertSkill(sport, { level });
    const me = await listMySkills();
    setSkills(me || []);
    setError(null);
    // ⛔️ не закрываем модалку здесь
  } catch (e: any) {
    setError(e?.message || "Не удалось сохранить");
  } finally {
    setBusy(false);
  }
}

async function removeSkill(sport: string) {
  setBusy(true);
  try {
    await deleteSkill(sport);
    const me = await listMySkills();
    setSkills(me || []);
    setError(null);
    // ⛔️ тоже не трогаем setOpen()
  } catch (e: any) {
    setError(e?.message || "Не удалось удалить");
  } finally {
    setBusy(false);
  }
}

  // 4) Рендер — после всех хуков
  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl">
          <h2 className="mb-2 text-lg font-semibold">Выберите виды спорта и уровни</h2>

          {error && (
            <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="max-h-[40vh] overflow-y-auto rounded-md border">
            {sports.map((s) => {
              const my = skills.find((k) => k.sport.toLowerCase() === s.code.toLowerCase());
              return (
                <div key={s.code} className="flex items-center justify-between border-b px-3 py-2 last:border-b-0">
                  <div className="text-sm">{s.name}</div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded border px-2 py-1 text-sm"
                      value={my?.level ?? ""}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) saveSkill(s.code, v);
                      }}
                      disabled={busy}
                    >
                      <option value="">—</option>
                      <option value={1}>Новичок</option>
                      <option value={2}>Любитель</option>
                      <option value={3}>Уверенный</option>
                      <option value={4}>Продвинутый</option>
                      <option value={5}>Профи</option>
                    </select>

                    {my && (
                      <button
                        disabled={busy}
                        onClick={() => removeSkill(s.code)}
                        className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 disabled:opacity-50"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-600">* Минимум один навык, чтобы продолжить</div>
            <button
              disabled={busy || (skills?.length ?? 0) === 0}
              onClick={() => setOpen(false)}
              className={`rounded px-3 py-1 text-sm ${
                busy || (skills?.length ?? 0) === 0
                  ? "cursor-not-allowed bg-gray-200 text-gray-500"
                  : "bg-black text-white hover:bg-gray-900"
              }`}
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
