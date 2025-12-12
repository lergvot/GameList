// web/js/localisation.js
class Localisation {
  constructor() {
    this.currentLang = "ru";
    this.translations = {};
    this.availableLangs = {
      ru: { name: "Русский", native: "Русский" },
      en: { name: "English", native: "English" },
    };
    this.loadedTranslations = {};
  }

  async init() {
    const savedLang = localStorage.getItem("lang");
    this.currentLang = savedLang || "ru";

    await this.loadLanguage(this.currentLang);

    this.renderLanguageSelector();
    this.applyTranslations();
    this.setupLanguageSwitchHandler();

    return this.currentLang;
  }

  async loadLanguage(lang) {
    try {
      let translationModule;

      switch (lang) {
        case "ru":
          translationModule = await import("./translations/ru.js");
          break;
        case "en":
          translationModule = await import("./translations/en.js");
          break;
        default:
          translationModule = await import("./translations/ru.js");
          lang = "ru";
      }

      this.loadedTranslations[lang] = translationModule.default;
      this.translations = translationModule.default;
      this.currentLang = lang;

      localStorage.setItem("lang", lang);

      console.log(`Loaded ${lang} language`);
    } catch (error) {
      console.error(`Failed to load ${lang} language:`, error);
      if (lang !== "ru") {
        await this.loadLanguage("ru");
      }
    }
  }

  t(key, params = {}) {
    let text = this.translations[key] || key;

    Object.keys(params).forEach((param) => {
      const placeholder = `{${param}}`;
      if (text.includes(placeholder)) {
        text = text.replace(new RegExp(placeholder, "g"), params[param]);
      }
    });

    return text;
  }

  renderLanguageSelector() {
    const select = document.getElementById("language-select");
    if (!select) return;

    const currentClasses = select.className;

    select.innerHTML = "";

    Object.entries(this.availableLangs).forEach(([code, lang]) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = lang.native;
      select.appendChild(option);
    });

    select.value = this.currentLang;
    select.className = currentClasses;
  }

  setupLanguageSwitchHandler() {
    const select = document.getElementById("language-select");
    if (!select) return;

    select.addEventListener("change", async (e) => {
      const newLang = e.target.value;

      if (newLang !== this.currentLang) {
        await this.loadLanguage(newLang);
        this.applyTranslations();
        this.renderLanguageSelector();

        if (window.app && window.app.loadAndRender) {
          await window.app.loadAndRender();
        }
      }
    });
  }

  applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const text = this.t(key);
      if (text !== key) {
        el.textContent = text;
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const text = this.t(key);
      if (text !== key) {
        el.placeholder = text;
      }
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      const text = this.t(key);
      if (text !== key) {
        el.title = text;
        if (el.hasAttribute("data-tooltip")) {
          el.setAttribute("data-tooltip", text);
        }
      }
    });

    document.querySelectorAll("option[data-i18n-value]").forEach((el) => {
      const key = el.getAttribute("data-i18n-value");
      const text = this.t(key);
      if (text !== key) {
        el.textContent = text;
      }
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      const text = this.t(key);
      if (text !== key) {
        el.setAttribute("aria-label", text);
      }
    });
  }

  getCurrentLang() {
    return this.currentLang;
  }

  async changeLanguage(lang) {
    if (lang === this.currentLang || !this.availableLangs[lang]) {
      return;
    }

    await this.loadLanguage(lang);
    this.applyTranslations();
    this.renderLanguageSelector();

    return Promise.resolve();
  }
}

const locale = new Localisation();

export const t = (key, params) => locale.t(key, params);

export default locale;
