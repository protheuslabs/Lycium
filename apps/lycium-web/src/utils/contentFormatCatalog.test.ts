import { readFileSync } from "node:fs";
import catalog from "@lycium/contracts/course-content-formats.json";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("generation content format catalog", () => {
  it("only advertises canonical types implemented by the content renderer", () => {
    const path = new URL("../components/ContentView/EditableContentBlock.tsx", import.meta.url);
    const source = ts.createSourceFile(path.pathname, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rendered = new Set<string>();
    const visit = (node: ts.Node) => {
      if (
        ts.isSwitchStatement(node)
        && ts.isPropertyAccessExpression(node.expression)
        && node.expression.getText(source) === "block.type"
      ) {
        for (const clause of node.caseBlock.clauses) {
          if (ts.isCaseClause(clause) && ts.isStringLiteral(clause.expression)) {
            rendered.add(clause.expression.text);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    expect(rendered.size).toBeGreaterThan(0);
    for (const format of catalog.formats) {
      expect(rendered.has(format.type), format.type).toBe(true);
    }
  });

  it("has one example and usage guidance per unique format", () => {
    expect(new Set(catalog.formats.map((format) => format.type)).size).toBe(catalog.formats.length);
    for (const format of catalog.formats) {
      expect(format.example.type).toBe(format.type);
      expect(format.useWhen.length).toBeGreaterThan(0);
      expect(format.avoidWhen.length).toBeGreaterThan(0);
      expect(format.requirements.length).toBeGreaterThan(0);
      expect(format.workflows.length).toBeGreaterThan(0);
    }
  });
});
