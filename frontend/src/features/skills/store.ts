import { create } from "zustand";
import { listMySkills, type UserSkill } from "./api";
import { normalizeSportCode } from "@/shared/lib/sport";

type SkillState = {
  skills: UserSkill[];
  loaded: boolean;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  setSkills: (skills: UserSkill[]) => void;
  clear: () => void;

  getLevelFor: (sportCode: string) => number | null;
};

function normSkills(arr: UserSkill[]): UserSkill[] {
  return (arr || []).map((s) => ({
    ...s,
    sport: normalizeSportCode(s.sport),
    level: Number(s.level || 0),
  }));
}

export const useMySkillsStore = create<SkillState>((set, get) => ({
  skills: [],
  loaded: false,
  loading: false,
  error: null,

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const data = await listMySkills();
      set({ skills: normSkills(data), loaded: true, loading: false });
    } catch (e: any) {
      const status = e?.response?.status;
      // если не авторизован/токен протух — просто сбрасываем
      if (status === 401 || status === 403) {
        set({ skills: [], loaded: false, loading: false, error: null });
        return;
      }
      set({ loading: false, loaded: true, error: e?.response?.data?.message || e?.message || "Не удалось загрузить навыки" });
    }
  },

  setSkills: (skills) => set({ skills: normSkills(skills || []), loaded: true, error: null }),
  clear: () => set({ skills: [], loaded: false, loading: false, error: null }),

  getLevelFor: (sportCode: string) => {
    const code = normalizeSportCode(sportCode);
    const sk = get().skills.find((x) => normalizeSportCode(x.sport) === code);
    const lvl = sk ? Number(sk.level) : NaN;
    return Number.isFinite(lvl) && lvl > 0 ? lvl : null;
  },
}));
