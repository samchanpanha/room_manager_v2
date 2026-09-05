import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  DICT,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_META,
  isLocale,
  tIn,
  tfIn,
  tNavIn,
  toLocale
} from "@/lib/i18n";

describe("i18n", () => {
  it("supports exactly en, km, zh", () => {
    expect(LOCALES).toEqual(["en", "km", "zh"]);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("km")).toBe(true);
    expect(isLocale("zh")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(42)).toBe(false);
  });

  it("reduces BCP-47 tags to supported bases", () => {
    expect(toLocale("en-US")).toBe("en");
    expect(toLocale("zh_CN")).toBe("zh");
    expect(toLocale("KM")).toBe("km");
    expect(toLocale("fr-FR")).toBeNull();
    expect(toLocale(undefined)).toBeNull();
    expect(toLocale("")).toBeNull();
  });

  it("has locale metadata for every language", () => {
    for (const locale of LOCALES) {
      expect(LOCALE_META[locale].code).toBe(locale);
      expect(LOCALE_META[locale].native.length).toBeGreaterThan(0);
      expect(LOCALE_META[locale].name.length).toBeGreaterThan(0);
      expect(LOCALE_META[locale].htmlLang).toMatch(/^([a-z]{2}(-[A-Za-z]{2})?)$/);
    }
  });

  it("keeps the same key set across all locales (no missing/extra translations)", () => {
    const enKeys = Object.keys(DICT.en).sort();
    expect(enKeys.length).toBeGreaterThan(40);
    for (const locale of LOCALES) {
      expect(Object.keys(DICT[locale]).sort()).toEqual(enKeys);
    }
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(DICT[locale])) {
        expect(value.length, `${locale}:${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("translates in the requested locale, English being the default", () => {
    expect(tIn(DEFAULT_LOCALE, "nav.admin")).toBe("Administration");
    expect(tIn("km", "nav.admin")).toBe("ការគ្រប់គ្រង");
    expect(tIn("zh", "nav.admin")).toBe("系统管理");
  });

  it("falls back to English, then the key itself", () => {
    // Present in en but intentionally absent from km/zh → English fallback.
    DICT.en["test.enOnly"] = "English only";
    try {
      expect(tIn("km", "test.enOnly")).toBe("English only");
    } finally {
      delete DICT.en["test.enOnly"];
    }
    expect(tIn("zh", "test.missing.everywhere")).toBe("test.missing.everywhere");
  });

  it("translates nav items by English label and falls back to the label", () => {
    expect(tNavIn("zh", "Dashboard")).toBe("仪表板");
    expect(tNavIn("km", "Dashboard")).toBe("ផ្ទាំងគ្រប់គ្រង");
    expect(tNavIn("en", "Not A Nav Item")).toBe("Not A Nav Item");
  });

  it("interpolates {var} placeholders", () => {
    expect(tfIn("en", "tabs.hint", { n: 2, max: 12 })).toBe("2/12 tabs · right-click a tab for close options");
    expect(tfIn("zh", "shell.phaseHint", { phase: 5 })).toBe("计划于第 5 阶段推出");
    expect(tfIn("km", "shell.phaseHint", { phase: 5 })).toBe("កំណត់សម្រាប់ដំណាក់កាល 5");
  });

  it("exposes the locale cookie name used by the LanguageSwitcher", () => {
    expect(LOCALE_COOKIE).toBe("rm-locale");
  });
});
