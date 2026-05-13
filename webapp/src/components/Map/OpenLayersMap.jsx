import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { geojson } from 'flatgeobuf'
import Feature from 'ol/Feature'
import Map from 'ol/Map'
import View from 'ol/View'
import CircleGeom from 'ol/geom/Circle'
import { fromCircle } from 'ol/geom/Polygon'
import GeoJSON from 'ol/format/GeoJSON'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import { bbox as bboxStrategy } from 'ol/loadingstrategy'
import { defaults as defaultControls } from 'ol/control'
import { transformExtent } from 'ol/proj'
import { transform } from 'ol/proj'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'
import {
  buildCircleFeature4326,
  loadFgbFeaturesInExtent,
  runWorkerAnalysis,
} from '../../services/analysis'
import {
  MIN_ZOOM_VECTOR,
  PILOT_EXTENT_4326,
  RADIUS_MAX_KM,
  RADIUS_MIN_KM,
  RADIUS_STEP_KM,
} from '../../constants'
import { pointInPilot3857 } from '../../utils/pilot'
import AnalysisWorker from '../../spatial.worker.js?worker'

function hexToRgba(hex, alpha) {
  const h = (hex || '#888').replace('#', '')
  const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r},${g},${b},${alpha})`
}

const OpenLayersMap = forwardRef(function OpenLayersMap(
  {
    coeffBySource,
    basemap,
    radiusKm,
    onRadiusChange,
    onAnalysis,
    onOutOfPilot,
    onFgbError,
  },
  ref,
) {
  const mapRef = useRef(null)
  const workerRef = useRef(null)
  const circleSourceRef = useRef(null)
  const unifiedLayerRef = useRef(null)
  const coeffRef = useRef(coeffBySource)
  const onFgbErrorRef = useRef(onFgbError)
  const mapDivRef = useRef(null)

  coeffRef.current = coeffBySource
  onFgbErrorRef.current = onFgbError

  const [center3857, setCenter3857] = useState(null)
  const [followPointer, setFollowPointer] = useState(false)
  const followPointerRef = useRef(followPointer)
  followPointerRef.current = followPointer
  const [placementHint, setPlacementHint] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    workerRef.current = new AnalysisWorker()
    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  useImperativeHandle(ref, () => ({
    // Public API for parent components (search bar / geolocation) to move the view.
    flyTo4326(lon, lat) {
      const map = mapRef.current
      if (!map) return
      const c = transform([lon, lat], 'EPSG:4326', 'EPSG:3857')
      const view = map.getView()
      view.animate({
        center: c,
        duration: 450,
        zoom: Math.max(view.getZoom(), 11),
      })
      setCenter3857(c)
      setPlacementHint(false)
    },
  }))

  const runAnalysis = useCallback(async () => {
    const url = import.meta.env.VITE_UNIFIED_FGB_URL
    if (!center3857 || !url || !coeffBySource) {
      onAnalysis?.(null)
      return
    }
    if (!pointInPilot3857(center3857)) {
      onOutOfPilot?.(true)
      onAnalysis?.(null)
      return
    }
    onOutOfPilot?.(false)

    // Query only features around the circle bbox; precise area intersection is done in worker.
    const radiusM = radiusKm * 1000
    const circle3857 = new CircleGeom(center3857, radiusM)
    let extent = circle3857.getExtent()
    const pad = Math.max((extent[2] - extent[0]) * 0.05, 100)
    extent = [extent[0] - pad, extent[1] - pad, extent[2] + pad, extent[3] + pad]

    setLoading(true)
    try {
      const raw = await loadFgbFeaturesInExtent(url, extent)
      const circle4326 = buildCircleFeature4326(center3857, radiusKm)
      const result = await runWorkerAnalysis(
        raw,
        circle4326,
        coeffBySource,
        workerRef.current,
      )
      onAnalysis?.({ ...result, radiusKm })
    } catch (e) {
      console.error(e)
      onFgbError?.(e)
      onAnalysis?.(null)
    } finally {
      setLoading(false)
    }
  }, [center3857, radiusKm, coeffBySource, onAnalysis, onOutOfPilot, onFgbError])

  useEffect(() => {
    const t = setTimeout(() => {
      void runAnalysis()
    }, 250)
    return () => clearTimeout(t)
  }, [runAnalysis])

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return

    const unifiedSource = new VectorSource({
      strategy: bboxStrategy,
      loader: async (extent, _res, projection) => {
        const map = mapRef.current
        const url = import.meta.env.VITE_UNIFIED_FGB_URL
        unifiedSource.clear()
        if (!map || !url) return
        // Keep low zoom lightweight by disabling polygon fetch until threshold.
        if (map.getView().getZoom() < MIN_ZOOM_VECTOR) return
        try {
          const format = new GeoJSON({
            dataProjection: 'EPSG:3857',
            featureProjection: projection,
          })
          const acc = []
          for await (const gj of geojson.deserialize(url, {
            minX: extent[0],
            minY: extent[1],
            maxX: extent[2],
            maxY: extent[3],
          })) {
            acc.push(format.readFeature(gj))
          }
          unifiedSource.addFeatures(acc)
        } catch (e) {
          console.error(e)
          onFgbErrorRef.current?.(e)
        }
      },
    })
    const circleSource = new VectorSource()
    circleSourceRef.current = circleSource

    const unifiedLayer = new VectorLayer({
      source: unifiedSource,
      style: (feature) => {
        const code = feature.get('code')
        const source = feature.get('source')
        const row = coeffRef.current?.[source]?.[String(code)]
        const fill = row?.couleur || '#AAAAAA'
        return new Style({
          fill: new Fill({ color: hexToRgba(fill, 0.35) }),
          stroke: new Stroke({ color: fill, width: 1 }),
        })
      },
      zIndex: 5,
    })
    unifiedLayerRef.current = unifiedLayer

    const circleLayer = new VectorLayer({
      source: circleSource,
      style: new Style({
        fill: new Fill({ color: 'rgba(66, 133, 244, 0.12)' }),
        stroke: new Stroke({ color: 'rgba(25, 118, 210, 0.9)', width: 2 }),
      }),
      zIndex: 10,
    })

    const osm = new TileLayer({ source: new OSM(), visible: basemap === 'osm' })
    const esri = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: '© Esri',
        maxZoom: 19,
      }),
      visible: basemap === 'esri',
    })
    const topo = new TileLayer({
      source: new XYZ({
        url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
        attributions: '© OpenStreetMap contributors, © OpenTopoMap',
        maxZoom: 17,
      }),
      visible: basemap === 'topo',
    })

    const view = new View({
      center: transform(
        [(PILOT_EXTENT_4326[0] + PILOT_EXTENT_4326[2]) / 2, (PILOT_EXTENT_4326[1] + PILOT_EXTENT_4326[3]) / 2],
        'EPSG:4326',
        'EPSG:3857',
      ),
      zoom: 9,
      minZoom: 6,
      maxZoom: 18,
      extent: transformExtent(PILOT_EXTENT_4326, 'EPSG:4326', 'EPSG:3857'),
    })

    const map = new Map({
      target: mapDivRef.current,
      layers: [osm, esri, topo, unifiedLayer, circleLayer],
      view,
      controls: defaultControls({ zoom: true, attribution: true }),
    })
    mapRef.current = map

    const updateCircleFeature = () => {
      circleSource.clear()
      if (!center3857) return
      const c = new CircleGeom(center3857, radiusKm * 1000)
      const poly = fromCircle(c, 96)
      circleSource.addFeature(new Feature(poly))
    }
    updateCircleFeature()

    map.on('singleclick', (evt) => {
      setCenter3857(evt.coordinate)
      setPlacementHint(false)
    })

    map.on('pointermove', (evt) => {
      if (followPointerRef.current && !evt.dragging) {
        setCenter3857(evt.coordinate)
      }
    })

    map.on('moveend', () => {
      const z = map.getView().getZoom()
      if (z >= MIN_ZOOM_VECTOR) unifiedSource.refresh()
    })

    return () => {
      map.setTarget(undefined)
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const layers = mapRef.current.getLayers().getArray()
    layers[0].setVisible(basemap === 'osm')
    layers[1].setVisible(basemap === 'esri')
    layers[2].setVisible(basemap === 'topo')
  }, [basemap])

  useEffect(() => {
    unifiedLayerRef.current?.changed()
  }, [coeffBySource])

  useEffect(() => {
    const circleSource = circleSourceRef.current
    if (!circleSource || !mapRef.current) return
    circleSource.clear()
    if (!center3857) return
    const c = new CircleGeom(center3857, radiusKm * 1000)
    circleSource.addFeature(new Feature(fromCircle(c, 96)))
  }, [center3857, radiusKm])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setCenter3857(null)
        setFollowPointer(false)
        return
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        onRadiusChange?.(Math.min(RADIUS_MAX_KM, radiusKm + RADIUS_STEP_KM))
      }
      if (e.key === '-') {
        e.preventDefault()
        onRadiusChange?.(Math.max(RADIUS_MIN_KM, radiusKm - RADIUS_STEP_KM))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [radiusKm, onRadiusChange])

  return (
    <div className="map-wrap">
      {placementHint && !center3857 && (
        <div className="map-hint">Cliquez sur la carte pour analyser un emplacement</div>
      )}
      {loading && <div className="map-loading">Analyse en cours…</div>}
      <div ref={mapDivRef} className="map-canvas" role="application" aria-label="Carte du pilote 31 et 09" />
      <div className="map-toolbar">
        <label className="map-toolbar-label">
          <input
            type="checkbox"
            checked={followPointer}
            onChange={(e) => setFollowPointer(e.target.checked)}
          />
          Suivre le curseur
        </label>
      </div>
    </div>
  )
})

export default OpenLayersMap
