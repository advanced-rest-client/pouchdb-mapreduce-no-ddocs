/* eslint-disable require-jsdoc */
/* eslint-disable max-len */
const { query, viewCleanup } = require('../');
const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-adapter-memory'));
PouchDB.plugin({
  query: query,
  viewCleanup: viewCleanup,
});
const testUtils = require('./utils');
const chai = require('chai');
global.should = chai.should();
chai.use(require('chai-as-promised'));

const adapters = ['local']; // , 'http'
adapters.forEach(function(adapters) {
  describe('views.spec.js-' + adapters[0] + '-' + adapters[1], function() {
    const dbs = {};

    beforeEach(function(done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_repl_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    after(function(done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });


    it('Test basic view', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { foo: 'bar' },
          {
            _id: 'volatile',
            foo: 'baz',
          },
        ],
      }, {}, function() {
        const queryFun = {
          map: function(doc) {
            emit(doc.foo, doc);
          },
        };
        db.get('volatile', function(_, doc) {
          db.remove(doc, function() {
            db.query(queryFun, {
              include_docs: true,
              reduce: false,
            }, function(_, res) {
              res.rows.should.have.length(1, 'Dont include deleted documents');
              res.total_rows.should.equal(1, 'Include total_rows property.');
              res.rows.forEach(function(x) {
                should.exist(x.id);
                should.exist(x.key);
                should.exist(x.value._rev);
                should.exist(x.doc._rev);
              });
              done();
            });
          });
        });
      });
    });

    it('Test passing just a function', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { foo: 'bar' },
          {
            _id: 'volatile',
            foo: 'baz',
          },
        ],
      }, {}, function() {
        const queryFun = function(doc) {
          emit(doc.foo, doc);
        };
        db.get('volatile', function(_, doc) {
          db.remove(doc, function() {
            db.query(queryFun, {
              include_docs: true,
              reduce: false,
            }, function(_, res) {
              res.rows.should.have.length(1, 'Dont include deleted documents');
              res.rows.forEach(function(x) {
                should.exist(x.id);
                should.exist(x.key);
                should.exist(x.value._rev);
                should.exist(x.doc._rev);
              });
              done();
            });
          });
        });
      });
    });

    it('Test opts.startkey/opts.endkey', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { key: 'key1' },
          { key: 'key2' },
          { key: 'key3' },
          { key: 'key4' },
          { key: 'key5' },
        ],
      }, {}, function() {
        const queryFun = {
          map: function(doc) {
            emit(doc.key, doc);
          },
        };
        db.query(queryFun, {
          reduce: false,
          startkey: 'key2',
        }, function(_, res) {
          res.rows.should.have.length(4, 'Startkey is inclusive');
          db.query(queryFun, {
            reduce: false,
            endkey: 'key3',
          }, function(_, res) {
            res.rows.should.have.length(3, 'Endkey is inclusive');
            db.query(queryFun, {
              reduce: false,
              startkey: 'key2',
              endkey: 'key3',
            }, function(_, res) {
              res.rows.should.have.length(2, 'Startkey and endkey together');
              db.query(queryFun, {
                reduce: false,
                startkey: 'key4',
                endkey: 'key4',
              }, function(_, res) {
                res.rows.should.have.length(1, 'Startkey=endkey');
                done();
              });
            });
          });
        });
      });
    });

    it('Test opts.key', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { key: 'key1' },
          { key: 'key2' },
          { key: 'key3' },
          { key: 'key3' },
        ],
      }, {}, function() {
        const queryFun = {
          map: function(doc) {
            emit(doc.key, doc);
          },
        };
        db.query(queryFun, {
          reduce: false,
          key: 'key2',
        }, function(_, res) {
          res.rows.should.have.length(1, 'Doc with key');
          db.query(queryFun, {
            reduce: false,
            key: 'key3',
          }, function(_, res) {
            res.rows.should.have.length(2, 'Multiple docs with key');
            done();
          });
        });
      });
    });

    it.skip('Test basic view collation', function(done) {
      const values = [];
      // special values sort before all other types
      values.push(null);
      values.push(false);
      values.push(true);
      // then numbers
      values.push(1);
      values.push(2);
      values.push(3);
      values.push(4);
      // then text, case sensitive
      // currently chrome uses ascii ordering and so wont handle
      // capitals properly
      values.push('a');
      // values.push("A");
      values.push('aa');
      values.push('b');
      // values.push("B");
      values.push('ba');
      values.push('bb');
      // then arrays. compared element by element until different.
      // Longer arrays sort after their prefixes
      values.push(['a']);
      values.push(['b']);
      values.push([
        'b',
        'c',
      ]);
      values.push([
        'b',
        'c',
        'a',
      ]);
      values.push([
        'b',
        'd',
      ]);
      values.push([
        'b',
        'd',
        'e',
      ]);
      // then object, compares each key value in the list until different.
      // larger objects sort after their subset objects.
      values.push({ a: 1 });
      values.push({ a: 2 });
      values.push({ b: 1 });
      values.push({ b: 2 });
      values.push({
        b: 2,
        a: 1,
      });
      // Member order does matter for collation.
      // CouchDB preserves member order
      // but doesn't require that clients will.
      // (this test might fail if used with a js engine
      // that doesn't preserve order)
      values.push({
        b: 2,
        c: 2,
      });
      const db = new PouchDB(dbs.name);
      const docs = values.map(function(x, i) {
        return {
          _id: i.toString(),
          foo: x,
        };
      });
      db.bulkDocs({ docs: docs }, {}, function(err) {
        const queryFun = {
          map: function(doc) {
            emit(doc.foo, null);
          },
        };
        if (err) {
          done(err);
        }
        db.query(queryFun, { reduce: false }, function(err, res) {
          if (err) {
            done(err);
          }
          res.rows.forEach(function(x, i) {
            x.key.should.deep.equal(values[i], 'keys collate');
          });
          db.query(queryFun, {
            descending: true,
            reduce: false,
          }, function(err, res) {
            if (err) {
              done(err);
            }
            res.rows.forEach(function(x, i) {
              x.key.should.deep
                  .equal(values[values.length - 1 - i],
                      'keys collate descending');
            });
            done();
          });
        });
      });
    });

    it('Test joins', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          {
            _id: 'mydoc',
            foo: 'bar',
          },
          { doc_id: 'mydoc' },
        ],
      }, {}, function() {
        const queryFun = {
          map: function(doc) {
            if (doc.doc_id) {
              emit(doc._id, { _id: doc.doc_id });
            }
          },
        };
        db.query(queryFun, {
          include_docs: true,
          reduce: false,
        }, function(_, res) {
          should.exist(res.rows[0].doc);
          res.rows[0].doc._id.should.equal('mydoc', 'mydoc included');
          done();
        });
      });
    });

    it('No reduce function', function(done) {
      const db = new PouchDB(dbs.name);
      db.post({ foo: 'bar' }, function() {
        const queryFun = {
          map: function() {
            emit('key', 'val');
          },
        };
        db.query(queryFun, function() {
          done();
        });
      });
    });

    it('Built in _sum reduce function', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { val: 'bar' },
          { val: 'bar' },
          { val: 'baz' },
        ],
      }, null, function() {
        const queryFun = {
          map: function(doc) {
            emit(doc.val, 1);
          },
          reduce: '_sum',
        };
        db.query(queryFun, {
          reduce: true,
          group_level: 999,
        }, function(err, res) {
          res.rows.should.have.length(2);
          res.rows[0].value.should.equal(2);
          res.rows[1].value.should.equal(1);
          done();
        });
      });
    });

    it('Built in _count reduce function', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { val: 'bar' },
          { val: 'bar' },
          { val: 'baz' },
        ],
      }, null, function() {
        const queryFun = {
          map: function(doc) {
            emit(doc.val, doc.val);
          },
          reduce: '_count',
        };
        db.query(queryFun, {
          reduce: true,
          group_level: 999,
        }, function(err, res) {
          res.rows.should.have.length(2);
          res.rows[0].value.should.equal(2);
          res.rows[1].value.should.equal(1);
          done();
        });
      });
    });

    it('Built in _stats reduce function', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { val: 'bar' },
          { val: 'bar' },
          { val: 'baz' },
        ],
      }, null, function() {
        const queryFun = {
          map: function(doc) {
            emit(doc.val, 1);
          },
          reduce: '_stats',
        };
        db.query(queryFun, {
          reduce: true,
          group_level: 999,
        }, function(err, res) {
          const stats = res.rows[0].value;
          stats.sum.should.equal(2);
          stats.count.should.equal(2);
          stats.min.should.equal(1);
          stats.max.should.equal(1);
          stats.sumsqr.should.equal(2);
          done();
        });
      });
    });

    it('No reduce function, passing just a  function', function(done) {
      const db = new PouchDB(dbs.name);
      db.post({ foo: 'bar' }, function() {
        const queryFun = function() {
          emit('key', 'val');
        };
        db.query(queryFun, function() {
          done();
        });
      });
    });

    it('Views should include _conflicts', function(done) {
      const doc1 = {
        _id: '1',
        foo: 'bar',
      };
      const doc2 = {
        _id: '1',
        foo: 'baz',
      };
      const queryFun = function(doc) {
        emit(doc._id, !!doc._conflicts);
      };
      const db = new PouchDB(dbs.name);
      const remote = new PouchDB(dbs.remote);
      db.post(doc1, function() {
        remote.post(doc2, function() {
          db.replicate.from(remote, function() {
            db.get(doc1._id, { conflicts: true }, function(err, res) {
              should.exist(res._conflicts);
              db.query(queryFun, function(err, res) {
                should.exist(res.rows[0].value);
                done();
              });
            });
          });
        });
      });
    });

    it('Map only documents with _conflicts (#1000)', function(done) {
      const docs1 = [
        {
          _id: '1',
          foo: 'bar',
        },
        {
          _id: '2',
          name: 'two',
        },
      ];
      const doc2 = {
        _id: '1',
        foo: 'baz',
      };
      const queryFun = function(doc) {
        if (doc._conflicts) {
          emit(doc._id, doc._conflicts);
        }
      };
      const db = new PouchDB(dbs.name);
      const remote = new PouchDB(dbs.remote);
      db.bulkDocs({ docs: docs1 }, function(err, res) {
        const revId1 = res[0].rev;
        remote.post(doc2, function(err, res) {
          const revId2 = res.rev;
          db.replicate.from(remote, function() {
            db.get(docs1[0]._id, { conflicts: true }, function(err, res) {
              const winner = res._rev;
              const looser = winner === revId1 ? revId2 : revId1;
              should.exist(res._conflicts);
              db.query(queryFun, function(err, res) {
                res.rows.should.have.length(1, 'One doc with conflicts');
                res.rows[0].key.should
                    .equal('1', 'Correct document with conflicts.');
                res.rows[0].value.should.deep
                    .equal([looser], 'Correct conflicts included.');
                done();
              });
            });
          });
        });
      });
    });

    it('Test view querying with limit option', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { foo: 'bar' },
          { foo: 'bar' },
          { foo: 'baz' },
        ],
      }, null, function() {
        db.query(function(doc) {
          if (doc.foo === 'bar') {
            emit(doc.foo);
          }
        }, { limit: 1 }, function(err, res) {
          res.total_rows.should.equal(2, 'Correctly returns total rows');
          res.rows.should.have.length(1, 'Correctly limits returned rows');
          done();
        });
      });
    });

    it('Query non existing view returns error', function(done) {
      const db = new PouchDB(dbs.name);
      const doc = {
        _id: '_design/barbar',
        views:
          { scores:
            { map: 'function (doc) { if (doc.score) ' +
                   '{ emit(null, doc.score); } }' } },
      };
      db.post(doc, function() {
        db.query('barbar/dontExist', { key: 'bar' }, function(err) {
          if (!err.name) {
            err.name = err.error;
            err.message = err.reason;
          }
          err.name.should.be.a('string');
          err.message.should.be.a('string');
          done();
        });
      });
    });

    it('Special document member _doc_id_rev', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: [{ foo: 'bar' }] }, null, function() {
        db.query(function(doc) {
          if (doc.foo === 'bar') {
            emit(doc.foo);
          }
        }, { include_docs: true }, function(err, res) {
          should.not.exist(res.rows[0].doc._doc_id_rev);
          done();
        });
      });
    });

    it('If reduce function returns 0', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({ docs: [{ foo: 'bar' }] }, null, function() {
        db.query({
          map: function(doc) {
            emit(doc.foo);
          },
          reduce: function() {
            return 0;
          },
        }, function(err, data) {
          should.not.equal(data.rows[0].value, null, 'value is null');
          done();
        });
      });
    });

    it('Testing skip with a view', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { foo: 'bar' },
          { foo: 'baz' },
          { foo: 'baf' },
        ],
      }, null, function() {
        db.query(function(doc) {
          emit(doc.foo, null);
        }, { skip: 1 }, function(err, data) {
          should.not.exist(err);
          data.rows.should.have.length(2);
          done();
        });
      });
    });

    it('Testing skip with allDocs', function(done) {
      const db = new PouchDB(dbs.name);
      db.bulkDocs({
        docs: [
          { foo: 'bar' },
          { foo: 'baz' },
          { foo: 'baf' },
        ],
      }, null, function() {
        db.allDocs({ skip: 1 }, function(err, data) {
          should.not.exist(err);
          data.rows.should.have.length(2);
          done();
        });
      });
    });

    it('Destroy view when db created with {name: foo}', function() {
      const db = new PouchDB({ name: dbs.name });
      const doc = {
        _id: '_design/index',
        views: {
          index:
          { map: 'function (doc) { emit(doc._id); }' },
        },
      };
      return db.put(doc).then(function() {
        return db.query('index');
      }).then(function() {
        return db.destroy();
      });
    });

    it.skip('Map documents on 0/null/undefined/empty string', function(done) {
      const db = new PouchDB(dbs.name);
      const docs = [
        {
          _id: 'doc0',
          num: 0,
        },
        {
          _id: 'doc1',
          num: 1,
        },
        { _id: 'doc2' },
        {
          _id: 'doc3',
          num: null,
        },
        {
          _id: 'doc4',
          num: '',
        },
      ];
      db.bulkDocs({ docs: docs }, function() {
        const mapFunction = function(doc) {
          emit(doc.num, null);
        };
        db.query(mapFunction, {
          key: 0,
          include_docs: true,
        }, function(err, data) {
          data.rows.should.have.length(1);
          data.rows[0].doc._id.should.equal('doc0');
        });
        db.query(mapFunction, {
          key: null,
          include_docs: true,
        }, function(err, data) {
          data.rows.should.have.length(2);
          data.rows[0].doc._id.should.equal('doc2');
          data.rows[1].doc._id.should.equal('doc3');
        });
        db.query(mapFunction, {
          key: '',
          include_docs: true,
        }, function(err, data) {
          data.rows.should.have.length(1);
          data.rows[0].doc._id.should.equal('doc4');
        });
        db.query(mapFunction, {
          key: undefined,
          include_docs: true,
        }, function(err, data) {
          data.rows.should.have.length(5);
          // everything
          done();
        });
      });
    });
  });
});
