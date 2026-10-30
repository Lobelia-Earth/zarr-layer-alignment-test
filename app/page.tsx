"use client";

import { Map, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { ZarrLayer } from "@carbonplan/zarr-layer";

setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());

const styleDataIntervalMs = 10;
const styleDataTimeoutMs = 1000 * 60 * 60;

const promiseStyle = (
  map: Map,
  signal: AbortSignal,
) => {
  if (signal.aborted) return false;

  if (map.isStyleLoaded()) {
    return map.style !== null;
  }

  const { promise, resolve } = Promise.withResolvers<boolean>();

  const cleanUpAndResolve = () => {
    cleanUp();
    resolve(map.style !== null);
  };

  const onStyleData = () => {
    if (map.isStyleLoaded()) {
      cleanUpAndResolve();
    }
  };

  const cleanUp = () => {
    clearInterval(interval);
    clearTimeout(timeout);
    map.off("styledata", onStyleData);
    signal.removeEventListener("abort", onAbort);
  };

  const onAbort = () => {
    cleanUp();
    resolve(false);
  };

  map.on("styledata", onStyleData);
  signal.addEventListener("abort", onAbort, { once: true });

  const interval = setInterval(() => {
    if (map.isStyleLoaded()) {
      cleanUpAndResolve();
    }
  }, styleDataIntervalMs);

  const timeout = setTimeout(() => {
    if (map.isStyleLoaded()) {
      cleanUpAndResolve();
    } else {
      cleanUp();
      resolve(false);
    }
  }, styleDataTimeoutMs);

  return promise;
};


const debugSource = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "row": "topmost"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [
                            11.7,
                            72.5
                        ],
                        [
                            11.8,
                            72.5
                        ],
                        [
                            11.8,
                            72.6
                        ],
                        [
                            11.7,
                            72.6
                        ],
                        [
                            11.7,
                            72.5
                        ]
                    ]
                ]
            }
        },
        {
            "type": "Feature",
            "properties": {
                "row": "central"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [
                            9.6,
                            46.7
                        ],
                        [
                            9.7,
                            46.7
                        ],
                        [
                            9.7,
                            46.8
                        ],
                        [
                            9.6,
                            46.8
                        ],
                        [
                            9.6,
                            46.7
                        ]
                    ]
                ]
            }
        }
    ]
};

const cordexPixelDebugLayer = {
  id: "debug-layer",
  source: "debug-source",
  type: "line",
  paint: {
    "line-color": "#ff00ff",
    "line-width": 1,
  },
};

export default function Home() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new Map({
      container: containerRef.current,
      style: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
      center: [9.64, 46.75],
      zoom: 11.5,
    });

    // @ts-expect-error Expose to window for debugging purposes
    window.map = map;

    const abortController = new AbortController();

    const addLayers = async () => {
      const styleLoaded = await promiseStyle(map, abortController.signal);
      console.log("Style loaded:", styleLoaded);

      map.setProjection({
        type: 'mercator'
      });

      if (styleLoaded && !abortController.signal.aborted) {
        console.log("Adding Zarr layer");
        map.addLayer(new ZarrLayer({
          id: "test-layer",
          source: "https://s3.waw3-1.cloudferro.com/lobelia-public-arco/dg-clima-prototype/v1.0/cordex-eur/txx_rp50/wlChunked.zarr",
          variable: "txx_rp50",
          clim: [0, 50],
          colormap: [
            "#000000",
            "#ffffff"
          ],
          crs: "EPSG:4326",
          zarrVersion: 2,
          fillValue: Number.NaN,
          selector: {
            warming_level: 2,
            quantile: 0.5
          },
          opacity: 0.5
        }));

        map.addSource("debug-source", {
          type: "geojson",
          data: debugSource
        });
        map.addLayer(cordexPixelDebugLayer);

      }
    };

    void addLayers();

    return () => {
      abortController.abort();
      map.remove();
    };
  }, []);


  return (
    <main>
      <div className='w-full h-dvh' ref={containerRef}></div>
    </main>
  );
}
