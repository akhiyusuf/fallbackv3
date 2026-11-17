// Stand-in for the system date and time picker in tests. It renders a host element a test can
// find by testID and answer:  fireEvent(picker, 'change', { type: 'set' }, new Date(2026, 6, 26))
const React = require('react');
const { View } = require('react-native');

function DateTimePicker(props) {
  return React.createElement(View, props);
}
module.exports = { __esModule: true, default: DateTimePicker, DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() } };
