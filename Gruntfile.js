module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    eslint: {
      target: ['*.js', 'test/**/*.js']
    },
    mocha_istanbul: {
      coverage: {
        src: 'test/**/*.js',
        options: {
          print: 'detail'
        }
      }
    }
  });

  grunt.registerTask('lint', ['eslint']);
  grunt.registerTask('test', ['mocha_istanbul:coverage']);

  grunt.registerTask('default', ['lint', 'test']);
};
