const install = PluginTypes => PluginTypes.PUBLISHER;

const check = (context) => {
  return context.task === 'publish';
};

const handleOld = (context) => new Promise((resolve, reject) => {

  const JSZip = require('jszip');
  const zip = new JSZip();
  const glob = require('glob');
  const fs = require('fs');
  const path = require('path');
  const config = context.config;

  // Compiled book directory
  const outputdir = path.join(config.outdir, config.name);

  // Find all of the book files
  glob(path.join(outputdir, '**/*'), { nodir: true }, (err, files) => {

    if (err) {
      return reject(err);
    }

    // Expand the progress bar value
    context.progress.expandBy(files.length * 2);

    let done = 0;

    // Zip all of the book files
    var promise = Promise.all(files.map((filename, index) => new Promise((resolve, reject) => {
      fs.readFile(filename, (err, data) => {
        if (err) {
          return reject(err);
        }
        done++;
        zip.file(filename, data, { binary: true });
        context.log(`Packaging files ${done}/${files.length}`);
        context.progress.tick();
        resolve();
      });
    })))

    // Generate the zip file
    .then(() => zip.generateAsync({ type: 'nodebuffer' }))

    .then(content => new Promise(resolve => {

      // <content> is the zip data
      // this is what needs to be pushed to the doc cloud

      // Fake, pushing to doc cloud...
      for(let i = 0; i <= files.length; i++) {
        setTimeout((function (percent) {
          context.log(`Pushing to Doc Cloud ${Math.round(percent)}%`);
          context.progress.tick();
          if (percent === 100) {
            resolve();
          }
        }).bind(this, (i + 1) / files.length * 100), 1000 + 20 * i);
      }
    }));

    resolve(promise);
  });

});

const validateConfigAndDestination = (config) => {
  const fs = require('fs');
  const path = require('path');

  // name and version are mandatory fields
  if (!config.name) {
    throw new Error('"name" field is missing in pandora.json.');
  }

  if (!config.version) {
    throw new Error('"version" field is missing in pandora.json.');
  }

  let books = config.books;
  let bookNames = [];

  for (let i = 0; i < books.length; i++) {
    let book = books[i];
    let dest = path.join(book.outdir, book.name);

    // Check that name is not duplicated
    // Book's name is changed to lower case in pandora core
    if (bookNames.indexOf(book.name) > -1) {
      throw new Error('Book\'s name cannot be duplicated.');
    }
    bookNames.push(book.name);

    // Check that compiled book exists
    if (!fs.existsSync(dest)) {
      throw new Error('Cannot find compiled book at ' + dest + '.');
    }
  }
};

const parseConfig = (config) => {
  let docsJson = {
    name: config.name,
    version: config.version,
    books: []
  };

  let books = config.books;
  for (let i = 0; i < books.length; i++) {
    let book = books[i];
    docsJson.books.push({
      name: book.name,
      type: book.type
    });
  }

  return docsJson;
};

const createDocsJson = (config, storage) => {
  const fs = require('fs');
  const path = require('path');

  let docsJson = parseConfig(config);
  let docsString = JSON.stringify(docsJson, null, 2);
  let docsJsonPath = path.join(storage, 'docs.json');

  fs.writeFileSync(docsJsonPath, docsString);
};

const copyBooks = (config, storage) => {
  const path = require('path');
  const fse = require('fs-extra');

  // create books folder
  var booksFolder = path.join(storage, 'books');
  fse.mkdirSync(booksFolder);

  // copy books
  var books = config.books;
  for(let i = 0; i < books.length; i++) {
    let book = books[i];
    let dest = path.join(book.outdir, book.name);

    fse.copySync(dest, path.join(booksFolder, book.name));
  }
};

const zipFiles = (config, storage) => new Promise((resolve, reject) => {
  const JSZip = require('jszip');
  const zip = new JSZip();
  const glob = require('glob');
  const fs = require('fs');
  const path = require('path');

  const globOptions = {
    nodir: true,
    cwd: storage
  };

  glob('**/*', globOptions, (err, files) => {
    if (err) {
      return reject(err);
    }

    let promise = Promise.all(files.map((filename, index) => {
      return new Promise((resolve, reject) => {
        fs.readFile(path.join(storage, filename), (err, data) => {
          if (err) {
            return reject(err);
          }

          zip.file(filename, data, { binary: true });
          resolve();
        });
      });
    }))

    .then(() => zip.generateAsync({ type: 'nodebuffer' }))

    .then((content) => {
      let zipName = config.name + '_' + config.version + '.zip';
      let zipPath = path.join(storage, zipName);
      fs.writeFileSync(zipPath, content);

      return zipPath;
    });

    resolve(promise);
  });
});

const upload = (zipFile, rcConfig) => new Promise((resolve, reject) => {
  const fs = require('fs');
  const request = require('request');
  const options = {
    url: rcConfig.endpoint,
    formData: {
      'doc-package': fs.createReadStream(zipFile)
    },
    timeout: 120000
  };

  request.post(options, (error, response, body) => {
    // Handle request's error e.g. timeout
    if (error) {
      return reject(new Error('Upload failed - ' + error.message));
    }

    // Parsing response from pandora-cloud
    let bodyJson;
    try {
      bodyJson = JSON.parse(body);
    }
    catch (e) {
      return reject(new Error('Upload failed - Response from pandora-cloud is not in the correct JSON format'));
    }

    // Handle error returned from pandora-cloud
    if (!bodyJson.success) {
      return reject(new Error('Upload failed - ' + bodyJson.error));
    }

    // Upload successfully
    resolve();
  });
});

const handle = (context) => {
  const defaultRcConfig = {
    endpoint: 'http://doccloud.int.thomsonreuters.com/api/v1/upload'
  };
  const rcConfig = require('rc')('pandora', defaultRcConfig);
  const config = context.config;
  const storage = context.storage;

  validateConfigAndDestination(config);
  createDocsJson(config, storage);
  copyBooks(config, storage);

  return zipFiles(config, storage)
  .then((zipFile) => {
    return upload(zipFile, rcConfig);
  });
};

module.exports = { install, check, handle };
