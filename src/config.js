const snakeCase = require('lodash/snakeCase');
const mapKeys = require('lodash/mapKeys');
const isBoolean = require('lodash/isBoolean');
const pkg = require('../package.json');
const fs = require('fs');
const path = require('path');

const envValues = mapKeys(process.env, (val, key) => key.toLowerCase());
/**
 * Reads a configruation from npm_config style env variable in process.env
 * (Case insensitive) or defaults to config node in package json.
 * See https://docs.npmjs.com/cli/config
 *
 * @param {String} key
 * @return {*}
 */
const get = key => {
  const lookupNs = ['', `npm_config__${snakeCase(pkg.name)}_`, 'npm_package_config_'];
  const lookupKeys = lookupNs.map(it => `${it}${snakeCase(key)}`.toLowerCase());
  const values = lookupKeys.map(it => envValues[it]).concat([pkg.config[snakeCase(key)]]);
  const ix = values.findIndex(it => typeof it !== 'undefined');
  return values[ix];
};
const getBoolean = key => (isBoolean(get(key)) ? get(key) : get(key) === 'true');
const getInt = key => parseInt(get(key), 10);
const getFile = key => fs.readFileSync(get(key));

const validate = (...keys) => {
  const missing = keys.filter(key => get(key) === null || get(key) === 'null' || typeof get(key) === 'undefined');
  if (missing.length) throw Error(`Missing env configuration ${missing.map(it => it.toUpperCase()).join(', ')}`);
};
 

const checkConfig = () => {
  // validate(...Object.keys(require(path.resolve('./package.json')).config));
};

module.exports = { get, getBoolean, getInt, getFile, validate, checkConfig };
