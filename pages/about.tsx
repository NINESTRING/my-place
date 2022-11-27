import { useMutation } from "@apollo/client";
import exifr from "exifr";
import lottie from "lottie-web";
import "mapbox-gl/dist/mapbox-gl.css";
import Image from "next/image";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import ReactMapGL, { MapRef, Marker } from "react-map-gl";
import { useAuth } from "src/auth/useAuth";
import {
  CREATE_PLACE_MUTATION,
  SIGNATURE_MUTATION,
  UPDATE_PLACE_MUTATION,
} from "src/schema/schema";
import styled from "styled-components";
import photoUpload from "../src/assets/photoUpload.json";

interface IUploadImageResponse {
  secure_url: string;
}

async function uploadImage(
  image: File,
  signature: string,
  timestamp: number
): Promise<IUploadImageResponse> {
  const url = `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/upload`;

  const formData = new FormData();
  formData.append("file", image);
  formData.append("signature", signature);
  formData.append("timestamp", timestamp.toString());
  formData.append("api_key", process.env.NEXT_PUBLIC_CLOUDINARY_KEY ?? "");

  const response = await fetch(url, {
    method: "post",
    body: formData,
  });
  return response.json();
}

interface IFormData {
  description: string;
  image: File;
  rating: number;
  category: number;
}

const About = () => {
  const { user, login } = useAuth();

  const mapRef = useRef<MapRef | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [exifrData, setExifrData] = useState({
    lat: 37.65874,
    lng: 126.97759,
    createDate: new Date(),
  });
  const router = useRouter();
  const [previewImage, setPreviewImage] = useState<string>();
  const [createSignature] = useMutation(SIGNATURE_MUTATION);
  const [updatePlace] = useMutation(UPDATE_PLACE_MUTATION);
  const [createPlace] = useMutation(CREATE_PLACE_MUTATION);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<IFormData>();

  const onImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    if (event?.target?.files?.[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();

      setValue("image", file);

      reader.onloadend = () => {
        exifr.parse(reader.result as string).then((data) => {
          if (data?.latitude && data?.longitude) {
            setExifrData({
              lat: data?.latitude,
              lng: data?.longitude,
              createDate: data?.CreateDate,
            });

            mapRef.current?.panTo(
              { lng: data?.longitude, lat: data?.latitude },
              { duration: 3000 }
            );

            setPreviewImage(reader.result as string);
          } else {
            alert("사진에 정보가 없습니다. 다른 사진을 선택해 주세요");
          }
        });
      };

      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (formData: IFormData) => {
    let image = "";

    const { data: signatureData } = await createSignature();

    if (signatureData) {
      const { signature, timestamp } = signatureData.createImageSignature;
      const imageData = await uploadImage(formData.image, signature, timestamp);
      image = imageData.secure_url;
    }

    const { data: placeData } = await createPlace({
      variables: {
        input: {
          description: formData.description,
          image,
          imageCreationTime: exifrData.createDate,
          coordinates: {
            latitude: exifrData.lat,
            longitude: exifrData.lng,
          },
          rating: Number(formData.rating),
          category: Number(formData.category),
        },
      },
    });

    if (placeData) {
      router.push(`/map/`);
    }
  };

  const lottieRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lottieRef.current) {
      lottie.loadAnimation({
        container: lottieRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        animationData: photoUpload,
      });
    }
  }, []);

  return (
    <Main>
      <h1>This is the "About" page</h1>
      <Form onSubmit={handleSubmit(onSubmit)}>
        {/* <input type="file" {...(register("image"), { required: true })} /> */}
        <ContentWrapper>
          <label>
            <Lottie ref={lottieRef} />
            <ImageInput
              // id="image"
              type="file"
              accept="image/*"
              {...(register("image"), { required: true })}
              onChange={onImageUpload}
              ref={imageInputRef}
            />
          </label>

          {previewImage && (
            <StyledImage
              src={previewImage}
              layout="fill"
              objectFit="cover"
              onClick={() => imageInputRef.current?.click()}
            />
          )}
        </ContentWrapper>
        <ContentWrapper>
          <ReactMapGL
            ref={(instance) => instance && (mapRef.current = instance)}
            initialViewState={{
              longitude: exifrData.lng,
              latitude: exifrData.lat,
              zoom: 10,
            }}
            style={{ borderRadius: "50%", overflow: "hidden" }}
            mapStyle="mapbox://styles/mapbox/streets-v9"
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_TOKEN}
          >
            <Marker
              longitude={exifrData.lng}
              latitude={exifrData.lat}
              color="red"
            />
          </ReactMapGL>
        </ContentWrapper>

        <div>{exifrData.createDate?.toDateString()}</div>

        <RadioWapper>
          <label>
            <input {...register("category")} type="radio" value={1} />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z"
              />
            </svg>
          </label>

          <label>
            <input {...register("category")} type="radio" value={2} />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"
              />
            </svg>
          </label>

          <label>
            <input {...register("category")} type="radio" value={3} />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </label>

          <label>
            <input
              {...register("category")}
              type="radio"
              value={4}
              defaultChecked
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
              />
            </svg>
          </label>
        </RadioWapper>

        <input
          placeholder="설명을 넣어 주세요"
          onChange={(e) => setValue("description", e.target.value)}
          {...(register("description"), { required: true })}
        />
        <RadioWapper>
          <label>
            <input {...register("rating")} type="radio" value={1} />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </label>
          <label>
            <input {...register("rating")} type="radio" value={2} />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </label>
          <label>
            <input
              {...register("rating")}
              type="radio"
              value={3}
              defaultChecked
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </label>
          <label>
            <input {...register("rating")} type="radio" value={4} />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </label>
          <label>
            <input {...register("rating")} type="radio" value={5} />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </label>
        </RadioWapper>

        <button type="submit">Submit</button>
      </Form>
    </Main>
  );
};

const Main = styled.main`
  padding: 100px 1rem 120px;
  display: grid;
  place-content: center;
  text-align: center;
  gap: 1rem;
  color: white;
  background-color: #777;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 0 auto 20px;
  height: 300px;
  width: 300px;
  position: relative;
  cursor: pointer;
`;

const StyledImage = styled(Image)`
  border-radius: 50%;

  &:hover {
    opacity: 0.5;
  }
`;

const ImageInput = styled.input`
  opacity: 0;
`;

const Lottie = styled.div`
  /* width: 100%; */
  /* height: 100%; */
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background-color: white;
  cursor: pointer;
`;

const RadioWapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
`;

export default About;
