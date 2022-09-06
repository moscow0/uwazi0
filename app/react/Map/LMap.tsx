import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { GeolocationSchema } from 'shared/types/commonTypes';
import uniqueID from 'shared/uniqueID';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  DataMarker,
  getClusterMarker,
  MarkerInput,
  parseMarkerPoint,
  TemplatesInfo,
  checkMapInitialization,
  preventDefaultEvent,
} from './MapHelper';
import { getMapProvider } from './TilesProviderFactory';

type LMapProps = {
  markers: MarkerInput[];
  height: number;
  clickOnMarker?: (marker: DataMarker) => {};
  clickOnCluster?: (cluster: DataMarker[]) => {};
  onClick?: (event: {}) => {};
  showControls?: boolean;
  startingPoint: GeolocationSchema;
  renderPopupInfo?: boolean;
  templatesInfo: TemplatesInfo;
  tilesProvider: string;
  mapApiKey: string;
};

const LMap = ({ markers: pointMarkers = [], showControls = true, ...props }: LMapProps) => {
  let map: L.Map;
  let markerGroup: L.MarkerClusterGroup;
  const [currentMarkers, setCurrentMarkers] = useState<MarkerInput[]>();
  const [currentTilesProvider, setCurrentTilesProvider] = useState(props.tilesProvider);
  const containerId = uniqueID();

  const clickHandler = (markerPoint: any) => {
    if (!props.onClick) return;
    markerGroup.clearLayers();
    getClusterMarker({ ...markerPoint, properties: {} }).addTo(markerGroup);
    const event = { lngLat: [markerPoint.latlng.lng, markerPoint.latlng.lat] };
    props.onClick(event);
  };

  const initMarkers = () => {
    const markers = pointMarkers.map(pointMarker =>
      parseMarkerPoint(pointMarker, props.templatesInfo, props.renderPopupInfo)
    );

    markers.forEach(m => getClusterMarker(m).addTo(markerGroup));
    markerGroup.on('clusterclick', cluster => {
      props.clickOnCluster?.(cluster.layer.getAllChildMarkers());
      preventDefaultEvent(cluster);
    });
    markerGroup.on('click', marker => {
      props.clickOnMarker?.(marker.layer);
    });
    if (pointMarkers.length) {
      map.fitBounds(markerGroup.getBounds(), { maxZoom: 6 });
    }
    markerGroup.addTo(map);
  };

  const initMap = () => {
    const { layers, baseMaps } = getMapProvider(props.tilesProvider, props.mapApiKey);
    const shouldScroll: boolean = props.renderPopupInfo || props.onClick !== undefined;
    map = L.map(containerId, {
      center: [props.startingPoint[0].lat, props.startingPoint[0].lon],
      zoom: 6,
      maxZoom: 20,
      minZoom: 2,
      zoomControl: false,
      preferCanvas: true,
      scrollWheelZoom: shouldScroll,
    });

    map.getPanes().mapPane.style.zIndex = '0';
    markerGroup = L.markerClusterGroup();

    if (showControls) {
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.control.layers(baseMaps, {}, { position: 'bottomright', autoZIndex: false }).addTo(map);
    }
    layers[0].options.zIndex = 0;
    layers[0].addTo(map);
    initMarkers();
    map.on('click', clickHandler);
  };

  useEffect(() => {
    const reRender = currentTilesProvider !== props.tilesProvider || !props.onClick;

    if (reRender || currentMarkers === undefined) {
      setCurrentMarkers(pointMarkers);
      setCurrentTilesProvider(props.tilesProvider);
      checkMapInitialization(map, containerId);
      initMap();
    }
    return () => {
      if (map && reRender) {
        map.remove();
      }
    };
  }, [pointMarkers, props.tilesProvider, props.mapApiKey]);

  return (
    <div className="map-container" data-testid="map-container">
      <div
        id={containerId}
        className="leafletmap"
        style={{ width: '100%', height: props.height }}
      />
    </div>
  );
};

export { LMap };
