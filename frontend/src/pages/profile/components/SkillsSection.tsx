import React from "react";
import type { Sport, UserSkill } from "@/features/skills/api";

export default function SkillsSection({
  sports,
  skills,
  amI,
  saving,
  onAddOrUpdate,
  onDelete,
}: {
  sports: Sport[];
  skills: UserSkill[];
  amI: boolean;
  saving: boolean;
  onAddOrUpdate: (sportCode: string, level: number) => void | Promise<void>;
  onDelete: (sportCode: string) => void | Promise<void>;
}) {
  const [newSport, setNewSport] = React.useState<string>(sports?.[0]?.code ?? "");
  const [newLevel, setNewLevel] = React.useState<number>(1);

  const LEVELS: Array<{ value: number; label: string }> = [
    { value: 1, label: "Новичок" },
    { value: 2, label: "Любитель" },
    { value: 3, label: "Уверенный" },
    { value: 4, label: "Продвинутый" },
    { value: 5, label: "Профи" },
  ];

  const nameByCode = React.useMemo(() => {
    const m = new Map<string, string>();
    (sports || []).forEach((s) => m.set(s.code, s.name));
    return m;
  }, [sports]);

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 text-sm font-semibold">Навыки / виды спорта</div>

      {!skills.length && <div className="text-sm text-gray-500">Навыков пока нет.</div>}

      {!!skills.length && (
        <div className="space-y-2">
          {skills.map((sk) => (
            <div key={sk.sport} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {nameByCode.get(sk.sport) || sk.sport}
                </div>
                <div className="text-xs text-gray-500">Уровень: {sk.levelLabel ?? sk.level}</div>
              </div>

              {amI && (
                <button
                  onClick={() => onDelete(sk.sport)}
                  disabled={saving}
                  className="rounded-md border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  Удалить
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {amI && (
        <div className="mt-4 rounded-lg border bg-gray-50 p-3">
          <div className="mb-2 text-xs font-semibold text-gray-700">Добавить / обновить</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={newSport}
              onChange={(e) => setNewSport(e.target.value)}
              disabled={saving}
            >
              {(sports || []).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={newLevel}
              onChange={(e) => setNewLevel(Number(e.target.value))}
              disabled={saving}
            >
              {LEVELS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>

            <button
              className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={saving || !newSport}
              onClick={() => onAddOrUpdate(newSport, newLevel)}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
