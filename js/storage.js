(() => {
  "use strict";

  const KEY = "yaduvanshi.preferences.v1";
  const DEFAULTS = Object.freeze({
    theme: "light",
    category: "all",
    status: "all",
    sort: "date-desc"
  });

  function read() {
    try {
      const saved = localStorage.getItem(KEY);
      const parsed = JSON.parse(saved || "{}");
      return {
        ...DEFAULTS,
        ...parsed,

        theme: parsed.theme === "dark" ? "dark" : "light",
        category: typeof parsed.category === "string" ? parsed.category : "all",
        status: [ "all", "TODO", "IN_PROGRESS", "COMPLETED" ].includes(parsed.status) ? parsed.status : "all",
        sort: [ "date-desc", "date-asc", "title-asc", "title-desc", "priority-desc", "updated-desc" ].includes(parsed.sort) ? parsed.sort : "date-desc"
      };
    } catch (error) {
      console.warn( "[Yaduvanshi Desk] Preferences could not be read.", error );
      return { ...DEFAULTS };
    }
  }

  let preferences = read();
  function save() {
    try {
      localStorage.setItem( KEY, JSON.stringify(preferences) );
      return true;
    } catch (error) {
      console.warn( "[Yaduvanshi Desk] Preferences could not be saved.", error );
      return false;
    }
  }

  window.YaduvanshiStorage = Object.freeze({
    get: (key) => preferences[key],
    getAll: () => ({ ...preferences }),
    set(key, value) {
      if (!Object.hasOwn(DEFAULTS, key)) {
        return false;
      }
      preferences[key] = value;
      return save();
    },

    resetFilters() {
      preferences.category = DEFAULTS.category;
      preferences.status = DEFAULTS.status;
      preferences.sort = DEFAULTS.sort;
      return save();
    }
  });
})();