// jest.setup.js
// ПРОМЕТЕЙ: Настройка окружения для Jest (глобальные моки).

// Мок для localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Мок для navigator.vibrate
Object.defineProperty(window.navigator, 'vibrate', {
  value: jest.fn(),
  writable: true,
});

// Мок для alert/confirm
global.alert = jest.fn();
global.confirm = jest.fn(() => true);

// Мок для requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
