let assert = require('assert');
let sinon = require('sinon');
let rewire = require("rewire");
let publish = rewire('../index.js')

let fsMock = {
  existsSync: (path) => true
};

describe('Validation', function () {
  let context = null;

  beforeEach(function () {
    publish.__set__('fs', fsMock);

    context = {
      config: {
        name: 'pandora-cloud',
        version: '1.0.0',
        books: [
          {
            name: 'book-1',
            outdir: './build'
          },
          {
            name: 'book-2',
            outdir: './build'
          }
        ]
      },
      storage: ''
    };
  });

  afterEach(function () {
  });

  it('throws error if project\'s name is missing', function (done) {
    context.config.name = '';

    publish.handle(context)
      .then(() => {
        done('Expect reject but receive resolve');
      })
      .catch(() => {
        done();
      });
  });

  it('throws error if project\'s version is missing', function (done) {
    context.config.version = '';

    publish.handle(context)
      .then(() => {
        done('Expect reject but receive resolve');
      })
      .catch(() => {
        done();
      });
  });

  it('throws error if book\'s name is duplicated', function (done) {
    context.config.books[0].name = 'book-1';
    context.config.books[1].name = 'BOOK-1';

    publish.handle(context)
      .then(() => {
        done('Expect reject but receive resolve');
      })
      .catch(() => {
        done();
      });
  });

  it('throws error if compiled book does not exist', function (done) {
    let mock = {
      existsSync: (path) => false
    }
    publish.__set__('fs', mock);

    publish.handle(context)
      .then(() => {
        done('Expect reject but receive resolve');
      })
      .catch(() => {
        done();
      });
  });
});

