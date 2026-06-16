const base = require('@playwright/test');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const test = base.test.extend({
  browser: [async ({}, use, testInfo) => {
    const launchOpts = (testInfo.project.use && testInfo.project.use.launchOptions) || {};
    const headless = testInfo.project.use && typeof testInfo.project.use.headless === 'boolean'
      ? testInfo.project.use.headless
      : false;

    const browser = await chromium.launch({
      headless,
      ...launchOpts,
    });

    await use(browser);
    await browser.close();
  }, { scope: 'worker' }],
});

module.exports = {
  test,
  expect: base.expect,
};
