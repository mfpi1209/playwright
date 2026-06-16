const base = require('@playwright/test');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

function mergeLaunchOptions(testInfo) {
  const cfgUse = (testInfo.config && testInfo.config.use) || {};
  const prjUse = (testInfo.project && testInfo.project.use) || {};

  const cfgLaunch = cfgUse.launchOptions || {};
  const prjLaunch = prjUse.launchOptions || {};

  const cfgArgs = Array.isArray(cfgLaunch.args) ? cfgLaunch.args : [];
  const prjArgs = Array.isArray(prjLaunch.args) ? prjLaunch.args : [];

  const headless = typeof prjUse.headless === 'boolean'
    ? prjUse.headless
    : (typeof cfgUse.headless === 'boolean' ? cfgUse.headless : false);

  const slowMo = (typeof prjLaunch.slowMo === 'number')
    ? prjLaunch.slowMo
    : (typeof cfgLaunch.slowMo === 'number'
      ? cfgLaunch.slowMo
      : (typeof prjUse.slowMo === 'number'
        ? prjUse.slowMo
        : (typeof cfgUse.slowMo === 'number' ? cfgUse.slowMo : undefined)));

  const merged = {
    ...cfgLaunch,
    ...prjLaunch,
    args: Array.from(new Set([...cfgArgs, ...prjArgs])),
    headless,
  };
  if (typeof slowMo === 'number') {
    merged.slowMo = slowMo;
  }

  return merged;
}

const test = base.test.extend({
  browser: [async ({}, use, testInfo) => {
    const launchOpts = mergeLaunchOptions(testInfo);
    const browser = await chromium.launch(launchOpts);
    await use(browser);
    await browser.close();
  }, { scope: 'worker' }],
});

module.exports = {
  test,
  expect: base.expect,
};
