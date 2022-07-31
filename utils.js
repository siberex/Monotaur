
/**
 * Randomly sorts provided array **in-place**
 *
 * https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
 * https://bost.ocks.org/mike/shuffle/
 *
 * @param array {T[]}
 * @returns {T[]}
 */
const shuffle = array => {
    // for i from n−1 down to 1 do:
    for (let j, i = array.length - 1; i > 0; i--) {
        // j := random integer such that 0 <= j <= i (inclusive)
        j = randomInt(i + 1);
        // exchange a[j] and a[i]
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Returns random int up to n.
 * Sanity constraint: 2 <= n <= 2^32 - 1.
 *
 * randomInt(-2) will produce random item from the set {0, 2^32-1}
 * randomInt(-3) will produce random item from the set {0, 2^32-1, 2^32-2}
 * ...
 *
 * @param n {number}
 * @returns {number} random int from the interval [0; n-1]
 */
const randomInt = n => (n * Math.random()) >>> 0;

/**
 * Produce CSV-formatted string from array
 * Or tab-separated TSV:
 * const tsv = a => csv(a, '\t');
 *
 * @param array {T[][]}
 * @param separator {string} comma by default
 * @returns {string}
 */
const csv = (array, separator=',') => array.reduce(
    (csv, row) => `${csv}${row.join(separator)}\n`, ''
);

/**
 * Converts array of Curves to array of polygon coordinates [x, y] represented by them.
 *
 * Accepts LineCurve, CubicBezierCurve and QuadraticBezierCurve.
 * Bézier curves are treated as lines like all control points are collinear.
 * Other Curve types (ArcCurve, EllipseCurve, SplineCurve) are ignored.
 *
 * Usage:
 * const SvgResult = (new SVGLoader()).parse('<svg>...</svg>');
 * SvgResult.paths.forEach(path => path.subPaths.forEach(subpath => {
 *     const coords = LineCurvesToPolygon(subpath.curves);
 *     console.log(csv(coords,'\t\t'));
 * }));
 *
 * @param curves {(LineCurve|CubicBezierCurve|QuadraticBezierCurve)[]}
 * @returns {number[][]}
 */
const LineCurvesToPolygon = (curves) => curves.reduce((acc, curve) => {

    let lineFrom, lineTo;
    switch (curve.type) {
        case 'LineCurve':
            lineFrom = curve.v1.toArray();
            lineTo = curve.v2.toArray();
            break;
        case 'CubicBezierCurve':
            lineFrom = curve.v0.toArray();
            lineTo = curve.v3.toArray();
            break;
        case 'QuadraticBezierCurve':
            lineFrom = curve.v0.toArray();
            lineTo = curve.v2.toArray();
            break;
        default:
            return acc;
    }

    if (acc.length) {
        const lastPoint = acc[acc.length-1];
        if (lineFrom[0] !== lastPoint[0] || lineFrom[1] !== lastPoint[1]) {
            acc.push(lineFrom);
        }
    } else {
        acc.push(lineFrom);
    }

    acc.push(lineTo);
    return acc;
}, []);


export {csv, randomInt, shuffle, LineCurvesToPolygon};
