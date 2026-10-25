// Copyright 2026 OpenObserve Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { describe, expect, it } from "vitest";
import arSa from "./languages/ar-SA.json";
import deDe from "./languages/de-DE.json";
import enUs from "./languages/en-US.json";
import esEs from "./languages/es-ES.json";
import frFr from "./languages/fr-FR.json";
import itIt from "./languages/it-IT.json";
import jaJp from "./languages/ja-JP.json";
import koKr from "./languages/ko-KR.json";
import nlNl from "./languages/nl-NL.json";
import plPl from "./languages/pl-PL.json";
import ptPt from "./languages/pt-PT.json";
import ruRu from "./languages/ru-RU.json";
import trTr from "./languages/tr-TR.json";
import viVn from "./languages/vi-VN.json";
import zhCn from "./languages/zh-CN.json";
import zhTw from "./languages/zh-TW.json";

type Locale = Record<string, any>;

const LOCALES: [string, Locale][] = [
  ["ar-SA", arSa],
  ["de-DE", deDe],
  ["en-US", enUs],
  ["es-ES", esEs],
  ["fr-FR", frFr],
  ["it-IT", itIt],
  ["ja-JP", jaJp],
  ["ko-KR", koKr],
  ["nl-NL", nlNl],
  ["pl-PL", plPl],
  ["pt-PT", ptPt],
  ["ru-RU", ruRu],
  ["tr-TR", trTr],
  ["vi-VN", viVn],
  ["zh-CN", zhCn],
  ["zh-TW", zhTw],
];

const PRODUCT = "Retrace.ai";
const UPSTREAM = "OpenObserve";

describe("brand ownership in locale strings", () => {
  for (const [code, locale] of LOCALES) {
    it(`${code} names the product the user actually signed into`, () => {
      expect(locale.login.getStarted.title).toContain(PRODUCT);
      expect(locale.login.getStarted.title).not.toContain(UPSTREAM);
    });

    it(`${code} captions this product's own logo with this product's name`, () => {
      expect(locale.login.openObserveLogoAlt).toContain(PRODUCT);
    });

    it(`${code} credits the built-in model pricing logo to the provider that owns it`, () => {
      expect(locale.modelPricing.openObserveLogoAlt).toBe(UPSTREAM);
    });

    it(`${code} names this product in the bring-your-own-bucket hero`, () => {
      expect(locale.storage_settings.heroBrand).toContain(PRODUCT);
      expect(locale.storage_settings.heroBrand).not.toContain(UPSTREAM);
    });

    it(`${code} names this product in the reasons a password change is forced`, () => {
      for (const key of ["reasonPolicyTightened", "reasonRotationExpired"]) {
        expect(locale.passwordReset[key]).toContain(PRODUCT);
        expect(locale.passwordReset[key]).not.toContain(UPSTREAM);
      }
    });

    it(`${code} sends organization-deletion recovery to this product's support`, () => {
      for (const key of ["deleteOrganizationDescription", "deleteOrganizationRecoverable"]) {
        expect(locale.settings[key]).toContain(PRODUCT);
        expect(locale.settings[key]).not.toContain(UPSTREAM);
      }
    });

    it(`${code} keeps the org-name slot the delete dialog interpolates into`, () => {
      expect(locale.settings.deleteOrganizationDescription).toContain("{name}");
    });

    it(`${code} names this product as the one that reads the user's data`, () => {
      expect(locale.autoobserve.subtitle).toContain(PRODUCT);
      expect(locale.autoobserve.subtitle).not.toContain(UPSTREAM);
    });
  }

  it("keeps the two alt keys apart, because the two logos are not the same company's", () => {
    expect(enUs.login.openObserveLogoAlt).not.toBe(enUs.modelPricing.openObserveLogoAlt);
    expect(zhTw.login.openObserveLogoAlt).not.toBe(zhTw.modelPricing.openObserveLogoAlt);
  });
});
