import { gql } from "@apollo/client";

export const PLACES_QUERY = gql`
  query PlacesQuery($bounds: BoundsInput!) {
    places(bounds: $bounds) {
      id
      latitude
      longitude
      description
      rating
      publicId
    }
  }
`;

export const ALL_PLACES_QUERY = gql`
  query PlacesQuery {
    allPlaces {
      id
      category
      description
      rating
      publicId
      imageCreationTime
    }
  }
`;

export const SIGNATURE_MUTATION = gql`
  mutation CreateSignatureMutation {
    createImageSignature {
      signature
      timestamp
    }
  }
`;

export const CREATE_PLACE_MUTATION = gql`
  mutation CreatePlaceMutation($input: PlaceInput!) {
    createPlace(input: $input) {
      id
    }
  }
`;

export const UPDATE_PLACE_MUTATION = gql`
  mutation UpdatePlaceMutation($id: String!, $input: PlaceInput!) {
    updatePlace(id: $id, input: $input) {
      id
      image
      imageCreationTime
      publicId
      latitude
      longitude
      description
      rating
      category
    }
  }
`;
