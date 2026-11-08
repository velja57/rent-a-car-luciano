import { createContext, useContext } from 'react';
import en from './en';
import sr from './sr';

export const dictionaries = { sr, en };

export const I18nContext = createContext(null);

// { lang, t (rečnik), paths (adrese za taj jezik), localize(car), setLang, renderLink }
export function useI18n() {
  return useContext(I18nContext);
}
