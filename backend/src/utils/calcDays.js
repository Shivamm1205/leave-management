// Counts both days
const calcDays = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e - s) / 86400000) + 1; // 86400000 = milliseconds in a day
};

module.exports = calcDays;