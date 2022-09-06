import L, { TileLayer } from 'leaflet';
import { t } from 'app/I18N';
import { getGoogleLayer } from 'app/Map/GoogleMapLayer';

const DEFAULT_MAPBOX_TOKEN =
  'pk.eyJ1Ijoibnd5dSIsImEiOiJjazlta3liaWowMHBkM2pwaHFiaG0wcDBqIn0.47wbPKb2A4u3iCt34qrSRw';

const mapBoxStyles: { [k: string]: string } = {
  Streets: 'mapbox/streets-v11',
  Satellite: 'mapbox/satellite-v9',
  Hybrid: 'mapbox/satellite-streets-v11',
};

const GoogleMapStyles: { [k: string]: 'roadmap' | 'satellite' | 'hybrid' } = {
  Streets: 'roadmap',
  Satellite: 'satellite',
  Hybrid: 'hybrid',
};

const getGoogleLayers: () => { [p: string]: TileLayer } = () =>
  Object.keys(GoogleMapStyles).reduce(
    (layers: { [k: string]: any }, styleId: string) => ({
      ...layers,
      [styleId]: getGoogleLayer(GoogleMapStyles[styleId]),
    }),
    {}
  );

const getMapboxLayers: (accessToken?: string) => { [p: string]: TileLayer } = accessToken => {
  const mapboxUrl =
    'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}';

  return Object.keys(mapBoxStyles).reduce((layers: { [k: string]: TileLayer }, styleId: string) => {
    const styleLabel = t('System', styleId, null, false);
    return {
      ...layers,
      [styleLabel]: L.tileLayer(mapboxUrl, {
        id: mapBoxStyles[styleId],
        tileSize: 512,
        zoomOffset: -1,
        accessToken: accessToken || DEFAULT_MAPBOX_TOKEN,
        zIndex: 0,
      }),
    };
  }, {});
};

const mapFunction: { [k: string]: (accessToken?: string) => { [p: string]: TileLayer } } = {
  google: getGoogleLayers,
  mapbox: getMapboxLayers,
};
const getMapProvider = (provider: string, mapApiKey?: string) => {
  const mapLayers = mapFunction[provider](mapApiKey);
  return { layers: Object.values(mapLayers), baseMaps: mapLayers };
};

export { getMapProvider };
