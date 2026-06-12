import { describe, expect, it } from "vitest";
import { getCatalogClusterRouteEntries, getCatalogProgramRouteEntries } from "../app/catalogRouteRegistry";
import { localCourses } from "./localCourses";
import { localPrograms } from "./programs";

describe("clean catalog baseline", () => {
  it("does not ship committed sample courses or programs", () => {
    expect(localCourses).toEqual([]);
    expect(localPrograms).toEqual([]);
  });

  it("keeps static catalog program routes empty until generated or imported content exists", () => {
    expect(getCatalogProgramRouteEntries()).toEqual([]);
    expect(getCatalogClusterRouteEntries()).toEqual([]);
  });
});
