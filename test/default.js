let assert = require('assert');
let rewire = require('rewire');
let publish = rewire('../index.js');

// Mock fs
let fsMock = {
  existsSync: (path) => true
};

describe('Publish', function () {
  let config = null;

  beforeEach(function () {
    publish.__set__('fs', fsMock);

    config = {
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
    };
  });

  it('throws error if project\'s name is missing', function (done) {
    config.name = '';

    publish.validateConfigAndDestination(config)
      .then(() => {
        done(new Error('Expect reject but receive resolve'));
      })
      .catch(() => {
        done();
      });
  });

  it('throws error if project\'s version is missing', function (done) {
    config.version = '';

    publish.validateConfigAndDestination(config)
      .then(() => {
        done(new Error('Expect reject but receive resolve'));
      })
      .catch(() => {
        done();
      });
  });

  it('throws error if book\'s name is duplicated', function (done) {
    config.books[0].name = 'book-1';
    config.books[1].name = 'BOOK-1';

    publish.validateConfigAndDestination(config)
      .then(() => {
        done(new Error('Expect reject but receive resolve'));
      })
      .catch(() => {
        done();
      });
  });

  it('throws error if compiled book does not exist', function (done) {
    let mock = {
      existsSync: (path) => false
    };
    publish.__set__('fs', mock);

    publish.validateConfigAndDestination(context.config)
      .then(() => {
        done(new Error('Expect reject but receive resolve'));
      })
      .catch(() => {
        done();
      });
  });

  it('use name as title when title does not exists', function () {
    books = config.books;

    publish.parseConfig(config);
    assert.strictEqual(books[0].title, books[0].name);
    assert.strictEqual(books[1].title, books[1].name)
  });
});

