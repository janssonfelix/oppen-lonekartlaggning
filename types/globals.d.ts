// Deklarationer för de inlinade tredjepartsbiblioteken (vendor/) som appen når
// som globaler i dist/app.js. Avsiktligt minimala: biblioteken typas som `any`
// så att typkontrollen (npm run typecheck) gäller vår egen kod, inte deras API.
declare const d3: any;
declare const XLSX: any;
declare const Papa: any;
declare const JSZip: any;

// Appens egna fält på DOM-element ("expando"): tabellrader bär sitt dataunderlag (för export och
// länkade vyer), diagrambehållare sin figur. Deklareras här så att typkontrollen vet att de finns
// — och fångar en felstavning av dem.
interface Element {
    _markering?: any;
    _sortInit?: boolean;
    _collapseInit?: boolean;
    _exportToolsInit?: boolean;
    _figur?: any;
    _figurVal?: any;
    _rfZoom?: any;
    _gd?: any;
    _lastSimResult?: any;
    _rapportRow?: any;
    _paygapRow?: any;
    _euRow?: any;
    _prioItem?: any;
    _exportBeskrivning?: string;
}
interface Window {
    __LV_DEBUG__?: boolean;
}
