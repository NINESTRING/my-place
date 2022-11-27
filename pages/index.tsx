import { useQuery } from "@apollo/client";
import Image from "next/image";
import { ALL_PLACES_QUERY } from "src/schema/schema";
import styled from "styled-components";

const Home = () => {
  const { data, error } = useQuery(ALL_PLACES_QUERY);

  return (
    <Main>
      <Hero>
        <h1>Let's explore some page transitions!</h1>
        <Image src={"/v1668691037/vfhjbnn7kpbd1lqkjydb.jpg"} layout="fill" />
      </Hero>

      <Container>
        {data?.allPlaces?.map(
          (item: {
            id: string;
            description: string;
            rating: number;
            publicId: string;
            imageCreationTime: string;
          }) => (
            <Wapper key={item.id}>
              <ImageWrapper>
                <Image src={item.publicId} layout="fill" />
                <h3>{new Date(item.imageCreationTime).toDateString()}</h3>
              </ImageWrapper>
              <p>{item.description}</p>
            </Wapper>
          )
        )}

        {/* <pre>{JSON.stringify(data, null, 2)}</pre> */}
      </Container>
    </Main>
  );
};

const Main = styled.main`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: white;
  background-color: #777;
`;

const Hero = styled.section`
  height: 50vh;
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #fff;
  background: #333;

  h1 {
    position: relative;
    z-index: 2;
  }

  img {
    position: absolute;
    inset: 0;
    height: 100%;
    width: 100%;
    object-fit: cover;
    filter: saturate(0.7) contrast(1.2) brightness(1.2);
    opacity: 0.7;
  }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const Wapper = styled.div`
  width: 300px;
  height: 400px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.25);
  background: #efefef;
  border-radius: 10px;
  color: black;
`;

const ImageWrapper = styled.section`
  width: 300px;
  height: 300px;
  border-radius: 10px;
  background: #efefef;
  position: relative;
  display: flex;
  justify-content: end;
  align-items: end;
  color: #fff;

  h3 {
    position: relative;
    margin: 0;
  }

  img {
    position: absolute;
    border-radius: 10px;
    inset: 0;
    object-fit: cover;
  }
`;

export default Home;
