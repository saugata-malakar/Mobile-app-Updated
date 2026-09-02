// Ensure global.console is always defined before any module loads
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
}

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

