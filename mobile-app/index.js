// Ensure global.console and global.ErrorUtils are always defined before any module loads
if (typeof global !== 'undefined') {
  if (!global.console) {
    global.console = {
      log: function () {},
      warn: function () {},
      error: function () {},
      info: function () {},
      debug: function () {},
      trace: function () {},
    };
  }
  if (!global.ErrorUtils) {
    var _globalHandler = null;
    global.ErrorUtils = {
      setGlobalHandler: function (handler) {
        _globalHandler = handler;
      },
      getGlobalHandler: function () {
        return _globalHandler;
      },
      reportError: function (error) {
        if (global.console && global.console.error) global.console.error(error);
      },
      reportFatalError: function (error) {
        if (global.console && global.console.error) global.console.error('FATAL:', error);
      },
      applyWithGuard: function (fun, context, args) {
        try {
          return fun.apply(context, args);
        } catch (e) {
          if (_globalHandler) _globalHandler(e, false);
        }
      },
      applyWithGuardIfNeeded: function (fun, context, args) {
        return fun.apply(context, args);
      },
    };
  }
}

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

