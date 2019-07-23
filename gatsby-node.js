const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const { getNestedValue } = require('./src/utils/get-nested-value');
const { findAllKeyValuePairs } = require('./src/utils/find-all-key-value-pairs');
const { findKeyValuePair } = require('./src/utils/find-key-value-pair');

// Atlas DB config
const DB = 'snooty';
const DOCUMENTS_COLLECTION = 'documents';
const ASSETS_COLLECTION = 'assets';

// test data properties
// const USE_TEST_DATA = process.env.USE_TEST_DATA;
const USE_TEST_DATA = true;
const TEST_DATA_PATH = 'tests/unit/data/site';
const LATEST_TEST_DATA_FILE = '__testDataLatest.json';

// different types of references
const PAGES = [];
const INCLUDE_FILES = {};
const PAGE_TITLE_MAP = {};

// in-memory object with key/value = filename/document
let RESOLVED_REF_DOC_MAPPING = {};

// env variables for building site along with use in front-end
// https://www.gatsbyjs.org/docs/environment-variables/#defining-environment-variables
const validateEnvVariables = () => {
  // make sure necessary env vars exist
  if (!process.env.GATSBY_SITE || !process.env.PARSER_USER || !process.env.PARSER_BRANCH) {
    return {
      error: true,
      message: `${process.env.NODE_ENV} requires the variables GATSBY_SITE, PARSER_USER, and PARSER_BRANCH`,
    };
  }
  // create split prefix for use in stitch function
  return {
    error: false,
  };
};

exports.sourceNodes = async () => {
  // setup env variables
  const envResults = validateEnvVariables();

  if (envResults.error) {
    throw Error(envResults.message);
  }

  // get data from test file
  try {
    const fullpath = path.join(TEST_DATA_PATH, LATEST_TEST_DATA_FILE);
    const fileContent = fs.readFileSync(fullpath, 'utf8');
    RESOLVED_REF_DOC_MAPPING = JSON.parse(fileContent);
  } catch (e) {
    throw Error(`ERROR with test data file: ${e}`);
  }

  // Identify page documents and parse each document for images
  let assets = {};
  Object.entries(RESOLVED_REF_DOC_MAPPING).forEach(([key, val]) => {
    const pageNode = getNestedValue(['ast', 'children'], val);
    if (key.includes('includes/')) {
      INCLUDE_FILES[key] = val;
    } else if (!key.includes('curl') && !key.includes('https://')) {
      PAGES.push(key);
      PAGE_TITLE_MAP[key] = {
        title: getNestedValue(['ast', 'children', 0, 'children', 0, 'children', 0, 'value'], val),
        category: getNestedValue(
          ['argument', 0, 'value'],
          findKeyValuePair(getNestedValue(['ast', 'children'], val), 'name', 'category')
        ),
        completionTime: getNestedValue(
          ['argument', 0, 'value'],
          findKeyValuePair(getNestedValue(['ast', 'children'], val), 'name', 'time')
        ),
        languages: findKeyValuePair(getNestedValue(['ast', 'children'], val), 'name', 'languages'),
      };
    }
  });
};

exports.createPages = ({ actions }) => {
  const { createPage } = actions;

  return new Promise((resolve, reject) => {
    PAGES.forEach(page => {
      let template = 'document';
      if (process.env.GATSBY_SITE === 'guides') {
        template = page === 'index' ? 'guides-index' : 'guide';
      }
      const pageUrl = page === 'index' ? '/' : page;
      if (RESOLVED_REF_DOC_MAPPING[page] && Object.keys(RESOLVED_REF_DOC_MAPPING[page]).length > 0) {
        createPage({
          path: pageUrl,
          component: path.resolve(`./src/templates/${template}.js`),
          context: {
            __refDocMapping: RESOLVED_REF_DOC_MAPPING[page],
            includes: INCLUDE_FILES,
            pageMetadata: PAGE_TITLE_MAP,
          },
        });
      }
    });
    resolve();
  });
};
