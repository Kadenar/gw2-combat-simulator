export function nextResultSortState(currentColumn, currentDirection, column) {
  if (currentColumn !== column) {
    return { column, direction: "desc" };
  }
  const direction = currentDirection === "desc"
    ? "asc"
    : currentDirection === "asc" ? null : "desc";
  return {
    column: direction ? column : null,
    direction,
  };
}

export function sortResultRows(rows, columns, column, direction) {
  const sorted = [...rows];
  if (!column || !direction) {
    return sorted.sort((left, right) =>
      Number(right.total || 0) - Number(left.total || 0));
  }

  const definition = columns.find(candidate => candidate.key === column);
  if (definition?.numeric) {
    return sorted.sort((left, right) => {
      const leftValue = left[column] ?? -Infinity;
      const rightValue = right[column] ?? -Infinity;
      return direction === "asc"
        ? leftValue - rightValue
        : rightValue - leftValue;
    });
  }
  return sorted.sort((left, right) => direction === "asc"
    ? String(left[column] ?? "").localeCompare(String(right[column] ?? ""))
    : String(right[column] ?? "").localeCompare(String(left[column] ?? "")));
}
