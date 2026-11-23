import { describe, expect, it } from "vitest";
import { formatCoordinate, gridStepFromTicks, snapCoordinate } from "./graphCoordinates";

describe("coordinate readout defaults", () => {
  it("uses two decimals at normal zoom without unnecessary zeros or negative zero", () => {
    expect(formatCoordinate(1.23456, 2)).toBe("1.23");
    expect(formatCoordinate(2, 2)).toBe("2");
    expect(formatCoordinate(1.2, 2)).toBe("1.2");
    expect(formatCoordinate(-0.00001, 2)).toBe("0");
  });
  it("reveals more detail at fine zoom and supports explicit precision", () => {
    expect(formatCoordinate(0.012345, 0.01)).toBe("0.012");
    expect(formatCoordinate(0.00012345, 0.0001)).toBe("0.00012");
    expect(formatCoordinate(1.75, 2, 0)).toBe("2");
    expect(formatCoordinate(1.23456, 2, 4)).toBe("1.2346");
    expect(formatCoordinate(1e-12, 1e-12)).toBe("1e-12");
    expect(formatCoordinate(Infinity, 2)).toBe("undefined");
  });
});

describe("x-coordinate grid snapping", () => {
  it("follows the actual ticks and supports fractional and negative coordinates", () => {
    expect(gridStepFromTicks([-4, -2, 0, 2])).toBe(2);
    expect(gridStepFromTicks([0, 0.1, 0.2])).toBe(0.1);
    expect(snapCoordinate(1.27, 2, [-10, 10])).toBe(2);
    expect(snapCoordinate(-1.27, 2, [-10, 10])).toBe(-2);
    expect(snapCoordinate(0.37, 0.25, [-1, 1])).toBe(0.25);
  });
  it("keeps snapped coordinates on visible grid lines at the viewport edges", () => {
    expect(snapCoordinate(1.7, 2, [-1.8, 1.8])).toBe(0);
    expect(snapCoordinate(-0.1, 2, [-10, 10])).toBe(0);
    expect(snapCoordinate(0.3, 2, [0.2, 0.8])).toBe(0.3);
  });
});
