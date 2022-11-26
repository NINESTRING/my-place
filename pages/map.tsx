import { useQuery } from "@apollo/client";
import { Place } from "@prisma/client";
import "mapbox-gl/dist/mapbox-gl.css";
import Image from "next/image";
import { useState } from "react";
import ReactMapGL, { Marker, Popup, ViewStateChangeEvent } from "react-map-gl";
import { PLACES_QUERY } from "src/schema/schema";
import { useLastData } from "src/utils/useLastData";
import { useLocalState } from "src/utils/useLocalState";
import styled from "styled-components";
import { useDebounce } from "use-debounce";

type BoundsArray = [[number, number], [number, number]];

const parseBounds = (boundsString: string) => {
  const bounds = JSON.parse(boundsString) as BoundsArray;
  return {
    sw: {
      latitude: bounds[0][1],
      longitude: bounds[0][0],
    },
    ne: {
      latitude: bounds[1][1],
      longitude: bounds[1][0],
    },
  };
};

const Map = () => {
  const [selectedPlace, setSelectedPlace] = useState<
    (Place & { publicId: string }) | null
  >(null);

  const [dataBounds, setDataBounds] = useLocalState<string>(
    "bounds",
    "[[126,37],[128,38]]"
  );

  const [viewport, setViewport] = useLocalState<{
    latitude: number;
    longitude: number;
    zoom: number;
  }>("viewport", {
    latitude: 37.65874,
    longitude: 126.97759,
    zoom: 10,
  });

  const [debouncedDataBounds] = useDebounce(dataBounds, 1000);

  const { data, error } = useQuery(PLACES_QUERY, {
    variables: { bounds: parseBounds(debouncedDataBounds) },
  });

  const lastData = useLastData(data);

  const onVieportChange = (e: ViewStateChangeEvent) => {
    setDataBounds(JSON.stringify(e.target.getBounds().toArray()));

    const center = e.target.getCenter();

    setViewport({
      latitude: center.lat,
      longitude: center.lng,
      zoom: e.target.getZoom(),
    });
  };

  return (
    <Main>
      <MapContainer>
        <ReactMapGL
          initialViewState={viewport}
          onMoveEnd={onVieportChange}
          mapStyle="mapbox://styles/mapbox/streets-v9"
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_TOKEN}
        >
          {lastData &&
            lastData.places.map((place: Place & { publicId: string }) => (
              <Marker
                key={place.id}
                latitude={place.latitude}
                longitude={place.longitude}
                color="red"
                onClick={() => setSelectedPlace(place)}
              ></Marker>
            ))}
          {selectedPlace && (
            <Popup
              latitude={selectedPlace.latitude}
              longitude={selectedPlace.longitude}
              onClose={() => setSelectedPlace(null)}
              closeOnClick={false}
            >
              <div>
                <h3>{selectedPlace.description}</h3>
                <Image
                  src={"/v1668691037/vfhjbnn7kpbd1lqkjydb.jpg"}
                  width={300}
                  height={300}
                  objectFit="cover"
                />
              </div>
            </Popup>
          )}
        </ReactMapGL>
      </MapContainer>
    </Main>
  );
};

const Main = styled.main`
  display: flex;
  height: 93vh;
  margin-top: 7vh;
`;

const MapContainer = styled.div`
  width: 100%;

  .map-container {
    width: 100%;
    height: 100%;
  }
`;

export default Map;
