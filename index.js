const install = PluginTypes => PluginTypes.PUBLISHER;

const check = (context) => {
  return context.task === 'publish';
};

const handle = (context) => new Promise((resolve, reject) => {

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

module.exports = { install, check, handle };