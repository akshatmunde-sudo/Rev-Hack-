import { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN

const DEFAULT_HEIGHT = 6 // metres, assumed when a building has no height data
const HIDDEN = Cesium.Color.WHITE.withAlpha(0.01)
const VISIBLE = Cesium.Color.fromCssColorString('#cbd5e1').withAlpha(0.9)

function makeStyle(show) {
  return new Cesium.Cesium3DTileStyle({
    color: show ? "color('#cbd5e1', 0.9)" : "color('white', 0.01)",
  })
}

export default function CesiumMap({ onSelect, showBuildings, target }) {
  const containerRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const osmRef = useRef(null)
  const viewerRef = useRef(null)
  const searchPinRef = useRef(null)
  const showRef = useRef(showBuildings)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // Toggle the visibility of the clickable building layer
  useEffect(() => {
    showRef.current = showBuildings
    if (osmRef.current) osmRef.current.style = makeStyle(showBuildings)
  }, [showBuildings])

  // Fly to a searched place
  useEffect(() => {
    const viewer = viewerRef.current
    if (!target || !viewer || viewer.isDestroyed()) return

    if (searchPinRef.current) {
      viewer.entities.remove(searchPinRef.current)
      searchPinRef.current = null
    }

    const center = Cesium.Cartesian3.fromDegrees(target.lng, target.lat, 0)

    searchPinRef.current = viewer.entities.add({
      position: center,
      point: {
        pixelSize: 12,
        color: Cesium.Color.DODGERBLUE,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: target.label || '',
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -22),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    const radius = Math.max(150, Math.min(target.radius || 400, 25000))
    viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, radius), {
      offset: new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-40),
        radius * 2.5
      ),
      duration: 3,
    })
  }, [target])

  useEffect(() => {
    let viewer
    let handler
    let selected = null
    let marker = null
    let cancelled = false

    async function init() {
      viewer = new Cesium.Viewer(containerRef.current, {
        baseLayerPicker: false,
        geocoder: false, // we use our own search bar
        timeline: false,
        animation: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: false,
      })
      viewerRef.current = viewer
      viewer.scene.globe.depthTestAgainstTerrain = true
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 10

      // Photorealistic Google 3D Tiles (visuals). Lower error = sharper.
      try {
        const google = await Cesium.Cesium3DTileset.fromIonAssetId(2275207)
        if (cancelled) return
        google.maximumScreenSpaceError = 8
        viewer.scene.primitives.add(google)
      } catch (e) {
        console.error('Google 3D tiles failed to load:', e)
      }

      // OSM buildings: used for height + clicking
      let osm = null
      try {
        osm = await Cesium.createOsmBuildingsAsync()
        if (cancelled) return
        osm.maximumScreenSpaceError = 6 // loads small buildings from further away
        osm.style = makeStyle(showRef.current)
        viewer.scene.primitives.add(osm)
        osmRef.current = osm
      } catch (e) {
        console.error('OSM buildings failed to load:', e)
      }

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-74.0134, 40.7035, 700),
        orientation: {
          heading: Cesium.Math.toRadians(20),
          pitch: Cesium.Math.toRadians(-35),
        },
        duration: 2,
      })

      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
      handler.setInputAction((click) => {
        // clear previous highlight and marker
        if (selected) {
          selected.color = showRef.current ? VISIBLE : HIDDEN
          selected = null
        }
        if (marker) {
          viewer.entities.remove(marker)
          marker = null
        }

        const pos = viewer.scene.pickPosition(click.position)
        if (!Cesium.defined(pos)) {
          onSelectRef.current?.(null)
          return
        }
        const carto = Cesium.Cartographic.fromCartesian(pos)
        const lat = Cesium.Math.toDegrees(carto.latitude)
        const lng = Cesium.Math.toDegrees(carto.longitude)

        const picks = viewer.scene.drillPick(click.position)
        const feature = picks.find(
          (p) => p instanceof Cesium.Cesium3DTileFeature && p.primitive === osm
        )

        if (feature) {
          feature.color = Cesium.Color.RED.withAlpha(0.7)
          selected = feature

          let height = Number(
            feature.getProperty('cesium#estimatedHeight') ??
              feature.getProperty('height') ??
              0
          )
          const estimated = !height || height <= 0
          if (estimated) height = DEFAULT_HEIGHT

          onSelectRef.current?.({
            height,
            lat,
            lng,
            estimated,
            name: feature.getProperty('name') ?? null,
          })
        } else {
          marker = viewer.entities.add({
            position: pos,
            point: {
              pixelSize: 14,
              color: Cesium.Color.RED,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })

          onSelectRef.current?.({
            height: DEFAULT_HEIGHT,
            lat,
            lng,
            estimated: true,
            name: 'Unmapped structure',
          })
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    }

    init()

    return () => {
      cancelled = true
      osmRef.current = null
      viewerRef.current = null
      searchPinRef.current = null
      handler?.destroy()
      if (viewer && !viewer.isDestroyed()) viewer.destroy()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    />
  )
}