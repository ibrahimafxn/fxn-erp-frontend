const fs = require('fs');

const chromeCandidates = [
  process.env.CHROME_BIN,
  '/snap/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome'
].filter(Boolean);

for (const candidate of chromeCandidates) {
  if (fs.existsSync(candidate)) {
    process.env.CHROME_BIN = candidate;
    break;
  }
}

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage')
    ],
    client: {
      jasmine: {},
      clearContext: false
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }]
    },
    reporters: ['progress', 'kjhtml'],
    port: Number(process.env.KARMA_PORT) || 9877,
    hostname: '127.0.0.1',
    listenAddress: '127.0.0.1',
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--headless', '--disable-gpu', '--disable-dev-shm-usage']
      }
    },
    browsers: ['ChromeHeadlessNoSandbox'],
    restartOnFileChange: false,
    singleRun: true
  });
};
