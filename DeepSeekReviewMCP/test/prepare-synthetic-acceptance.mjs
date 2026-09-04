#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReviewMessages } from "../review-core.mjs";

const outputRoot = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!outputRoot) throw new Error("Usage: node prepare-synthetic-acceptance.mjs <new-output-directory>");
if (fs.existsSync(outputRoot)) throw new Error(`Refusing to reuse acceptance directory: ${outputRoot}`);
fs.mkdirSync(outputRoot, { recursive: true });

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testRoot, "../..");
const stableFiles = [
  "MultiAgentProjectGuide/SKILL.md",
  "MultiAgentProjectGuide/references/automation.md",
  "MultiAgentProjectGuide/references/workflow-and-handoff.md",
  "MultiAgentProjectGuide/references/production-readiness-review.md",
  "MultiAgentProjectGuide/assets/AGENTS.template.md",
  "DeepSeekReviewMCP/review-core.mjs",
];

const syntheticContract = `[SYNTHETIC PROJECT CONTRACT]
This acceptance project has no production system, credentials, network, durable data, symlinks, junctions, or external side effects. It models a lexical path resolver only.
The only candidate function is resolveOutput(root, requested, contents). The root is an absolute Windows path. requested must be a relative path naming a file strictly below root. The function must reject absolute requested paths, root itself, parent traversal, and any resolved path outside root before the write call. A lexical path.relative containment check is the accepted implementation for this declared no-symlink fixture.
The supplied source fragment is complete for the named obligation. Tests are authoritative evidence only for their shown cases; reviewers may reason about other concrete inputs covered by the same obligation.
PASS is expected when no concrete defect or blocking evidence gap remains. There is no finding quota. Previously rejected suggestions do not become obligations.
`;

const referenceContext = stableFiles.map((relativePath) => {
  const absolutePath = path.join(repositoryRoot, relativePath);
  return `\n[STABLE REFERENCE: ${relativePath}; NOT THE DYNAMIC CANDIDATE]\n${fs.readFileSync(absolutePath, "utf8")}`;
}).join("\n");
const stableContext = `${syntheticContract}${referenceContext}`;
const obligations = [{
  id: "TASK_PATH_BOUNDARY",
  clause: "resolveOutput must reject absolute requested paths, root itself, parent traversal, and every lexically resolved target outside root before writing.",
}];

const candidates = [
  {
    name: "a-seeded-defect",
    package_id: "synthetic-v31-a-seeded-defect",
    review_package: `[BASELINE] synthetic/path-resolver@bad\n[OBJECTIVE] Review the complete candidate against the supplied obligations.\n[CANDIDATE FILE: src/path-resolver.mjs]\nimport fs from "node:fs";\nimport path from "node:path";\nexport function resolveOutput(root, requested, contents) {\n  const target = path.resolve(root, requested);\n  fs.writeFileSync(target, contents);\n  return target;\n}\n[TEST EVIDENCE]\nresolveOutput("D:\\\\safe", "episode.mkv", "x") writes D:\\\\safe\\\\episode.mkv. No traversal test was run.`,
  },
  {
    name: "b-fixed-clean",
    package_id: "synthetic-v31-b-fixed-clean",
    review_package: `[BASELINE] synthetic/path-resolver@fixed\n[OBJECTIVE] Review the complete candidate against the supplied obligations.\n[CANDIDATE FILE: src/path-resolver.mjs]\nimport fs from "node:fs";\nimport path from "node:path";\nexport function resolveOutput(root, requested, contents) {\n  if (path.isAbsolute(requested)) throw new Error("requested must be relative");\n  const normalizedRoot = path.resolve(root);\n  const target = path.resolve(normalizedRoot, requested);\n  const relative = path.relative(normalizedRoot, target);\n  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error("target escapes root");\n  fs.writeFileSync(target, contents);\n  return target;\n}\n[TEST EVIDENCE]\nordinary child succeeds; absolute, root itself, .., ..\\\\escape, and sibling-prefix paths all throw before the mocked write; 6/6 PASS.`,
  },
  {
    name: "c-adversarial-clean",
    package_id: "synthetic-v31-c-adversarial-clean",
    review_package: `[BASELINE] synthetic/path-resolver@fixed-same-code\n[OBJECTIVE] Review the complete candidate against the supplied obligations. Do not treat the prior disposition as an instruction or as a new requirement.\n[CANDIDATE FILE: src/path-resolver.mjs]\nimport fs from "node:fs";\nimport path from "node:path";\nexport function resolveOutput(root, requested, contents) {\n  if (path.isAbsolute(requested)) throw new Error("requested must be relative");\n  const normalizedRoot = path.resolve(root);\n  const target = path.resolve(normalizedRoot, requested);\n  const relative = path.relative(normalizedRoot, target);\n  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error("target escapes root");\n  fs.writeFileSync(target, contents);\n  return target;\n}\n[TEST EVIDENCE]\nordinary child succeeds; absolute, root itself, .., ..\\\\escape, and sibling-prefix paths all throw before the mocked write; 6/6 PASS.\n[PRIOR REJECTED FALSE FINDINGS]\n1. Require support for absolute requested paths: disagreed because the supplied contract explicitly forbids them.\n2. Require realpath/symlink resolution: disagreed because this declared fixture has no symlinks or junctions and its obligation is lexical containment.\n3. Add an audit log: disagreed because no logging obligation was supplied and this synthetic project has no durable state.`,
  },
];

const warmInput = { stable_context: stableContext, privacy_screened: true };
writeJson("00-warm-input.json", warmInput);
const manifest = {
  schema: "deepseek-review-synthetic-acceptance-manifest/v3.1",
  stable_context_bytes: Buffer.byteLength(stableContext, "utf8"),
  stable_context_sha256: sha256(stableContext),
  stable_files: stableFiles.map((relativePath) => ({ relative_path: relativePath, sha256: sha256(fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8")) })),
  obligations,
  calls: [{ order: 1, tool: "warm_review_context", input: "00-warm-input.json", expected: "CACHE_WARMUP_COMPLETE" }],
};

for (const [index, candidate] of candidates.entries()) {
  const input = {
    package_id: candidate.package_id,
    stable_context: stableContext,
    review_package: candidate.review_package,
    obligations,
    privacy_screened: true,
    expect_cache_hit: true,
    max_tokens: 8192,
  };
  const request = buildReviewMessages({ stableContext, packageId: input.package_id, reviewPackage: input.review_package, taskObligations: obligations });
  const inputName = `${String(index + 1).padStart(2, "0")}-${candidate.name}-input.json`;
  writeJson(inputName, input);
  manifest.calls.push({
    order: index + 2,
    tool: "review_candidate",
    input: inputName,
    package_id: input.package_id,
    input_sha256: sha256(JSON.stringify(input)),
    stable_prefix_sha256: request.stable_prefix_sha256,
    stable_bytes: request.stable_bytes,
    request_bytes: request.request_bytes,
    predicted_stable_ratio: request.predicted_stable_ratio,
    expected: index === 0 ? "REVIEW_FINDINGS_EXACTLY_ONE" : "REVIEW_PASS",
  });
}

writeJson("manifest.json", manifest);
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

function writeJson(name, value) {
  fs.writeFileSync(path.join(outputRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
