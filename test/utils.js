'use strict';
/* eslint-disable require-jsdoc */
const PouchDB = require('pouchdb');
function uniq(list) {
  const map = {};
  list.forEach(function(item) {
    map[item] = true;
  });
  return Object.keys(map);
}
const _Promise = require('pouchdb-promise');
module.exports = {
  Promise: _Promise,
  adapterUrl: function(adapter, name) {
    if (adapter === 'http') {
      return 'http://127.0.0.1:5984/' + name;
    }
    return name;
  },
  // Promise finally util similar to Q.finally
  fin: function(promise, cb) {
    return promise.then(function(res) {
      const promise2 = cb();
      if (typeof promise2.then === 'function') {
        return promise2.then(function() {
          return res;
        });
      }
      return res;
    }, function(reason) {
      const promise2 = cb();
      if (typeof promise2.then === 'function') {
        return promise2.then(function() {
          throw reason;
        });
      }
      throw reason;
    });
  },
  promisify: function(fun, context) {
    return function(...args) {
      return new _Promise(function(resolve, reject) {
        args.push(function(err, res) {
          if (err) {
            return reject(err);
          }
          return resolve(res);
        });
        fun.apply(context, args);
      });
    };
  },
  // Delete specified databases
  cleanup: function(dbs, done) {
    dbs = uniq(dbs);
    let num = dbs.length;
    const finished = function() {
      if (--num === 0) {
        done();
      }
    };

    dbs.forEach(function(db) {
      new PouchDB(db).destroy(finished, finished);
    });
  },
};
