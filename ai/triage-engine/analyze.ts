import fs from "fs";
import path from "path";
import { classifyFailure, Severity } from "./domain-classifier";

interface TestResult {
 domain: string;
 testName: string;
 status: "passed" | "failed" | "skipped";
 error?: string;
 duration: number;
}

interface TriageResult {
 domain: string;
 testName: string;
 severity: Severity;
 action: string;
 escalate: boolean;
 error: string;
}

const SEVERITY_ORDER: Record<Severity, number> = {
 CRITICAL: 0,
 HIGH: 1,
 MEDIUM: 2,
 LOW: 3,
};

function parseJUnitResults(filePath: string, domain: string): TestResult[] {
 if (!fs.existsSync(filePath)) return [];

 const content = fs.readFileSync(filePath, "utf-8");
 const results: TestResult[] = [];

 const testcaseRegex =
  /<testcase[^>]*name="([^"]*)"[^>]*time="([^"]*)"[^>]*>([\s\S]*?)<\/testcase>/g;
 let match;

 while ((match = testcaseRegex.exec(content)) !== null) {
  const [, name, time, body] = match;
  const failureMatch = body.match(/<failure[^>]*>([\s\S]*?)<\/failure>/);

  results.push({
   domain,
   testName: name,
   status: failureMatch
    ? "failed"
    : body.includes("<skipped")
      ? "skipped"
      : "passed",
   error: failureMatch ? failureMatch[1].trim() : undefined,
   duration: parseFloat(time) * 1000,
  });
 }

 return results;
}

function triage(results: TestResult[]): TriageResult[] {
 const failed = results.filter((r) => r.status === "failed" && r.error);
 const triaged: TriageResult[] = [];

 for (const result of failed) {
  const classification = classifyFailure(result.domain, result.error!);
  if (classification) {
   triaged.push({
    domain: result.domain,
    testName: result.testName,
    severity: classification.severity,
    action: classification.recommendedAction,
    escalate: classification.escalate,
    error: result.error!.slice(0, 200),
   });
  } else {
   triaged.push({
    domain: result.domain,
    testName: result.testName,
    severity: "LOW",
    action: "Review test failure manually — no pattern match found.",
    escalate: false,
    error: result.error!.slice(0, 200),
   });
  }
 }

 return triaged.sort(
  (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
 );
}

function report(triaged: TriageResult[], allResults: TestResult[]) {
 const total = allResults.length;
 const passed = allResults.filter((r) => r.status === "passed").length;
 const failed = allResults.filter((r) => r.status === "failed").length;

 console.log("\n═══════════════════════════════════════════════════");
 console.log("  1Platform — Triage Report");
 console.log("═══════════════════════════════════════════════════\n");
 console.log(`  Total: ${total}  Passed: ${passed}  Failed: ${failed}\n`);

 if (triaged.length === 0) {
  console.log("All tests passed. No triage required.\n");
  return;
 }

 const byDomain = triaged.reduce(
  (acc, t) => {
   (acc[t.domain] = acc[t.domain] || []).push(t);
   return acc;
  },
  {} as Record<string, TriageResult[]>,
 );

 for (const [domain, items] of Object.entries(byDomain)) {
  console.log(
   `   ${domain.toUpperCase()} (${items.length} failure${items.length > 1 ? "s" : ""}) \n`,
  );
  for (const item of items) {
   const icon =
    item.severity === "CRITICAL"
     ? "🔴"
     : item.severity === "HIGH"
       ? "🟠"
       : item.severity === "MEDIUM"
         ? "🟡"
         : "🟢";
   console.log(`${icon} [${item.severity}] ${item.testName}`);
   console.log(`Action: ${item.action}`);
   if (item.escalate)
    console.log(`⚠️  ESCALATE — block release pending review`);
   console.log();
  }
 }

 const outputPath = path.join(process.cwd(), "artifacts", "triage-report.json");
 fs.mkdirSync(path.dirname(outputPath), { recursive: true });
 fs.writeFileSync(outputPath, JSON.stringify(triaged, null, 2));
 console.log(`  Full report: ${outputPath}\n`);
}

const domains = ["finance", "health", "commerce"];
const allResults: TestResult[] = [];

for (const domain of domains) {
 const junitPath = path.join(
  process.cwd(),
  "results",
  "api",
  domain,
  "junit.xml",
 );
 allResults.push(...parseJUnitResults(junitPath, domain));
}

const triaged = triage(allResults);
report(triaged, allResults);

process.exit(triaged.some((t) => t.severity === "CRITICAL") ? 1 : 0);
