
/**
 * Randomly sorts provided array **in-place**
 *
 * https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
 * https://bost.ocks.org/mike/shuffle/
 *
 * @param array []T
 * @returns []T
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
 *
 * @param n {number}
 * @returns {number} random int from the interval [0; n-1]
 */
const randomInt = n => (n * Math.random()) >>> 0;

export {randomInt, shuffle};
