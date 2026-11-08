import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// Android back button closes the top-most overlay, otherwise exits the app
const stack = [];
if (Capacitor.isNativePlatform()) {
  App.addListener('backButton', () => {
    const f = stack[stack.length - 1];
    if (f) f();
    else App.exitApp();
  });
}

export function useBack(fn) {
  useEffect(() => {
    const h = () => fn();
    stack.push(h);
    return () => {
      const i = stack.indexOf(h);
      if (i >= 0) stack.splice(i, 1);
    };
    // eslint-disable-next-line
  }, []);
}
