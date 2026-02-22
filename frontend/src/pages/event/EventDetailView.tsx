import { Link } from "react-router-dom";
import type { Event } from "@/entities/event/types";
import Badge from "./components/Badge";
import { eventLifecycleBadge } from "@/shared/lib/eventLifecycle";
import EventMetaCard from "./components/EventMetaCard";
import AfterTrainingSection from "./components/AfterTrainingSection";
import { sportLabel } from "@/shared/lib/sport";

export default function EventDetailView({
  ev,
  isOrganizer,
  meId,
  statusColor,
  acting,
  onCancel,
  onDelete,
  onLaunch,
  onFinish,
}: {
  ev: Event;
  isOrganizer: boolean;
  meId: string | null;
  statusColor: string;
  acting: "cancel" | "delete" | "launch" | "finish" | null;
  onCancel: () => void;
  onDelete: () => void;
  onLaunch: () => void;
  onFinish: () => void;
}) {
  const kind = String((ev as any).kind || "EVENT").toUpperCase();
  const kindRu = kind === "TRAINING" ? "ТРЕНИРОВКА" : "СОБЫТИЕ";

  const sport = (ev as any).sport ? sportLabel((ev as any).sport) : "";
  const lifecycle = eventLifecycleBadge(ev);

  const startsAtMs = Date.parse(ev.startsAt);
  const nowMs = Date.now();
  const launchOpenMs = startsAtMs - 5 * 60 * 1000;
  const launchCloseMs = startsAtMs + 15 * 60 * 1000;
  const inLaunchWindow = nowMs >= launchOpenMs && nowMs <= launchCloseMs;

  const canDelete =
    isOrganizer &&
    !ev.launchedAt &&
    nowMs < startsAtMs &&
    ["DRAFT", "PUBLISHED", "CANCELLED"].includes(String(ev.status));

  const launchTitle =
    nowMs < launchOpenMs
      ? "Запуск доступен за 5 минут до начала"
      : nowMs > launchCloseMs
        ? "Окно запуска прошло (15 минут после начала)"
        : "Запуск доступен за 5 минут до начала и 15 минут после";

  const launchLabel = kind === "TRAINING" ? "Запустить тренировку" : "Запустить событие";

  // Кнопка завершения: после ручного запуска (в любое время)
  const canFinish = isOrganizer && Boolean((ev as any).launchedAt ?? ev.launchedAt) && !["CANCELLED", "FINISHED"].includes(String(ev.status));

  // admission (MANUAL/AUTO) — пользователям не показываем (особенно MANUAL)
  const admission = String((ev as any).admission || "").toUpperCase();
  const showAdmission = admission && admission !== "MANUAL";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {sport ? <Badge className="bg-slate-100 text-slate-800">{sport}</Badge> : null}
            <h1 className="min-w-0 truncate text-2xl font-semibold">{ev.title}</h1>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {lifecycle ? <Badge className={statusColor}>{lifecycle}</Badge> : null}
            <Badge className="bg-blue-100 text-blue-700">{kindRu}</Badge>
            {showAdmission ? <Badge className="bg-violet-100 text-violet-700">{admission}</Badge> : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {isOrganizer && (
            <>
              <Link
                to={`/event/${ev.id}/edit`}
                className="rounded-md bg-black px-3 py-1.5 text-sm text-white transition-transform hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                Редактировать
              </Link>

              {ev.status === "PUBLISHED" && (
                <button
                  disabled={acting === "cancel"}
                  onClick={onCancel}
                  className="rounded-md bg-orange-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {acting === "cancel" ? "Отмена…" : "Отменить"}
                </button>
              )}

              {ev.status === "PUBLISHED" && !ev.launchedAt && (
                <button
                  disabled={acting === "launch" || !inLaunchWindow}
                  onClick={onLaunch}
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  title={launchTitle}
                >
                  {acting === "launch" ? "Запуск…" : launchLabel}
                </button>
              )}

              {canFinish && (
                <button
                  disabled={acting === "finish"}
                  onClick={onFinish}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white transition-transform hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-50"
                  title="Завершение откроет оценки и финальные отметки"
                >
                  {acting === "finish" ? "Завершение…" : kind === "TRAINING" ? "Завершить тренировку" : "Завершить событие"}
                </button>
              )}

              {canDelete && (
                <button
                  disabled={acting === "delete"}
                  onClick={onDelete}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  title="Удаление доступно только до начала"
                >
                  {acting === "delete" ? "Удаление…" : "Удалить"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <EventMetaCard ev={ev} />

      <AfterTrainingSection ev={ev} isOrganizer={isOrganizer} meId={meId} />

      <div>
        <Link to="/map" className="text-sm text-blue-700 hover:underline">
          ← Вернуться на карту
        </Link>
      </div>
    </div>
  );
}
