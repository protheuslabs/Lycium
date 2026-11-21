import { seededRandom } from "./libraryOrbit";

export function cartShelfBooks(variant: number, row: number) {
  const random = seededRandom(341 + variant * 79 + row * 271);
  const count = 18 + (row + variant) % 3;
  const tilt = (row % 2 === 0 ? -1 : 1) * (0.17 + variant % 3 * 0.01);
  const sine = Math.sin(tilt);
  const cosine = Math.cos(tilt);
  const widths = Array.from({ length: count }, () => 0.027 + random() * 0.02);
  const scale = (0.8 - (count - 1) * 0.0015) / widths.reduce((total, width) => total + width, 0);
  let offset = -0.4;
  const books = widths.map((rawWidth) => {
    const width = rawWidth * scale;
    const height = 0.18 + random() * 0.13;
    const y = cosine * height / 2 + Math.abs(sine) * width / 2;
    // Pack along the face normal while grounding every tilted book on the shelf.
    const x = (offset + width / 2 - sine * y) / cosine;
    offset += width + 0.0015;
    return { width, height, depth: 0.19 + random() * 0.05, cover: Math.floor(random() * 6), tilt, x, y, z: (random() - 0.5) * 0.025 };
  });
  const extents = books.map((book) => ({ x: book.x, halfWidth: cosine * book.width / 2 + Math.abs(sine) * book.height / 2 }));
  const center = (Math.min(...extents.map((book) => book.x - book.halfWidth)) + Math.max(...extents.map((book) => book.x + book.halfWidth))) / 2;
  return books.map((book) => ({ ...book, x: book.x - center }));
}
