import scopedEval from 'scope-eval';
/* eslint-disable require-jsdoc */
function evalfunc(func, emit, sum, log, isArray, toJSON) {
  return scopedEval(
      '(' + func.replace(/;\s*$/, '') + ');',
      {
        emit: emit,
        sum: sum,
        log: log,
        isArray: isArray,
        toJSON: toJSON,
      }
  );
}

export default evalfunc;
