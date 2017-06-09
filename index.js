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

  // Verify that compiled books exist
  let books = config.books;
  if (Array.isArray(books)) {
    for (let i = 0; i < books.length; i++) {
      let book = books[i];
      let dest = path.join(book.outdir, book.name);

      if (!fs.existsSync(dest)) {
        throw new Error('Cannot find compiled book at ' + dest + '.');
      }
    }
  }
};

const createTempFolder = () => {
  const fs = require('fs-extra');
  const tempFolder = './.pandora-publish';

  if (fs.existsSync(tempFolder)) {
    fs.removeSync(tempFolder);
  }

  fs.mkdirSync(tempFolder);

  return tempFolder;
};

const parseConfig = (config) => {
  let docsJson = {
    name: config.name,
    version: config.version,
    books: []
  };

  let books = config.books;
  if (Array.isArray(books) && books.length > 0) {
    for (let i = 0; i < books.length; i++) {
      let book = books[i];
      docsJson.books.push({
        name: book.name,
        type: book.type
      });
    }
  }

  return docsJson;
};

const createDocsJson = (config, tempFolder) => new Promise((resolve, reject) => {
  const fs = require('fs');
  const path = require('path');

  let docsJson = parseConfig(config);
  let docsString = JSON.stringify(docsJson, null, 2);
  let docsJsonPath = path.join(tempFolder, 'docs.json');

  fs.writeFile(docsJsonPath, docsString, err => {
    if (err) {
      throw err;
    }
    else {
      resolve();
    }
  });
});

const handle = (context) => {
  var config = context.config;

  validateConfigAndDestination(config);
  let tempFolder = createTempFolder();

  return createDocsJson(config, tempFolder);
};

module.exports = { install, check, handle };
