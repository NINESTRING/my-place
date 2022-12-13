import { useMutation } from "@apollo/client";
import exifr from "exifr";
import lottie from "lottie-web";
import "mapbox-gl/dist/mapbox-gl.css";
import Image from "next/image";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import ReactMapGL, { MapRef, Marker } from "react-map-gl";
import { useAuth } from "src/auth/useAuth";
import Category from "src/components/category";
import Spinner from "src/components/spiner";
import StarRating from "src/components/starRating";
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [createSignature] = useMutation(SIGNATURE_MUTATION);
  const [updatePlace] = useMutation(UPDATE_PLACE_MUTATION);
  const [createPlace, { loading }] = useMutation(CREATE_PLACE_MUTATION);

  const {
    register,
    handleSubmit,
    setValue,
    control,
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
    if (isLoading) return;

    setIsLoading(true);
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
      <Form onSubmit={handleSubmit(onSubmit)}>
        <ContentWrapper>
          <label>
            <Lottie ref={lottieRef} />
            <ImageInput
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

        <Controller
          control={control}
          name="category"
          defaultValue={4}
          render={({ field: { onChange } }) => (
            <IconContainer>
              <Category onChange={onChange} />
            </IconContainer>
          )}
        />

        <TextInput
          placeholder="설명을 넣어 주세요"
          onChange={(e) => setValue("description", e.target.value)}
          {...(register("description"), { required: true })}
        />

        <Controller
          control={control}
          name="rating"
          defaultValue={3}
          render={({ field: { onChange } }) => (
            <IconContainer>
              <StarRating onChange={onChange} />
            </IconContainer>
          )}
        />

        <Button type="submit">{isLoading ? <Spinner /> : "submit"}</Button>
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
  border-radius: 50%;
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
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background-color: white;
  cursor: pointer;
`;

const TextInput = styled.input`
  width: 300px;
  height: 64px;
  border: 0;
  padding-left: 25px;
  border-radius: 36px;
`;

const IconContainer = styled.div`
  display: block;
  width: 300px;
  height: 100px;
  align-self: center;
  position: relative;
`;

const Button = styled.button`
  align-self: center;
  width: 100px;
  height: 100px;
  border: 0;
  position: relative;

  line-height: 100px;
  text-align: center;
  text-decoration: none;
  color: white;

  background-color: #12a65c;
  border-radius: 50px;
  box-shadow: 0 8px 10px -4px rgba(0, 0, 0, 0.4);

  &:hover {
    background-color: #14bd69;
  }
`;

export default About;
