import { useState } from "react";
import styled from "styled-components";

const StarRating: React.FC<{
  onChange: (...event: any[]) => void;
}> = ({ onChange }) => {
  const [rating, setRating] = useState<number>(3);

  return (
    <MainComponent>
      <svg
        viewBox="0 0 24 24"
        className={rating >= 1 ? "star" : ""}
        onClick={() => {
          setRating(1);
          onChange(1);
        }}
      >
        <polygon points="9.9, 1.1, 3.3, 21.78, 19.8, 8.58, 0, 8.58, 16.5, 21.78" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className={rating >= 2 ? "star" : ""}
        onClick={() => {
          setRating(2);
          onChange(2);
        }}
      >
        <polygon points="9.9, 1.1, 3.3, 21.78, 19.8, 8.58, 0, 8.58, 16.5, 21.78" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className={rating >= 3 ? "star" : ""}
        onClick={() => {
          setRating(3);
          onChange(3);
        }}
      >
        <polygon points="9.9, 1.1, 3.3, 21.78, 19.8, 8.58, 0, 8.58, 16.5, 21.78" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className={rating >= 4 ? "star" : ""}
        onClick={() => {
          setRating(4);
          onChange(4);
        }}
      >
        <polygon points="9.9, 1.1, 3.3, 21.78, 19.8, 8.58, 0, 8.58, 16.5, 21.78" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className={rating >= 5 ? "star" : ""}
        onClick={() => {
          setRating(5);
          onChange(5);
        }}
      >
        <polygon points="9.9, 1.1, 3.3, 21.78, 19.8, 8.58, 0, 8.58, 16.5, 21.78" />
      </svg>
    </MainComponent>
  );
};

export default StarRating;

const MainComponent = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  svg {
    fill: white;
  }

  .star {
    fill: gold;
  }
`;
