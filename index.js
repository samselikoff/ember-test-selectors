'use strict';

/* eslint-env node */

const VersionChecker = require('ember-cli-version-checker');

module.exports = {
  name: 'ember-test-selectors',

  _assignOptions(app) {
    let ui = app.project.ui;

    let appOptions = app.options || {};
    let addonOptions = appOptions['ember-test-selectors'] || {};

    if (addonOptions.environments) {
      ui.writeDeprecateLine('The "environments" option in "ember-test-selectors" has been replaced ' +
        'with the "strip" option. Use e.g. "strip: EmberApp.env() === \'production\'" instead to ' +
        'recreate the old behavior.', false);

      this._stripTestSelectors = (addonOptions.environments.indexOf(app.env) !== -1);
    } else if ('strip' in addonOptions) {
      this._stripTestSelectors = addonOptions.strip;
    } else {
      this._stripTestSelectors = !app.tests;
    }
  },

  setupPreprocessorRegistry(type, registry) {
    if (type === 'parent') {
      this._assignOptions(registry.app);

      if (this._stripTestSelectors) {
        let StripTestSelectorsTransform = require('./strip-test-selectors');

        registry.add('htmlbars-ast-plugin', {
          name: 'strip-test-selectors',
          plugin: StripTestSelectorsTransform,
          baseDir() { return __dirname; }
        });
      } else {
        let TransformTestSelectorParamsToHashPairs = require('./transform-test-selector-params-to-hash-pairs');

        registry.add('htmlbars-ast-plugin', {
          name: 'transform-test-selector-params-to-hash-pairs',
          plugin: TransformTestSelectorParamsToHashPairs,
          baseDir() { return __dirname; }
        });
      }
    }
  },

  included(app) {
    this._super.included.apply(this, arguments);

    // add the StripDataTestPropertiesPlugin to the list of plugins used by
    // the `ember-cli-babel` addon
    if (this._stripTestSelectors && !this._registeredWithBabel) {
      let checker = new VersionChecker(this).for('ember-cli-babel', 'npm');

      app.options = app.options || {};
      app.options.babel = app.options.babel || {};
      app.options.babel.plugins = app.options.babel.plugins || [];

      if (checker.satisfies('^5.0.0')) {
        app.options.babel.plugins.push(require('./strip-data-test-properties-plugin'));
      } else if (checker.satisfies('^6.0.0-beta.1')) {
        app.options.babel.plugins.push(require('./strip-data-test-properties-plugin6'));
      } else {
        this.ui.writeWarnLine('ember-test-selectors: You are using an unsupported ember-cli-babel version. data-test ' +
          'properties are not automatically stripped from your JS code.');
      }

      this._registeredWithBabel = true;
    }

    if (!this._stripTestSelectors) {
      app.import('vendor/ember-test-selectors/patch-component.js');
    }
  },

  treeForAddon() {
    // remove our "addon" folder from the build if we're stripping test selectors
    if (!this._stripTestSelectors) {
      return this._super.treeForAddon.apply(this, arguments);
    }
  },

  preprocessTree(type, tree) {
    // remove the unit tests if we're testing ourself and are in strip mode.
    // we do this because these tests depend on the "addon" and "app" folders being available,
    // which is not the case if they are stripped out of the build.
    if (type === 'test' && this._stripTestSelectors && this.project.name() === 'ember-test-selectors') {
      tree = require('broccoli-stew').rm(tree, 'dummy/tests/unit/**/*.js');
    }
    return tree;
  },
};
