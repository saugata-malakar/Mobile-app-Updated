/**
 * @format
 */

import 'react-native';
import React from 'react';
import {it} from '@jest/globals';
import renderer from 'react-test-renderer';

jest.mock('../src/navigation/RootNavigator', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return function MockNav() {
    return React.createElement(Text, null, 'HealthScreen');
  };
});

import App from '../App';

it('renders correctly', () => {
  renderer.create(<App />);
});
