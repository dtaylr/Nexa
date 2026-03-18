module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/step-definitions/**/*.ts'],
    requireModule: ['tsx/cjs'],
    format: [
      'progress-bar',
      'json:artifacts/cucumber-report.json',
      'html:artifacts/cucumber-report.html',
    ],
    formatOptions: { snippetInterface: 'async-await' },
    parallel: 1,
    worldParameters: {},
  },
};
