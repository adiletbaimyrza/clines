import { describe, expect, it } from "vitest";
import { describeIssues } from "../src/config/load.js";
import { parseUserConfig } from "../src/config/validate.js";

type Case = [name: string, input: unknown, expected: unknown];

const ACCEPTED: Case[] = [
  [
    "{}",
    {},
    {
      ignore: { dirs: [], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    '{ ignore: { dirs: ["a"] } }',
    { ignore: { dirs: ["a"] } },
    {
      ignore: { dirs: ["a"], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    '{ unignore: { files: ["package.json"] } }',
    { unignore: { files: ["package.json"] } },
    {
      ignore: { dirs: [], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: ["package.json"], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    '{ roles: { test: ["e2e/**"] } }',
    { roles: { test: ["e2e/**"] } },
    {
      ignore: { dirs: [], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: [], test: ["e2e/**"], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    "{ respectGitignore: false }",
    { respectGitignore: false },
    {
      ignore: { dirs: [], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: false,
    },
  ],
  [
    "{ respectGitignore: true }",
    { respectGitignore: true },
    {
      ignore: { dirs: [], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    "{ ignore: { dirs: [], files: [], extensions: [], globs: [] } }",
    { ignore: { dirs: [], files: [], extensions: [], globs: [] } },
    {
      ignore: { dirs: [], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    "{ roles: { source: [], test: [], generated: [], vendored: [], docs: [] } }",
    { roles: { source: [], test: [], generated: [], vendored: [], docs: [] } },
    {
      ignore: { dirs: [], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    '{ ignore: { globs: ["*.js"] }, unignore: { extensions: [".map"] } }',
    { ignore: { globs: ["*.js"] }, unignore: { extensions: [".map"] } },
    {
      ignore: { dirs: [], files: [], extensions: [], globs: ["*.js"] },
      unignore: { dirs: [], files: [], extensions: [".map"] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    '{ ignore: { dirs: ["dup", "dup"] } }',
    { ignore: { dirs: ["dup", "dup"] } },
    {
      ignore: { dirs: ["dup", "dup"], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    '{ ignore: { dirs: ["a"] }, unignore: { dirs: ["a"] } }',
    { ignore: { dirs: ["a"] }, unignore: { dirs: ["a"] } },
    {
      ignore: { dirs: ["a"], files: [], extensions: [], globs: [] },
      unignore: { dirs: ["a"], files: [], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    "{ respectGitignore: undefined }",
    { respectGitignore: undefined },
    {
      ignore: { dirs: [], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    "{ ignore: undefined }",
    { ignore: undefined },
    {
      ignore: { dirs: [], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: [], test: [], generated: [], vendored: [], docs: [] },
      respectGitignore: true,
    },
  ],
  [
    '{ roles: { docs: ["d"], source: ["s"] } }',
    { roles: { docs: ["d"], source: ["s"] } },
    {
      ignore: { dirs: [], files: [], extensions: [], globs: [] },
      unignore: { dirs: [], files: [], extensions: [] },
      roles: { source: ["s"], test: [], generated: [], vendored: [], docs: ["d"] },
      respectGitignore: true,
    },
  ],
];

const REJECTED: Case[] = [
  ["{ ignor: {} }", { ignor: {} }, '  Unknown key "ignor" — did you mean "ignore"?'],
  ["{ zzzzz: {} }", { zzzzz: {} }, '  Unknown key "zzzzz"'],
  [
    "{ nope: true, alsoNope: 1 }",
    { nope: true, alsoNope: 1 },
    '  Unknown key "nope"\n  Unknown key "alsoNope"',
  ],
  [
    '{ ignore: { dirs: "nope" } }',
    { ignore: { dirs: "nope" } },
    "  ignore.dirs: expected array, received string",
  ],
  [
    '{ ignore: { folders: ["x"] } }',
    { ignore: { folders: ["x"] } },
    '  Unknown key "ignore: folders"',
  ],
  [
    '{ respectGitignore: "yes" }',
    { respectGitignore: "yes" },
    "  respectGitignore: expected boolean, received string",
  ],
  [
    "{ respectGitignore: null }",
    { respectGitignore: null },
    "  respectGitignore: expected boolean, received null",
  ],
  [
    "{ respectGitignore: 0 }",
    { respectGitignore: 0 },
    "  respectGitignore: expected boolean, received number",
  ],
  [
    "{ respectGitignore: 1 }",
    { respectGitignore: 1 },
    "  respectGitignore: expected boolean, received number",
  ],
  [
    "{ ignore: { dirs: [1, 2] } }",
    { ignore: { dirs: [1, 2] } },
    "  ignore.dirs.0: expected string, received number\n  ignore.dirs.1: expected string, received number",
  ],
  ['{ roles: { tests: ["x"] } }', { roles: { tests: ["x"] } }, '  Unknown key "roles: tests"'],
  ['{ ignore: "x" }', { ignore: "x" }, "  ignore: expected object, received string"],
  ["{ ignore: null }", { ignore: null }, "  ignore: expected object, received null"],
  ["{ ignore: [] }", { ignore: [] }, "  ignore: expected object, received array"],
  [
    "{ ignore: { dirs: {} } }",
    { ignore: { dirs: {} } },
    "  ignore.dirs: expected array, received object",
  ],
  [
    "{ ignore: { dirs: [[]] } }",
    { ignore: { dirs: [[]] } },
    "  ignore.dirs.0: expected string, received array",
  ],
  [
    '{ ignore: { dirs: ["ok", 3, null] } }',
    { ignore: { dirs: ["ok", 3, null] } },
    "  ignore.dirs.1: expected string, received number\n  ignore.dirs.2: expected string, received null",
  ],
  [
    '{ ignore: { dirs: "bad" }, respectGitignore: "no" }',
    { ignore: { dirs: "bad" }, respectGitignore: "no" },
    "  ignore.dirs: expected array, received string\n  respectGitignore: expected boolean, received string",
  ],
  [
    '{ roles: { test: ["a"], nope: 1, alsoNope: 2 } }',
    { roles: { test: ["a"], nope: 1, alsoNope: 2 } },
    '  Unknown key "roles: nope"\n  Unknown key "roles: alsoNope"',
  ],
  ["{ IGNORE: {} }", { IGNORE: {} }, '  Unknown key "IGNORE"'],
  ["{ ign: {} }", { ign: {} }, '  Unknown key "ign" — did you mean "ignore"?'],
  ["{ unign: {} }", { unign: {} }, '  Unknown key "unign" — did you mean "unignore"?'],
  ["{ rol: {} }", { rol: {} }, '  Unknown key "rol" — did you mean "roles"?'],
  ["{ resp: {} }", { resp: {} }, '  Unknown key "resp" — did you mean "respectGitignore"?'],
  ["{ ignore: { dir: [] } }", { ignore: { dir: [] } }, '  Unknown key "ignore: dir"'],
  [
    "{ ignore: { extension: [] } }",
    { ignore: { extension: [] } },
    '  Unknown key "ignore: extension"',
  ],
  ['"nope"', "nope", "  expected object, received string"],
  ["null", null, "  expected object, received null"],
  ["undefined", undefined, "  required"],
  ["42", 42, "  expected object, received number"],
  ["true", true, "  expected object, received boolean"],
  ["[]", [], "  expected object, received array"],
  ['["ignore"]', ["ignore"], "  expected object, received array"],
  [
    'JSON.parse(\'{"__proto__":{"polluted":true}}\')',
    JSON.parse('{"__proto__":{"polluted":true}}'),
    '  Unknown key "__proto__"',
  ],
  [
    'JSON.parse(\'{"ignore":{"__proto__":{"x":1}}}\')',
    JSON.parse('{"ignore":{"__proto__":{"x":1}}}'),
    '  Unknown key "ignore: __proto__"',
  ],
  [
    'JSON.parse(\'{"constructor":{"prototype":{}}}\')',
    JSON.parse('{"constructor":{"prototype":{}}}'),
    '  Unknown key "constructor"',
  ],
  [
    "Object.create({ inherited: true })",
    Object.create({ inherited: true }),
    '  Unknown key "inherited"',
  ],
  [
    '{ ignore: { folders: ["x"], dirs: "bad" } }',
    { ignore: { folders: ["x"], dirs: "bad" } },
    '  ignore.dirs: expected array, received string\n  Unknown key "ignore: folders"',
  ],
  [
    '{ ignore: { dirs: "bad" }, unignore: { dirs: "bad" } }',
    { ignore: { dirs: "bad" }, unignore: { dirs: "bad" } },
    "  ignore.dirs: expected array, received string\n  unignore.dirs: expected array, received string",
  ],
  [
    '{ nope: 1, ignore: { dirs: "bad" } }',
    { nope: 1, ignore: { dirs: "bad" } },
    '  ignore.dirs: expected array, received string\n  Unknown key "nope"',
  ],
  [
    '{ ignore: { dirs: ["a", 1] }, roles: { nope: 1 } }',
    { ignore: { dirs: ["a", 1] }, roles: { nope: 1 } },
    '  ignore.dirs.1: expected string, received number\n  Unknown key "roles: nope"',
  ],
  [
    '{ ignore: { globs: "x" }, unignore: { extensions: 1 }, roles: { docs: {} } }',
    { ignore: { globs: "x" }, unignore: { extensions: 1 }, roles: { docs: {} } },
    "  ignore.globs: expected array, received string\n  unignore.extensions: expected array, received number\n  roles.docs: expected array, received object",
  ],
  [
    "{ ignore: { dirs: [undefined] } }",
    { ignore: { dirs: [undefined] } },
    "  ignore.dirs.0: required",
  ],
  [
    '{ ignore: { dirs: ["a", undefined, 2] } }',
    { ignore: { dirs: ["a", undefined, 2] } },
    "  ignore.dirs.1: required\n  ignore.dirs.2: expected string, received number",
  ],
  [
    "{ roles: { docs: [undefined] } }",
    { roles: { docs: [undefined] } },
    "  roles.docs.0: required",
  ],
];

describe("config validation matches the schema it replaced", () => {
  it.each(ACCEPTED)("accepts %s", (_name, input, expected) => {
    expect(parseUserConfig(input)).toEqual(expected);
  });

  it.each(REJECTED)("rejects %s", (_name, input, expected) => {
    let caught: unknown;
    try {
      parseUserConfig(input);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    expect(describeIssues(caught)).toBe(expected);
  });
});
