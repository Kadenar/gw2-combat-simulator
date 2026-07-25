export const strike = (
  coefficient,
  {
    hits = 1,
    atMs,
    intervalMs,
    name,
  } = {},
) => ({
  type: "strike",
  coefficient,
  hits,
  ...(atMs == null ? {} : { atMs }),
  ...(intervalMs == null ? {} : { intervalMs }),
  ...(name ? { name } : {}),
});

export const condition = (
  conditionName,
  stacks,
  duration,
  atMs,
) => ({
  type: "condition",
  condition: conditionName,
  stacks,
  duration,
  ...(atMs == null ? {} : { atMs }),
});

export const repeatedCondition = (
  conditionName,
  {
    count,
    duration,
    firstAtMs,
    intervalMs,
    stacks = 1,
  },
) => Array.from({ length: count }, (_, index) =>
  condition(
    conditionName,
    stacks,
    duration,
    firstAtMs + index * intervalMs,
  ));

export const implemented = definition => ({
  implemented: true,
  ...definition,
});
