import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Your token
mapboxgl.accessToken = 'pk.eyJ1IjoiYWtzaGF0bXVuZGUiLCJhIjoiY212YzgxeDc3MDhxeDQ4cXh0dzc0bndsaSJ9.ZkhiGy9RXEenq-m9JcEwAg';

export default function Map3D() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-74.006, 40.7128], // New York City
      zoom: 15.5,
      pitch: 60,
    });

    map.current.on('load', () => {
      // Add 3D buildings
      map.current.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': '#475569',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.8
        }
      });
    });
  }, []);

  // Removed negative zIndex so it stays visible!
  return (
    <div 
      ref={mapContainer} 
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} 
    />
  );
}