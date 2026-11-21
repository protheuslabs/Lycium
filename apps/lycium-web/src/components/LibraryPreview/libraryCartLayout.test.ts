import { describe, expect, it } from "vitest";
import { cartShelfBooks } from "./libraryCartLayout";

describe("book cart shelves", () => {
  it("packs many books together with one lean per shelf and opposite leans on adjacent shelves", () => {
    for (let variant = 0; variant < 6; variant += 1) for (let row = 0; row < 3; row += 1) {
      const books = cartShelfBooks(variant, row);
      expect(books.length).toBeGreaterThanOrEqual(18);
      expect(new Set(books.map((book) => book.tilt)).size).toBe(1);
      expect(Math.sign(books[0].tilt)).toBe(row % 2 === 0 ? -1 : 1);
      for (const [index, book] of books.entries()) {
        const cosine = Math.cos(book.tilt);
        const sine = Math.sin(book.tilt);
        const extentX = cosine * book.width / 2 + Math.abs(sine) * book.height / 2;
        expect(Math.abs(book.x) + extentX).toBeLessThan(0.45);
        expect(book.y - (cosine * book.height / 2 + Math.abs(sine) * book.width / 2)).toBeCloseTo(0);
        if (index > 0) {
          const previous = books[index - 1];
          const gap = (book.x - previous.x) * cosine + (book.y - previous.y) * sine - (book.width + previous.width) / 2;
          expect(gap).toBeCloseTo(0.0015);
        }
      }
    }
  });

  it("keeps every cart's arrangement distinct and repeatable", () => {
    expect(cartShelfBooks(0, 0)).toEqual(cartShelfBooks(0, 0));
    expect(cartShelfBooks(0, 0)).not.toEqual(cartShelfBooks(1, 0));
  });
});
