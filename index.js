let fs = require('fs');

const install = PluginTypes => PluginTypes.PUBLISHER;

const check = (context) => {
  return context.task === 'publish';
};

const validateConfigAndDestination = (config) => new Promise((resolve, reject) => {
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
    let bookName = book.name.toLowerCase();
    let dest = path.join(book.outdir, book.name);

    // Check that name is not duplicated
    if (bookNames.indexOf(bookName) > -1) {
      throw new Error('Book\'s name cannot be duplicated.');
    }
    bookNames.push(bookName);

    // Check that compiled book exists
    if (!fs.existsSync(dest)) {
      throw new Error('Cannot find compiled book at ' + dest + '.');
    }
  }

  resolve();
});

const parseConfig = (config) => {
  // Actually, we just save all configuration from pandora core into docs.json.
  // However, if book's title is not available we will use book's name as book's title.
  let books = config.books;
  for (let i = 0; i < books.length; i++) {
    let book = books[i];
    book.title = book.title || book.name;
  }

  return config;
};

const createDocsJson = (context) => new Promise((resolve, reject) => {
  const path = require('path');
  const config = context.config;
  const storage = context.storage;

  let docsJson = parseConfig(config);
  let docsString = JSON.stringify(docsJson, null, 2);
  let docsJsonPath = path.join(storage, 'docs.json');

  fs.writeFileSync(docsJsonPath, docsString);

  resolve();
});

const zipBook = (book, zip, progress) => new Promise((resolve, reject) => {
  const path = require('path');
  const glob = require('glob');

  let dest = path.join(book.outdir, book.name);
  const globOptions = {
    nodir: true,
    cwd: dest
  };

  glob('**/*', globOptions, (err, files) => {
    if (err) {
      return reject(err);
    }

    Promise.all(files.map((filename, index) => {
      return new Promise((resolve, reject) => {
        fs.readFile(path.join(dest, filename), (err, data) => {
          if (err) {
            return reject(err);
          }

          // path.join() use '\' while JSZIP use '/'
          let fileDest = 'books/' + book.name + '/' + filename;
          zip.file(fileDest, data, { binary: true });
          resolve();
        });
      });
    }))

    .then(() => {
      progress.tick();
      resolve();
    });
  });
});

const createZipFile = (context) => new Promise((resolve, reject) => {
  const path = require('path');
  const JSZip = require('jszip');
  const zip = new JSZip();
  const config = context.config;
  const progress = context.progress;
  const storage = context.storage;
  let books = config.books;

  // Add docs.json
  let data = fs.readFileSync(path.join(storage, 'docs.json'));
  zip.file('docs.json', data, { binary: true });

  // Create zip file will use 50% of progress bar
  progress.expandTo(books.length * 2);

  // Add books
  let promise = Promise.all(books.map((book) => {
    return zipBook(book, zip, progress);
  }))

  .then(() => {
    return zip.generateAsync({ type: 'nodebuffer' });
  })

  .then((content) => {
    let zipName = config.name + '_' + config.version + '.zip';
    let zipPath = path.join(storage, zipName);
    fs.writeFileSync(zipPath, content);

    return zipPath;
  });

  resolve(promise);
});

const upload = (zipFile, rcConfig, context) => new Promise((resolve, reject) => {
  const progress = context.progress;
  const request = require('request');
  const url = rcConfig.endpoint + '/api/v1/upload';
  const options = {
    url: url,
    formData: {
      'doc-package': fs.createReadStream(zipFile)
    },
    timeout: 120000
  };

  // Handle progress bar
  const fileSize = fs.statSync(zipFile).size;
  const booksLength = context.config.books.length;

  // We need 10 steps or more for upload.
  // So, do not expand if the existing steps (i.e. booksLength) is >= 10
  let numberOfStep = booksLength;
  if (booksLength < 10) {
    numberOfStep = 10;
    progress.expandBy(10 - booksLength);
  }

  const stepSize = fileSize / numberOfStep;
  let nextUpdateSize = stepSize;

  let req = request.post(options, (error, response, body) => {
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
      const message = 'Upload failed - Response from pandora-cloud is not in the expected JSON format.\n'
                      + 'Response\'s body: \n\n'
                      + body;
      return reject(new Error(message));
    }

    // Handle error returned from pandora-cloud
    if (!bodyJson.success) {
      return reject(new Error('Upload failed - ' + bodyJson.error));
    }

    // Upload successfully
    progress.fill();
    resolve();
  })
  .on('drain', () => {
    let uploadedSize = req.req.connection.bytesWritten;

    // The last tick will be done when we get a response from server
    if (uploadedSize > nextUpdateSize && uploadedSize < fileSize) {
      nextUpdateSize += stepSize;
      progress.tick();
    }
  });
});

const handle = (context) => new Promise((resolve, reject) => {
  const defaultRcConfig = {
    endpoint: 'http://api.doccloud.int.thomsonreuters.com'
  };
  const rcConfig = require('rc')('pandora', defaultRcConfig);

  let promise = validateConfigAndDestination(context.config)
  .then(() => {
    return createDocsJson(context);
  })
  .then(() => {
    return createZipFile(context);
  })
  .then((zipFile) => {
    return upload(zipFile, rcConfig, context);
  });

  resolve(promise);
});

module.exports = { install, check, handle, validateConfigAndDestination, parseConfig };
