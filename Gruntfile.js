module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    eslint: {
      target: ['*.js']
    }
  });

  grunt.registerTask('lint', ['eslint']);
  grunt.registerTask('default', ['lint']);
};
