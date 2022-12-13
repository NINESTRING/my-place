import { useQuery } from "@apollo/client";
import Image from "next/image";
import { ALL_PLACES_QUERY } from "src/schema/schema";
import styled from "styled-components";

const Home = () => {
  const { data, error } = useQuery(ALL_PLACES_QUERY);

  console.log("data", data);
  return (
    <Main>
      {data?.allPlaces?.map(
        (item: {
          id: string;
          description: string;
          rating: number;
          publicId: string;
          imageCreationTime: string;
        }) => (
          <Card key={item.id}>
            <h2>{new Date(item.imageCreationTime).toDateString()}</h2>
            <p>{item.description}</p>
            <BackgroundImage src={item.publicId} width="400px" height="200px" />
            <ul>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
              <li></li>
            </ul>
            <button>{item.rating}</button>
          </Card>
        )
      )}

      {/* <pre>{JSON.stringify(data, null, 2)}</pre> */}
    </Main>
  );
};

const Main = styled.main`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem;
  color: white;
  background-color: #777;
`;

const Card = styled.section`
  width: 500px;
  height: 200px;
  position: relative;
  overflow: hidden;
  background-color: #fff;

  &:before {
    z-index: 1;
    content: "";
    position: absolute;
    top: -10px;
    left: 32px;
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 16px;
    background-color: #777;
  }

  &:after {
    z-index: 2;
    content: "";
    position: absolute;
    bottom: -10px;
    left: 32px;
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 16px;
    background-color: #777;
  }

  ul {
    z-index: 2;
    margin: 0;
    padding: 0;
    position: absolute;
    left: 39px;
    top: 5px;
    list-style-type: none;
    li {
      width: 4px;
      height: 4px;
      border-radius: 2px;
      margin: 6px 0;
      background-color: #777;
    }
  }

  h2 {
    position: absolute;
    top: 24px;
    left: 6px;
    /* font-size: 60px; */
    font-weight: 700;
    color: #fff;
    /* color: black; */
    z-index: 1;
    margin: 0;
    writing-mode: vertical-lr;
  }

  p {
    position: absolute;
    top: 20px;
    right: 40px;
    color: #333;
    opacity: 0.7;
    font-size: 12px;
    letter-spacing: 1px;
    writing-mode: vertical-rl;
    -webkit-transition: all 0.2s ease;
    transition: all 0.2s ease;
  }

  button {
    position: absolute;
    right: 14px;
    bottom: 14px;
    width: 30px;
    height: 30px;
    background-color: orange;
    border: none;
    border-radius: 30px;
    cursor: pointer;
    outline: none;
    transition: all 0.3s ease;
    mix-blend-mode: hard-light;

    i {
      font-size: 3rem;
    }
  }

  &:hover button {
    transform: scale(16.5);
  }

  &:hover p {
    color: #fff;
  }

  &:hover .pic {
    filter: grayscale(0);
  }
`;

const BackgroundImage = styled(Image)`
  position: absolute;
  inset: 0;
  object-fit: cover;
`;

export default Home;
