// Minimala deklarationer för Node-API:t som tools/*.mjs använder. Projektet
// har bara typescript som extra utvecklingsberoende (inget @types/node), så
// Node-modulerna deklareras som kortform-ambienta moduler: allt importerat från
// dem blir `any`, och typkontrollen gäller vår egen kod (npm run typecheck:lib).
declare module 'node:fs';
declare module 'node:path';
declare module 'node:url';
declare module 'node:child_process';
declare module 'node:vm';
declare module 'node:crypto';
declare module 'node:os';
declare module 'playwright';
declare const process: any;
declare const Buffer: any;
