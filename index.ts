// Polyfills required for SheetJS (xlsx) in React Native / Expo.
// These MUST be the very first imports — before expo, react, or any library.
// SheetJS references `process` and `Buffer` at module load time; if they're
// not globally available by then, xlsx silently becomes an empty object and
// all XLSX.read() / XLSX.utils calls fail at runtime with no useful error.
import 'process/browser';
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') { global.Buffer = Buffer; }
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
