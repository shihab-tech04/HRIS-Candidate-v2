export function createLatestRequestGate() {
  let generation = 0;

  return {
    open() {
      const requestGeneration = ++generation;
      let cancelled = false;

      return {
        isCurrent() {
          return !cancelled && requestGeneration === generation;
        },
        cancel() {
          cancelled = true;
        },
      };
    },
  };
}
