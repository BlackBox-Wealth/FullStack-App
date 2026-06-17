
import { useAuthStore } from '../store';
import { translations } from '../lib/translations';

export const useTranslation = () => {
  const { user } = useAuthStore();
  const lang = user?.language || 'en';
  
  // Safe language key mapping (e.g. handle 'pa' for punjabi, 'hi' for hindi)
  const langKey = translations[lang] ? lang : 'en';

  const t = (path: string) => {
    const keys = path.split('.');
    let result = translations[langKey];
    
    for (const key of keys) {
      if (result && result[key]) {
        result = result[key];
      } else {
        // Fallback to English if key missing in current language
        let fallback = translations['en'];
        for (const fKey of keys) {
          if (fallback && fallback[fKey]) {
            fallback = fallback[fKey];
          } else {
            return path; // Return path if totally missing
          }
        }
        return fallback;
      }
    }
    
    return result;
  };

  return { t, lang: langKey };
};
