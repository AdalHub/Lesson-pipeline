/**
 * TEKS reference material used to anchor classification.
 *
 * The model knows TEKS from training, but recall is fuzzy at grade
 * boundaries. A compact table of landmark student expectations (math, where
 * the boundaries are most ambiguous) plus explicit boundary rules makes the
 * grade decision repeatable. Codes here were written from the published
 * TEKS (19 TAC Chapter 111); keep this list short and only add entries you
 * are sure of.
 */
export const TEKS_ANCHORS = `
TEKS math landmarks (grade: representative student expectations):
K: K.3A join and separate sets to add and subtract within 10; K.2A count to 20.
1: 1.3B word problems joining, separating or comparing sets within 20; 1.3D add and subtract within 20 using basic fact strategies; 1.5B skip count by 2s, 5s and 10s to 120.
2: 2.4B add up to four two-digit numbers and subtract two-digit numbers using place value and algorithms; 2.4C one- and multi-step addition/subtraction word problems within 1,000; 2.6A model contextual multiplication situations by joining equal sets (introduction only; no products or facts computed).
3: 3.4K one- and two-step multiplication and division problems within 100 using equal groups, arrays or facts; 3.4A add and subtract within 1,000 fluently; 3.3F equivalent fractions; 3.6C area of rectangles; 3.7B perimeter of polygons.
4: 4.4H multi-digit multiplication and division problems including remainders; 4.3E add and subtract fractions with equal denominators; 4.4A add and subtract whole numbers and decimals to the hundredths; 4.5D perimeter and area of rectangles.
5: 5.3K add and subtract positive rational numbers (fractions and decimals) fluently; 5.3E multiply decimals; 5.3L divide whole numbers by unit fractions and unit fractions by whole numbers; 5.4F simplify numerical expressions with up to two levels of grouping, no exponents; 5.4H perimeter, area and volume problems; 5.8C graph ordered pairs in the first quadrant.
6: 6.3D add, subtract, multiply and divide integers fluently; 6.3E multiply and divide positive rational numbers; 6.4B ratio and rate problems; 6.7A order of operations with whole-number exponents; 6.10A one-variable, one-step equations and inequalities; 6.8D area of triangles, parallelograms and trapezoids, volume of rectangular prisms.
7: 7.3B operations with rational numbers in problems; 7.4A constant rates of change including d = rt; 7.4D ratios, rates and percents including percent increase and decrease; 7.9B circumference and area of circles; 7.11A one-variable, two-step equations and inequalities; 7.6I experimental and theoretical probability.
8: 8.4C slope and y-intercept from a table or graph; 8.4B graph proportional relationships with unit rate as slope; 8.5I write y = mx + b for a linear relationship; 8.7C Pythagorean theorem to solve problems; 8.8C one-variable equations with variables on both sides; 8.8D triangle angle sum and exterior angle facts; 8.7A volume of cylinders, cones and spheres; 8.2B approximate irrational numbers.
Algebra I (grade 9): A.2C write linear equations from tables, graphs or descriptions; A.3A slope of a line from a table, graph, two points or an equation; A.3B rate of change of a linear function; A.5A solve linear equations including the distributive property and variables on both sides; A.5C solve systems of two linear equations; A.8A solve quadratic equations by factoring, square roots, completing the square or the quadratic formula; A.10E factor trinomials ax^2 + bx + c; A.11B laws of exponents including rational exponents; A.9C write exponential functions.
Geometry (grade 10): G.2B distance, slope and midpoint formulas; G.6D theorems about triangles (angle sum, isosceles base angles, midsegments); G.9A sine, cosine and tangent ratios in right triangles; G.9B special right triangles; G.11B area of composite figures; G.11D surface area of three-dimensional figures; G.12E equation of a circle with center (h, k) and radius r.
Algebra II (grade 11): 2A.3B systems of three linear equations; 2A.4F solve quadratic and square root equations; 2A.5D solve exponential and logarithmic equations; 2A.7B add, subtract and multiply polynomials; 2A.7C divide polynomials; 2A.7F operations on rational expressions; 2A.7I domain and range in interval notation.
Precalculus (grade 12): P.* codes.

Math grade-boundary rules:
- Multiplication or division word problems with equal groups or arrays are grade 3 (3.4K), not grade 2. Grade 2 only models equal sets; it does not compute products.
- Adding or subtracting two-digit numbers with totals above 20 is grade 2 (2.4B or 2.4C), not grade 1. Grade 1 stays within 20.
- Slope from a table or graph, y = mx + b, and the Pythagorean theorem are grade 8. Slope from two points, solving quadratics, factoring, systems of equations and function notation are Algebra I (grade 9).
- Formal proof, trigonometric ratios and circle equations are Geometry (grade 10). Logarithms, polynomial division and rational expressions are Algebra II (grade 11).

Other subjects:
- Science, social studies and ELAR K-8 codes use the same "<grade>.<n><letter>" form (e.g. 5.6A, 8.7A, 4.7C). High-school courses use a course prefix: B (Biology, grade 9), C (Chemistry, grade 10), P (Physics, grade 11), IPC (grade 9), E1-E4 (English I-IV, grades 9-12), WG (World Geography, 9), WH (World History, 10), USH (US History, 11), GOVT and ECO (12).
- Reading passages with comprehension questions: judge by the text complexity and the skill (e.g. main idea, inference, theme, author's purpose), then pick the grade whose ELAR standard matches.
`.trim();

/** Typical Texas grade for high-school course prefixes. */
const COURSE_GRADES: Record<string, number> = {
  A: 9,
  G: 10,
  '2A': 11,
  E1: 9,
  E2: 10,
  E3: 11,
  E4: 12,
  B: 9,
  IPC: 9,
  C: 10,
  WG: 9,
  WH: 10,
  USH: 11,
  GOVT: 12,
  ECO: 12,
  // 'P' is ambiguous (Physics, grade 11 vs Precalculus, grade 12): not reconciled.
};

/**
 * Returns the grade implied by a TEKS code, or null when the code is
 * "unknown", malformed, or a prefix we don't map.
 */
export function gradeFromTeksCode(code: string): number | null {
  const trimmed = code.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return null;

  const numeric = /^(\d{1,2})\.\d{1,2}[A-Za-z]?$/.exec(trimmed);
  if (numeric) {
    const grade = Number(numeric[1]);
    return grade >= 1 && grade <= 12 ? grade : null;
  }

  const course = /^([A-Za-z0-9]{1,4})\.\d{1,2}[A-Za-z]?$/.exec(trimmed);
  if (course) {
    return COURSE_GRADES[course[1]!.toUpperCase()] ?? null;
  }

  return null;
}
