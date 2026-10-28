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
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const atPath = (locale: Locale, dotted: string) =>
  dotted.split(".").reduce((node: any, part) => (node == null ? undefined : node[part]), locale);

// Keys whose referent is the product the user is looking at — the product-referent sweep. They name this
// deployment, so naming upstream in them is a missed rename; none of them is a wire value.
const PRODUCT_REFERENT_KEYS = [
  "emptyState.noRemoteTasks.actionDesc",
  "rum.analytics.sdkSampledTip",
  "ingestion.firstEvent.askAiPrompt",
  "ingestion.webServerGuide.verifyTitle",
  "ingestion.vmagent.tipSuffix",
  "ingestion.azureSetup.activityLogsDescription",
  "ingestion.setupCard.advancedInstallDescSelfHosted",
  "ingestion.setupCard.agentTroubleUnreachableA",
  "ingestion.setupCard.dynamodbFirehoseEndpointTitle",
  "ingestion.setupCard.gcpSinkDesc",
  "ingestion.setupCard.gcpSubscriptionTitle",
  "ingestion.setupCard.gcpTroublePartialA",
  "ingestion.setupCard.k8sInternalEndpointNote",
  "ingestion.setupCard.pointExporterTitle",
  "ingestion.setupCard.rumFixBody",
  "ingestion.setupCard.rumTroublePlainHttpQ",
  "ingestion.setupCard.sendNotebookLogsDesc",
  "ingestion.setupCard.verifyDataTitle",
  "ingestion.setupCard.taglineDatabricks",
  "ingestion.setupCard.taglineGcp",
  "ingestion.setupCard.taglineOtlpTraces",
  "ingestion.setupCard.gpuShipTitle",
  "ingestion.setupCard.gpuShipDesc",
  "ingestion.setupCard.aerospikeTagline",
  "ingestion.setupCard.cassandraTagline",
  "ingestion.setupCard.dynamodbTagline",
  "ingestion.setupCard.mariadbTagline",
  "ingestion.setupCard.mongodbTagline",
  "ingestion.setupCard.mysqlTagline",
  "ingestion.setupCard.oracleTagline",
  "ingestion.setupCard.postgresqlTagline",
  "ingestion.setupCard.redisTagline",
  "ingestion.setupCard.snowflakeTagline",
  "ingestion.setupCard.sqlServerTagline",
  "ingestion.setupCard.zookeeperTagline",
  "ingestion.integrations.aws.cloudwatch-logs.description",
  "ingestion.integrations.aws.vpc-flow-logs.cloudwatchIntegrationDescription",
  "ingestion.integrations.aws.dynamodb.lambdaIntegrationDescription",
  "ingestion.integrations.aws.dynamodb.directIntegrationDescription",
  "ingestion.integrations.aws.cloudfront.directIntegrationDescription",
  "ingestion.integrations.aws.kinesis.lambdaIntegrationDescription",
  "ingestion.integrations.azure.activity-logs.description",
  "aiAssistant.suggestions.datadogToO2",
  "alerts.alertSettings.builtInVars.alertUrl",
  "alerts.prebuiltDestinations.servicenowResolutionCodeHelp",
  "alert_library.noCollectorDescription",
  "correlation.semanticFieldGroupsCaption",
  "onlineEvals.job.inputMapping.systemProvided.description",
  "dbm.activity.notCollecting.checks.sampling.noDetail",
  "statusPages.domains.nextStepCname",
  "infra.k8s2.workloadsRuleTip",
  "fleet.settings.targetVersionDesc",
  "storage_settings.awsStsCloudInfo",
  // The Alert Library's "catalog too new" error names the deployment the user is
  // browsing, not the catalog's publisher, and the login banner has always been
  // this product's own pitch; both were renamed without ever being pinned.
  "alert_library.error.unsupported_version",
  "login.getStartedBannerMessage",
  // The Slack strings whose referent is this deployment — its accounts, its administrator,
  // its support routing, the link a thread has to it. They were held out of both ledgers while
  // that read was contested; it is settled now: none of them names the app registered in the
  // workspace, so they follow the deleteOrganization precedent rather than the consent keeps.
  "slackApp.link.noAccessTitle",
  "slackApp.link.noAccessDetail",
  "slackApp.link.helpContactDefault",
  "slackApp.linking.mappedReadonly",
  "slackApp.linking.removedUsers",
  "slackApp.linking.autoHelp",
  "slackApp.linking.matches",
  "slackApp.people.columnUser",
  "slackApp.linkedAccounts.description",
  "slackApp.channels.description",
];

// Keys whose referent is an upstream-run artifact — editions and license banners, the Terraform
// provider, the registered Slack app, npm/SDK names, k8s/Helm wire identifiers, upstream hosts and
// docs. Renaming any of these would attribute upstream's things to this product.
const UPSTREAM_REFERENT_KEYS = [
  "about.license_info_note",
  "about.os_libraries_msg",
  "about.enterprise_offer.cloud.offer_text",
  "enterpriseFeature.locked",
  "traces.serviceGraph.errorApiNotFound",
  "common.openProviderOnRegistry",
  "common.exportTerraformSkipped",
  "alerts.exportDialogSubtitle",
  "slos.exportSubtitle",
  "communitySlackInvite.description",
  "ingestion.setupCard.otlpGrpcCloudNote",
  "slackApp.wizard.subtitle",
  "settings.slackAppDesc",
  "alert_destinations.slackOAuth.selfHostedApp",
  "ingestion.mcp.name",
  "ingestion.setupCard.initRumLogsDesc",
  "rum.emptyState.webAppDesc",
  "ingestion.setupCard.k8sTroubleEndpointA",
  "ingestion.setupCard.k8sTroubleNoDataA",
];

// Ambiguous referents held back on purpose (collector/agent prose, a pipeline destination that may
// be a foreign instance, the upstream-owned built-in model catalog): untouched, still upstream-named.
const AMBIGUOUS_HELD_KEYS = [
  "pipeline.destinationNotes.openobserveTitle",
  "alert_destinations.organizationHelpText",
  "synthetics.createBrowserTest.setupInstallTitle",
  "ingestion.setupCard.taglineKubernetes",
];

// Not a credit and not a miss: this is the label the backend itself puts in the alert it sends —
// DEFAULT_LINK_LABEL ("src/core/src/alerts/notifications/render/mod.rs:86", used by slack.rs,
// teams.rs, email.rs and webhook.rs) — so the preview that promises it must say what arrives.
const PAYLOAD_FIDELITY_KEYS = ["alert_templates.viewAlertLinkLabel"];

/**
 * The keep side of the same ratchet, generated from en-US itself rather than hand-listed.
 * The three ledgers above pinned 24 of the 105 English strings that still name upstream, so
 * 81 upstream-owned strings sat one blind find-and-replace away from being credited to this
 * product with the whole suite still green — exactly the failure mode the pins exist to
 * prevent. This list closes the rest of them so the four ledgers together cover the whole
 * upstream-naming population (locked as a set equality below). Ten Slack deployment-referent
 * strings that used to sit here, or in the under-review booking, are in the product ledger now,
 * which is why the locked population is ten smaller than the 105 this comment counted.
 */
const KEPT_UPSTREAM_KEYS = [
  // about — license banners, waiver/usage notices, edition prose on the About page (9)
  "about.banner_paused_other",
  "about.banner_paused_usage",
  "about.banner_restored",
  "about.banner_restored_with_note",
  "about.feature_comparision_ent_msg",
  "about.feature_comparision_good_news",
  "about.feature_comparision_os_msg",
  "about.waivers_from_key",
  "about.waivers_title",
  "about.enterprise_offer.cloud.features_title",
  "about.enterprise_offer.enterprise_with_license.offer_text",
  "about.enterprise_offer.enterprise_without_license.offer_text",
  "about.header_button.get_enterprise_free",
  // upstream editions and license operations, adjacent to already-pinned siblings
  "alert_destinations.streamHelpText",
  "alert_library.enterpriseHint",
  "alert_library.install.anomalyUnavailable",
  "billing.upgradeToPlanMessage",
  "communitySlackInvite.communityNote",
  "enterpriseFeature.availableIn",
  "login.copyrightNotice",
  "modelPricing.openObserveLogoAlt",
  // collector / agent / installer prose — upstream-shipped binaries and charts
  "infra.hosts.group.hostMetricsHint",
  "infra.k8s.group.nodeMetricsHint",
  "ingestion.fluentBitDocLinkText",
  "ingestion.cloudwatchMetrics.docLinkText",
  "ingestion.integrations.aws.ec2.linuxUnixMacosManualInstallDescription",
  "ingestion.integrations.aws.ec2.windowsManualInstallDescription",
  "ingestion.setupCard.gpuExporterK8sNote",
  "ingestion.setupCard.gpuFixBody",
  "ingestion.setupCard.gpuPrereqK8sNote",
  "ingestion.setupCard.gpuShipK8sNote",
  "ingestion.setupCard.gpuTroubleGkeA",
  "ingestion.setupCard.gpuTroubleNoMetricsA",
  "ingestion.setupCard.gpuTroubleOperatorA",
  "ingestion.setupCard.installAndroidSdkDesc",
  "ingestion.setupCard.k8sEbpfNote",
  "ingestion.setupCard.k8sInstallerNote",
  "ingestion.setupCard.k8sTroubleAnnotationA",
  "ingestion.setupCard.macosTroubleUnifiedLogA",
  "ingestion.setupCard.macosTroubleVolumeA",
  "ingestion.setupCard.quickInstallDesc",
  "ingestion.setupCard.taglineLinux",
  "ingestion.setupCard.taglineMacos",
  "ingestion.setupCard.taglineWindows",
  "ingestion.setupCard.uninstallAgentDescLinux",
  // the external pipeline destination is a foreign (upstream-named) instance
  "pipeline.destinationNotes.openobserveStep1",
  "pipeline.destinationNotes.openobserveStep2",
  "pipeline.destinationNotes.openobserveStep6",
  "pipeline.orgRequiredOpenobserve",
  "pipeline.streamRequiredOpenobserve",
  // the Slack app registered in the customer's workspace, and its wire identifiers
  "slackApp.card.forgetMessage",
  "slackApp.channels.privateHint",
  "slackApp.connect.consent",
  "slackApp.connect.consentPrivate",
  "slackApp.connect.description",
  "slackApp.connect.requestText",
  "slackApp.connect.selfHostedHint",
  "slackApp.connect.setupAppOtherTeam",
  "slackApp.connectCallback.connectedDetail",
  "slackApp.credentials.installerUserToken",
  "slackApp.link.resentDetail",
  "slackApp.link.unknownDetail",
  "slackApp.linkedAccounts.emptyDetail",
  "slackApp.linkedAccounts.note",
  "slackApp.orgAccess.otherAppTitle",
  "slackApp.people.unlinkMessage",
  "slackApp.wizard.create.socketDescription",
  "slackApp.wizard.create.tokenHelp",
  "slackApp.wizard.install.appNotCreatedByO2",
  "slackApp.wizard.install.appNotDeleted",
  "slackApp.wizard.instanceTeamRemoved",
];

/**
 * The Slack strings that name this deployment — its accounts, its administrator, its support
 * routing, the link a thread has to it. They are product referents and live in
 * PRODUCT_REFERENT_KEYS with the rest; what stayed on the keep side names the app registered in
 * the customer's workspace (its name, its `@OpenObserve` mention handle, its consent and scope
 * copy, its installer tokens and manifest lifecycle), which would be a false statement if
 * renamed: in the workspace that app really is called OpenObserve.
 */
const SLACK_DEPLOYMENT_REFERENT_KEYS = [
  "slackApp.link.noAccessTitle",
  "slackApp.link.noAccessDetail",
  "slackApp.link.helpContactDefault",
  "slackApp.linking.mappedReadonly",
  "slackApp.linking.removedUsers",
  "slackApp.linking.autoHelp",
  "slackApp.linking.matches",
  "slackApp.people.columnUser",
  "slackApp.linkedAccounts.description",
  "slackApp.channels.description",
];

function collectStrings(node: any, path: string, into: [string, string][]): void {
  if (typeof node === "string") into.push([path, node]);
  else if (Array.isArray(node)) node.forEach((v, i) => collectStrings(v, `${path}[${i}]`, into));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node))
      collectStrings(value, path ? `${path}.${key}` : key, into);
  }
}

describe("product referents name this product, upstream referents do not", () => {
  for (const [code, locale] of LOCALES) {
    it(`${code} stops naming upstream in the ${PRODUCT_REFERENT_KEYS.length} product-referent keys`, () => {
      for (const key of PRODUCT_REFERENT_KEYS) {
        const value = atPath(locale, key);
        expect(typeof value, key).toBe("string");
        expect(value, key).not.toMatch(/openobserve/i);
      }
    });

    it(`${code} never credits an upstream-owned or wire-payload string to this product`, () => {
      for (const key of [
        ...UPSTREAM_REFERENT_KEYS,
        ...AMBIGUOUS_HELD_KEYS,
        ...PAYLOAD_FIDELITY_KEYS,
      ]) {
        expect(String(atPath(locale, key)), key).not.toContain(PRODUCT);
      }
    });

    it(`${code} carries no string that names both brands at once`, () => {
      const flat: [string, string][] = [];
      collectStrings(locale, "", flat);
      expect(flat.length).toBeGreaterThan(1000);
      const mixed = flat.filter(
        ([, value]) => /retrace/i.test(value) && /openobserve/i.test(value),
      );
      expect(mixed.map(([key]) => key)).toEqual([]);
    });
  }

  it("names this product in English where the sweep applied", () => {
    for (const key of PRODUCT_REFERENT_KEYS) {
      expect(String(atPath(enUs, key)), key).toContain(PRODUCT);
    }
  });

  // The rename side of the ratchet gets the same set-equality lock the keep side has (F-161i/
  // BRD MINOR-2). Without it, a NEW en-US string could credit something to Retrace.ai while being
  // booked nowhere — the mixed-brand lock only fires when a value ALSO names upstream, which the
  // dangerous new-string shape does not. The eight keys below are renamed product referents pinned
  // individually by the hero/login/passwordReset/autoobserve cells at the top of this file rather
  // than folded into PRODUCT_REFERENT_KEYS; the population equality counts them exactly once.
  const PRODUCT_RENAMED_PINNED_ELSEWHERE_KEYS = [
    "autoobserve.subtitle",
    "login.getStarted.title",
    "login.openObserveLogoAlt",
    "passwordReset.reasonPolicyTightened",
    "passwordReset.reasonRotationExpired",
    "settings.deleteOrganizationDescription",
    "settings.deleteOrganizationRecoverable",
    "storage_settings.heroBrand",
  ];

  it("covers every Retrace-naming English string exactly once", () => {
    const flat: [string, string][] = [];
    collectStrings(enUs, "", flat);
    const population = flat
      .filter(([, value]) => /retrace/i.test(value))
      .map(([key]) => key)
      .sort();
    const ledgers = [...PRODUCT_REFERENT_KEYS, ...PRODUCT_RENAMED_PINNED_ELSEWHERE_KEYS];
    expect(new Set(ledgers).size, "a key is booked by two product ledgers").toBe(ledgers.length);
    expect(ledgers.sort()).toEqual(population);
    expect(population.length).toBe(73);
  });

  /**
   * The ratchet itself: the five ledgers are not a sample, they are the whole population.
   * A string that starts naming upstream without being booked here, or one booked here that
   * stopped naming upstream, fails this equality — which is what a rename of a keep-side key
   * looks like from the inside.
   */
  it("covers every upstream-naming English string exactly once", () => {
    const flat: [string, string][] = [];
    collectStrings(enUs, "", flat);
    const population = flat
      .filter(([, value]) => /openobserve/i.test(value))
      .map(([key]) => key)
      .sort();
    const ledgers = [
      ...UPSTREAM_REFERENT_KEYS,
      ...AMBIGUOUS_HELD_KEYS,
      ...PAYLOAD_FIDELITY_KEYS,
      ...KEPT_UPSTREAM_KEYS,
    ];
    expect(new Set(ledgers).size, "a key is booked by two ledgers").toBe(ledgers.length);
    expect(ledgers.sort()).toEqual(population);
    expect(population.length).toBe(95);
  });

  for (const [code, locale] of LOCALES) {
    it(`${code} leaves all ${KEPT_UPSTREAM_KEYS.length} kept upstream referents unclaimed`, () => {
      for (const key of KEPT_UPSTREAM_KEYS) {
        const value = atPath(locale, key);
        expect(typeof value, key).toBe("string");
        expect(value, key).not.toContain(PRODUCT);
      }
    });
  }

  // The Slack deployment referents are checked in both directions: naming this product in every
  // locale here, and never naming upstream in any locale through the product ledger above.
  for (const [code, locale] of LOCALES) {
    it(`${code} names this product in the Slack deployment-referent strings`, () => {
      for (const key of SLACK_DEPLOYMENT_REFERENT_KEYS) {
        expect(String(atPath(locale, key)), key).toContain(PRODUCT);
      }
    });
  }

  it("keeps upstream's own name in English on upstream-owned and payload-owned strings", () => {
    for (const key of [
      ...UPSTREAM_REFERENT_KEYS,
      ...AMBIGUOUS_HELD_KEYS,
      ...PAYLOAD_FIDELITY_KEYS,
    ]) {
      expect(String(atPath(enUs, key)), key).toContain(UPSTREAM);
    }
  });

  it("renders the AWS STS contact with the correct casing of whoever is being contacted", () => {
    expect(enUs.storage_settings.awsStsCloudInfo).toContain(PRODUCT);
    expect(enUs.storage_settings.awsStsCloudInfo).not.toMatch(/Openobserve/);
  });

  it("re-translates the Turkish Slack wizard lines to what English actually says", () => {
    expect(trTr.slackApp.wizard.instanceAdminContact).toBe("Örneğinizin yöneticisi: {contact}");
    expect(trTr.slackApp.wizard.takeOverAction).toBe("Bunu örneğin çalışma alanı yap");
    for (const value of [
      trTr.slackApp.wizard.instanceAdminContact,
      trTr.slackApp.wizard.takeOverAction,
    ]) {
      expect(value).not.toMatch(/openobserve/i);
      expect(value).not.toContain(PRODUCT);
    }
  });
});

const componentSource = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/** A `raw("…")` / `raw('…')` slot — the templates do not agree on quote style. */
const fillsWith = (source: string, brand: string) =>
  source.includes(`raw("${brand}")`) || source.includes(`raw('${brand}')`);

describe("raw product-name slots in components", () => {
  for (const [file, call] of [
    ["src/components/ingestion/logs/SplunkHec.vue", 't("ingestion.splunkHec.intro"'],
    ["src/components/ingestion/logs/SplunkHec.vue", 't("ingestion.splunkHec.authBody"'],
    ["src/components/ingestion/logs/SplunkHec.vue", 't("ingestion.splunkHec.tlsBody"'],
    [
      "src/components/alerts/AlertSettingsHelpDrawer.vue",
      't("alerts.alertSettings.helpBuiltInIntro"',
    ],
    ["src/components/settings/OrgStorageEditor.vue", 't("storage_settings.awsStsCloudInfo"'],
    // The empty-state locale value is "{product}"-parameterised, so only the call-site fill carries the branding.
    ["src/views/HomeNoDataState.vue", 't("logs.noData.title"'],
    ["src/plugins/logs/LogsNoDataState.vue", 't("logs.noData.title"'],
    ["src/plugins/traces/TracesNoDataState.vue", 't("traces.noData.title"'],
  ] as [string, string][]) {
    it(`${file} fills ${call} with this product's name`, () => {
      const source = componentSource(file);
      const slot = source.slice(source.indexOf(call), source.indexOf(call) + 400);
      expect(slot).toContain(`raw("${PRODUCT}")`);
      expect(slot).not.toContain(`raw("${UPSTREAM}")`);
    });
  }

  // The Slack OAuth slots split by referent, and the split is easy to get wrong
  // from across the room: the popup blocker acts on THIS deployment's origin and
  // the callback page IS this deployment, so those two name this product — while
  // the consent strings describe the app registered inside Slack, which really is
  // called OpenObserve there, and must keep saying so.
  it("names this product in the Slack OAuth slots that describe this deployment", () => {
    for (const [file, call] of [
      [
        "src/composables/slack/useSlackOAuthPopup.ts",
        't("alert_destinations.slackOAuth.popupBlocked"',
      ],
      ["src/views/SlackOAuthCallback.vue", 't("alert_destinations.slackOAuth.callbackWorking"'],
      ["src/views/SlackConnectCallback.vue", "t('alert_destinations.slackOAuth.callbackWorking'"],
    ] as [string, string][]) {
      const source = componentSource(file);
      const at = source.indexOf(call);
      expect(at, `${file} still fills ${call}`).toBeGreaterThan(-1);
      const slot = source.slice(at, at + 220);
      // Either quote style is fine (one of these bindings is single-quoted); only a
      // rename of the referent is not.
      expect(fillsWith(slot, PRODUCT), file).toBe(true);
      expect(fillsWith(slot, UPSTREAM), file).toBe(false);
    }
  });

  it("leaves the Slack consent slots naming the app registered in the workspace", () => {
    const source = componentSource("src/components/alerts/SlackDestinationSetup.vue");
    for (const call of [
      't("alert_destinations.slackOAuth.permissionNote"',
      't("slackApp.connect.consentPending"',
    ]) {
      const at = source.indexOf(call);
      expect(at, `SlackDestinationSetup.vue still fills ${call}`).toBeGreaterThan(-1);
      const slot = source.slice(at, at + 220);
      expect(fillsWith(slot, UPSTREAM), call).toBe(true);
      expect(fillsWith(slot, PRODUCT), call).toBe(false);
    }
  });

  it("labels the built-in cipher key type and the openobserve pipeline type as this product", () => {
    expect(componentSource("src/components/cipherkeys/AddCipherKey.vue")).toContain(
      `{ label: raw("${PRODUCT}"), value: "local" }`,
    );
    const pipeline = componentSource("src/components/pipeline/NodeForm/CreateDestinationForm.vue");
    expect(pipeline).toContain(`label: raw("${PRODUCT}"),\n    value: "openobserve",`);
    expect(pipeline).toContain('getImageURL("images/pipeline/openobserve.svg")');
  });

  // Mirror, not credit: this is the Opsgenie resolve body this build sends, `{"source":"OpenObserve"}`
  // (src/core/src/alerts/notifications/platform.rs:116) plus DEFAULT_LINK_LABEL (render/mod.rs:86).
  it("leaves preview copy that mirrors the sent payload saying what actually arrives", () => {
    const preview = componentSource("src/components/alerts/DestinationPreview.vue");
    expect(preview).toContain(`<strong>{{ raw("Source:") }}</strong> {{ raw("${UPSTREAM}") }}`);
    expect(preview).toContain(`raw("${UPSTREAM} Alert: High CPU Usage")`);
    expect(preview).toContain(`raw("View in ${UPSTREAM}")`);
  });

  // Credit, not a miss: the built-in model catalog, the enterprise-edition CTA, the Slack workspace
  // and the npm/`@openobserve` MCP surface all belong to upstream.
  it("leaves the slots that credit upstream standing as upstream", () => {
    const keeps: [string, string][] = [
      ["src/components/settings/ModelPricingList.vue", `raw('${UPSTREAM}')`],
      ["src/components/Header.vue", `raw("${UPSTREAM}")`],
      ["src/components/CommunitySlackInvite.vue", `raw("${UPSTREAM}")`],
      ["src/components/ingestion/McpCrossLink.vue", `raw("${UPSTREAM}")`],
      ["src/components/ingestion/ai/McpServerCard.vue", `raw("${UPSTREAM}")`],
    ];
    for (const [file, needle] of keeps) {
      expect(componentSource(file), file).toContain(needle);
    }
  });
});

/**
 * The other identifier this product answers to: the `O2` shorthand. The population above is keyed on
 * the brand *spelling*, so these 14 English strings sat outside every ledger and a sweep could rename
 * or keep each of them with the whole suite green. Booked here with its verdict, so either flip is a
 * red test from now on.
 */
// Compat surface, not branding — an operator has to type these identifiers verbatim, and the license
// pair mirrors the server's own sentence (ENV_KEY_CONFLICT_MSG, api/management/src/request/license/mod.rs).
// The five lowercase entries are the wire identifiers the case-sensitive matcher used to miss:
// `_o2_id` is the storage-schema field (search/linePermalink copy), `#o2-help` the Slack help channel
// placeholder, the helm release `o2` the k8s endpoint sentence's own default, and `o2syn_` the private
// synthetics-agent token prefix (src/infra token minting) named by both token-description strings.
// All five are compat KEEPS: renaming the copy would misname the thing the operator must type.
const O2_COMPAT_IDENTIFIER_KEYS = [
  "about.license_status_env_key",
  "about.license_status_env_key_superseded",
  "fleet.settings.auditDisabled",
  "ingestion.setupCard.rnNavigationNote",
  "ingestion.setupCard.rnTroubleScreenNamesA",
  "search.linePermalink.bannerAmbiguousTieHeavy",
  "slackApp.card.helpContactPlaceholder",
  "ingestion.setupCard.k8sTroubleEndpointA",
  "iam.syntheticsTokensDesc",
  "synthetics.tokens.explanation",
];

// Kept as the feature's own proper noun rather than read as a missed rename: the component family
// (O2AIChat, O2AIConfirmDialog), the `o2-ai-*` data-test hooks and the session header the server
// tracks turns by (src/api/common/src/lib.rs:25) all carry the same shorthand, so renaming only what
// renders would split the assistant's name from every identifier around it — across 16 locales.
// Renaming it stays possible and stays cheap; it simply can no longer happen quietly.
const O2_FEATURE_NAME_KEYS = [
  "about.enterprise_offer.enterprise_features.ai_assistant.name",
  "home.tabAiAssistant",
  "aiAssistant.welcome.taglineHighlight",
  "aiAssistant.autoNavigation.enabledTooltip",
  "aiAssistant.autoNavigation.disabledTooltip",
  "aiAssistant.aiChat.navigateConfirmQuestion",
  "aiAssistant.aiChat.allowAssistantTo",
  "aiAssistant.aiChat.allowAssistantNavigateTo",
  "settings.addRegexPattern.tryAiAssistant",
];

const O2_IDENTIFIER = /O2_[A-Z_]+|O2Rum[A-Za-z]*|O2Assistant|o2syn_|_o2_id|#o2-help|release `o2`/i;

describe("the O2 shorthand is booked, not invisible", () => {
  const english = (locale: Locale) => {
    const flat: [string, string][] = [];
    collectStrings(locale, "", flat);
    return flat;
  };

  it("covers every O2-naming English string exactly once", () => {
    const population = english(enUs)
      .filter(([, value]) => value.toLowerCase().includes("o2"))
      .map(([key]) => key)
      .sort();
    const ledgers = [...O2_COMPAT_IDENTIFIER_KEYS, ...O2_FEATURE_NAME_KEYS];
    expect(new Set(ledgers).size, "a key is booked by two O2 ledgers").toBe(ledgers.length);
    expect(ledgers.sort()).toEqual(population);
    expect(population.length).toBe(19);
  });

  it("keeps the five compat identifiers spelled the way the server spells them", () => {
    for (const key of O2_COMPAT_IDENTIFIER_KEYS) {
      const value = String(atPath(enUs, key));
      expect(value, key).toMatch(O2_IDENTIFIER);
      expect(value, key).not.toContain(PRODUCT);
    }
  });

  it("keeps the assistant booked under its feature name in English", () => {
    for (const key of O2_FEATURE_NAME_KEYS) {
      expect(String(atPath(enUs, key)), key).toContain("O2");
    }
  });

  for (const [code, locale] of LOCALES) {
    it(`${code} never names both brands inside one O2 string`, () => {
      const mixed = english(locale).filter(
        ([, value]) => value.toLowerCase().includes("o2") && value.includes(PRODUCT),
      );
      expect(mixed.map(([key]) => key)).toEqual([]);
    });
  }
});

const BRAND_ARTICLE_ERRORS: [RegExp, string][] = [
  [/\ban\s+(Retrace(\.ai)?|O2)\b/i, '"an" in front of a name that starts with a consonant sound'],
  [/\ba\s+OpenObserve\b/i, '"a" in front of a name that starts with a vowel sound'],
];

/**
 * Article agreement is English grammar, so it applies to English strings: everything en-US renders,
 * plus every locale value that is byte-identical to its English one — a translated value follows its
 * own language, where "an"/"a" before a name mean something else (German "an Retrace.ai" is a
 * preposition, Spanish "a OpenObserve" is the personal a).
 */
describe("brand-adjacent English articles", () => {
  const articleErrors = (flat: [string, string][]) =>
    flat
      .filter(([, value]) => BRAND_ARTICLE_ERRORS.some(([pattern]) => pattern.test(value)))
      .map(([key]) => key);

  it("agrees with the noun in every English string", () => {
    const flat: [string, string][] = [];
    collectStrings(enUs, "", flat);
    expect(flat.length).toBeGreaterThan(1000);
    expect(articleErrors(flat), BRAND_ARTICLE_ERRORS.map(([, why]) => why).join("; ")).toEqual([]);
  });

  it("says a Retrace.ai user in the Slack match count, which the rename broke", () => {
    expect(enUs.slackApp.linking.matches).toContain(`a ${PRODUCT} user`);
    expect(enUs.slackApp.linking.matches).not.toMatch(/\ban\s+Retrace/i);
  });

  for (const [code, locale] of LOCALES) {
    it(`${code} keeps English articles in the strings it never translated`, () => {
      const flat: [string, string][] = [];
      collectStrings(locale, "", flat);
      const carried = flat.filter(([key, value]) => value === atPath(enUs, key));
      expect(articleErrors(carried)).toEqual([]);
    });
  }
});
