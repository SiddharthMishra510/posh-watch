import { en } from "./en";
import { hi } from "./hi";
import { mr } from "./mr";
import type { Dict, Lang } from "./types";

export * from "./types";

const dicts: Record<Lang, Dict> = { en, mr, hi };
export const getDict = (lang: Lang) => dicts[lang];
