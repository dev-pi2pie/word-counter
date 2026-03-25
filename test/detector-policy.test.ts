import { describe, expect, test } from "bun:test";
import { DEFAULT_HAN_TAG, DEFAULT_LOCALE } from "../src/wc/locale-detect";
import type { LocaleChunk } from "../src/wc/types";
import { DETECTOR_ROUTE_POLICIES, type DetectorWindow } from "../src/detector/policy";

describe("detector route policies", () => {
  const defaultEligibleStrictNotEligibleText = "Readers understand the feature.";
  const defaultNotEligibleLooseEligibleText = "Users understand this now.";

  test("applies the Latin prose content gate only to Latin windows", () => {
    const latinPolicy = DETECTOR_ROUTE_POLICIES[DEFAULT_LOCALE];
    const proseSample = latinPolicy.buildDiagnosticSample(
      {
        routeTag: DEFAULT_LOCALE,
        startIndex: 0,
        endIndex: 0,
        text: "This sentence should clearly be detected as English for the wasm detector path.",
      },
      [],
    );
    const technicalSample = latinPolicy.buildDiagnosticSample(
      {
        routeTag: DEFAULT_LOCALE,
        startIndex: 0,
        endIndex: 0,
        text: [
          "Usage: word-counter --path docs --format json --debug",
          "",
          "Options:",
          "  --debug enable structured diagnostics",
        ].join("\n"),
      },
      [],
    );

    expect(latinPolicy.evaluateContentGate(proseSample)).toEqual({
      applied: true,
      passed: true,
      policy: "latinProse",
      mode: "default",
    });
    expect(latinPolicy.evaluateContentGate(technicalSample)).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "default",
    });

    const haniPolicy = DETECTOR_ROUTE_POLICIES[DEFAULT_HAN_TAG];
    const haniSample = haniPolicy.buildDiagnosticSample(
      {
        routeTag: DEFAULT_HAN_TAG,
        startIndex: 0,
        endIndex: 0,
        text: "世界！",
      },
      [],
    );
    expect(haniPolicy.evaluateContentGate(haniSample)).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "default",
    });
  });

  test("supports default, strict, loose, and off content gate modes on Latin routes", () => {
    const latinPolicy = DETECTOR_ROUTE_POLICIES[DEFAULT_LOCALE];
    const shortProseSample = latinPolicy.buildDiagnosticSample(
      {
        routeTag: DEFAULT_LOCALE,
        startIndex: 0,
        endIndex: 0,
        text: "Readers understand this behavior.",
      },
      [],
    );
    const mixedSample = latinPolicy.buildDiagnosticSample(
      {
        routeTag: DEFAULT_LOCALE,
        startIndex: 0,
        endIndex: 0,
        text: ["mode: debug", "tee: true", "path: logs", "Use this for testing."].join("\n"),
      },
      [],
    );

    expect(latinPolicy.evaluateContentGate(shortProseSample, "default")).toEqual({
      applied: true,
      passed: true,
      policy: "latinProse",
      mode: "default",
    });
    expect(latinPolicy.evaluateContentGate(shortProseSample, "strict")).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "strict",
    });
    expect(latinPolicy.evaluateContentGate(mixedSample, "default")).toEqual({
      applied: true,
      passed: false,
      policy: "latinProse",
      mode: "default",
    });
    expect(latinPolicy.evaluateContentGate(mixedSample, "loose")).toEqual({
      applied: true,
      passed: true,
      policy: "latinProse",
      mode: "loose",
    });
    expect(latinPolicy.evaluateContentGate(mixedSample, "off")).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
  });

  test("changes Latin eligibility thresholds for strict and loose while keeping off on default thresholds", () => {
    const latinPolicy = DETECTOR_ROUTE_POLICIES[DEFAULT_LOCALE];
    const strictBoundarySample = latinPolicy.buildDiagnosticSample(
      {
        routeTag: DEFAULT_LOCALE,
        startIndex: 0,
        endIndex: 0,
        text: defaultEligibleStrictNotEligibleText,
      },
      [],
    );
    const looseBoundarySample = latinPolicy.buildDiagnosticSample(
      {
        routeTag: DEFAULT_LOCALE,
        startIndex: 0,
        endIndex: 0,
        text: defaultNotEligibleLooseEligibleText,
      },
      [],
    );

    expect(latinPolicy.eligibility.evaluate(strictBoundarySample, "default")).toEqual({
      scriptChars: 27,
      minScriptChars: 24,
      passed: true,
    });
    expect(latinPolicy.eligibility.evaluate(strictBoundarySample, "strict")).toEqual({
      scriptChars: 27,
      minScriptChars: 30,
      passed: false,
    });
    expect(latinPolicy.eligibility.evaluate(looseBoundarySample, "default")).toEqual({
      scriptChars: 22,
      minScriptChars: 24,
      passed: false,
    });
    expect(latinPolicy.eligibility.evaluate(looseBoundarySample, "loose")).toEqual({
      scriptChars: 22,
      minScriptChars: 20,
      passed: true,
    });
    expect(latinPolicy.eligibility.evaluate(looseBoundarySample, "off")).toEqual({
      scriptChars: 22,
      minScriptChars: 24,
      passed: false,
    });
  });

  test("keeps non-applicable routes as no-op content gate evaluations for every mode", () => {
    const haniPolicy = DETECTOR_ROUTE_POLICIES[DEFAULT_HAN_TAG];
    const haniSample = haniPolicy.buildDiagnosticSample(
      {
        routeTag: DEFAULT_HAN_TAG,
        startIndex: 0,
        endIndex: 0,
        text: "世界！",
      },
      [],
    );

    expect(haniPolicy.evaluateContentGate(haniSample, "default")).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "default",
    });
    expect(haniPolicy.evaluateContentGate(haniSample, "strict")).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "strict",
    });
    expect(haniPolicy.evaluateContentGate(haniSample, "loose")).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "loose",
    });
    expect(haniPolicy.evaluateContentGate(haniSample, "off")).toEqual({
      applied: false,
      passed: true,
      policy: "none",
      mode: "off",
    });
    expect(haniPolicy.eligibility.evaluate(haniSample, "default")).toEqual({
      scriptChars: 2,
      minScriptChars: 12,
      passed: false,
    });
    expect(haniPolicy.eligibility.evaluate(haniSample, "strict")).toEqual({
      scriptChars: 2,
      minScriptChars: 12,
      passed: false,
    });
    expect(haniPolicy.eligibility.evaluate(haniSample, "loose")).toEqual({
      scriptChars: 2,
      minScriptChars: 12,
      passed: false,
    });
    expect(haniPolicy.eligibility.evaluate(haniSample, "off")).toEqual({
      scriptChars: 2,
      minScriptChars: 12,
      passed: false,
    });
  });

  test("borrows directly adjacent Japanese context for Hani diagnostic samples", () => {
    const haniPolicy = DETECTOR_ROUTE_POLICIES[DEFAULT_HAN_TAG];
    const chunks: LocaleChunk[] = [
      { locale: "ja", text: "こんにちは、" },
      { locale: DEFAULT_HAN_TAG, text: "世界！" },
      { locale: "ja", text: "これはテストです。" },
    ];
    const window: DetectorWindow = {
      routeTag: DEFAULT_HAN_TAG,
      startIndex: 1,
      endIndex: 1,
      text: "世界！",
    };

    const sample = haniPolicy.buildDiagnosticSample(window, chunks);
    const eligibility = haniPolicy.eligibility.evaluate(sample);

    expect(sample.textSource).toBe("borrowed-context");
    expect(sample.text).toBe("こんにちは、世界！これはテストです。");
    expect(sample.normalizedText).toBe("世界");
    expect(sample.borrowedContext).toEqual({ leftChunkIndex: 0, rightChunkIndex: 2 });
    expect(eligibility.passed).toBeTrue();
  });

  test("keeps Hani windows in focus-only mode when no adjacent Japanese context exists", () => {
    const haniPolicy = DETECTOR_ROUTE_POLICIES[DEFAULT_HAN_TAG];
    const chunks: LocaleChunk[] = [
      { locale: "ja", text: "こんにちは " },
      { locale: DEFAULT_LOCALE, text: "Hello " },
      { locale: DEFAULT_HAN_TAG, text: "世界" },
    ];
    const window: DetectorWindow = {
      routeTag: DEFAULT_HAN_TAG,
      startIndex: 2,
      endIndex: 2,
      text: "世界",
    };

    const sample = haniPolicy.buildDiagnosticSample(window, chunks);
    const eligibility = haniPolicy.eligibility.evaluate(sample);

    expect(sample.textSource).toBe("focus");
    expect(sample.text).toBe("世界");
    expect(sample.borrowedContext).toBeUndefined();
    expect(eligibility).toEqual({
      scriptChars: 2,
      minScriptChars: 12,
      passed: false,
    });
  });

  test("keeps reliable and corroborated acceptance rules route-aware", () => {
    const latinPolicy = DETECTOR_ROUTE_POLICIES[DEFAULT_LOCALE];
    const haniPolicy = DETECTOR_ROUTE_POLICIES[DEFAULT_HAN_TAG];

    expect(
      latinPolicy.accept({
        tag: "en",
        source: "wasm",
        confidence: 0.93,
        reliable: true,
      }),
    ).toBeTrue();
    expect(
      haniPolicy.accept({
        tag: "ja",
        source: "wasm",
        confidence: 0.99,
        reliable: true,
      }),
    ).toBeTrue();
    expect(
      haniPolicy.accept({
        tag: "ja",
        source: "wasm",
        confidence: 0.99,
        reliable: false,
      }),
    ).toBeFalse();

    const corroborated = latinPolicy.acceptCorroborated?.(
      {
        tag: "en",
        source: "wasm",
        confidence: 0.71,
        reliable: true,
      },
      {
        tag: "en",
        source: "wasm",
        confidence: 0.7,
        reliable: false,
      },
    );
    expect(corroborated).toEqual({
      accepted: true,
      confidence: 0.71,
      hasReliableCorroboration: true,
    });

    const unreliableCorroboration = latinPolicy.acceptCorroborated?.(
      {
        tag: "fr",
        source: "wasm",
        confidence: 0.8,
        reliable: false,
      },
      {
        tag: "fr",
        source: "wasm",
        confidence: 0.75,
        reliable: false,
      },
    );
    expect(unreliableCorroboration).toEqual({
      accepted: false,
      confidence: 0.8,
      hasReliableCorroboration: false,
      reason: "unreliable",
    });
  });
});
